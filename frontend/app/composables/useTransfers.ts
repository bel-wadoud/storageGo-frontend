import { ApiError } from '~/services/api/client'
import { driveApi } from '~/services/api/drive'
import { transfer as transferApi, UPLOAD_CHUNK, type UploadInit } from '~/services/api/transfer'
import { CryptoError } from '~/services/crypto/types'

// Uploads and downloads, shown in the transfer tray. An upload goes
//   queued → preparing → encrypting (on this device) → sending (resumable) → verifying → done
// and a download goes downloading → decrypting (on this device) → done (verified, saved).
// Network drops pause a transfer; it resumes by itself when the connection is back.

export type TransferState =
  | 'queued'
  | 'preparing'
  | 'encrypting'
  | 'sending'
  | 'verifying'
  | 'downloading'
  | 'decrypting'
  | 'done'
  | 'paused'
  | 'failed'
  | 'rejected'
  | 'cancelled'

export type TransferProblem =
  | { code: 'too_large'; limit: number }
  | { code: 'quota'; contact: string | null }
  | { code: 'altered' }
  | { code: 'access' }
  | { code: 'error'; error: unknown }

export interface Transfer {
  id: string
  kind: 'upload' | 'download'
  name: string
  size: number
  parentId: string | null
  /** Upload as a new version of this item ("Replace" on a name conflict). */
  replaceId: string | null
  itemId: string | null
  state: TransferState
  /** Progress of the current phase. */
  done: number
  total: number
  /** Bytes per second while sending/downloading (smoothed). */
  speed: number
  problem: TransferProblem | null
}

export interface ConflictQuestion {
  name: string
  remaining: number
}
export type ConflictChoice = 'keep-both' | 'replace' | 'skip'

const ACTIVE: TransferState[] = ['preparing', 'encrypting', 'sending', 'verifying', 'downloading', 'decrypting']
const MAX_PARALLEL_UPLOADS = 3

// Things that can't live in reactive state: the files, the ciphertext, abort controllers.
const payloads = new Map<string, { file?: Blob; cipher?: Blob; init?: UploadInit; url?: string; controller?: AbortController }>()
let listening = false
let conflictResolver: ((answer: { choice: ConflictChoice; all: boolean }) => void) | null = null

