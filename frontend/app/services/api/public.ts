// Public endpoints of the Go API (/v1) for people without an account: opening a share link
// (/s/{id}) and sending files through a file request (/r/{id}). The keys never come here: a
// link's key is in the URL fragment (#k=…), which browsers don't send to any server.
import { ApiError, api } from './client'
import type { LinkRecord } from './drive'
import { UPLOAD_CHUNK } from './transfer'

/** Who shared it, as they chose to appear: name and organization only, never an email. */
export interface PublicSender {
  name: string
  org_name: string | null
}

/** An item reached through a link. Its key is wrapped by its parent's (or by the link key, for the root). */
export interface PublicItem {
  id: string
  kind: 'file' | 'folder'
  parent_id: string | null
  enc_name: string
  wrapped_key: string
  /** Plaintext size in bytes (for a folder: the sum of what's inside). */
  size: number
  updated_at: string
}

export type LinkStatus = 'active' | 'expired' | 'revoked' | 'exhausted'

export interface PublicLink {
  id: string
  status: LinkStatus
  sender: PublicSender
  created_at: string
  expires_at: string | null
  /** When an expired, revoked or used-up link stopped working. */
  ended_at: string | null
  max_downloads: number | null
  downloads: number
  has_password: boolean
  /** The shared item. Absent once the link stopped working. */
  item: PublicItem | null
  /** The wrapped link key. Absent when a password is required: it comes from `unlock`. */
  record: LinkRecord | null
}

export interface PublicFolder {
  folder: PublicItem
  /** From the shared root down to `folder` (for the breadcrumb). */
  path: PublicItem[]
  items: PublicItem[]
}

export type RequestStatus = 'active' | 'closed' | 'expired'

export interface PublicRequest {
  id: string
  status: RequestStatus
  /** The person who asked for files. */
  requester: PublicSender
  title: string
  created_at: string
  expires_at: string | null
  ended_at: string | null
  /** Largest single file accepted, in bytes. */
  max_file_size: number
}

/** Built by the crypto core (contract/request_upload.json): sealed to the request's public key. */
export interface RequestUploadInit {
  id: string
  request_id: string
  /** The file key, HPKE-sealed to the folder's public key: only the requester can open it. */
  sealed_key: string
  /** Name (and the sender's note) sealed the same way. */
  sealed_meta: string
  plaintext_size: number
  cipher_size: number
  chunk_size: number
}

const id = (value: string) => encodeURIComponent(value)

async function devMock() {
  const config = useRuntimeConfig()
  if (!(import.meta.dev && config.public.devMocks)) return null
  return (await import('../dev/mockDrive')).mockPublicTransfer
}

