// One way to talk to the Go API. Every call gets:
//  - a timeout, so nothing hangs forever on a bad connection
//  - an Idempotency-Key on writes, so a retried request is never applied twice
//  - errors turned into a stable `ApiError.code` the UI maps to a message or a screen
import type { FetchError } from 'ofetch'
import { standInsEnabled, testAccountOnly } from '../dev/testAccount'

export type ApiErrorCode =
  | 'NETWORK' // no connection, DNS, connection reset
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'GONE' // a share link or file request that stopped working (expired, revoked, used up)
  | 'CONFLICT'
  | 'VALIDATION'
  | 'INVALID_CREDENTIALS' // email or passphrase doesn't match (same answer for unknown emails)
  | 'CODE_INVALID'
  | 'CODE_EXPIRED'
  | 'SIGNUP_EXPIRED'
  | 'SERVER'
  | 'UNKNOWN'

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    readonly status = 0,
    /** Seconds to wait before trying again (from Retry-After or the error body). */
    readonly retryAfter?: number,
    /** Field-level problems for VALIDATION errors: { email: 'invalid' }. */
    readonly fields?: Record<string, string>,
    /** Extra facts for the UI, e.g. { attempts_left: 2 } on INVALID_CREDENTIALS. */
    readonly data?: Record<string, unknown>,
  ) {
    super(code)
    this.name = 'ApiError'
  }
}

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: Record<string, string | number | undefined>
  /** Milliseconds. Defaults to 15 s; key uploads and exports pass more. */
  timeout?: number
  signal?: AbortSignal
  /** Reuse the same key when the user retries the same logical action (e.g. "Try again"). */
  idempotencyKey?: string
}

const STATUS_CODES: Record<number, ApiErrorCode> = {
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  410: 'GONE',
  422: 'VALIDATION',
  429: 'RATE_LIMITED',
}

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  const fetchError = error as FetchError<{
    code?: string
    retry_after?: number
    fields?: Record<string, string>
    data?: Record<string, unknown>
  }>
  const status = fetchError?.response?.status ?? 0
  if (!status) {
    const timedOut = fetchError?.name === 'TimeoutError' || /timeout|aborted/i.test(String(fetchError?.message))
    return new ApiError(timedOut ? 'TIMEOUT' : 'NETWORK')
  }
  const body = fetchError.data
  const header = Number(fetchError.response?.headers.get('retry-after'))
  const retryAfter = body?.retry_after ?? (Number.isFinite(header) && header > 0 ? header : undefined)
  const code = (body?.code as ApiErrorCode | undefined) ?? STATUS_CODES[status] ?? (status >= 500 ? 'SERVER' : 'UNKNOWN')
  return new ApiError(code, status, retryAfter, body?.fields, body?.data)
}

// Called when a request outside sign-in answers 401: the app layout sends the user to sign in
// again, keeping where they were.
let unauthorizedHandler: (() => void) | null = null
export function onUnauthorized(handler: (() => void) | null) {
  unauthorizedHandler = handler
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  try {
    return await request<T>(path, options)
  } catch (error) {
    const failure = toApiError(error)
    if (failure.code === 'UNAUTHORIZED' && !path.startsWith('/auth/')) unauthorizedHandler?.()
    throw failure
  }
}

async function request<T>(path: string, options: ApiOptions): Promise<T> {
  const config = useRuntimeConfig()
  const method = options.method ?? 'GET'

  if (standInsEnabled(config.public)) {
    const { mockApi } = await import('../dev/mockApi')
    return mockApi<T>(path, method, options.body, options.query, testAccountOnly(config.public))
  }

  // (Typed as T: these are the Go API's routes, not this app's own server routes.)
  return (await $fetch<T>(path, {
    baseURL: config.public.apiBase,
    method,
    body: options.body as Record<string, unknown> | undefined,
    query: options.query,
    timeout: options.timeout ?? 15_000,
    signal: options.signal,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      // Writes can be retried safely: the server applies one Idempotency-Key only once.
      ...(method === 'GET' ? {} : { 'Idempotency-Key': options.idempotencyKey ?? crypto.randomUUID() }),
    },
    // Reads retry on flaky networks; writes don't retry blindly.
    retry: method === 'GET' ? 2 : 0,
    retryDelay: 600,
  })) as T
}
