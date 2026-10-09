// Sign-in endpoints of the Go API (/v1). The passphrase never leaves the browser: the crypto
// core derives an auth key from it (contract/login_request.json) and that is what is sent.
// The server answers with the wrapped key bundle, which only this device can open.
import { api } from './client'
import type { AccountKind, KdfParams, SignedIdentity } from './signup'

/** Same shape for unknown emails, so this can't be used to find out who has an account. */
export interface PreloginResponse {
  kdf: KdfParams
  salt: string
}

/** Built by the crypto core (`Vault.loginRequest`). */
export interface LoginRequest {
  email: string
  auth_key: string
}

/** The account's wrapped keys (contract/key_bundle.json). */
export interface KeyBundle {
  user_id: string
  identity: SignedIdentity
  identity_by_kek: string
  identity_by_recovery: string
  identity_by_org?: string | null
  root_folder_id: string
  root_folder_key: string
}

export interface AccountSummary {
  user_id: string
  email: string
  name: string
  kind: AccountKind
  org_id?: string | null
  org_name?: string | null
  /** False until the recovery kit was confirmed; the drive stays closed until then. */
  kit_verified: boolean
}

export interface DeviceInfo {
  public_key: string
  /** Shown to the user's other devices, e.g. "Chrome on Windows". */
  name: string
}

export type LoginResult =
  | { status: 'ok'; bundle: KeyBundle; account: AccountSummary }
  | {
      status: 'device_approval'
      device_id: string
      /** Seconds before the request expires (10 minutes by default). */
      expires_in: number
      account_kind: AccountKind
    }

export type DeviceStatus =
  | { status: 'pending' }
  | { status: 'approved'; bundle: KeyBundle; account: AccountSummary }
  | { status: 'denied' }
  | { status: 'expired' }

export interface SessionInfo {
  account: AccountSummary
  prelogin: PreloginResponse
}

export const authApi = {
  prelogin: (email: string) => api<PreloginResponse>('/auth/prelogin', { method: 'POST', body: { email } }),

  login: (request: LoginRequest, device: DeviceInfo) =>
    api<LoginResult>('/auth/login', { method: 'POST', body: { ...request, device }, timeout: 20_000 }),

  /** The current session, if any (401 otherwise). Used to unlock without typing the email again. */
  session: () => api<SessionInfo>('/auth/session'),

  /** Session still valid but keys locked on this device: prove the passphrase again. */
  unlock: (authKey: string) =>
    api<{ bundle: KeyBundle; account: AccountSummary }>('/auth/unlock', { method: 'POST', body: { auth_key: authKey } }),

  deviceStatus: (deviceId: string) => api<DeviceStatus>(`/auth/devices/${encodeURIComponent(deviceId)}/status`),

  /** A new 10-minute window for an expired approval request. */
  renewDevice: (deviceId: string) =>
    api<{ expires_in: number }>(`/auth/devices/${encodeURIComponent(deviceId)}/renew`, { method: 'POST' }),

  /** Org accounts: ask the administrators to approve this device instead. */
  askAdmin: (deviceId: string) => api<void>(`/auth/devices/${encodeURIComponent(deviceId)}/admin-request`, { method: 'POST' }),

  logout: () => api<void>('/auth/logout', { method: 'POST' }),
}
