// Main-thread side of the crypto worker: { id, op, args } -> { id, ok, value | error }.
// One worker per tab, created on first use, so pages that never touch keys don't load the WASM.
import { CryptoError, type CryptoEngine } from './types'

// Loading the WASM and running the test vectors should take well under a second; past this,
// something is wrong (blocked by the network, a proxy, an extension) and the UI says so.
const READY_TIMEOUT = 20_000

export function createWorkerEngine(workerUrl: string): CryptoEngine {
  let worker: Worker | null = null
  let nextId = 1
  const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: CryptoError) => void }>()

  function failAll(message: string) {
    for (const { reject } of pending.values()) reject(new CryptoError(message))
    pending.clear()
    worker?.terminate()
    worker = null
  }

  function start(): Worker {
    if (worker) return worker
    worker = new Worker(workerUrl, { type: 'module' })
    worker.onmessage = ({ data }: MessageEvent<{ id: number; ok: boolean; value?: unknown; error?: string }>) => {
      const call = pending.get(data.id)
      if (!call) return
      pending.delete(data.id)
      if (data.ok) call.resolve(data.value)
      else call.reject(new CryptoError(data.error ?? 'SG_ERR_UNKNOWN'))
    }
    worker.onerror = (event) => {
      event.preventDefault()
      failAll(`SG_ERR_ENGINE: the encryption engine could not start (${event.message || 'load error'})`)
    }
    return worker
  }

  function call<T>(op: string, ...args: unknown[]): Promise<T> {
    const target = start()
    const id = nextId++
    return new Promise<T>((resolve, reject) => {
      pending.set(id, { resolve: resolve as (value: unknown) => void, reject })
      target.postMessage({ id, op, args })
    })
  }

  // Vault methods return JSON text (the contract format); parse it once here.
  const json = async <T>(op: string, ...args: unknown[]) => JSON.parse(await call<string>(op, ...args)) as T

  let readyPromise: Promise<void> | null = null

  return {
    ready() {
      readyPromise ??= new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          readyPromise = null
          failAll('SG_ERR_ENGINE: the encryption engine took too long to start')
        }, READY_TIMEOUT)
        call<boolean>('ready').then(
          (passed) => {
            clearTimeout(timer)
            if (passed) resolve()
            else reject(new CryptoError('SG_ERR_SELFTEST: the encryption engine failed its self-test'))
          },
          (error) => {
            clearTimeout(timer)
            readyPromise = null
            reject(error)
          },
        )
      })
      return readyPromise
    },
    signup: (email, passphrase) => json('signup', email, passphrase, null),
    identity: () => json('identity'),
    async isUnlocked() {
      try {
        await call('identity')
        return true
      } catch {
        return false
      }
    },
    regenerateKit: () => json('regenerateKit'),
    setupOrgRecovery: (orgId) => json('setupOrgRecovery', orgId),
    lock: () => call('lock'),
  }
}
