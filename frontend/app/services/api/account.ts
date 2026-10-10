// Account settings endpoints of the Go API (/v1): profile, passphrase, recovery kit, devices,
// sessions, notification preferences and the individual plan. As everywhere, anything secret
// is made on the device: a passphrase change sends a new auth key and newly wrapped keys,
// never a passphrase.
import { api } from './client'
import type { AccountSummary } from './auth'
import type { KdfParams } from './signup'

export interface AccountDetails extends AccountSummary {
  /** In an organization: the user's role. */
  role: 'admin' | 'member' | null
  locale: 'en' | 'fr' | 'ar'
  created_at: string
  /** Last time the user confirmed they still have their recovery kit (or made it). */
  kit_confirmed_at: string | null
  /** Whether the organization can restore the user's access (org recovery is on). */
  org_recovery: boolean
}

/** Built by the crypto core (contract/passphrase_change.json). */
export interface PassphraseChange {
  kdf: KdfParams
  salt: string
  auth_key: string
  identity_by_kek: string
}

export interface Device {
  id: string
  /** "Chrome on Windows". */
  name: string
  /** City and wilaya from the network, approximate ("Sétif"). */
  location: string | null
  status: 'trusted' | 'pending'
  /** This browser. */
  current: boolean
  /** The device's public key, to show the 2-word safety code of a pending request. */
  public_key: string
  created_at: string
  last_active_at: string
}

export interface Session {
  id: string
  /** "Firefox on Android". */
  name: string
  location: string | null
  current: boolean
  created_at: string
  last_active_at: string
}

export type NotificationPrefs = Record<'shares' | 'requests' | 'storage' | 'recovery' | 'security', boolean>

export interface Plan {
  id: string
  name: string
  /** Bytes. */
  storage: number
  /** Monthly price in Algerian dinars. */
  price: number
}

export interface Billing {
  plan: Plan
  plans: Plan[]
  renews_at: string | null
  /** CIB or Edahabia card, only the last digits are known. */
  payment_method: { kind: 'cib' | 'edahabia'; last4: string } | null
}

export interface Invoice {
  id: string
  date: string
  amount: number
  status: 'paid' | 'due'
  /** PDF of the invoice (a short-lived download URL). */
  url: string
}

const id = (value: string) => encodeURIComponent(value)

export const accountApi = {
  get: () => api<AccountDetails>('/account'),
  update: (change: { name?: string; locale?: string }) => api<AccountDetails>('/account', { method: 'PATCH', body: change }),

  /** Sends a code to the new address; the change applies once it's confirmed. */
  startEmailChange: (email: string) =>
    api<{ change_id: string; resend_after: number }>('/account/email', { method: 'POST', body: { email } }),
  resendEmailCode: (changeId: string) =>
    api<{ resend_after: number }>(`/account/email/${id(changeId)}/code`, { method: 'POST' }),
  confirmEmailChange: (changeId: string, code: string) =>
    api<AccountDetails>(`/account/email/${id(changeId)}/verify`, { method: 'POST', body: { code } }),

  /** Proves the current passphrase (its auth key) and installs the new one. Other sessions end. */
  changePassphrase: (currentAuthKey: string, change: PassphraseChange) =>
    api<void>('/account/passphrase', { method: 'POST', body: { current_auth_key: currentAuthKey, change }, timeout: 30_000 }),

  /** A new kit replaces the old one, which stops working. Requires the passphrase (auth key). */
  regenerateKit: (currentAuthKey: string, identityByRecovery: string) =>
    api<void>('/account/recovery-kit/regenerate', {
      method: 'POST',
      body: { current_auth_key: currentAuthKey, identity_by_recovery: identityByRecovery },
    }),
  /** "Yes, I still have it" (the periodic reminder) or a regenerated kit that was checked. */
  confirmKit: () => api<{ kit_confirmed_at: string }>('/account/recovery-kit/confirmed', { method: 'POST' }),

  devices: () => api<Device[]>('/devices'),
  approveDevice: (deviceId: string, signature: string) =>
    api<void>(`/devices/${id(deviceId)}/approve`, { method: 'POST', body: { signature } }),
  denyDevice: (deviceId: string) => api<void>(`/devices/${id(deviceId)}/deny`, { method: 'POST' }),
  revokeDevice: (deviceId: string) => api<void>(`/devices/${id(deviceId)}`, { method: 'DELETE' }),

  sessions: () => api<Session[]>('/account/sessions'),
  endSession: (sessionId: string) => api<void>(`/account/sessions/${id(sessionId)}`, { method: 'DELETE' }),
  endOtherSessions: () => api<{ ended: number }>('/account/sessions/others', { method: 'DELETE' }),

  notificationPrefs: () => api<NotificationPrefs>('/account/notifications'),
  setNotificationPref: (key: keyof NotificationPrefs, on: boolean) =>
    api<NotificationPrefs>('/account/notifications', { method: 'PATCH', body: { [key]: on } }),

  billing: () => api<Billing>('/billing'),
  /** Switches plan. A paid change may return a checkout page (SATIM / CIB, Edahabia). */
  changePlan: (planId: string) => api<{ checkout_url: string | null; billing: Billing }>('/billing/plan', { method: 'POST', body: { plan_id: planId } }),
  invoices: () => api<Invoice[]>('/billing/invoices'),
  /** The card is entered on the bank's page (SATIM / CIB, Edahabia); this returns where to go. */
  updateCard: () => api<{ checkout_url: string }>('/billing/payment-method', { method: 'POST' }),
}
