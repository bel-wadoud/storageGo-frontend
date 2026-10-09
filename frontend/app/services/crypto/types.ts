// What the web app needs from the crypto core (`sgcrypt`, compiled to WASM and run in a Web
// Worker). Keys stay inside the worker; only public data and wrapped keys come out.
// Operation names match the worker's allow-list (see book/reference/sgcrypt-wasm/js).
import type { KeyBundle, LoginRequest, PreloginResponse } from '../api/auth'
import type { OrgRecoverySetup, SignedIdentity, SignupRequest } from '../api/signup'

export interface SignupResult {
  request: SignupRequest
  /** The 24 recovery-kit words, space separated. Shown once, then wiped from memory. */
  recovery_phrase: string
}

export interface RegeneratedKit {
  recovery_phrase: string
  identity_by_recovery: string
}

export interface OrgRecoveryResult {
  setup: OrgRecoverySetup
  /** This admin's own identity keys, sealed to the new org recovery public key. */
  admin_identity_by_org: string
}

export interface DeviceIdentity {
  /** This browser's device public key (base64url). Created once, kept on this device. */
  public_key: string
  /** Two words derived from the public key, compared on the approving device. */
  safety_code: [string, string]
}

export interface CryptoEngine {
  /** Resolves once the WASM is loaded and the official test vectors passed. */
  ready(): Promise<void>
  /** Argon2id + key generation: takes 1–3 s, which is why it runs in a worker. */
  signup(email: string, passphrase: string): Promise<SignupResult>
  /** Sign-in step 1: Argon2id on the passphrase → the auth key to send. The KEK stays inside. */
  loginRequest(email: string, passphrase: string, prelogin: PreloginResponse): Promise<LoginRequest>
  /** Sign-in step 2: opens the key bundle with the KEK from step 1. Returns the user id. */
  unlock(bundle: KeyBundle): Promise<string>
  deviceIdentity(): Promise<DeviceIdentity>
  identity(): Promise<SignedIdentity>
  /** True while the account's keys are unlocked in this tab. */
  isUnlocked(): Promise<boolean>
  regenerateKit(): Promise<RegeneratedKit>
  /** Creates the org recovery key pair, wraps it to this admin and escrows their identity to it. */
  setupOrgRecovery(orgId: string): Promise<OrgRecoveryResult>
  lock(): Promise<void>
}

/** Errors from the core arrive as "SG_ERR_CODE: message"; `code` drives the UI. */
export class CryptoError extends Error {
  readonly code: string

  constructor(text: string) {
    super(text)
    this.name = 'CryptoError'
    this.code = /^(SG_ERR_[A-Z_]+)/.exec(text)?.[1] ?? 'SG_ERR_UNKNOWN'
  }
}
