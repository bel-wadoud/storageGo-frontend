// DEV ONLY. An in-memory imitation of the account settings endpoints (profile, passphrase,
// recovery kit, devices, sessions, notifications, plan). Only imported behind
// `import.meta.dev && devMocks`.
//
// Email change: any 6-digit code works except 000000. Passphrase: "wrong passphrase" is
// rejected as the current one. A device "Chrome on Windows · Sétif" waits for approval.
import type { AccountDetails, Billing, Device, Invoice, NotificationPrefs, Session } from '../api/account'
import type { AccountSummary } from '../api/auth'
import { ApiError } from '../api/client'
import { isMockAdmin } from './mockAdmin'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const ago = (days: number, hours = 0) => new Date(Date.now() - days * 86_400_000 - hours * 3_600_000).toISOString()

let profile: Partial<AccountDetails> = {}
let pendingEmail: { id: string; email: string } | null = null
let devices: Device[] | null = null
let sessions: Session[] | null = null
let prefs: NotificationPrefs = { shares: true, requests: true, storage: true, recovery: true, security: true }
let billing: Billing | null = null

const PLANS = [
  { id: 'p20', name: 'Personnel 20', storage: 20_000_000_000, price: 450 },
  { id: 'p200', name: 'Personnel 200', storage: 200_000_000_000, price: 1_200 },
  { id: 'p1000', name: 'Personnel 1 To', storage: 1_000_000_000_000, price: 3_500 },
]

function decodeKey(authKey: unknown): string {
  try {
    return new TextDecoder().decode(Uint8Array.from(atob(String(authKey)), (c) => c.charCodeAt(0)))
  } catch {
    return ''
  }
}

function details(account: AccountSummary): AccountDetails {
  return {
    ...account,
    role: account.kind === 'org' ? (isMockAdmin(account) ? 'admin' : 'member') : null,
    locale: 'en',
    created_at: ago(220),
    // About 7 months ago: the "Still have your recovery kit?" reminder is due.
    kit_confirmed_at: ago(214),
    org_recovery: account.kind === 'org',
    ...profile,
  } as AccountDetails
}

function seedDevices(): Device[] {
  return [
    { id: 'd-this', name: deviceLabel(), location: 'Alger', status: 'trusted', current: true, public_key: 'pk-this', created_at: ago(40), last_active_at: new Date().toISOString() },
    { id: 'd-phone', name: 'Safari on iOS', location: 'Alger', status: 'trusted', current: false, public_key: 'pk-phone', created_at: ago(120), last_active_at: ago(0, 3) },
    { id: 'd-old', name: 'Firefox on Windows', location: 'Blida', status: 'trusted', current: false, public_key: 'pk-old', created_at: ago(300), last_active_at: ago(64) },
    { id: 'd-new', name: 'Chrome on Windows', location: 'Sétif', status: 'pending', current: false, public_key: 'pk-setif-7731', created_at: ago(0, 0.05), last_active_at: ago(0, 0.05) },
  ]
}

function deviceLabel() {
  const ua = navigator.userAgent
  const browser = /Firefox\//.test(ua) ? 'Firefox' : /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : 'Safari'
  const system = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'macOS' : 'Linux'
  return `${browser} on ${system}`
}

function invoices(): Invoice[] {
  return [0, 1, 2].map((m) => ({ id: `inv-2026-${10 - m}`, date: ago(9 + m * 30), amount: 450, status: m === 0 ? 'due' : 'paid', url: '#' }) as Invoice)
}

