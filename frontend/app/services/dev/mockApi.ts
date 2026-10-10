// DEV ONLY. An in-memory imitation of the Go API's signup and sign-in endpoints, so the flows can be
// clicked through before the backend exists. Only imported behind `import.meta.dev && devMocks`.
//
// Verification codes: any 6 digits work, except 000000 (wrong code) and 999999 (expired).
// Invites: addresses containing "taken" come back as already members.
// Sign-in: the passphrase "wrong passphrase" is rejected (5 tries, then a 30 s pause).
//   An email containing "device" needs approval from another device (approved after ~8 s),
//   "deny" → the other device declines, "expire" → the request expires,
//   "newkit" → the recovery kit was never confirmed (sign-in resumes signup at the kit step).
import type { AccountSummary, KeyBundle } from '../api/auth'
import { ApiError } from '../api/client'
import { isAccountPath, mockAccount } from './mockAccount'
import { isAdminPath, mockAdmin } from './mockAdmin'
import { isDrivePath, isPublicPath, mockDrive, mockPublic } from './mockDrive'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const signups = new Map<string, { email: string }>()
let announced = false

// Sign-in state. A demo session exists until /auth/logout, so /signin/unlock can be tried.
const demo: AccountSummary = {
  user_id: 'dev-user',
  email: 'karim@clinique-atlas.dz',
  name: 'Karim Haddad',
  kind: 'org',
  org_id: 'dev-org',
  org_name: 'Clinique Atlas',
  kit_verified: true,
  kit_confirmed_at: new Date(Date.now() - 214 * 86_400_000).toISOString(),
  kit_reminder_due: true,
}
let session: AccountSummary | null = demo
let failures = 0
let blockedUntil = 0
const devices = new Map<string, { email: string; polls: number; expiresAt: number }>()
// Accounts created in this tab whose recovery kit isn't confirmed yet.
const pendingKits = new Set<string>()
// Emails whose new device was approved: their next sign-in goes straight through.
const trusted = new Set<string>()

// A real server keeps its state when the page reloads; so does this one (for this tab).
const STATE_KEY = 'sg_dev_mock_api'
try {
  const saved = JSON.parse(sessionStorage.getItem(STATE_KEY) ?? 'null')
  if (saved) {
    session = saved.session
    failures = saved.failures
    blockedUntil = saved.blockedUntil
    for (const [id, device] of saved.devices) devices.set(id, device)
    for (const email of saved.pendingKits) pendingKits.add(email)
    for (const email of saved.trusted ?? []) trusted.add(email)
  }
} catch {
  // Fresh state.
}

function persist() {
  try {
    sessionStorage.setItem(
      STATE_KEY,
      JSON.stringify({
        session,
        failures,
        blockedUntil,
        devices: [...devices],
        pendingKits: [...pendingKits],
        trusted: [...trusted],
      }),
    )
  } catch {
    // Not important for a mock.
  }
}

function bundle(): KeyBundle {
  return {
    user_id: 'dev-user',
    identity: { user_id: 'dev-user', x25519: 'x', ed25519: 'e', signature: 's' },
    identity_by_kek: 'k',
    identity_by_recovery: 'r',
    root_folder_id: 'root',
    root_folder_key: 'rk',
  }
}

// Full names of the sample people; other addresses get a name made from the address.
const NAMES: Record<string, string> = { karim: 'Karim Haddad', 'amine.saidi': 'Amine Saidi', nadia: 'Nadia Bouzid', yacine: 'Yacine Belkacem' }

function accountFor(email: string): AccountSummary {
  const individual = email.endsWith('@mail.dz') || email.includes('gmail')
  const local = email.split('@')[0]!.replace(/^(device|deny|expire|newkit)\./, '')
  return {
    ...demo,
    email,
    name: NAMES[local] ?? local.replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    kind: individual ? 'individual' : 'org',
    org_id: individual ? null : demo.org_id,
    org_name: individual ? null : demo.org_name,
    kit_verified: !email.includes('newkit') && !pendingKits.has(email),
    kit_reminder_due: !email.includes('newkit') && !pendingKits.has(email),
  }
}

function checkPassphrase(authKey: unknown) {
  if (Date.now() < blockedUntil) {
    throw new ApiError('RATE_LIMITED', 429, Math.ceil((blockedUntil - Date.now()) / 1000))
  }
  let passphrase = ''
  try {
    passphrase = new TextDecoder().decode(Uint8Array.from(atob(String(authKey)), (c) => c.charCodeAt(0)))
  } catch {
    // Not one of ours: treat as wrong.
  }
  if (passphrase && passphrase !== 'wrong passphrase') {
    failures = 0
    return
  }
  failures += 1
  if (failures >= 5) {
    failures = 0
    blockedUntil = Date.now() + 30_000
    throw new ApiError('RATE_LIMITED', 429, 30)
  }
  throw new ApiError('INVALID_CREDENTIALS', 401, undefined, undefined, { attempts_left: 5 - failures })
}

function viaJson<V>(value: V): V {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as V)
}

