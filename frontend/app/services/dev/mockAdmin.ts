// DEV ONLY. An in-memory imitation of the administration endpoints (/admin/…), with a
// plausible clinic: members, groups, a recovery queue in every state, devices, an audit log,
// compliance documents, billing and the organization. Only imported behind
// `import.meta.dev && devMocks`.
//
// Administrators: every organization account except emails containing "yacine" or "member"
// (those are plain members and get 403). The passphrase "wrong passphrase" is rejected.
// Scenarios (set from /dev, sessionStorage "sg_dev_admin"):
//   seatsFull · domainVerified · oneHolder (a single recovery key holder) · emptyQueue
import type {
  AdminMember,
  AuditAction,
  AuditEvent,
  ExportJob,
  Group,
  MemberRole,
  OrgBilling,
  OrgDevice,
  OrgInvoice,
  OrgPlan,
  Organization,
  Overview,
  Policies,
  QuorumResult,
  RecoveryRequest,
  Residency,
} from '../api/admin'
import type { AccountSummary } from '../api/auth'
import { ApiError } from '../api/client'
import type { Person } from '../api/drive'
import { tinyPdf } from './mockDrive'

interface Scenario {
  seatsFull?: boolean
  domainVerified?: boolean
  oneHolder?: boolean
  emptyQueue?: boolean
}
function scenario(): Scenario {
  try {
    return JSON.parse(sessionStorage.getItem('sg_dev_admin') ?? '{}') as Scenario
  } catch {
    return {}
  }
}

export function isMockAdmin(account: AccountSummary | null): boolean {
  return Boolean(account && account.kind === 'org' && !/yacine|member/i.test(account.email))
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const DAY = 86_400_000
const ago = (days: number, hours = 0) => new Date(Date.now() - days * DAY - hours * 3_600_000).toISOString()
const ahead = (days: number, hours = 0) => new Date(Date.now() + days * DAY + hours * 3_600_000).toISOString()
const rand = (n = 8) => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(n)))).replace(/[+/=]/g, '').slice(0, n)

function decodeKey(authKey: unknown): string {
  try {
    return new TextDecoder().decode(Uint8Array.from(atob(String(authKey)), (c) => c.charCodeAt(0)))
  } catch {
    return ''
  }
}
function checkPassphrase(authKey: unknown) {
  if (!authKey || decodeKey(authKey) === 'wrong passphrase') throw new ApiError('INVALID_CREDENTIALS', 401)
}

// ---- State ----
let seeded = false
const members: AdminMember[] = []
const groups: Group[] = []
const recovery: RecoveryRequest[] = []
const devices: OrgDevice[] = []
const audit: AuditEvent[] = []
const jobs = new Map<string, { job: ExportJob; started: number; build: () => string }>()
let policies: Policies
let residency: Residency
let billing: OrgBilling
let organization: Organization
let seatTotal = 25
let domainChecks = 0

const person = (m: AdminMember): Person => ({ user_id: m.id, name: m.name, email: m.email })
const me = () => members.find((m) => m.id === 'dev-user')!
const PLANS: OrgPlan[] = [
  { name: 'Organisation', seat_price: 900, storage_per_seat: 4_000_000_000 },
  { name: 'Organisation Plus', seat_price: 1_600, storage_per_seat: 20_000_000_000 },
]

const PEOPLE: [string, string, string][] = [
  ['dev-user', 'Karim Haddad', 'karim'],
  ['u-samia', 'Samia Kaci', 'samia.kaci'],
  ['u-nadia', 'Nadia Bouzid', 'nadia.bouzid'],
  ['u-yacine', 'Yacine Belkacem', 'yacine.belkacem'],
  ['u-amine', 'Amine Saidi', 'amine.saidi'],
  ['u-leila', 'Leila Mansouri', 'leila.mansouri'],
  ['u-omar', 'Omar Ferhat', 'omar.ferhat'],
  ['u-meriem', 'Meriem Benali', 'meriem.benali'],
  ['u-sofiane', 'Sofiane Rahmani', 'sofiane.rahmani'],
  ['u-amel', 'Amel Cherif', 'amel.cherif'],
  ['u-riad', 'Riad Bensalem', 'riad.bensalem'],
  ['u-houda', 'Houda Zerrouki', 'houda.zerrouki'],
  ['u-bilal', 'Bilal Messaoudi', 'bilal.messaoudi'],
  ['u-imene', 'Imène Taleb', 'imene.taleb'],
  ['u-farid', 'Farid Ouali', 'farid.ouali'],
  ['u-sarah', 'Sarah Hamidi', 'sarah.hamidi'],
  ['u-mourad', 'Mourad Aït Ali', 'mourad.aitali'],
  ['u-lina', 'Lina Boudiaf', 'lina.boudiaf'],
  ['u-walid', 'Walid Guerfi', 'walid.guerfi'],
  ['u-khadidja', 'خديجة بن يوسف', 'khadidja.benyoucef'],
  ['u-rachid', 'رشيد عمراني', 'rachid.amrani'],
]

