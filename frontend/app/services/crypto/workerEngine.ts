// Main-thread side of the crypto worker: { id, op, args } -> { id, ok, value | error }.
// One worker per tab, created on first use, so pages that never touch keys don't load the WASM.
import { CryptoError, type CryptoEngine, type Progress } from './types'

// Loading the WASM and running the test vectors should take well under a second; past this,
// something is wrong (blocked by the network, a proxy, an extension) and the UI says so.
const READY_TIMEOUT = 20_000

export function createWorkerEngine(workerUrl: string): CryptoEngine {
  let worker: Worker | null = null
  let nextId = 1
  const pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: CryptoError) => void; progress?: Progress }
  >()

  function failAll(message: string) {
    for (const { reject } of pending.values()) reject(new CryptoError(message))
    pending.clear()
    worker?.terminate()
    worker = null
  }

  function start(): Worker {
    if (worker) return worker
    worker = new Worker(workerUrl, { type: 'module' })
    worker.onmessage = ({
      data,
    }: MessageEvent<{ id: number; ok?: boolean; value?: unknown; error?: string; progress?: [number, number] }>) => {
      const call = pending.get(data.id)
      if (!call) return
      // Long operations (file encryption) report progress before their result.
      if (data.progress) {
        call.progress?.(data.progress[0], data.progress[1])
        return
      }
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

  function callWithProgress<T>(op: string, progress: Progress | undefined, ...args: unknown[]): Promise<T> {
    const target = start()
    const id = nextId++
    return new Promise<T>((resolve, reject) => {
      pending.set(id, { resolve: resolve as (value: unknown) => void, reject, progress })
      target.postMessage({ id, op, args })
    })
  }

  const call = <T>(op: string, ...args: unknown[]) => callWithProgress<T>(op, undefined, ...args)

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
    loginRequest: (email, passphrase, prelogin) => json('loginRequest', email, passphrase, JSON.stringify(prelogin)),
    unlock: (bundle) => call<string>('unlock', JSON.stringify(bundle)),
    deviceIdentity: () => json('deviceIdentity'),
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
    openItems: (records) => json('openItems', JSON.stringify(records)),
    createFolder: (parentId, name) => json('createFolder', parentId, name),
    renameItem: (itemId, name) => json('renameItem', itemId, name),
    prepareUpload: (parentId, name, size) => json('prepareUpload', parentId, name, size),
    encryptFile: async (fileId, file, onProgress) =>
      (await callWithProgress<{ size: number; blob: Blob }>('encryptFile', onProgress, fileId, file)).blob,
    decryptFile: (fileId, object, onProgress) => callWithProgress<Blob>('decryptFile', onProgress, fileId, object),
    rewrapForMove: (itemId, isFolder, newParentId) => call<string>('rewrapForMove', itemId, isFolder, newParentId),
    shareItem: (itemId, recipient, role, previouslySeen) =>
      json('shareItem', itemId, JSON.stringify(recipient), role, previouslySeen ? JSON.stringify(previouslySeen) : null),
    createLink: (itemId, linkId, password) => json('createLink', itemId, linkId, password),
    createFileRequest: (folderId) => json('createFileRequest', folderId),
    forget: (itemId) => call('forget', itemId),
  }
}
