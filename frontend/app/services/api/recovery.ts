// Getting back in without the passphrase (key-model-ux.md §4), and joining an organization
// from an invitation. As everywhere, what is secret is made on the device: the recovery kit
// opens the identity keys here, and the server only checks a signature proving it did.
//
// To avoid revealing which emails have accounts, the server answers kit and admin requests
// for unknown addresses with the same shape (a decoy that never opens, a request that never
// gets approved), and limits how often an address can be tried.
import { api } from './client'
import type { PassphraseChange } from './account'
import type { AccountSummary } from './auth'
import type { SignupRequest } from './signup'

export interface KitRecoveryStart {
  recovery_id: string
  /** The identity keys, encrypted with the recovery kit's secret. */
  identity_by_recovery: string
  /** Signed by the opened identity to prove the kit worked (contract/recovery_proof.json). */
  challenge: string
}

/** A finished recovery: signed in (the keys are already open on this device). */
export interface RecoveryDone {
  account: AccountSummary
}

export type AdminRequestStatus = 'pending' | 'waiting_second' | 'approved' | 'denied' | 'expired'

export interface AdminRequestState {
  status: AdminRequestStatus
  expires_at: string
  /** Approvals given so far and needed (organization policy). */
  approvals: number
  required: number
  denied_reason: string | null
  /** Once approved: the identity keys, sealed to this device's recovery key. */
  sealed_identity: string | null
  challenge: string | null
}

export type InviteStatus = 'valid' | 'expired' | 'used' | 'revoked'

export interface InviteInfo {
  status: InviteStatus
  email: string
  role: 'admin' | 'member'
  org_name: string
  inviter: { name: string }
  expires_at: string
  /** Organization recovery is on: the new identity is also sealed to the organization key. */
  org_recovery: boolean
  /** The organization's recovery public key (when org recovery is on). */
  org_recovery_key: string | null
}

const id = (value: string) => encodeURIComponent(value)

export const recoveryApi = {
  /** Starts a recovery with the kit: returns the identity copy the kit can open. */
  startKit: (email: string) => api<KitRecoveryStart>('/recover/kit', { method: 'POST', body: { email } }),
  /** The kit opened the identity: install the new passphrase. Other sessions end. */
  finishKit: (recoveryId: string, proof: string, change: PassphraseChange) =>
    api<RecoveryDone>(`/recover/kit/${id(recoveryId)}`, { method: 'POST', body: { proof, change }, timeout: 30_000 }),

  /** Asks the organization's administrators. The device's public key receives the result. */
  requestAdmin: (email: string, reason: string, devicePublicKey: string) =>
    api<{ request_id: string; expires_at: string }>('/recover/admin', { method: 'POST', body: { email, reason, public_key: devicePublicKey } }),
  adminStatus: (requestId: string) => api<AdminRequestState>(`/recover/admin/${id(requestId)}`),
  finishAdmin: (requestId: string, proof: string, change: PassphraseChange) =>
    api<RecoveryDone>(`/recover/admin/${id(requestId)}/complete`, { method: 'POST', body: { proof, change }, timeout: 30_000 }),

  invite: (token: string) => api<InviteInfo>(`/invites/${id(token)}`),
  /** Creates the member's account from keys made on this device; answers with a session. */
  acceptInvite: (token: string, name: string, account: SignupRequest, idempotencyKey: string) =>
    api<{ account: AccountSummary }>(`/invites/${id(token)}/accept`, { method: 'POST', body: { name, account }, timeout: 30_000, idempotencyKey }),
}
