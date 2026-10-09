// DEV ONLY. A stand-in for the crypto worker so screens can be built before the WASM core
// exists. It produces random placeholders, not keys, and is never part of a production build:
// it is only imported behind `import.meta.dev && devMocks`.
import { CryptoError, type CryptoEngine } from '../crypto/types'

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

export function createMockEngine(): CryptoEngine {
  let unlocked = false
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
    async isUnlocked() {
      return unlocked
    },
    async regenerateKit() {
      if (!unlocked) throw new CryptoError('SG_ERR_ARG: vault is locked')
      await wait(300)
      return { recovery_phrase: phrase(), identity_by_recovery: b64url(92) }
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
  }
}
