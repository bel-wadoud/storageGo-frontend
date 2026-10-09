// Signup endpoints of the Go API (/v1). Shapes follow the JSON contract of the crypto core
// (book/reference/contract/*.json): everything secret is created and wrapped in the browser;
// the server only ever receives public keys, wrapped keys and the auth key.
import { api } from './client'

export type AccountKind = 'individual' | 'org'
export type OrgSector = 'health' | 'legal' | 'finance' | 'public' | 'education' | 'other'
export type InviteRole = 'member' | 'admin'

export interface KdfParams {
  m_kib: number
  t: number
  p: number
}

export interface SignedIdentity {
  user_id: string
  x25519: string
  ed25519: string
  signature: string
}

/** Built by the crypto core (`Vault.signup`). Field names match contract/signup_request.json. */
export interface SignupRequest {
  user_id: string
  email: string
  kdf: KdfParams
  salt: string
  auth_key: string
  identity: SignedIdentity
  identity_by_kek: string
  identity_by_recovery: string
  identity_by_org?: string | null
  root_folder_id: string
  root_folder_key: string
}

/** Built by the crypto core. Matches contract/org_recovery_setup.json. */
export interface OrgRecoverySetup {
  public_key: string
  threshold: number
  shares: { admin_id: string; sealed: string }[]
}

export interface StartSignupBody {
  kind: AccountKind
  name: string
  email: string
  locale: string
  org?: { name: string; sector: OrgSector }
}

export interface StartSignupResponse {
  signup_id: string
  /** Seconds before another code can be requested. */
  resend_after: number
}

export interface InviteResult {
  sent: string[]
  skipped: { email: string; reason: 'already_member' | 'already_invited' | 'invalid' }[]
}

export const signupApi = {
  /**
   * Sends a 6-digit code to the email. The answer is the same whether or not the address
   * already has an account (the email itself says so), so this can't be used to probe accounts.
   */
  start: (body: StartSignupBody) => api<StartSignupResponse>('/signup', { method: 'POST', body }),

  resendCode: (signupId: string) =>
    api<{ resend_after: number }>(`/signup/${encodeURIComponent(signupId)}/code`, { method: 'POST' }),

  verifyEmail: (signupId: string, code: string) =>
    api<{ signup_token: string }>(`/signup/${encodeURIComponent(signupId)}/verify`, { method: 'POST', body: { code } }),

  /** Creates the account from the keys built on this device. The server answers with a session cookie. */
  complete: (signupToken: string, account: SignupRequest, idempotencyKey: string) =>
    api<{ user_id: string; org_id?: string }>('/signup/complete', {
      method: 'POST',
      body: { signup_token: signupToken, account },
      timeout: 30_000,
      idempotencyKey,
    }),

  /** Replaces the recovery-kit copy of the identity keys (after a new kit was made on resume). */
  replaceRecoveryKit: (identityByRecovery: string) =>
    api<void>('/account/recovery-kit', { method: 'PUT', body: { identity_by_recovery: identityByRecovery } }),

  /** The user proved they saved the kit; the drive stays closed until this is recorded. */
  confirmKitVerified: () => api<void>('/account/recovery-kit/verified', { method: 'POST' }),

  /**
   * `require_two_admins` is the quorum policy. With one admin the key is wrapped to that admin
   * alone; once a second admin joins, their client re-splits it 2-of-n.
   */
  setupOrgRecovery: (
    setup: OrgRecoverySetup,
    adminIdentityByOrg: string,
    requireTwoAdmins: boolean,
    idempotencyKey: string,
  ) =>
    api<void>('/org/recovery', {
      method: 'POST',
      body: { setup, admin_identity_by_org: adminIdentityByOrg, require_two_admins: requireTwoAdmins },
      idempotencyKey,
    }),

  invite: (invites: { email: string; role: InviteRole }[]) =>
    api<InviteResult>('/org/invites', { method: 'POST', body: { invites } }),
}