export function useTransfers() {
  const transfers = useState<Transfer[]>('drive:transfers', () => [])
  const conflict = useState<ConflictQuestion | null>('drive:conflict', () => null)
  const trayOpen = useState<boolean>('drive:tray-open', () => true)
  const drive = useDrive()

  const active = computed(() => transfers.value.filter((t) => ACTIVE.includes(t.state) || t.state === 'queued' || t.state === 'paused'))
  const busy = computed(() => active.value.length > 0)

  function update(id: string, change: Partial<Transfer>) {
    transfers.value = transfers.value.map((t) => (t.id === id ? { ...t, ...change } : t))
  }

  function get(id: string) {
    return transfers.value.find((t) => t.id === id)
  }

  if (import.meta.client && !listening) {
    listening = true
    // Back online: everything paused by the drop continues where it stopped.
    window.addEventListener('online', () => {
      for (const t of transfers.value) if (t.state === 'paused') update(t.id, { state: 'queued', problem: null })
      pump()
    })
  }

  // ---- Queueing uploads ----

  /** Asks how to handle a file whose name already exists in the folder (one question at a time). */
  function ask(name: string, remaining: number): Promise<{ choice: ConflictChoice; all: boolean }> {
    conflict.value = { name, remaining }
    return new Promise((resolve) => {
      conflictResolver = (answer) => {
        conflict.value = null
        conflictResolver = null
        resolve(answer)
      }
    })
  }

  function answerConflict(choice: ConflictChoice, all: boolean) {
    conflictResolver?.({ choice, all })
  }

  /** Names taken in a folder (only known for a folder whose listing was loaded). */
  function takenNames(parentId: string): Map<string, string> {
    const taken = new Map<string, string>()
    for (const record of Object.values(drive.records.value)) {
      if (record.parent_id !== parentId || record.trashed_at) continue
      const name = drive.item(record.id)?.name
      if (name) taken.set(name.toLowerCase(), record.id)
    }
    return taken
  }

  /** "Rapport.pdf" → "Rapport (1).pdf", the first that isn't taken. */
  function freeName(name: string, taken: Map<string, string>): string {
    const dot = name.lastIndexOf('.')
    const [base, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, '']
    for (let n = 1; ; n++) {
      const candidate = `${base} (${n})${ext}`
      if (!taken.has(candidate.toLowerCase())) return candidate
    }
  }

  async function upload(files: File[], parentId: string) {
    const taken = takenNames(parentId)
    let remembered: ConflictChoice | null = null
    const clashes = files.filter((f) => taken.has(f.name.toLowerCase())).length
    let asked = 0
    for (const file of files) {
      let name = file.name
      let replaceId: string | null = null
      const existing = taken.get(name.toLowerCase())
      if (existing) {
        asked += 1
        let choice: ConflictChoice | null = remembered
        if (!choice) {
          const answer = await ask(name, clashes - asked)
          choice = answer.choice
          if (answer.all) remembered = choice
        }
        if (choice === 'skip') continue
        if (choice === 'replace') replaceId = existing
        else name = freeName(name, taken)
      }
      taken.set(name.toLowerCase(), 'pending')
      const id = crypto.randomUUID()
      payloads.set(id, { file })
      transfers.value = [
        ...transfers.value,
        { id, kind: 'upload', name, size: file.size, parentId, replaceId, itemId: null, state: 'queued', done: 0, total: file.size, speed: 0, problem: null },
      ]
    }
    trayOpen.value = true
    pump()
  }

  /**
   * Uploads a dropped folder tree, keeping its structure. Folders that already exist at the
   * destination with the same name are reused (merged), like a desktop copy.
   */
  async function uploadTree(entries: { path: string[]; file: File }[], parentId: string) {
    const folders = new Map<string, string>([['', parentId]])
    const engine = await useCrypto()
    const byFolder = new Map<string, File[]>()
    for (const { path, file } of entries) {
      for (let depth = 1; depth <= path.length; depth++) {
        const key = path.slice(0, depth).join('/')
        if (folders.has(key)) continue
        const parent = folders.get(path.slice(0, depth - 1).join('/'))!
        const name = path[depth - 1]!
        const reuse = takenNames(parent).get(name.toLowerCase())
        if (reuse && drive.records.value[reuse]?.kind === 'folder') {
          folders.set(key, reuse)
          continue
        }
        const created = await engine.createFolder(parent, name)
        const record = await driveApi.createFolder(created, crypto.randomUUID())
        drive.setName(record.id, name)
        await drive.absorb([record])
        drive.addToList(`folder:${parent}`, record.id)
        folders.set(key, record.id)
      }
      const key = path.join('/')
      byFolder.set(key, [...(byFolder.get(key) ?? []), file])
    }
    for (const [key, files] of byFolder) await upload(files, folders.get(key)!)
  }

  // ---- Running ----

  function pump() {
    const running = transfers.value.filter((t) => t.kind === 'upload' && ACTIVE.includes(t.state)).length
    const waiting = transfers.value.filter((t) => t.kind === 'upload' && t.state === 'queued')
    for (const t of waiting.slice(0, Math.max(0, MAX_PARALLEL_UPLOADS - running))) runUpload(t.id)
  }

  async function runUpload(id: string) {
    const t = get(id)
    const payload = payloads.get(id)
    if (!t || !payload?.file) return
    const controller = new AbortController()
    payload.controller = controller
    try {
      // Refuse early what the server would refuse anyway.
      const quota = drive.quota.value
      if (quota && t.size > quota.per_file_limit) {
        update(id, { state: 'rejected', problem: { code: 'too_large', limit: quota.per_file_limit } })
        return
      }
      if (quota && quota.used + t.size > quota.limit) {
        update(id, { state: 'rejected', problem: { code: 'quota', contact: quota.contact?.name ?? null } })
        return
      }
      const engine = await useCrypto()
      if (!payload.init) {
        update(id, { state: 'preparing', done: 0, total: 1, problem: null })
        payload.init = await engine.prepareUpload(t.parentId!, t.name, t.size)
      }
      if (!payload.cipher) {
        update(id, { state: 'encrypting', done: 0, total: t.size })
        payload.cipher = await engine.encryptFile(payload.init.id, payload.file, (done, total) => update(id, { done, total }))
      }
      if (controller.signal.aborted) throw new DOMException('cancelled', 'AbortError')

      // Sending: resumable, chunk by chunk, from what the server already has.
      const cipher = payload.cipher
      payload.url ??= await transferApi.create(payload.init, payload.init.id, t.replaceId)
      let offset = await transferApi.offset(payload.url)
      update(id, { state: 'sending', done: offset, total: cipher.size })
      let speed = 0
      while (offset < cipher.size) {
        const started = performance.now()
        const from = offset
        offset = await transferApi.patch(payload.url, offset, cipher.slice(offset, Math.min(offset + UPLOAD_CHUNK, cipher.size)), controller.signal)
        // Bytes the server confirmed per second, smoothed so the estimate doesn't jump around.
        const instant = (offset - from) / Math.max((performance.now() - started) / 1000, 0.001)
        speed = speed ? speed * 0.7 + instant * 0.3 : instant
        update(id, { done: offset, speed })
      }

      update(id, { state: 'verifying', done: 0, total: 1 })
      const record = await transferApi.finish(payload.init.id)
      drive.setName(record.id, t.name)
      await drive.absorb([record])
      if (!t.replaceId) drive.addToList(`folder:${t.parentId}`, record.id)
      drive.verified.value = { ...drive.verified.value, [record.id]: new Date().toISOString() }
      payloads.delete(id)
      update(id, { state: 'done', itemId: record.id, done: 1, total: 1 })
      drive.refreshQuota()
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') {
        if (payload.url) transferApi.cancel(payload.url)
        payloads.delete(id)
        update(id, { state: 'cancelled' })
      } else if (error instanceof ApiError && (error.code === 'NETWORK' || error.code === 'TIMEOUT')) {
        // Kept: the next attempt resumes from the server's offset.
        update(id, { state: navigator.onLine ? 'failed' : 'paused', problem: { code: 'error', error } })
      } else if (error instanceof ApiError && error.data?.reason === 'quota') {
        update(id, { state: 'rejected', problem: { code: 'quota', contact: drive.quota.value?.contact?.name ?? null } })
      } else if (error instanceof ApiError && error.fields?.size === 'too_large') {
        update(id, { state: 'rejected', problem: { code: 'too_large', limit: drive.quota.value?.per_file_limit ?? 0 } })
      } else {
        update(id, { state: 'failed', problem: { code: 'error', error } })
      }
    } finally {
      pump()
    }
  }

  async function download(itemId: string) {
    const item = drive.item(itemId)
    if (!item || item.kind !== 'file') return
    const id = crypto.randomUUID()
    const controller = new AbortController()
    payloads.set(id, { controller })
    transfers.value = [
      ...transfers.value,
      { id, kind: 'download', name: item.name ?? '', size: item.size, parentId: item.parentId, replaceId: null, itemId, state: 'downloading', done: 0, total: item.size, speed: 0, problem: null },
    ]
    trayOpen.value = true
    try {
      const plain = await fetchAndDecrypt(itemId, controller.signal, (state, done, total) => update(id, { state, done, total }))
      save(plain, item.name ?? 'download')
      update(id, { state: 'done', done: 1, total: 1 })
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') update(id, { state: 'cancelled' })
      else update(id, { state: 'failed', problem: problemOf(error) })
    } finally {
      payloads.delete(id)
    }
  }

  /**
   * Downloads and decrypts a file (download tray and preview). Marks it verified when every
   * chunk's tag checked out; an altered file throws and nothing is returned.
   */
  async function fetchAndDecrypt(
    itemId: string,
    signal: AbortSignal,
    onStep: (state: 'downloading' | 'decrypting', done: number, total: number) => void,
  ): Promise<Blob> {
    const item = drive.item(itemId)!
    const cipher = await transferApi.download(itemId, (received) => onStep('downloading', received, item.size), signal)
    const engine = await useCrypto()
    onStep('decrypting', 0, item.size)
    const plain = await engine.decryptFile(itemId, cipher, (done, total) => onStep('decrypting', done, total))
    drive.verified.value = { ...drive.verified.value, [itemId]: new Date().toISOString() }
    return plain
  }

  function save(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = name
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  function problemOf(error: unknown): TransferProblem {
    if (error instanceof CryptoError && error.code === 'SG_ERR_AUTH') return { code: 'altered' }
    if (error instanceof ApiError && (error.code === 'NOT_FOUND' || error.code === 'FORBIDDEN')) return { code: 'access' }
    return { code: 'error', error }
  }

  function cancel(id: string) {
    const t = get(id)
    if (!t) return
    if (t.state === 'queued' || t.state === 'paused' || t.state === 'failed') {
      const payload = payloads.get(id)
      if (payload?.url) transferApi.cancel(payload.url)
      payloads.delete(id)
      update(id, { state: 'cancelled' })
      return
    }
    payloads.get(id)?.controller?.abort()
  }

  function retry(id: string) {
    const t = get(id)
    if (!t) return
    if (t.kind === 'download') {
      remove(id)
      if (t.itemId) download(t.itemId)
      return
    }
    update(id, { state: 'queued', problem: null })
    pump()
  }

  function remove(id: string) {
    transfers.value = transfers.value.filter((t) => t.id !== id)
  }

  /** Clears finished, cancelled and rejected rows (the tray's "Clear"). */
  function clearFinished() {
    transfers.value = transfers.value.filter((t) => !['done', 'cancelled', 'rejected'].includes(t.state))
  }

  return {
    transfers,
    active,
    busy,
    conflict,
    trayOpen,
    upload,
    uploadTree,
    download,
    fetchAndDecrypt,
    save,
    problemOf,
    answerConflict,
    cancel,
    retry,
    remove,
    clearFinished,
  }
}
