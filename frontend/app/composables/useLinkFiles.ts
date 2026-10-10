import { ApiError } from '~/services/api/client'
import { publicApi } from '~/services/api/public'
import { CryptoError } from '~/services/crypto/types'

// Files opened through a share link: downloaded as ciphertext, decrypted and checked on this
// device (states.md, "Share link (recipient)"): downloading → decrypting → done (verified).
// An altered file is refused, never "opened anyway". A decrypted file is kept for the visit,
// so previewing then saving it doesn't use up a second download of a limited link.

export interface LinkFile {
  id: string
  name: string
  size: number
}

export type LinkFilePhase = 'idle' | 'downloading' | 'decrypting' | 'done' | 'altered' | 'failed'

export interface LinkFileState {
  phase: LinkFilePhase
  done: number
  total: number
  error: unknown
  /** Saved to the device during this visit. */
  saved: boolean
}

/** Decrypted files above this size aren't kept in memory after saving. */
const KEEP_LIMIT = 300_000_000

export function useLinkFiles(linkId: () => string, options: { onGone: () => void }) {
  const states = ref<Record<string, LinkFileState>>({})
  const kept = new Map<string, Blob>()
  const running = new Map<string, Promise<Blob>>()

  const stateOf = (id: string): LinkFileState => states.value[id] ?? { phase: 'idle', done: 0, total: 0, error: null, saved: false }

  function update(id: string, change: Partial<LinkFileState>) {
    states.value = { ...states.value, [id]: { ...stateOf(id), ...change } }
  }

  /** The decrypted file (from memory when it was opened before). Throws on failure. */
  function open(file: LinkFile, signal?: AbortSignal): Promise<Blob> {
    const ready = kept.get(file.id)
    if (ready) return Promise.resolve(ready)
    const pending = running.get(file.id)
    if (pending) return pending
    const work = (async () => {
      update(file.id, { phase: 'downloading', done: 0, total: file.size, error: null })
      try {
        const cipher = await publicApi.download(linkId(), file.id, (received) => update(file.id, { done: Math.min(received, file.size) }), signal)
        update(file.id, { phase: 'decrypting', done: 0, total: file.size })
        const engine = await useCrypto()
        const plain = await engine.decryptFile(file.id, cipher, (done, total) => update(file.id, { done, total }))
        if (plain.size <= KEEP_LIMIT) kept.set(file.id, plain)
        update(file.id, { phase: 'done', done: file.size, total: file.size })
        return plain
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') {
          update(file.id, { phase: 'idle', done: 0, total: 0 })
        } else if (error instanceof CryptoError && error.code === 'SG_ERR_AUTH') {
          update(file.id, { phase: 'altered', error })
        } else {
          update(file.id, { phase: 'failed', error })
          // The link stopped working meanwhile (expired, revoked, download limit reached).
          if (error instanceof ApiError && error.code === 'GONE') options.onGone()
        }
        throw error
      } finally {
        running.delete(file.id)
      }
    })()
    running.set(file.id, work)
    return work
  }

  /** Decrypts (if needed) and saves the file to the device. */
  async function save(file: LinkFile): Promise<boolean> {
    try {
      const blob = await open(file)
      const url = URL.createObjectURL(new Blob([blob], { type: mimeFor(file.name) }))
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = file.name
      anchor.rel = 'noopener'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
      update(file.id, { saved: true })
      return true
    } catch {
      return false
    }
  }

  return { states, stateOf, open, save }
}
