// Moving encrypted bytes. Uploads use the tus protocol (resumable: after a drop, the upload
// continues from the last byte the server confirmed). Downloads go straight to storage with a
// short-lived URL. Everything here is ciphertext: encryption happens before, decryption after.
import { ApiError, api } from './client'
import type { ItemRecord } from './drive'

/** Built by the crypto core (contract/upload_init.json). */
export interface UploadInit {
  id: string
  parent_id: string
  enc_name: string
  wrapped_key: string
  plaintext_size: number
  cipher_size: number
  chunk_size: number
}

/** 5 MiB per PATCH: small enough to resume cheaply, big enough to keep the line busy. */
export const UPLOAD_CHUNK = 5 * 1024 * 1024

const TUS = { 'Tus-Resumable': '1.0.0' }

async function mock() {
  const config = useRuntimeConfig()
  if (!(import.meta.dev && config.public.devMocks)) return null
  return (await import('../dev/mockDrive')).mockTransfer
}

function base64(text: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(text)))
}

function failure(status: number, retryAfter?: string | null): ApiError {
  if (!status) return new ApiError('NETWORK')
  if (status === 413) return new ApiError('VALIDATION', status, undefined, { size: 'too_large' })
  if (status === 507) return new ApiError('CONFLICT', status, undefined, undefined, { reason: 'quota' })
  if (status === 429) return new ApiError('RATE_LIMITED', status, Number(retryAfter) || undefined)
  if (status === 401) return new ApiError('UNAUTHORIZED', status)
  return new ApiError(status >= 500 ? 'SERVER' : 'UNKNOWN', status)
}

async function send(url: string, init: RequestInit): Promise<Response> {
  let response: Response
  try {
    response = await fetch(url, { credentials: 'include', ...init })
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') throw error
    throw new ApiError('NETWORK')
  }
  if (!response.ok) throw failure(response.status, response.headers.get('retry-after'))
  return response
}

export const transfer = {
  /**
   * Starts an upload; the metadata is the crypto core's UploadInit (encrypted name, wrapped key).
   * `replaces`: store it as a new version of that item instead of a new file.
   */
  async create(init: UploadInit, idempotencyKey: string, replaces: string | null = null): Promise<string> {
    const fake = await mock()
    if (fake) return fake.create(init, replaces)
    const { apiBase } = useRuntimeConfig().public
    const response = await send(`${apiBase}/uploads`, {
      method: 'POST',
      headers: {
        ...TUS,
        'Upload-Length': String(init.cipher_size),
        'Upload-Metadata': [`init ${base64(JSON.stringify(init))}`, ...(replaces ? [`replaces ${base64(replaces)}`] : [])].join(','),
        'Idempotency-Key': idempotencyKey,
      },
    })
    const location = response.headers.get('location')
    if (!location) throw new ApiError('SERVER', response.status)
    return new URL(location, window.location.origin).toString()
  },

  /** How many bytes the server already has (to resume after a drop or a reload). */
  async offset(uploadUrl: string): Promise<number> {
    const fake = await mock()
    if (fake) return fake.offset(uploadUrl)
    const response = await send(uploadUrl, { method: 'HEAD', headers: TUS })
    return Number(response.headers.get('upload-offset') ?? 0)
  },

  async patch(uploadUrl: string, offset: number, chunk: Blob, signal?: AbortSignal): Promise<number> {
    const fake = await mock()
    if (fake) return fake.patch(uploadUrl, offset, chunk, signal)
    const response = await send(uploadUrl, {
      method: 'PATCH',
      signal,
      headers: { ...TUS, 'Upload-Offset': String(offset), 'Content-Type': 'application/offset+octet-stream' },
      body: chunk,
    })
    return Number(response.headers.get('upload-offset') ?? offset + chunk.size)
  },

  async cancel(uploadUrl: string): Promise<void> {
    const fake = await mock()
    if (fake) return fake.cancel(uploadUrl)
    await send(uploadUrl, { method: 'DELETE', headers: TUS }).catch(() => undefined)
  },

  /** The stored item, once the last byte is in and the server checked the SGO1 structure. */
  finish: (fileId: string) => api<ItemRecord>(`/uploads/${encodeURIComponent(fileId)}/finish`, { method: 'POST' }),

  /** Downloads a file's ciphertext with progress (bytes received so far). */
  async download(fileId: string, onProgress?: (received: number) => void, signal?: AbortSignal): Promise<Blob> {
    const fake = await mock()
    if (fake) return fake.download(fileId, onProgress, signal)
    const { url } = await api<{ url: string; expires_in: number }>(`/files/${encodeURIComponent(fileId)}/content`)
    const response = await send(url, { signal, credentials: 'omit' })
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
}
