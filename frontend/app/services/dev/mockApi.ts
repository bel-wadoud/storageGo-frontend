// DEV ONLY. An in-memory imitation of the Go API's signup and sign-in endpoints, so the flows can be
// clicked through before the backend exists. Only loaded in development with `devMocks` on, or
// while the temporary test account is on (testAccount.ts): then only that account gets in.
//
// Verification codes: any 6 digits work, except 000000 (wrong code) and 999999 (expired).
// Invites: addresses containing "taken" come back as already members.
// Sign-in: the passphrase "wrong passphrase" is rejected (5 tries, then a 30 s pause).
//   An email containing "device" needs approval from another device (approved after ~8 s),
//   "deny" → the other device declines, "expire" → the request expires,
//   "newkit" → the recovery kit was never confirmed (sign-in resumes signup at the kit step).
// Recovery: any 24 words from the dev word list work; one word repeated 24 times is "another
//   account's kit". Admin requests: approved after a few checks; "deny" → denied, "expire" →
//   expired; individual addresses (@mail.dz) can't ask an organization.
// Invitations: /invite/inv-member, inv-admin, inv-expired, inv-used, inv-revoked.
import type { AccountSummary, KeyBundle } from '../api/auth'
import { ApiError } from '../api/client'
import { isAccountPath, mockAccount } from './mockAccount'
import { isAdminPath, mockAdmin } from './mockAdmin'
import { isDrivePath, isPublicPath, mockDrive, mockPublic } from './mockDrive'
import { TEST_ACCOUNT } from './testAccount'

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
// Only the test account gets in (set by the API client on each call, see testAccount.ts).
let testOnly = false
let restored = false
let failures = 0
let blockedUntil = 0
const devices = new Map<string, { email: string; polls: number; expiresAt: number }>()
// Accounts created in this tab whose recovery kit isn't confirmed yet.
const pendingKits = new Set<string>()
// Emails whose new device was approved: their next sign-in goes straight through.
const trusted = new Set<string>()
// Recovery requests to administrators (kept across reloads, like the device requests).
const adminRequests = new Map<string, { email: string; polls: number; createdAt: number }>()
const INVITES: Record<string, { email: string; role: 'admin' | 'member'; status: 'valid' | 'expired' | 'used' | 'revoked' }> = {
  'inv-member': { email: 'rania.belaid@clinique-atlas.dz', role: 'member', status: 'valid' },
  'inv-admin': { email: 'nassim.kaddour@clinique-atlas.dz', role: 'admin', status: 'valid' },
  'inv-expired': { email: 'old.invite@clinique-atlas.dz', role: 'member', status: 'expired' },
  'inv-used': { email: 'meriem.benali@clinique-atlas.dz', role: 'member', status: 'used' },
  'inv-revoked': { email: 'former@clinique-atlas.dz', role: 'member', status: 'revoked' },
}