function seed() {
  if (seeded) return
  seeded = true
  const s = scenario()
  groups.push(
    { id: 'g-med', name: 'Médecins', description: 'Corps médical, accès aux dossiers patients', member_ids: [], created_at: ago(200) },
    { id: 'g-compta', name: 'Comptabilité', description: 'Factures, bilans, relevés', member_ids: [], created_at: ago(200) },
    { id: 'g-rh', name: 'Ressources humaines', description: '', member_ids: [], created_at: ago(150) },
    { id: 'g-dir', name: 'Direction', description: 'Comité de direction', member_ids: [], created_at: ago(120) },
  )
  PEOPLE.forEach(([id, name, local], i) => {
    const role: MemberRole = id === 'dev-user' || id === 'u-samia' ? 'admin' : 'member'
    const group = ['g-med', 'g-compta', 'g-rh', 'g-dir'][i % 4]!
    members.push({
      id,
      name,
      email: `${local}@clinique-atlas.dz`,
      role,
      status: id === 'u-walid' ? 'suspended' : 'active',
      group_ids: id === 'dev-user' ? ['g-dir'] : [group],
      storage_used: Math.round(((i * 7919) % 4000) * 1_000_000 + 120_000_000),
      last_active_at: ago(i % 9, i),
      joined_at: ago(200 - i * 5),
      invited_at: ago(201 - i * 5),
      kit_confirmed: !['u-omar', 'u-lina', 'u-bilal'].includes(id),
      holds_recovery_key: role === 'admin' && !(s.oneHolder && id === 'u-samia'),
      devices: 1 + (i % 3),
    })
  })
  for (const email of ['rania.belaid@clinique-atlas.dz', 'nassim.kaddour@clinique-atlas.dz']) {
    members.push({
      id: `inv-${rand(6)}`,
      name: '',
      email,
      role: 'member',
      status: 'invited',
      group_ids: [],
      storage_used: 0,
      last_active_at: null,
      joined_at: null,
      invited_at: ago(2),
      kit_confirmed: false,
      holds_recovery_key: false,
      devices: 0,
    })
  }
  for (const group of groups) group.member_ids = members.filter((m) => m.group_ids.includes(group.id)).map((m) => m.id)
  seatTotal = s.seatsFull ? members.filter((m) => m.status !== 'suspended').length : 25

  policies = {
    links_allowed: true,
    max_link_days: 30,
    link_password_required: false,
    requests_allowed: true,
    device_approval: 'trusted_device_or_admin',
    session_hours: 24,
    idle_lock_minutes: 60,
    org_recovery: true,
    recovery_approvals: s.oneHolder ? 1 : 2,
    kit_required: true,
    trash_days: 30,
  }

  const byId = (id: string) => person(members.find((m) => m.id === id)!)
  if (!s.emptyQueue) {
    recovery.push(
      {
        id: 'rec-yacine',
        member: byId('u-yacine'),
        status: 'pending',
        created_at: ago(0, 2),
        expires_at: ahead(2, 22),
        device: 'Chrome on Android',
        location: 'Sétif',
        reason: "J'ai changé de téléphone et je ne retrouve plus mon kit de récupération.",
        approvals: [],
        required: policies.recovery_approvals,
        decided_at: null,
        denied_reason: null,
      },
      {
        id: 'rec-leila',
        member: byId('u-leila'),
        status: 'waiting_second',
        created_at: ago(0, 9),
        expires_at: ahead(2, 15),
        device: 'Firefox on Windows',
        location: 'Oran',
        reason: 'Phrase secrète oubliée après mes congés.',
        approvals: [{ admin: byId('u-samia'), at: ago(0, 5) }],
        required: policies.recovery_approvals,
        decided_at: null,
        denied_reason: null,
      },
    )
  }
  recovery.push(
    {
      id: 'rec-omar',
      member: byId('u-omar'),
      status: 'pending',
      created_at: ago(4),
      expires_at: ago(1),
      device: 'Safari on iOS',
      location: 'Alger',
      reason: 'Téléphone volé.',
      approvals: [],
      required: 2,
      decided_at: null,
      denied_reason: null,
    },
    {
      id: 'rec-nadia',
      member: byId('u-nadia'),
      status: 'approved',
      created_at: ago(21),
      expires_at: ago(18),
      device: 'Chrome on Windows',
      location: 'Oran',
      reason: 'Oubli de la phrase secrète.',
      approvals: [
        { admin: byId('dev-user'), at: ago(21, -2) },
        { admin: byId('u-samia'), at: ago(21, -3) },
      ],
      required: 2,
      decided_at: ago(21, -3),
      denied_reason: null,
    },
    {
      id: 'rec-unknown',
      member: byId('u-farid'),
      status: 'denied',
      created_at: ago(34),
      expires_at: ago(31),
      device: 'Chrome on Windows',
      location: 'Annaba',
      reason: 'Urgent, merci de valider rapidement.',
      approvals: [],
      required: 2,
      decided_at: ago(34, -1),
      denied_reason: "Farid n'a pas fait cette demande (vérifié par téléphone).",
    },
  )

  const names = ['Chrome on Windows', 'Safari on iOS', 'Chrome on Android', 'Firefox on Windows', 'Edge on Windows', 'Safari on macOS']
  const places = ['Alger', 'Oran', 'Sétif', 'Blida', 'Constantine', null]
  members.filter((m) => m.status !== 'invited').forEach((m, i) => {
    for (let d = 0; d < m.devices; d++) {
      devices.push({
        id: `dev-${m.id}-${d}`,
        member: person(m),
        name: names[(i + d) % names.length]!,
        location: places[(i * 3 + d) % places.length]!,
        status: 'trusted',
        public_key: `pk-${m.id}-${d}`,
        created_at: ago(150 - i * 3 - d * 20),
        last_active_at: ago((i + d) % 12, d * 3),
      })
    }
  })
  devices.unshift({
    id: 'dev-pending-nadia',
    member: byId('u-nadia'),
    name: 'Chrome on Windows',
    location: 'Tlemcen',
    status: 'pending',
    public_key: 'pk-nadia-new-4410',
    created_at: ago(0, 0.3),
    last_active_at: ago(0, 0.3),
  })

  const actions: AuditAction[] = ['signed_in', 'file_uploaded', 'file_downloaded', 'item_shared', 'link_created', 'link_opened', 'device_added', 'signed_in', 'file_downloaded', 'request_upload', 'sign_in_failed', 'passphrase_changed', 'policy_changed', 'member_invited', 'role_changed']
  const active = members.filter((m) => m.status === 'active')
  for (let i = 0; i < 180; i++) {
    const action = actions[(i * 7) % actions.length]!
    const actor = action === 'link_opened' || action === 'request_upload' ? null : active[(i * 5) % active.length]!
    audit.push({
      id: `ev-${i}`,
      at: new Date(Date.now() - i * 7.9 * 3_600_000).toISOString(),
      action,
      actor: actor ? person(actor) : null,
      target:
        action === 'member_invited' || action === 'role_changed'
          ? { kind: 'member', person: person(active[(i * 3) % active.length]!) }
          : action === 'policy_changed'
            ? { kind: 'policy', id: 'max_link_days' }
            : action.startsWith('link')
              ? { kind: 'link', id: `L${rand(9)}` }
              : action.startsWith('file') || action === 'item_shared' || action === 'request_upload'
                ? { kind: 'item', id: rand(12) }
                : action === 'device_added'
                  ? { kind: 'device', id: rand(10) }
                  : null,
      ip: `41.${100 + (i % 90)}.${(i * 13) % 255}.${(i * 29) % 255}`,
      location: ['Alger', 'Oran', 'Sétif', 'Blida', null][i % 5]!,
    })
  }

  residency = {
    datacenters: [
      { wilaya: '16', city: 'Alger', role: 'primary', operator: 'storageGo DC1' },
      { wilaya: '31', city: 'Oran', role: 'replica', operator: 'storageGo DC2' },
    ],
    certificate: { number: 'SG-RES-2026-00417', issued_at: ago(10), valid_until: ahead(355), issuer: 'storageGo SPA' },
    dpa: { signed_at: null, signed_by: null },
  }

  billing = {
    plan: PLANS[0]!,
    plans: PLANS,
    seats: seatsNow(),
    storage: { used: 42_300_000_000, limit: 100_000_000_000 },
    renews_at: ahead(21),
    payment_method: { kind: 'transfer', reference: 'SG-ATLAS-2026' },
    transfer: { bank: 'BNA — Agence Oran Centre', account_name: 'storageGo SPA', rib: '001 00512 0300000123 45', reference: 'SG-ATLAS-2026' },
  }

  organization = {
    id: 'dev-org',
    name: 'Clinique Atlas',
    sector: 'health',
    domain: 'clinique-atlas.dz',
    domain_status: s.domainVerified ? 'verified' : 'pending',
    domain_record: { name: '_storagego.clinique-atlas.dz', value: `storagego-verify=${rand(24)}` },
    logo_url: null,
    created_at: ago(205),
    admins: [],
    recovery_threshold: policies.recovery_approvals,
  }
  syncAdmins()
}

