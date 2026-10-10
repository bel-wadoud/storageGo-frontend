// DEV ONLY. A stand-in for the crypto worker so screens can be built before the WASM core
// exists. It produces random placeholders, not keys, and is never part of a production build:
// it is only imported behind `import.meta.dev && devMocks`.
import { CryptoError, type CryptoEngine, type OpenedName, type Progress } from '../crypto/types'
import { alteredIds, decodeName, encodeName } from './mockDrive'

const WORDS =
  'anchor basket cactus dolphin eagle fabric garden harbor island jacket kettle ladder magnet napkin orbit pepper quarry ribbon saddle tablet umbrella velvet walnut yogurt zebra almond bridge candle desert engine forest glacier'.split(
    ' ',
  )

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function b64url(bytes: number): string {
  const data = crypto.getRandomValues(new Uint8Array(bytes))
  return btoa(String.fromCharCode(...data)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function phrase(): string {
  const picks = crypto.getRandomValues(new Uint8Array(24))
  return Array.from(picks, (n) => WORDS[n % WORDS.length]).join(' ')
}

/** Stands in for the auth key: lets the mock API recognise the "wrong passphrase" test value. */
function fakeAuthKey(passphrase: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(passphrase)))
}

/** A link or request key in the fragment: `k=` and 32 bytes in base64url (43 characters). */
const FRAGMENT = /^k=[A-Za-z0-9_-]{43}$/

/** The mock "wraps" a link key with its password so the password can be checked again. */
function linkWrap(password: string | null): string {
  return `mk:${password ? btoa(String.fromCharCode(...new TextEncoder().encode(password))) : ''}:${b64url(24)}`
}
function linkPassword(wrapped: string): string | null {
  const encoded = wrapped.split(':')[1]
  if (!wrapped.startsWith('mk:') || !encoded) return null
  return new TextDecoder().decode(Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0)))
}

/** Pretends to work through a file chunk by chunk (about 150 MB/s, like WASM AES-GCM). */
async function chunked(size: number, onProgress?: Progress) {
  const steps = Math.min(20, Math.max(2, Math.ceil(size / 2_000_000)))
  for (let i = 1; i <= steps; i++) {
    await wait(Math.min(120, Math.max(15, size / 150_000_000 / steps * 1000)))
    onProgress?.(Math.round((size * i) / steps), size)
  }
}