export async function mockAccount(method: string, path: string, body: unknown, account: AccountSummary | null): Promise<unknown> {
  await wait(250 + Math.random() * 350)
  if (!navigator.onLine) throw new ApiError('NETWORK')
  if (!account) throw new ApiError('UNAUTHORIZED', 401)
  const data = (body ?? {}) as Record<string, unknown>
  const route = `${method} ${path
    .replace(/^\/account\/email\/[^/]+\/(code|verify)$/, '/account/email/:id/$1')
    .replace(/^\/devices\/[^/]+\/(approve|deny)$/, '/devices/:id/$1')
    .replace(/^\/devices\/[^/]+$/, '/devices/:id')
    .replace(/^\/account\/sessions\/(?!others$)[^/]+$/, '/account/sessions/:id')}`
  const target = decodeURIComponent(path.split('/')[2] ?? '')
  devices ??= seedDevices()
  sessions ??= [
    { id: 's-this', name: deviceLabel(), location: 'Alger', current: true, created_at: ago(0, 1), last_active_at: new Date().toISOString() },
    { id: 's-phone', name: 'Safari on iOS', location: 'Alger', current: false, created_at: ago(2), last_active_at: ago(0, 3) },
    { id: 's-office', name: 'Edge on Windows', location: 'Oran', current: false, created_at: ago(6), last_active_at: ago(1) },
  ]

  switch (route) {
    case 'GET /account':
      return details(account)
    case 'PATCH /account':
      profile = { ...profile, ...(data as Partial<AccountDetails>) }
      return details(account)
    case 'POST /account/email':
      if (String(data.email).toLowerCase() === account.email) throw new ApiError('VALIDATION', 422, undefined, { email: 'same' })
      pendingEmail = { id: crypto.randomUUID(), email: String(data.email) }
      return { change_id: pendingEmail.id, resend_after: 30 }
    case 'POST /account/email/:id/code':
      return { resend_after: 30 }
    case 'POST /account/email/:id/verify':
      if (data.code === '000000') throw new ApiError('CODE_INVALID', 400)
      if (!pendingEmail) throw new ApiError('NOT_FOUND', 404)
      profile = { ...profile, email: pendingEmail.email }
      pendingEmail = null
      return details(account)
    case 'POST /account/passphrase':
    case 'POST /account/recovery-kit/regenerate':
      if (decodeKey(data.current_auth_key) === 'wrong passphrase') throw new ApiError('INVALID_CREDENTIALS', 401, undefined, undefined, { attempts_left: 4 })
      if (route.endsWith('passphrase')) sessions = sessions.filter((s) => s.current)
      return undefined
    case 'POST /account/recovery-kit/confirmed': {
      const at = new Date().toISOString()
      profile = { ...profile, kit_confirmed_at: at }
      return { kit_confirmed_at: at }
    }
    case 'GET /devices':
      return devices
    case 'POST /devices/:id/approve':
    case 'POST /devices/:id/deny': {
      const device = devices.find((d) => d.id === target)
      if (!device) throw new ApiError('NOT_FOUND', 404)
      if (route.endsWith('approve')) device.status = 'trusted'
      else devices = devices.filter((d) => d.id !== target)
      return undefined
    }
    case 'DELETE /devices/:id':
      if (devices.find((d) => d.id === target)?.current) throw new ApiError('CONFLICT', 409)
      devices = devices.filter((d) => d.id !== target)
      return undefined
    case 'GET /account/sessions':
      return sessions
    case 'DELETE /account/sessions/:id':
      sessions = sessions.filter((s) => s.id !== target)
      return undefined
    case 'DELETE /account/sessions/others': {
      const ended = sessions.filter((s) => !s.current).length
      sessions = sessions.filter((s) => s.current)
      return { ended }
    }
    case 'GET /account/notifications':
      return prefs
    case 'PATCH /account/notifications':
      prefs = { ...prefs, ...(data as Partial<NotificationPrefs>), security: true }
      return prefs
    case 'GET /billing':
      if (account.kind === 'org') throw new ApiError('FORBIDDEN', 403)
      billing ??= { plan: PLANS[0]!, plans: PLANS, renews_at: new Date(Date.now() + 21 * 86_400_000).toISOString(), payment_method: { kind: 'edahabia', last4: '4821' } }
      return billing
    case 'POST /billing/plan': {
      const plan = PLANS.find((p) => p.id === data.plan_id)
      if (!plan || !billing) throw new ApiError('VALIDATION', 422)
      billing = { ...billing, plan }
      return { checkout_url: null, billing }
    }
    case 'GET /billing/invoices':
      return invoices()
    case 'POST /billing/payment-method':
      // A real server answers with the bank's page; it sends the user back here afterwards.
      return { checkout_url: '/settings/plan?card=updated' }
  }
  throw new ApiError('NOT_FOUND', 404)
}

export function isAccountPath(path: string): boolean {
  if (path === '/account/recovery-kit' || path === '/account/recovery-kit/verified') return false
  return /^\/(account(\/|$)|devices(\/|$)|billing(\/|$))/.test(path) && !path.startsWith('/account/workspaces')
}
