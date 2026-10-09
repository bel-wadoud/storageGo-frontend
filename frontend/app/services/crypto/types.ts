// What the web app needs from the crypto core (`sgcrypt`, compiled to WASM and run in a Web
// Worker). Keys stay inside the worker; only public data and wrapped keys come out.
// Operation names match the worker's allow-list (see book/reference/sgcrypt-wasm/js).
import type { KeyBundle, LoginRequest, PreloginResponse } from '../api/auth'
import type { FileRequestRecord, ItemRecord, LinkRecord, NewFolder, ShareGrant, ShareRole } from '../api/drive'
import type { UploadInit } from '../api/transfer'
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

/** A name opened on this device, or why it couldn't be (e.g. SG_ERR_AUTH: altered). */
export type OpenedName = { id: string; name: string } | { id: string; error: string }

export type Progress = (done: number, total: number) => void

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

  // ---- Drive ----
  /**
   * Opens item keys and names. Each record's key is wrapped by its parent (opened earlier, or
   * through `record.path`) or sealed to me (`sealed_key`, shares). Keys stay in the worker.
   * Returns a name (or an error) for every record and for every ancestor in their paths.
   */
  openItems(records: ItemRecord[]): Promise<OpenedName[]>
  createFolder(parentId: string, name: string): Promise<NewFolder>
  /** A new encrypted name for an item whose key is open. */
  renameItem(itemId: string, name: string): Promise<{ enc_name: string }>
  prepareUpload(parentId: string, name: string, size: number): Promise<UploadInit>
  /** SGO1 ciphertext of a prepared upload, chunk by chunk, with progress. */
  encryptFile(fileId: string, file: Blob, onProgress?: Progress): Promise<Blob>
  /** Plaintext of a downloaded object. Throws SG_ERR_AUTH if any chunk was altered. */
  decryptFile(fileId: string, object: Blob, onProgress?: Progress): Promise<Blob>
  /** The item key wrapped for its new parent (base64url). */
  rewrapForMove(itemId: string, isFolder: boolean, newParentId: string): Promise<string>
  /** Throws SG_ERR_KEY_CHANGED when `previouslySeen` differs from `recipient`. */
  shareItem(itemId: string, recipient: SignedIdentity, role: ShareRole, previouslySeen: SignedIdentity | null): Promise<ShareGrant>
  /** The link key goes in the URL fragment (`k=…`), never to the server. */
  createLink(itemId: string, linkId: string, password: string | null): Promise<{ fragment: string; record: LinkRecord }>
  createFileRequest(folderId: string): Promise<FileRequestRecord>
  /** Drops an item key from memory (e.g. after deleting it). */
  forget(itemId: string): Promise<void>
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