// A real server keeps its state when the page reloads; so does this one (for this tab).
const STATE_KEY = 'sg_dev_mock_api'
try {
  const saved = JSON.parse(sessionStorage.getItem(STATE_KEY) ?? 'null')
  if (saved) {
    restored = true
    session = saved.session
    failures = saved.failures
    blockedUntil = saved.blockedUntil
    for (const [id, device] of saved.devices) devices.set(id, device)
    for (const email of saved.pendingKits) pendingKits.add(email)
    for (const email of saved.trusted ?? []) trusted.add(email)
    for (const [id, request] of saved.adminRequests ?? []) adminRequests.set(id, request)
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
        adminRequests: [...adminRequests],
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
const NAMES: Record<string, string> = { test: TEST_ACCOUNT.name, karim: 'Karim Haddad', 'amine.saidi': 'Amine Saidi', nadia: 'Nadia Bouzid', yacine: 'Yacine Belkacem' }

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

const isTestEmail = (email: unknown) => String(email).trim().toLowerCase() === TEST_ACCOUNT.email

function checkPassphrase(authKey: unknown, email?: unknown) {
  if (Date.now() < blockedUntil) {
    throw new ApiError('RATE_LIMITED', 429, Math.ceil((blockedUntil - Date.now()) / 1000))
  }
  let passphrase = ''
  try {
    passphrase = new TextDecoder().decode(Uint8Array.from(atob(String(authKey)), (c) => c.charCodeAt(0)))
  } catch {
    // Not one of ours: treat as wrong.
  }
  const accepted = testOnly
    ? isTestEmail(email) && passphrase === TEST_ACCOUNT.passphrase
    : Boolean(passphrase) && passphrase !== 'wrong passphrase'
  if (accepted) {
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

export async function mockApi<T>(
  path: string,
  method: string,
  body: unknown,
  query?: Record<string, unknown>,
  onlyTestAccount = false,
): Promise<T> {
  // With the test account, nobody is signed in until it signs in.
  if (onlyTestAccount && !testOnly && !restored) session = null
  testOnly = onlyTestAccount
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
    .replace(/\/auth\/devices\/[^/]+\/(status|renew|admin-request)$/, '/auth/devices/:id/$1')
    .replace(/^\/recover\/kit\/[^/]+$/, '/recover/kit/:id')
    .replace(/^\/recover\/admin\/[^/]+\/complete$/, '/recover/admin/:id/complete')
    .replace(/^\/recover\/admin\/[^/]+$/, '/recover/admin/:id')
    .replace(/^\/invites\/[^/]+\/accept$/, '/invites/:id/accept')
    .replace(/^\/invites\/[^/]+$/, '/invites/:id')}`
  const pathId = decodeURIComponent(path.split('/')[path.startsWith('/invites/') ? 2 : 3] ?? '')
  const deviceId = decodeURIComponent(path.split('/')[3] ?? '')

  // With the test account, recovery and invitations can't open a session for anyone else.
  if (testOnly) {
    if (key === 'POST /recover/kit' || key === 'POST /recover/admin') {
      if (!isTestEmail(data.email)) throw new ApiError('INVALID_CREDENTIALS', 401)
    }
    if (key === 'POST /invites/:id/accept' || key === 'POST /dev/session') throw new ApiError('GONE', 410)
  }

  switch (key) {
    case 'POST /signup': {
      if (testOnly && !isTestEmail(data.email)) throw new ApiError('VALIDATION', 422, undefined, { email: 'test_account_only' })
      const id = crypto.randomUUID()
      signups.set(id, { email: String(data.email) })
      return { signup_id: id, resend_after: 30 } as T
    }
    case 'POST /signup/:id/code':
      return { resend_after: 30 } as T
    case 'POST /signup/:id/verify':
      if (testOnly && data.code !== TEST_ACCOUNT.code) throw new ApiError('CODE_INVALID', 400)
      if (data.code === '000000') throw new ApiError('CODE_INVALID', 400)
      if (data.code === '999999') throw new ApiError('CODE_EXPIRED', 400)
      return { signup_token: crypto.randomUUID() } as T
    case 'POST /signup/complete':
      await wait(400)
      {
        const account = (data.account ?? {}) as { email?: string; auth_key?: string }
        const email = String(account.email ?? demo.email)
        // The test account keeps its one passphrase, so signing in later works.
        if (testOnly) checkPassphrase(account.auth_key, email)
        pendingKits.add(email)
        session = accountFor(email)
      }
      return { user_id: 'dev-user', org_id: 'dev-org' } as T
    case 'POST /auth/prelogin':
      return { kdf: { m_kib: 65536, t: 3, p: 1 }, salt: 'dev-salt' } as T
    case 'POST /auth/login': {
      const email = String(data.email)
      checkPassphrase(data.auth_key, email)
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
      checkPassphrase(data.auth_key, session.email)
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
    // ---- Public website ----
    case 'POST /contact':
      // "fail" in the address shows the error state.
      if (String(data.email).includes('fail')) throw new ApiError('SERVER', 503)
      return { reference: `C-${Math.floor(100000 + Math.random() * 900000)}` } as T

    // ---- Recovery ----
    case 'POST /recover/kit':
      return { recovery_id: `kit-${btoa(String(data.email))}`, identity_by_recovery: 'r', challenge: crypto.randomUUID() } as T
    case 'POST /recover/kit/:id': {
      const email = atob(pathId.replace(/^kit-/, ''))
      await wait(300)
      session = { ...accountFor(email), kit_verified: true }
      return { account: session } as T
    }
    case 'POST /recover/admin': {
      const email = String(data.email).toLowerCase()
      if (accountFor(email).kind !== 'org') throw new ApiError('CONFLICT', 409, undefined, undefined, { reason: 'not_org' })
      const id = crypto.randomUUID()
      adminRequests.set(id, { email, polls: 0, createdAt: Date.now() })
      return { request_id: id, expires_at: new Date(Date.now() + 72 * 3_600_000).toISOString() } as T
    }
    case 'GET /recover/admin/:id': {
      const request = adminRequests.get(pathId)
      if (!request) throw new ApiError('NOT_FOUND', 404)
      request.polls += 1
      const base = { expires_at: new Date(request.createdAt + 72 * 3_600_000).toISOString(), required: 2, denied_reason: null, sealed_identity: null, challenge: null }
      if (request.email.includes('expire') && request.polls >= 2) return { ...base, status: 'expired', approvals: 0 } as T
      if (request.email.includes('deny') && request.polls >= 2)
        return { ...base, status: 'denied', approvals: 0, denied_reason: "Nous n'avons pas pu vous joindre au numéro habituel." } as T
      if (request.polls >= 4) return { ...base, status: 'approved', approvals: 2, sealed_identity: 's', challenge: crypto.randomUUID() } as T
      if (request.polls >= 2) return { ...base, status: 'waiting_second', approvals: 1 } as T
      return { ...base, status: 'pending', approvals: 0 } as T
    }
    case 'POST /recover/admin/:id/complete': {
      const request = adminRequests.get(pathId)
      if (!request) throw new ApiError('NOT_FOUND', 404)
      adminRequests.delete(pathId)
      // Their old kit is lost: the drive stays closed until a new one is saved and checked.
      pendingKits.add(request.email)
      session = { ...accountFor(request.email), kit_verified: false }
      return { account: session } as T
    }

    // ---- Invitations ----
    case 'GET /invites/:id': {
      const invite = INVITES[pathId]
      if (!invite) throw new ApiError('NOT_FOUND', 404)
      return {
        ...invite,
        org_name: demo.org_name,
        inviter: { name: demo.name },
        expires_at: new Date(Date.now() + (invite.status === 'expired' ? -2 : 5) * 86_400_000).toISOString(),
        org_recovery: true,
        org_recovery_key: 'org-recovery-public-key',
      } as T
    }
    case 'POST /invites/:id/accept': {
      const invite = INVITES[pathId]
      if (!invite) throw new ApiError('NOT_FOUND', 404)
      if (invite.status !== 'valid') throw new ApiError('GONE', 410)
      await wait(400)
      pendingKits.add(invite.email)
      session = { ...accountFor(invite.email), name: String(data.name), kit_verified: false }
      return { account: session } as T
    }

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
