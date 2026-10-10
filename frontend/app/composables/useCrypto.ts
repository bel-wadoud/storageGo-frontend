import type { CryptoEngine } from '~/services/crypto/types'
import { createWorkerEngine } from '~/services/crypto/workerEngine'
import { standInsEnabled } from '~/services/dev/testAccount'

// One engine per tab, kept outside Vue state on purpose: nothing about it should ever be
// serialised into the page payload or shown in devtools.
let engine: Promise<CryptoEngine> | null = null

/** The browser features the crypto core needs. Without them we show a dedicated screen. */
export function cryptoSupported(): boolean {
  return (
    import.meta.client &&
    typeof WebAssembly === 'object' &&
    typeof Worker === 'function' &&
    typeof crypto?.getRandomValues === 'function' &&
    window.isSecureContext
  )
}

export function useCrypto(): Promise<CryptoEngine> {
  if (import.meta.server) throw new Error('useCrypto() is browser-only')
  engine ??= (async () => {
    const config = useRuntimeConfig()
    if (standInsEnabled(config.public)) {
      const { createMockEngine } = await import('~/services/dev/mockCrypto')
      return createMockEngine()
    }
    return createWorkerEngine(config.public.cryptoWorkerUrl)
  })()
  return engine
}

/** Wipes the keys from memory, if the engine was ever started in this tab. */
export async function lockCrypto(): Promise<void> {
  if (!engine) return
  try {
    await (await engine).lock()
  } catch {
    // Nothing loaded, nothing to wipe.
  }
}