export const publicApi = {
  link: (linkId: string) => api<PublicLink>(`/s/${id(linkId)}`),
  /**
   * The wrapped key of a password-protected link. Each call counts as one try (the password is
   * checked on this device, so the server limits how often the key can be fetched).
   */
  unlock: (linkId: string) => api<{ record: LinkRecord; attempts_left: number }>(`/s/${id(linkId)}/key`, { method: 'POST' }),
  folder: (linkId: string, folderId: string) => api<PublicFolder>(`/s/${id(linkId)}/folders/${id(folderId)}`),

  /** Downloads a file's ciphertext with progress. Counts as one download of the link. */
  async download(linkId: string, fileId: string, onProgress?: (received: number) => void, signal?: AbortSignal): Promise<Blob> {
    const fake = await devMock()
    if (fake) return fake.download(linkId, fileId, onProgress, signal)
    const { url } = await api<{ url: string }>(`/s/${id(linkId)}/files/${id(fileId)}/content`, { method: 'POST' })
    let response: Response
    try {
      response = await fetch(url, { signal, credentials: 'omit', referrerPolicy: 'no-referrer' })
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') throw error
      throw new ApiError('NETWORK')
    }
    if (!response.ok) throw new ApiError(response.status === 404 ? 'NOT_FOUND' : 'SERVER', response.status)
    if (!response.body) return response.blob()
    const reader = response.body.getReader()
    const parts: Uint8Array[] = []
    let received = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      parts.push(value)
      received += value.byteLength
      onProgress?.(received)
    }
    return new Blob(parts as BlobPart[])
  },

  request: (requestId: string) => api<PublicRequest>(`/r/${id(requestId)}`),

  /** Starts a resumable (tus) upload into a request. Offset, PATCH and cancel then use `requestTransfer`. */
  async startUpload(requestId: string, init: RequestUploadInit): Promise<string> {
    const fake = await devMock()
    if (fake) return fake.create(requestId, init)
    const { apiBase } = useRuntimeConfig().public
    const meta = btoa(JSON.stringify(init))
    let response: Response
    try {
      response = await fetch(`${apiBase}/r/${id(requestId)}/uploads`, {
        method: 'POST',
        credentials: 'omit',
        headers: { 'Tus-Resumable': '1.0.0', 'Upload-Length': String(init.cipher_size), 'Upload-Metadata': `init ${meta}`, 'Idempotency-Key': init.id },
      })
    } catch {
      throw new ApiError('NETWORK')
    }
    if (response.status === 413) throw new ApiError('VALIDATION', 413, undefined, { size: 'too_large' })
    if (response.status === 410) throw new ApiError('GONE', 410)
    if (response.status === 429) throw new ApiError('RATE_LIMITED', 429, Number(response.headers.get('retry-after')) || undefined)
    if (!response.ok) throw new ApiError(response.status >= 500 ? 'SERVER' : 'UNKNOWN', response.status)
    const location = response.headers.get('location')
    if (!location) throw new ApiError('SERVER', response.status)
    return new URL(location, window.location.origin).toString()
  },

  async offset(uploadUrl: string): Promise<number> {
    const fake = await devMock()
    if (fake) return fake.offset(uploadUrl)
    const response = await fetch(uploadUrl, { method: 'HEAD', credentials: 'omit', headers: { 'Tus-Resumable': '1.0.0' } }).catch(() => {
      throw new ApiError('NETWORK')
    })
    if (!response.ok) throw new ApiError(response.status >= 500 ? 'SERVER' : 'NOT_FOUND', response.status)
    return Number(response.headers.get('upload-offset') ?? 0)
  },

  async patch(uploadUrl: string, offset: number, chunk: Blob, signal?: AbortSignal): Promise<number> {
    const fake = await devMock()
    if (fake) return fake.patch(uploadUrl, offset, chunk, signal)
    let response: Response
    try {
      response = await fetch(uploadUrl, {
        method: 'PATCH',
        signal,
        credentials: 'omit',
        headers: { 'Tus-Resumable': '1.0.0', 'Upload-Offset': String(offset), 'Content-Type': 'application/offset+octet-stream' },
        body: chunk,
      })
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') throw error
      throw new ApiError('NETWORK')
    }
    if (response.status === 409) throw new ApiError('CONFLICT', 409)
    if (!response.ok) throw new ApiError(response.status >= 500 ? 'SERVER' : 'UNKNOWN', response.status)
    return Number(response.headers.get('upload-offset') ?? offset + chunk.size)
  },

  async cancelUpload(uploadUrl: string): Promise<void> {
    const fake = await devMock()
    if (fake) return fake.cancel(uploadUrl)
    await fetch(uploadUrl, { method: 'DELETE', credentials: 'omit', headers: { 'Tus-Resumable': '1.0.0' } }).catch(() => undefined)
  },

  /** The last byte is in: the server checks the SGO1 structure and files it in the requester's folder. */
  finishUpload: (requestId: string, fileId: string) =>
    api<{ received_at: string }>(`/r/${id(requestId)}/uploads/${id(fileId)}/finish`, { method: 'POST' }),
}

export { UPLOAD_CHUNK }