function seatsNow() {
  const used = members.filter((m) => m.status === 'active' || m.status === 'suspended').length
  const pending = members.filter((m) => m.status === 'invited').length
  return { used, pending, total: Math.max(seatTotal, used + pending) }
}

function syncAdmins() {
  const pendingKeys = new Set(organization.admins.filter((a) => a.pending_key).map((a) => a.person.user_id))
  organization.admins = members
    .filter((m) => m.role === 'admin' && m.status !== 'invited')
    .map((m) => ({ person: person(m), holds_recovery_key: m.holds_recovery_key, pending_key: !m.holds_recovery_key && pendingKeys.has(m.id) }))
  organization.recovery_threshold = policies.recovery_approvals
  billing.seats = seatsNow()
}

function statusOf(request: RecoveryRequest): RecoveryRequest {
  if ((request.status === 'pending' || request.status === 'waiting_second') && Date.parse(request.expires_at) < Date.now()) {
    return { ...request, status: 'expired' }
  }
  return request
}

function log(action: AuditAction, target: AuditEvent['target'] = null) {
  audit.unshift({ id: `ev-${rand(8)}`, at: new Date().toISOString(), action, actor: person(me()), target, ip: '41.104.22.7', location: 'Alger' })
}

function member(id: string): AdminMember {
  const found = members.find((m) => m.id === id)
  if (!found) throw new ApiError('NOT_FOUND', 404)
  return found
}