export function createMockEngine(): CryptoEngine {
  let unlocked = false
  // A share link opened on this page (public pages: nothing else is unlocked).
  let linkOpen = false
  let pendingKek = false
  const devicePublic = b64url(32)
  const code = crypto.getRandomValues(new Uint8Array(2))
  const safetyCode: [string, string] = [WORDS[code[0]! % WORDS.length]!, WORDS[code[1]! % WORDS.length]!]
  const userId = b64url(16)
  const identity = { user_id: userId, x25519: b64url(32), ed25519: b64url(32), signature: b64url(64) }

  return {
    async ready() {
      await wait(150)
    },
    async signup(email, passphrase) {
      if (!passphrase) throw new CryptoError('SG_ERR_ARG: empty passphrase')
      await wait(1600) // roughly what Argon2id costs on a mid-range laptop
      unlocked = true
      return {
        request: {
          user_id: userId,
          email,
          kdf: { m_kib: 65536, t: 3, p: 1 },
          salt: b64url(16),
          auth_key: b64url(32),
          identity,
          identity_by_kek: b64url(92),
          identity_by_recovery: b64url(92),
          identity_by_org: null,
          root_folder_id: b64url(16),
          root_folder_key: b64url(80),
        },
        recovery_phrase: phrase(),
      }
    },
    async loginRequest(email, passphrase) {
      if (!passphrase) throw new CryptoError('SG_ERR_ARG: empty passphrase')
      await wait(1200) // Argon2id
      pendingKek = true
      return { email, auth_key: fakeAuthKey(passphrase) }
    },
    async unlock(bundle) {
      if (!pendingKek) throw new CryptoError('SG_ERR_ARG: call login_request first')
      await wait(200)
      pendingKek = false
      unlocked = true
      return bundle.user_id
    },
    async deviceIdentity() {
      return { public_key: devicePublic, safety_code: safetyCode }
    },
    async identity() {
      if (!unlocked) throw new CryptoError('SG_ERR_ARG: vault is locked')
      return identity
    },
    async identityFingerprint() {
      if (!unlocked) throw new CryptoError('SG_ERR_ARG: vault is locked')
      return 'C3D1 07A9 5E2B 98F4 1A6C D0E7 3B45 F982'
    },
    async isUnlocked() {
      return unlocked
    },
    async regenerateKit() {
      if (!unlocked) throw new CryptoError('SG_ERR_ARG: vault is locked')
      await wait(300)
      return { recovery_phrase: phrase(), identity_by_recovery: b64url(92) }
    },
    async changePassphrase(newPassphrase) {
      if (!unlocked) throw new CryptoError('SG_ERR_ARG: vault is locked')
      await wait(1400) // Argon2id
      return { kdf: { m_kib: 65536, t: 3, p: 1 }, salt: b64url(16), auth_key: fakeAuthKey(newPassphrase), identity_by_kek: b64url(92) }
    },
    async safetyCode(devicePublicKey) {
      let hash = 0
      for (const c of devicePublicKey) hash = (hash * 31 + c.charCodeAt(0)) >>> 0
      return [WORDS[hash % WORDS.length]!, WORDS[(hash >>> 8) % WORDS.length]!]
    },
    async approveDevice() {
      if (!unlocked) throw new CryptoError('SG_ERR_ARG: vault is locked')
      await wait(80)
      return b64url(64)
    },
    async setupOrgRecovery() {
      if (!unlocked) throw new CryptoError('SG_ERR_ARG: vault is locked')
      await wait(900)
      return {
        setup: { public_key: b64url(32), threshold: 1, shares: [{ admin_id: userId, sealed: b64url(120) }] },
        admin_identity_by_org: b64url(140),
      }
    },
    async lock() {
      unlocked = false
      pendingKek = false
    },

    // ---- Drive ----
    async openItems(records) {
      if (!unlocked) throw new CryptoError('SG_ERR_ARG: vault is locked')
      await wait(Math.min(1200, 20 + records.length * 0.6))
      const out = new Map<string, OpenedName>()
      for (const record of records) {
        for (const item of [...(record.path ?? []), record]) {
          const name = decodeName(item.enc_name)
          out.set(item.id, name === null ? { id: item.id, error: 'SG_ERR_AUTH' } : { id: item.id, name })
        }
      }
      return [...out.values()]
    },
    async createFolder(parentId, name) {
      await wait(30)
      return { id: b64url(16), parent_id: parentId, enc_name: encodeName(name), wrapped_key: b64url(60) }
    },
    async renameItem(_itemId, name) {
      await wait(20)
      return { enc_name: encodeName(name) }
    },
    async prepareUpload(parentId, name, size) {
      await wait(40)
      const chunks = Math.max(1, Math.ceil(size / 262_144))
      return {
        id: b64url(16),
        parent_id: parentId,
        enc_name: encodeName(name),
        wrapped_key: b64url(60),
        plaintext_size: size,
        cipher_size: 32 + size + chunks * 16,
        chunk_size: 262_144,
      }
    },
    async encryptFile(_fileId, file, onProgress) {
      await chunked(file.size, onProgress)
      return file
    },
    async decryptFile(fileId, object, onProgress) {
      await chunked(object.size, onProgress)
      if (alteredIds.has(fileId)) throw new CryptoError('SG_ERR_AUTH: chunk 3 failed its integrity check')
      return object
    },
    async rewrapForMove() {
      await wait(20)
      return b64url(60)
    },
    async shareItem(itemId, recipient, role, previouslySeen) {
      await wait(80)
      if (previouslySeen && previouslySeen.ed25519 !== recipient.ed25519) {
        throw new CryptoError('SG_ERR_KEY_CHANGED: the recipient identity key changed')
      }
      return { item_id: itemId, recipient_id: recipient.user_id, role, sealed_key: b64url(90), recipient_fingerprint: 'B1E9 19D6' }
    },
    async createLink(_itemId, linkId, password) {
      await wait(password ? 700 : 60)
      return {
        fragment: `k=${b64url(32)}`,
        record: { link_id: linkId, wrapped_key: linkWrap(password), password: password ? { salt: b64url(16), kdf: { m_kib: 19456, t: 2, p: 1 } } : null },
      }
    },
    async createFileRequest(folderId) {
      await wait(60)
      return { request_id: b64url(12), folder_id: folderId, public_key: b64url(32), wrapped_secret: b64url(60) }
    },
    async forget() {},

    // ---- Public pages ----
    async openLink(record, fragment, password, root) {
      if (!FRAGMENT.test(fragment)) throw new CryptoError('SG_ERR_FORMAT: the link key is incomplete')
      await wait(record.password ? 900 : 120) // Argon2id when there's a password
      if (record.password && linkPassword(record.wrapped_key) !== password) throw new CryptoError('SG_ERR_AUTH: the link key did not open')
      linkOpen = true
      const name = decodeName(root.enc_name)
      return name === null ? { id: root.id, error: 'SG_ERR_AUTH' } : { id: root.id, name }
    },
    async openLinkItems(list) {
      if (!linkOpen) throw new CryptoError('SG_ERR_ARG: open the link first')
      await wait(20 + list.length)
      return list.map((item) => {
        const name = decodeName(item.enc_name)
        return name === null ? { id: item.id, error: 'SG_ERR_AUTH' } : { id: item.id, name }
      })
    },
    async prepareRequestUpload(requestId, fragment, name, size, note) {
      if (!FRAGMENT.test(fragment)) throw new CryptoError('SG_ERR_FORMAT: the request key is incomplete')
      await wait(40)
      const chunks = Math.max(1, Math.ceil(size / 262_144))
      return {
        id: b64url(16),
        request_id: requestId,
        sealed_key: b64url(80),
        sealed_meta: encodeName(JSON.stringify({ name, note })),
        plaintext_size: size,
        cipher_size: 32 + size + chunks * 16,
        chunk_size: 262_144,
      }
    },
  }
}