export async function mockApi<T>(path: string, method: string, body: unknown, query?: Record<string, unknown>): Promise<T> {
  // Public pages: no session needed.
  if (isPublicPath(path)) return (await mockPublic(method, path)) as T
  // Through JSON both ways, like a real request: the mock never keeps the page's reactive
  // objects, and the page never holds the mock's own.
  if (isAdminPath(path)) return viaJson(await mockAdmin(method, path, viaJson(body), query, session)) as T
  if (isDrivePath(path)) return (await mockDrive(method, path, body, query, session)) as T
  if (isAccountPath(path)) {
    const result = await mockAccount(method, path, body, session)
    // Profile changes show up in the session (name, email) like on a real server.
    if (session && result && typeof result === 'object' && 'user_id' in result) {
      session = { ...session, ...(result as Partial<AccountSummary>) }
      persist()
    }
    return result as T
  }
  try {
    return await route<T>(path, method, body)
  } finally {
    persist()
  }
}

async function route<T>(path: string, method: string, body: unknown): Promise<T> {
  if (!announced) {
    announced = true
    console.info('[dev mocks] API is mocked. Any 6-digit code works; 000000 = wrong, 999999 = expired.')
  }
  await wait(350 + Math.random() * 400)
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new ApiError('NETWORK')

  const data = (body ?? {}) as Record<string, unknown>
  const key = `${method} ${path
    .replace(/\/signup\/[^/]+\/(code|verify)$/, '/signup/:id/$1')
    .replace(/\/auth\/devices\/[^/]+\/(status|renew|admin-request)$/, '/auth/devices/:id/$1')}`
  const deviceId = decodeURIComponent(path.split('/')[3] ?? '')

  switch (key) {
    case 'POST /signup': {
      const id = crypto.randomUUID()
      signups.set(id, { email: String(data.email) })
      return { signup_id: id, resend_after: 30 } as T
    }
    case 'POST /signup/:id/code':
      return { resend_after: 30 } as T
    case 'POST /signup/:id/verify':
      if (data.code === '000000') throw new ApiError('CODE_INVALID', 400)
      if (data.code === '999999') throw new ApiError('CODE_EXPIRED', 400)
      return { signup_token: crypto.randomUUID() } as T
    case 'POST /signup/complete':
      await wait(400)
      {
        const email = String((data.account as { email?: string })?.email ?? demo.email)
        pendingKits.add(email)
        session = accountFor(email)
      }
      return { user_id: 'dev-user', org_id: 'dev-org' } as T
    case 'POST /auth/prelogin':
      return { kdf: { m_kib: 65536, t: 3, p: 1 }, salt: 'dev-salt' } as T
    case 'POST /auth/login': {
      const email = String(data.email)
      checkPassphrase(data.auth_key)
      const account = accountFor(email)
      if (/device|deny|expire/.test(email) && !trusted.has(email)) {
        const id = crypto.randomUUID()
        devices.set(id, { email, polls: 0, expiresAt: Date.now() + (email.includes('expire') ? 6_000 : 600_000) })
        return { status: 'device_approval', device_id: id, expires_in: email.includes('expire') ? 6 : 600, account_kind: account.kind } as T
      }
      session = account
      return { status: 'ok', bundle: bundle(), account } as T
    }
    case 'GET /auth/devices/:id/status': {
      const device = devices.get(deviceId)
      if (!device) throw new ApiError('NOT_FOUND', 404)
      device.polls += 1
      if (Date.now() > device.expiresAt) return { status: 'expired' } as T
      if (device.email.includes('deny') && device.polls >= 2) return { status: 'denied' } as T
      if (device.email.includes('device') && device.polls >= 3) {
        trusted.add(device.email)
        session = accountFor(device.email)
        return { status: 'approved', bundle: bundle(), account: session } as T
      }
      return { status: 'pending' } as T
    }
    case 'POST /auth/devices/:id/renew': {
      const device = devices.get(deviceId)
      if (!device) throw new ApiError('NOT_FOUND', 404)
      Object.assign(device, { polls: 0, expiresAt: Date.now() + 600_000, email: device.email.replace('expire', 'device') })
      return { expires_in: 600 } as T
    }
    case 'POST /auth/devices/:id/admin-request':
      return undefined as T
    case 'GET /auth/session':
      if (!session) throw new ApiError('UNAUTHORIZED', 401)
      return { account: session, prelogin: { kdf: { m_kib: 65536, t: 3, p: 1 }, salt: 'dev-salt' } } as T
    case 'POST /auth/unlock':
      if (!session) throw new ApiError('UNAUTHORIZED', 401)
      checkPassphrase(data.auth_key)
      return { bundle: bundle(), account: session } as T
    case 'POST /auth/logout':
      session = null
      return undefined as T
    case 'POST /account/recovery-kit/verified':
      if (session) {
        pendingKits.delete(session.email)
        session = { ...session, kit_verified: true }
      }
      return undefined as T
    case 'POST /dev/session':
      session = demo
      return undefined as T
    case 'PUT /account/recovery-kit':
    case 'POST /org/recovery':
      return undefined as T
    case 'POST /org/invites': {
      const invites = (data.invites ?? []) as { email: string }[]
      return {
        sent: invites.filter((i) => !i.email.includes('taken')).map((i) => i.email),
        skipped: invites.filter((i) => i.email.includes('taken')).map((i) => ({ email: i.email, reason: 'already_member' })),
      } as T
    }
    default:
      throw new ApiError('NOT_FOUND', 404)
  }
}