const holders = () => members.filter((m) => m.holds_recovery_key && m.status === 'active')

function filterAudit(query: Record<string, unknown>) {
  const from = query.from ? Date.parse(String(query.from)) : -Infinity
  const to = query.to ? Date.parse(String(query.to)) + DAY : Infinity
  return audit.filter(
    (e) =>
      (!query.actor || e.actor?.user_id === query.actor || (e.target?.kind === 'member' && e.target.person.user_id === query.actor)) &&
      (!query.action || e.action === query.action) &&
      Date.parse(e.at) >= from &&
      Date.parse(e.at) < to,
  )
}

function csvOf(events: AuditEvent[]): string {
  const cell = (v: string) => `"${v.replace(/"/g, '""')}"`
  const rows = events.map((e) =>
    [e.at, e.action, e.actor?.email ?? '', e.target ? (e.target.kind === 'member' ? e.target.person.email : `${e.target.kind}:${e.target.id}`) : '', e.ip ?? '', e.location ?? ''].map(cell).join(','),
  )
  return ['time,action,actor,target,ip,location', ...rows].join('\n')
}

async function dataUrl(blob: Blob): Promise<string> {
  return await new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(blob)
  })
}

function page<T>(all: T[], cursor: unknown, size: number) {
  const start = Number(cursor ?? 0) || 0
  return { items: all.slice(start, start + size), next_cursor: start + size < all.length ? String(start + size) : null, total: all.length }
}

function jobView(id: string): ExportJob {
  const entry = jobs.get(id)
  if (!entry) throw new ApiError('NOT_FOUND', 404)
  const progress = Math.min(1, (Date.now() - entry.started) / 3500)
  if (progress >= 1 && entry.job.status === 'preparing') entry.job = { ...entry.job, status: 'ready', progress: 1, url: entry.build() }
  else if (entry.job.status === 'preparing') entry.job = { ...entry.job, progress }
  return entry.job
}

export function isAdminPath(path: string): boolean {
  return path.startsWith('/admin/')
}

export async function mockAdmin(method: string, path: string, body: unknown, query: Record<string, unknown> | undefined, account: AccountSummary | null): Promise<unknown> {
  seed()
  await wait(220 + Math.random() * 380)
  if (!navigator.onLine) throw new ApiError('NETWORK')
  if (!account) throw new ApiError('UNAUTHORIZED', 401)
  if (!isMockAdmin(account)) throw new ApiError('FORBIDDEN', 403)
  const data = (body ?? {}) as Record<string, unknown>
  const q = query ?? {}
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent)
  const route = `${method} ${path
    .replace(/^\/admin\/invites\/[^/]+\/resend$/, '/admin/invites/:id/resend')
    .replace(/^\/admin\/invites\/[^/]+$/, '/admin/invites/:id')
    .replace(/^\/admin\/members\/[^/]+(\/(?:suspend|reactivate|sessions))?$/, '/admin/members/:id$1')
    .replace(/^\/admin\/groups\/[^/]+$/, '/admin/groups/:id')
    .replace(/^\/admin\/recovery\/[^/]+\/(material|approve|deny)$/, '/admin/recovery/:id/$1')
    .replace(/^\/admin\/devices\/[^/]+(\/approve)?$/, '/admin/devices/:id$1')
    .replace(/^\/admin\/exports\/[^/]+$/, '/admin/exports/:id')
    .replace(/^\/admin\/compliance\/(certificate|location|dpa|whitepaper)$/, method === 'GET' ? '/admin/compliance/:doc' : '/admin/compliance/$1')
    .replace(/^\/admin\/organization\/admins\/[^/]+\/recovery-key$/, '/admin/organization/admins/:id/recovery-key')}`

  switch (route) {
    case 'GET /admin/overview': {
      const answer: Overview = {
        seats: seatsNow(),
        storage: billing.storage,
        pending: {
          recovery: recovery.map(statusOf).filter((r) => r.status === 'pending' || r.status === 'waiting_second').length,
          devices: devices.filter((d) => d.status === 'pending').length,
          invites: members.filter((m) => m.status === 'invited').length,
        },
        health: {
          domain_verified: organization.domain_status === 'verified',
          key_holders: holders().length,
          org_recovery: policies.org_recovery,
          device_approval: policies.device_approval,
          kits_missing: members.filter((m) => m.status === 'active' && !m.kit_confirmed).length,
        },
        recent: audit.slice(0, 6),
      }
      return answer
    }

    // ---- Members ----
    case 'GET /admin/members': {
      const text = String(q.q ?? '').trim().toLowerCase()
      const list = members
        .filter((m) => (!text || `${m.name} ${m.email}`.toLowerCase().includes(text)) && (!q.status || m.status === q.status) && (!q.role || m.role === q.role))
        .sort((a, b) => (a.status === 'invited' ? 1 : 0) - (b.status === 'invited' ? 1 : 0) || (a.name || a.email).localeCompare(b.name || b.email, 'fr'))
      return page(list, q.cursor, 50)
    }
    case 'GET /admin/seats':
      return seatsNow()
    case 'POST /admin/invites': {
      const invites = data.invites as { email: string; role: MemberRole; group_ids: string[] }[]
      const seats = seatsNow()
      const fresh = invites.filter((i) => !members.some((m) => m.email === i.email.toLowerCase()))
      if (seats.used + seats.pending + fresh.length > seats.total) {
        throw new ApiError('CONFLICT', 409, undefined, undefined, { reason: 'seats', available: Math.max(0, seats.total - seats.used - seats.pending) })
      }
      const outcome = { sent: [] as string[], skipped: [] as { email: string; reason: 'member' | 'invited' }[] }
      for (const invite of invites) {
        const email = invite.email.toLowerCase()
        const existing = members.find((m) => m.email === email)
        if (existing) {
          outcome.skipped.push({ email, reason: existing.status === 'invited' ? 'invited' : 'member' })
          continue
        }
        members.push({ id: `inv-${rand(6)}`, name: '', email, role: invite.role, status: 'invited', group_ids: invite.group_ids, storage_used: 0, last_active_at: null, joined_at: null, invited_at: new Date().toISOString(), kit_confirmed: false, holds_recovery_key: false, devices: 0 })
        outcome.sent.push(email)
        log('member_invited', { kind: 'member', person: { user_id: '', name: email, email } })
      }
      syncAdmins()
      return outcome
    }
    case 'POST /admin/invites/:id/resend':
      if (member(parts[2]!).status !== 'invited') throw new ApiError('CONFLICT', 409)
      return undefined
    case 'DELETE /admin/invites/:id': {
      const target = member(parts[2]!)
      members.splice(members.indexOf(target), 1)
      syncAdmins()
      return undefined
    }
    case 'PATCH /admin/members/:id': {
      const target = member(parts[2]!)
      if (data.role && data.role !== target.role) {
        if (data.role === 'member') {
          const admins = members.filter((m) => m.role === 'admin' && m.status === 'active')
          if (admins.length <= 1) throw new ApiError('CONFLICT', 409, undefined, undefined, { reason: 'last_admin' })
          if (target.holds_recovery_key && holders().length <= policies.recovery_approvals) throw new ApiError('CONFLICT', 409, undefined, undefined, { reason: 'last_key_holder' })
          target.holds_recovery_key = false
        }
        target.role = data.role as MemberRole
        log('role_changed', { kind: 'member', person: person(target) })
      }
      if (Array.isArray(data.group_ids)) {
        target.group_ids = data.group_ids as string[]
        for (const group of groups) group.member_ids = members.filter((m) => m.group_ids.includes(group.id)).map((m) => m.id)
      }
      syncAdmins()
      return target
    }
    case 'POST /admin/members/:id/suspend': {
      const target = member(parts[2]!)
      if (target.id === me().id) throw new ApiError('CONFLICT', 409, undefined, undefined, { reason: 'self' })
      if (target.holds_recovery_key && holders().length <= policies.recovery_approvals) throw new ApiError('CONFLICT', 409, undefined, undefined, { reason: 'last_key_holder' })
      target.status = 'suspended'
      log('member_suspended', { kind: 'member', person: person(target) })
      return target
    }
    case 'POST /admin/members/:id/reactivate': {
      const target = member(parts[2]!)
      target.status = 'active'
      return target
    }
    case 'DELETE /admin/members/:id/sessions':
      member(parts[2]!)
      return { ended: 2 }
    case 'DELETE /admin/members/:id': {
      const target = member(parts[2]!)
      if (target.id === me().id) throw new ApiError('CONFLICT', 409, undefined, undefined, { reason: 'self' })
      if (target.holds_recovery_key && holders().length <= policies.recovery_approvals) throw new ApiError('CONFLICT', 409, undefined, undefined, { reason: 'last_key_holder' })
      const heir = member(String(data.transfer_to))
      if (heir.id === target.id || heir.status !== 'active') throw new ApiError('VALIDATION', 422)
      heir.storage_used += target.storage_used
      members.splice(members.indexOf(target), 1)
      for (const group of groups) group.member_ids = group.member_ids.filter((id) => id !== target.id)
      for (let i = devices.length - 1; i >= 0; i--) if (devices[i]!.member.user_id === target.id) devices.splice(i, 1)
      log('member_removed', { kind: 'member', person: person(target) })
      syncAdmins()
      return undefined
    }

    // ---- Groups ----
    case 'GET /admin/groups':
      return groups
    case 'POST /admin/groups': {
      const name = String(data.name).trim()
      if (groups.some((g) => g.name.toLowerCase() === name.toLowerCase())) throw new ApiError('VALIDATION', 422, undefined, { name: 'taken' })
      const group: Group = { id: `g-${rand(6)}`, name, description: String(data.description ?? ''), member_ids: (data.member_ids as string[]) ?? [], created_at: new Date().toISOString() }
      groups.push(group)
      for (const m of members) if (group.member_ids.includes(m.id)) m.group_ids = [...m.group_ids, group.id]
      return group
    }
    case 'PATCH /admin/groups/:id': {
      const group = groups.find((g) => g.id === parts[2])
      if (!group) throw new ApiError('NOT_FOUND', 404)
      if (typeof data.name === 'string') {
        const name = data.name.trim()
        if (groups.some((g) => g.id !== group.id && g.name.toLowerCase() === name.toLowerCase())) throw new ApiError('VALIDATION', 422, undefined, { name: 'taken' })
        group.name = name
      }
      if (typeof data.description === 'string') group.description = data.description
      if (Array.isArray(data.member_ids)) {
        group.member_ids = data.member_ids as string[]
        for (const m of members) {
          const inside = group.member_ids.includes(m.id)
          m.group_ids = inside ? [...new Set([...m.group_ids, group.id])] : m.group_ids.filter((g) => g !== group.id)
        }
      }
      return group
    }
    case 'DELETE /admin/groups/:id': {
      const index = groups.findIndex((g) => g.id === parts[2])
      if (index < 0) throw new ApiError('NOT_FOUND', 404)
      const [gone] = groups.splice(index, 1)
      for (const m of members) m.group_ids = m.group_ids.filter((g) => g !== gone!.id)
      return undefined
    }

    // ---- Recovery ----
    case 'GET /admin/recovery': {
      const all = recovery.map(statusOf)
      const open = (r: RecoveryRequest) => r.status === 'pending' || r.status === 'waiting_second'
      return (q.scope === 'history' ? all.filter((r) => !open(r)) : all.filter(open)).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    }
    case 'GET /admin/recovery/:id/material': {
      const request = recovery.find((r) => r.id === parts[2])
      if (!request) throw new ApiError('NOT_FOUND', 404)
      if (statusOf(request).status === 'expired') throw new ApiError('GONE', 410)
      if (!me().holds_recovery_key) throw new ApiError('FORBIDDEN', 403, undefined, undefined, { reason: 'no_key' })
      return {
        request_id: request.id,
        threshold: request.required,
        my_share: rand(40),
        received: request.approvals.map(() => rand(60)),
        holders: holders().filter((h) => h.id !== me().id).map((h) => ({ user_id: h.id, x25519: `${h.id}-x`, ed25519: `${h.id}-e`, signature: `${h.id}-s` })),
        identity_by_org: rand(60),
        requester_public_key: rand(32),
      }
    }
    case 'POST /admin/recovery/:id/approve': {
      checkPassphrase(data.auth_key)
      const request = recovery.find((r) => r.id === parts[2])
      if (!request) throw new ApiError('NOT_FOUND', 404)
      const current = statusOf(request)
      if (current.status === 'expired') throw new ApiError('GONE', 410)
      if (current.status !== 'pending' && current.status !== 'waiting_second') throw new ApiError('CONFLICT', 409)
      if (request.approvals.some((a) => a.admin.user_id === me().id)) throw new ApiError('CONFLICT', 409, undefined, undefined, { reason: 'already' })
      request.approvals.push({ admin: person(me()), at: new Date().toISOString() })
      const result = data.result as QuorumResult
      if (result.kind === 'final' || request.approvals.length >= request.required) {
        request.status = 'approved'
        request.decided_at = new Date().toISOString()
        log('recovery_approved', { kind: 'member', person: request.member })
      } else {
        request.status = 'waiting_second'
      }
      return request
    }
    case 'POST /admin/recovery/:id/deny': {
      const request = recovery.find((r) => r.id === parts[2])
      if (!request) throw new ApiError('NOT_FOUND', 404)
      if (statusOf(request).status === 'expired') throw new ApiError('GONE', 410)
      request.status = 'denied'
      request.denied_reason = String(data.reason)
      request.decided_at = new Date().toISOString()
      log('recovery_denied', { kind: 'member', person: request.member })
      return request
    }

    // ---- Devices ----
    case 'GET /admin/devices': {
      const text = String(q.q ?? '').trim().toLowerCase()
      const list = devices.filter(
        (d) => (!text || `${d.member.name} ${d.member.email} ${d.name} ${d.location ?? ''}`.toLowerCase().includes(text)) && (!q.status || d.status === q.status),
      )
      return page(list, q.cursor, 50)
    }
    case 'POST /admin/devices/:id/approve': {
      const device = devices.find((d) => d.id === parts[2])
      if (!device) throw new ApiError('NOT_FOUND', 404)
      if (policies.device_approval !== 'trusted_device_or_admin') throw new ApiError('FORBIDDEN', 403, undefined, undefined, { reason: 'policy' })
      device.status = 'trusted'
      log('device_approved', { kind: 'device', id: device.id })
      return device
    }
    case 'DELETE /admin/devices/:id': {
      const index = devices.findIndex((d) => d.id === parts[2])
      if (index < 0) throw new ApiError('NOT_FOUND', 404)
      const [gone] = devices.splice(index, 1)
      log('device_revoked', { kind: 'device', id: gone!.id })
      return undefined
    }

    // ---- Policies ----
    case 'GET /admin/policies':
      return policies
    case 'PATCH /admin/policies': {
      const { auth_key: authKey, ...change } = data as Partial<Policies> & { auth_key?: string }
      if (change.org_recovery === false && policies.org_recovery) checkPassphrase(authKey)
      if (change.recovery_approvals === 2 && holders().length < 2) throw new ApiError('CONFLICT', 409, undefined, undefined, { reason: 'holders' })
      policies = { ...policies, ...change }
      for (const r of recovery) if (r.status === 'pending') r.required = policies.recovery_approvals
      syncAdmins()
      log('policy_changed', { kind: 'policy', id: Object.keys(change).join(',') })
      return policies
    }

    // ---- Audit ----
    case 'GET /admin/audit':
      return page(filterAudit(q), q.cursor, 50)
    case 'POST /admin/audit/exports': {
      const format = data.format === 'pdf' ? 'pdf' : 'csv'
      const events = filterAudit(data)
      const id = `job-${rand(8)}`
      const job: ExportJob = { id, status: 'preparing', progress: 0, url: null, file_name: `storagego-audit-${new Date().toISOString().slice(0, 10)}.${format}` }
      const csv = csvOf(events)
      const pdf = await dataUrl(tinyPdf(`Audit log - ${events.length} events`))
      jobs.set(id, { job, started: Date.now(), build: () => (format === 'csv' ? `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}` : pdf) })
      log('export_created')
      return job
    }
    case 'GET /admin/exports/:id':
      return jobView(parts[2]!)

    // ---- Compliance ----
    case 'GET /admin/compliance':
      return residency
    case 'GET /admin/compliance/:doc': {
      const kind = parts[2]!
      if (kind === 'dpa' && !residency.dpa.signed_at) throw new ApiError('CONFLICT', 409, undefined, undefined, { reason: 'unsigned' })
      const names: Record<string, string> = { certificate: 'certificat-residence', location: 'localisation-donnees', dpa: 'accord-traitement-donnees', whitepaper: 'livre-blanc-securite' }
      return { url: await dataUrl(tinyPdf(`storageGo - ${names[kind]} - Clinique Atlas`)), file_name: `storagego-${names[kind]}.pdf` }
    }
    case 'POST /admin/compliance/exports': {
      const id = `job-${rand(8)}`
      const job: ExportJob = { id, status: 'preparing', progress: 0, url: null, file_name: `storagego-dossier-conformite-${new Date().toISOString().slice(0, 10)}.zip` }
      jobs.set(id, { job, started: Date.now(), build: () => 'data:application/zip;base64,UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==' })
      log('export_created')
      return job
    }
    case 'POST /admin/compliance/dpa':
      residency = { ...residency, dpa: { signed_at: new Date().toISOString(), signed_by: { ...person(me()), name: String(data.signer_name) } } }
      return residency

    // ---- Billing ----
    case 'GET /admin/billing':
      billing.seats = seatsNow()
      return billing
    case 'POST /admin/billing/seats': {
      const total = Number(data.total)
      const seats = seatsNow()
      if (!Number.isInteger(total) || total < seats.used + seats.pending) throw new ApiError('VALIDATION', 422, undefined, { total: 'below_used' })
      seatTotal = total
      billing.seats = seatsNow()
      billing.storage = { ...billing.storage, limit: total * billing.plan.storage_per_seat }
      return { billing, checkout_url: null }
    }
    case 'POST /admin/billing/plan': {
      const plan = PLANS.find((p) => p.name === data.plan)
      if (!plan) throw new ApiError('VALIDATION', 422)
      billing = { ...billing, plan, storage: { ...billing.storage, limit: seatsNow().total * plan.storage_per_seat } }
      return { billing, checkout_url: null }
    }
    case 'POST /admin/billing/payment-method':
      if (data.kind === 'transfer') {
        billing = { ...billing, payment_method: { kind: 'transfer', reference: billing.transfer.reference } }
        return { checkout_url: null, billing }
      }
      return { checkout_url: '/admin/billing?card=updated', billing }
    case 'GET /admin/billing/invoices': {
      const list: OrgInvoice[] = [0, 1, 2, 3].map((m) => ({ id: `F-2026-${String(41 - m).padStart(4, '0')}`, date: ago(9 + m * 30), amount: 21_600, status: m === 0 ? 'due' : 'paid', url: '#' }))
      return list
    }

    // ---- Organization ----
    case 'GET /admin/organization':
      syncAdmins()
      return organization
    case 'PATCH /admin/organization': {
      if (typeof data.name === 'string') organization.name = data.name.trim()
      if (typeof data.sector === 'string') organization.sector = data.sector
      if (data.domain !== undefined) {
        const domain = data.domain ? String(data.domain).toLowerCase() : null
        if (domain !== organization.domain) {
          organization.domain = domain
          organization.domain_status = domain ? 'pending' : 'none'
          organization.domain_record = domain ? { name: `_storagego.${domain}`, value: `storagego-verify=${rand(24)}` } : null
          domainChecks = 0
        }
      }
      return organization
    }
    case 'POST /admin/organization/domain/check':
      domainChecks += 1
      // The record "appears" on the second check, as DNS often takes a moment.
      if (organization.domain && domainChecks >= 2) organization.domain_status = 'verified'
      return organization
    case 'PUT /admin/organization/logo':
      organization.logo_url = (data.data_url as string | null) ?? null
      return organization
    case 'GET /admin/organization/admins/:id/recovery-key': {
      const target = member(parts[3]!)
      if (target.role !== 'admin') throw new ApiError('CONFLICT', 409)
      if (!me().holds_recovery_key) throw new ApiError('FORBIDDEN', 403, undefined, undefined, { reason: 'no_key' })
      return {
        admin_id: target.id,
        threshold: policies.recovery_approvals,
        my_share: rand(40),
        received: [],
        holders: holders().filter((h) => h.id !== me().id).map((h) => ({ user_id: h.id, x25519: `${h.id}-x`, ed25519: `${h.id}-e`, signature: `${h.id}-s` })),
        recipient: { user_id: target.id, x25519: `${target.id}-x`, ed25519: `${target.id}-e`, signature: `${target.id}-s` },
      }
    }
    case 'POST /admin/organization/admins/:id/recovery-key': {
      checkPassphrase(data.auth_key)
      const target = member(parts[3]!)
      const result = data.result as QuorumResult
      if (result.kind === 'final') target.holds_recovery_key = true
      syncAdmins()
      if (result.kind === 'partial') organization.admins = organization.admins.map((a) => (a.person.user_id === target.id ? { ...a, pending_key: true } : a))
      return organization
    }
  }
  throw new ApiError('NOT_FOUND', 404)
}

/** Starts over from the sample data (after changing a scenario on /dev). */
export function resetMockAdmin() {
  seeded = false
  members.length = 0
  groups.length = 0
  recovery.length = 0
  devices.length = 0
  audit.length = 0
  jobs.clear()
}
