// DEV ONLY. An in-memory imitation of the Go API's drive endpoints and of encrypted storage,
// with plausible sample data, so every drive screen can be used before the backend exists.
// Only imported behind `import.meta.dev && devMocks`. Names are "encrypted" with a trivial
// reversible encoding that only the mock crypto engine reads.
//
// Public pages: sample share links and file requests for every state the recipient can meet
// (see PUBLIC_SAMPLES below; /dev opens each one). The password of protected links is "atlas2026".
//
// Scenarios (set from /dev, stored in sessionStorage "sg_dev_drive"):
//   empty: a brand-new organization · quota: '95' | '100' · failList: listing fails
//   slow: slow network · many: 1,500 files in "Archives scannées"
import type { AccountSummary } from '../api/auth'
import { ApiError } from '../api/client'
import type {
  Access,
  ActivityEvent,
  DirectoryEntry,
  FileRequestInfo,
  ItemRecord,
  LinkInfo,
  LinkRecord,
  Member,
  Notification,
  Person,
  Quota,
  Version,
  Workspace,
} from '../api/drive'
import type { PublicFolder, PublicItem, PublicLink, PublicRequest, RequestUploadInit } from '../api/public'
import type { UploadInit } from '../api/transfer'
import { isMockAdmin } from './mockAdmin'

// ---- Name "encryption" shared with the mock crypto engine ----
export function encodeName(name: string): string {
  return `n:${btoa(String.fromCharCode(...new TextEncoder().encode(name)))}`
}
export function decodeName(enc: string): string | null {
  if (!enc.startsWith('n:')) return null
  return new TextDecoder().decode(Uint8Array.from(atob(enc.slice(2)), (c) => c.charCodeAt(0)))
}
/** Files whose stored bytes were "altered": decryption fails (SG_ERR_AUTH). */
export const alteredIds = new Set<string>(['x-ordonnance'])

// ---- Scenario ----
interface Scenario {
  empty?: boolean
  quota?: '95' | '100'
  failList?: boolean
  slow?: boolean
  many?: boolean
}
function scenario(): Scenario {
  try {
    return JSON.parse(sessionStorage.getItem('sg_dev_drive') ?? '{}') as Scenario
  } catch {
    return {}
  }
}
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const latency = () => wait(scenario().slow ? 1800 + Math.random() * 1200 : 250 + Math.random() * 350)

// ---- People ----
const me: Person = { user_id: 'dev-user', name: 'Karim Haddad', email: 'karim@clinique-atlas.dz' }
const nadia: Person = { user_id: 'u-nadia', name: 'Nadia Bouzid', email: 'nadia.bouzid@clinique-atlas.dz' }
const yacine: Person = { user_id: 'u-yacine', name: 'Yacine Belkacem', email: 'yacine.belkacem@clinique-atlas.dz' }
const samia: Person = { user_id: 'u-samia', name: 'Samia Kaci', email: 'samia.kaci@clinique-atlas.dz' }
const amine: Person = { user_id: 'u-amine', name: 'Amine Saidi', email: 'amine.saidi@clinique-atlas.dz' }
const identity = (id: string, key: string) => ({ user_id: id, x25519: `${key}-x`, ed25519: `${key}-e`, signature: `${key}-s` })
const directory: DirectoryEntry[] = [
  // Nadia's key changed since Karim last shared with her: sharing asks to verify first.
  { person: nadia, identity: identity(nadia.user_id, 'nadia-2026'), fingerprint: 'B1E9 19D6 D0B1 68A7 D742 B9A2 C97F C4A1', last_seen: identity(nadia.user_id, 'nadia-2025') },
  { person: yacine, identity: identity(yacine.user_id, 'yacine'), fingerprint: '4C2A 8E71 0F93 D5B8 61AA 2E07 9C34 B6F0', last_seen: identity(yacine.user_id, 'yacine') },
  { person: samia, identity: identity(samia.user_id, 'samia'), fingerprint: '7F3A 91C0 2B8E 44D1 A9C6 0E52 F17B 3D88', last_seen: null },
  { person: amine, identity: identity(amine.user_id, 'amine'), fingerprint: 'E05D 3B94 C27A 81F6 0D4E 9A13 B8C5 72E9', last_seen: null },
]

// ---- Items ----
interface Item extends ItemRecord {
  workspace: 'ws-org' | 'ws-me'
  name: string
  content?: Blob
}
const items = new Map<string, Item>()
const shares = new Map<string, Member[]>()
const links: LinkInfo[] = []
/** What a link's owner sent when creating it (the wrapped link key), by link id. */
const linkRecords = new Map<string, LinkRecord>()
const requests: FileRequestInfo[] = []
const usage: Record<string, number> = { 'ws-org': 42_300_000_000, 'ws-me': 1_200_000_000 }
let seeded = false

const ago = (days: number, hours = 0) => new Date(Date.now() - days * 86_400_000 - hours * 3_600_000).toISOString()
const rand = (n = 16) => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(n)))).replace(/[+/=]/g, '')

function add(
  id: string,
  name: string,
  parent: string | null,
  workspace: Item['workspace'],
  extra: Partial<Item> = {},
): Item {
  const kind = extra.kind ?? (name.includes('.') ? 'file' : 'folder')
  const item: Item = {
    id,
    kind,
    parent_id: parent,
    enc_name: encodeName(name),
    wrapped_key: `wk-${id}-${rand(8)}`,
    size: 0,
    created_at: ago(40),
    updated_at: ago(10),
    trashed_at: null,
    owner: me,
    role: 'owner',
    shared: false,
    starred: false,
    versions: kind === 'file' ? 1 : 0,
    workspace,
    name,
    ...extra,
  }
  items.set(id, item)
  return item
}

function seed() {
  if (seeded) return
  seeded = true
  const s = scenario()
  add('root-org', 'Clinique Atlas', null, 'ws-org', { kind: 'folder' })
  add('root-me', 'Karim Haddad', null, 'ws-me', { kind: 'folder' })
  // Personal space
  add('p-cv', 'CV_Karim_Haddad.pdf', 'root-me', 'ws-me', { size: 184_000, updated_at: ago(12) })
  add('p-photos', 'Photos famille', 'root-me', 'ws-me', { updated_at: ago(30) })
  add('p-mariage', 'Mariage_Ahmed.jpg', 'p-photos', 'ws-me', { size: 3_400_000, updated_at: ago(30) })
  if (s.empty) return

  // Organization
  add('f-patients', 'Dossiers patients', 'root-org', 'ws-org', { updated_at: ago(0, 2), shared: true })
  add('f-compta', 'Comptabilité 2025', 'root-org', 'ws-org', { updated_at: ago(1) })
  add('f-rh', 'Ressources humaines', 'root-org', 'ws-org', { updated_at: ago(4) })
  add('f-proto', 'Protocoles de soins', 'root-org', 'ws-org', { owner: nadia, role: 'viewer', updated_at: ago(6), shared: true })

  add('x-0457', 'ملف المريض - 0457.pdf', 'f-patients', 'ws-org', { size: 842_000, updated_at: ago(0, 3), shared: true })
  add('x-0458', 'ملف المريض - 0458.pdf', 'f-patients', 'ws-org', { size: 911_500, updated_at: ago(0, 5) })
  add('x-irm', 'Compte-rendu_IRM_0457.txt', 'f-patients', 'ws-org', { size: 2_900, updated_at: ago(0, 2) })
  add('x-ordonnance', 'Scan_ordonnance_0459.pdf', 'f-patients', 'ws-org', { size: 455_000, updated_at: ago(2), versions: 2 })
  add('x-radio', 'Radio_thorax_0457.png', 'f-patients', 'ws-org', { size: 1_640_000, updated_at: ago(1, 6) })
  add('f-analyses', 'Analyses 2025', 'f-patients', 'ws-org', { updated_at: ago(2) })
  add('x-analyse', 'Analyse_sang_0457.pdf', 'f-analyses', 'ws-org', { size: 268_000, updated_at: ago(2) })

  add('x-bilan', 'Bilan_2025_SARL-Atlas.pdf', 'f-compta', 'ws-org', { size: 1_204_000, starred: true, shared: true, versions: 3, updated_at: ago(1, 2) })
  add('x-factures', 'Factures_mars.xlsx', 'f-compta', 'ws-org', { size: 96_400, updated_at: ago(8) })
  add('x-releve', 'Relevé_bancaire_BNA_09.pdf', 'f-compta', 'ws-org', { size: 310_000, updated_at: ago(15) })
  add('x-corrupt', 'corrupt', 'f-compta', 'ws-org', { kind: 'file', enc_name: 'corrupt', size: 52_000, updated_at: ago(20) })

  add('x-contrat', 'Contrat_Yacine_Belkacem.docx', 'f-rh', 'ws-org', { size: 64_200, updated_at: ago(4) })
  add('x-planning', 'Planning_garde_octobre.xlsx', 'f-rh', 'ws-org', { size: 38_800, shared: true, starred: true, updated_at: ago(0, 20) })
  add('x-ancien', 'Ancien_planning_septembre.xlsx', 'f-rh', 'ws-org', { size: 37_100, trashed_at: ago(3), updated_at: ago(33) })

  add('x-sterilisation', 'Protocole_sterilisation_v4.pdf', 'f-proto', 'ws-org', { size: 702_000, owner: nadia, role: 'viewer', updated_at: ago(6) })

  add('x-pv', 'Procès-verbal_AG_2025.docx', 'root-org', 'ws-org', { size: 128_000, updated_at: ago(3) })
  add('x-notes', 'Notes_réunion_direction.txt', 'root-org', 'ws-org', { size: 4_100, updated_at: ago(0, 1) })
  add('x-facade', 'Photo_façade_clinique.jpg', 'root-org', 'ws-org', { size: 2_870_000, updated_at: ago(9) })
  add('x-presentation', 'Présentation_partenaires.pptx', 'root-org', 'ws-org', { size: 5_400_000, updated_at: ago(11) })
  add('x-archive', 'Archive_2024.zip', 'root-org', 'ws-org', { size: 2_300_000_000, updated_at: ago(60) })
  add('x-brouillon', 'Brouillon_lettre_CNAS.docx', 'root-org', 'ws-org', { size: 22_000, trashed_at: ago(20), updated_at: ago(25) })

  // Shared with me by Yacine, from a folder I can't see.
  add('x-guide', 'Guide_accueil_patients.pdf', 'hidden-yacine', 'ws-org', {
    size: 1_050_000,
    owner: yacine,
    role: 'editor',
    sealed_key: `sk-${rand(8)}`,
    shared: true,
    updated_at: ago(2),
  })

  if (s.many) {
    add('f-archives', 'Archives scannées', 'root-org', 'ws-org', { updated_at: ago(0, 1) })
    for (let i = 1; i <= 1500; i++) {
      add(`a-${i}`, `Scan_${String(i).padStart(4, '0')}.pdf`, 'f-archives', 'ws-org', { size: 150_000 + ((i * 7919) % 900_000), updated_at: ago(i % 200) })
    }
  }

  shares.set('x-bilan', [
    { person: samia, role: 'viewer', fingerprint: '7F3A 91C0 2B8E 44D1 A9C6 0E52 F17B 3D88', key_changed: false, since: ago(5) },
    { person: yacine, role: 'editor', fingerprint: '4C2A 8E71 0F93 D5B8 61AA 2E07 9C34 B6F0', key_changed: false, since: ago(2) },
  ])
  shares.set('f-patients', [{ person: nadia, role: 'editor', fingerprint: 'A0C1 5E77 92B4 0D3F 6E18 C9A2 47F0 1B5D', key_changed: true, since: ago(30) }])
  shares.set('x-planning', [{ person: amine, role: 'viewer', fingerprint: 'E05D 3B94 C27A 81F6 0D4E 9A13 B8C5 72E9', key_changed: false, since: ago(1) }])
  const soon = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString()
  links.push(
    { id: 'L8KQ2nVx7a', item_id: 'x-bilan', created_at: ago(2), expires_at: soon(5), max_downloads: 10, downloads: 3, has_password: true, revoked_at: null },
    { id: 'Lm3R8pQw2c', item_id: 'x-0457', created_at: ago(12), expires_at: ago(5), max_downloads: null, downloads: 1, has_password: false, revoked_at: null },
    { id: 'LfPat2026x', item_id: 'f-patients', created_at: ago(1), expires_at: soon(6), max_downloads: null, downloads: 0, has_password: false, revoked_at: null },
    { id: 'LrvK9sTq4e', item_id: 'x-releve', created_at: ago(9), expires_at: soon(20), max_downloads: null, downloads: 0, has_password: false, revoked_at: ago(1) },
    { id: 'LmaxD3wn5z', item_id: 'x-factures', created_at: ago(4), expires_at: soon(3), max_downloads: 2, downloads: 2, has_password: false, revoked_at: null },
    { id: 'LaltR7dk2m', item_id: 'x-ordonnance', created_at: ago(1), expires_at: soon(6), max_downloads: null, downloads: 0, has_password: false, revoked_at: null },
    { id: 'LcvKH4m8Rn', item_id: 'p-cv', created_at: ago(0, 3), expires_at: null, max_downloads: null, downloads: 0, has_password: false, revoked_at: null },
  )
  for (const link of links) {
    const password = link.has_password ? btoa('atlas2026') : ''
    linkRecords.set(link.id, {
      link_id: link.id,
      wrapped_key: `mk:${password}:${rand(24)}`,
      password: link.has_password ? { salt: rand(16), kdf: { m_kib: 19456, t: 2, p: 1 } } : null,
    })
  }
  requests.push({
    id: 'aAqPPBH9r8',
    folder: strip(items.get('f-patients')!),
    title: 'Pièces justificatives — dossier 0457',
    created_at: ago(3),
    expires_at: new Date(Date.now() + 27 * 86_400_000).toISOString(),
    uploads: 2,
    closed_at: null,
  })
  requests.push(
    { id: 'rClosed2Fq', folder: strip(items.get('f-compta')!), title: 'Relevés bancaires 2025', created_at: ago(20), expires_at: null, uploads: 5, closed_at: ago(2) },
    { id: 'rExp9Lm2Qa', folder: strip(items.get('f-rh')!), title: 'CV — poste infirmier', created_at: ago(40), expires_at: ago(10), uploads: 7, closed_at: null },
  )
}

/** Public shape of an item, with its path for lists that mix folders. */
function strip(item: Item, withPath = false): ItemRecord {
  const { workspace: _w, name: _n, content: _c, ...record } = item
  if (!withPath) return record
  const path: ItemRecord[] = []
  let parent = item.parent_id ? items.get(item.parent_id) : undefined
  while (parent) {
    path.unshift(strip(parent))
    parent = parent.parent_id ? items.get(parent.parent_id) : undefined
  }
  return { ...record, path }
}

const live = (item: Item) => !item.trashed_at && item.parent_id !== null
const childrenOf = (id: string) => [...items.values()].filter((i) => i.parent_id === id && !i.trashed_at)

function descendants(id: string): string[] {
  const out: string[] = []
  for (const child of [...items.values()].filter((i) => i.parent_id === id)) out.push(child.id, ...descendants(child.id))
  return out
}

function quotaFor(ws: string): Quota {
  const s = scenario()
  const limit = ws === 'ws-org' ? 100_000_000_000 : 20_000_000_000
  const used = s.quota === '100' ? limit : s.quota === '95' ? Math.round(limit * 0.962) : usage[ws]!
  return { used, limit, per_file_limit: 5_000_000_000, wilayas: ws === 'ws-org' ? ['16', '31'] : ['16'], contact: ws === 'ws-org' ? samia : null }
}

function page<T>(all: T[], cursor: unknown, size: number) {
  const start = Number(cursor ?? 0) || 0
  const slice = all.slice(start, start + size)
  return { items: slice, next_cursor: start + size < all.length ? String(start + size) : null }
}

function versionsOf(item: Item): Version[] {
  return Array.from({ length: Math.max(1, item.versions) }, (_, i) => ({
    id: `${item.id}-v${item.versions - i}`,
    size: Math.max(1000, item.size - i * 1700),
    created_at: i === 0 ? item.updated_at : ago(10 * i + 3),
    created_by: i % 2 ? yacine : item.owner,
    current: i === 0,
  }))
}

function activityOf(item: Item): ActivityEvent[] {
  const events: ActivityEvent[] = [{ id: `${item.id}-a1`, action: item.kind === 'file' ? 'uploaded' : 'created', actor: item.owner, at: item.created_at }]
  for (const member of shares.get(item.id) ?? []) events.push({ id: `${item.id}-s-${member.person.user_id}`, action: 'shared', actor: me, at: member.since })
  for (const link of links.filter((l) => l.item_id === item.id)) events.push({ id: `${item.id}-l-${link.id}`, action: 'link_created', actor: me, at: link.created_at })
  if (item.versions > 1) events.push({ id: `${item.id}-v`, action: 'uploaded', actor: yacine, at: item.updated_at })
  return events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
}

function need(id: string): Item {
  const item = items.get(id)
  if (!item) throw new ApiError('NOT_FOUND', 404)
  return item
}

function touch(item: Item) {
  item.updated_at = new Date().toISOString()
}

// ---- Routes ----
/** "/drive/items/abc/shares/u1" → "/drive/items/:id/shares/:id" (most specific first). */
function pattern(path: string): string {
  return path
    .replace(/^\/drive\/items\/[^/]+\/versions\/[^/]+\/restore$/, '/drive/items/:id/versions/:id/restore')
    .replace(/^\/drive\/items\/[^/]+\/shares\/[^/]+$/, '/drive/items/:id/shares/:id')
    .replace(/^\/drive\/items\/[^/]+(\/(?:children|versions|activity|access|shares|links|move|star))?$/, '/drive/items/:id$1')
    .replace(/^\/workspaces\/[^/]+\/(quota|recent|starred|trash|index|links|requests)$/, '/workspaces/:id/$1')
    .replace(/^\/links\/[^/]+$/, '/links/:id')
    .replace(/^\/requests\/[^/]+$/, '/requests/:id')
    .replace(/^\/uploads\/[^/]+\/finish$/, '/uploads/:id/finish')
}
export async function mockDrive(method: string, path: string, body: unknown, query: Record<string, unknown> | undefined, account: AccountSummary | null): Promise<unknown> {
  seed()
  await latency()
  if (!navigator.onLine) throw new ApiError('NETWORK')
  if (!account) throw new ApiError('UNAUTHORIZED', 401)
  const data = (body ?? {}) as Record<string, unknown>
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent)
  const route = `${method} ${pattern(path)}`
  // Request counts per route, for checking load in tests (e.g. none per search keystroke).
  const counts = ((globalThis as { __sgMockCalls?: Record<string, number> }).__sgMockCalls ??= {})
  counts[route] = (counts[route] ?? 0) + 1

  switch (route) {
    case 'GET /account/workspaces': {
      const list: Workspace[] = []
      if (account.kind === 'org') list.push({ id: 'ws-org', kind: 'org', name: 'Clinique Atlas', root: { ...strip(items.get('root-org')!), sealed_key: 'sk-root-org' }, admin: isMockAdmin(account) })
      list.push({ id: 'ws-me', kind: 'personal', name: account.name, root: strip(items.get('root-me')!), admin: false })
      return list
    }
    case 'GET /workspaces/:id/quota':
      return quotaFor(parts[1]!)
    case 'GET /drive/items/:id/children': {
      const folder = need(parts[2]!)
      if (scenario().failList && folder.parent_id === null) throw new ApiError('SERVER', 503)
      const all = childrenOf(folder.id)
      return { folder: strip(folder, true), ...page(all.map((i) => strip(i)), query?.cursor, 200) }
    }
    case 'GET /drive/items/:id':
      return strip(need(parts[2]!), true)
    case 'GET /workspaces/:id/recent':
      return { items: [...items.values()].filter((i) => i.workspace === parts[1] && i.kind === 'file' && live(i) && !i.sealed_key).sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at)).slice(0, 30).map((i) => strip(i, true)), next_cursor: null }
    case 'GET /workspaces/:id/starred':
      return { items: [...items.values()].filter((i) => i.workspace === parts[1] && i.starred && live(i)).map((i) => strip(i, true)), next_cursor: null }
    case 'GET /workspaces/:id/trash':
      return page([...items.values()].filter((i) => i.workspace === parts[1] && i.trashed_at).map((i) => strip(i, true)), query?.cursor, 100)
    case 'GET /workspaces/:id/index':
      return page([...items.values()].filter((i) => i.workspace === parts[1] && live(i) && !i.sealed_key).map((i) => strip(i, true)), query?.cursor, 1000)
    case 'GET /drive/shared':
      return { items: [...items.values()].filter((i) => i.owner.user_id !== me.user_id && live(i) && (i.sealed_key || i.parent_id === 'root-org')).map((i) => ({ ...strip(i), sealed_key: i.sealed_key ?? `sk-${i.id}` })), next_cursor: null }

    case 'POST /drive/folders': {
      const parent = need(String(data.parent_id))
      if (parent.role === 'viewer') throw new ApiError('FORBIDDEN', 403)
      const name = decodeName(String(data.enc_name)) ?? 'Dossier'
      const now = new Date().toISOString()
      return strip(add(String(data.id), name, parent.id, parent.workspace, { kind: 'folder', enc_name: String(data.enc_name), wrapped_key: String(data.wrapped_key), created_at: now, updated_at: now }))
    }
    case 'PATCH /drive/items/:id': {
      const item = need(parts[2]!)
      item.enc_name = String(data.enc_name)
      item.name = decodeName(item.enc_name) ?? item.name
      touch(item)
      return strip(item)
    }
    case 'POST /drive/items/:id/move': {
      const item = need(parts[2]!)
      const target = need(String(data.parent_id))
      if (descendants(item.id).includes(target.id) || target.id === item.id) throw new ApiError('CONFLICT', 409)
      item.parent_id = target.id
      item.wrapped_key = String(data.wrapped_key)
      touch(item)
      return strip(item)
    }
    case 'PUT /drive/items/:id/star':
    case 'DELETE /drive/items/:id/star':
      need(parts[2]!).starred = method === 'PUT'
      return undefined
    case 'POST /drive/trash':
      for (const id of data.ids as string[]) {
        const item = need(id)
        if (item.role === 'viewer') throw new ApiError('FORBIDDEN', 403)
        item.trashed_at = new Date().toISOString()
      }
      return undefined
    case 'POST /drive/trash/restore':
      for (const id of data.ids as string[]) need(id).trashed_at = null
      return undefined
    case 'POST /drive/trash/delete':
      for (const id of data.ids as string[]) {
        const item = need(id)
        usage[item.workspace] = Math.max(0, usage[item.workspace]! - item.size)
        for (const child of descendants(id)) items.delete(child)
        items.delete(id)
      }
      return undefined

    case 'GET /drive/items/:id/versions':
      return versionsOf(need(parts[2]!))
    case 'POST /drive/items/:id/versions/:id/restore': {
      const item = need(parts[2]!)
      item.versions += 1
      touch(item)
      return strip(item)
    }
    case 'GET /drive/items/:id/activity':
      return activityOf(need(parts[2]!))
    case 'GET /drive/items/:id/access': {
      const item = need(parts[2]!)
      const access: Access = {
        owner: item.owner,
        members: shares.get(item.id) ?? [],
        links: links.filter((l) => l.item_id === item.id),
        policy: item.workspace === 'ws-org' ? { links_allowed: true, max_link_days: 30, policy_contact: samia } : { links_allowed: true, max_link_days: null, policy_contact: null },
      }
      return access
    }
    case 'GET /org/directory': {
      const q = String(query?.q ?? '').toLowerCase()
      return directory.filter((d) => `${d.person.name} ${d.person.email}`.toLowerCase().includes(q))
    }
    case 'POST /drive/items/:id/shares': {
      const item = need(parts[2]!)
      const entry = directory.find((d) => d.person.user_id === data.recipient_id)
      if (!entry) throw new ApiError('NOT_FOUND', 404)
      const member: Member = { person: entry.person, role: data.role as Member['role'], fingerprint: entry.fingerprint, key_changed: false, since: new Date().toISOString() }
      shares.set(item.id, [...(shares.get(item.id) ?? []).filter((m) => m.person.user_id !== entry.person.user_id), member])
      // The verified key becomes the one to compare with next time.
      entry.last_seen = entry.identity
      item.shared = true
      return member
    }
    case 'PATCH /drive/items/:id/shares/:id': {
      const list = shares.get(parts[2]!) ?? []
      shares.set(parts[2]!, list.map((m) => (m.person.user_id === parts[4] ? { ...m, role: data.role as Member['role'] } : m)))
      return undefined
    }
    case 'DELETE /drive/items/:id/shares/:id': {
      const item = need(parts[2]!)
      shares.set(item.id, (shares.get(item.id) ?? []).filter((m) => m.person.user_id !== parts[4]))
      item.shared = Boolean(shares.get(item.id)?.length || links.some((l) => l.item_id === item.id && !l.revoked_at))
      return undefined
    }
    case 'POST /drive/items/:id/links': {
      const item = need(parts[2]!)
      const record = data.record as LinkRecord
      linkRecords.set(record.link_id, record)
      const link: LinkInfo = {
        id: record.link_id,
        item_id: item.id,
        created_at: new Date().toISOString(),
        expires_at: (data.expires_at as string | null) ?? null,
        max_downloads: (data.max_downloads as number | null) ?? null,
        downloads: 0,
        has_password: Boolean(record.password),
        revoked_at: null,
      }
      links.unshift(link)
      item.shared = true
      return link
    }
    case 'DELETE /links/:id': {
      const link = links.find((l) => l.id === parts[1])
      if (!link) throw new ApiError('NOT_FOUND', 404)
      link.revoked_at = new Date().toISOString()
      return undefined
    }
    case 'GET /workspaces/:id/links':
      return { items: links.filter((l) => items.get(l.item_id)?.workspace === parts[1]).map((l) => ({ ...l, item: strip(items.get(l.item_id)!, true) })), next_cursor: null }
    case 'GET /workspaces/:id/requests':
      return { items: requests.filter((r) => items.get(r.folder.id)?.workspace === parts[1]), next_cursor: null }
    case 'POST /requests': {
      const record = data.record as { request_id: string; folder_id: string }
      const request: FileRequestInfo = {
        id: record.request_id,
        folder: strip(need(record.folder_id), true),
        title: String(data.title),
        created_at: new Date().toISOString(),
        expires_at: (data.expires_at as string | null) ?? null,
        uploads: 0,
        closed_at: null,
      }
      requests.unshift(request)
      return request
    }
    case 'DELETE /requests/:id': {
      const request = requests.find((r) => r.id === parts[1])
      if (!request) throw new ApiError('NOT_FOUND', 404)
      request.closed_at = new Date().toISOString()
      return undefined
    }
    case 'GET /notifications': {
      const list: Notification[] = [
        ...(isMockAdmin(account) && account.kind === 'org' ? [{ id: 'n0', kind: 'recovery' as const, actor: yacine, at: ago(0, 2), read: false }] : []),
        { id: 'n1', kind: 'shared', actor: yacine, at: ago(0, 2), read: false, item: strip(items.get('x-guide')!) },
        { id: 'n2', kind: 'request_upload', actor: null, at: ago(1), read: false },
        { id: 'n3', kind: 'device', actor: null, at: ago(3), read: true },
      ]
      return list
    }
    case 'POST /notifications/read':
      return undefined
    case 'POST /uploads/:id/finish':
      return finishUpload(parts[1]!)
  }
  throw new ApiError('NOT_FOUND', 404)
}

/** Starts over from the sample data (after changing a scenario on /dev). */
export function resetMockDrive() {
  items.clear()
  shares.clear()
  links.length = 0
  linkRecords.clear()
  linkAttempts.clear()
  requests.length = 0
  generated.clear()
  seeded = false
}

/** Paths the drive mock answers (the rest go to the auth/signup mock). */
export function isDrivePath(path: string): boolean {
  return /^\/(account\/workspaces|workspaces|drive|uploads|files|links|requests|org\/directory|notifications)(\/|$)/.test(path)
}

// ---- Content (what a download returns) ----
const generated = new Map<string, Blob>()

async function contentOf(item: Item): Promise<Blob> {
  if (item.content) return item.content
  const cached = generated.get(item.id)
  if (cached) return cached
  const ext = item.name.split('.').pop()?.toLowerCase() ?? ''
  let blob: Blob
  if (ext === 'txt') {
    blob = new Blob([
      `${item.name}\n\nClinique Atlas — document de démonstration (environnement de développement).\n` +
        'Ce texte a été déchiffré sur cet appareil.\n\nهذا نص تجريبي فُكّ تشفيره على هذا الجهاز.\n',
    ], { type: 'text/plain' })
  } else if (['png', 'jpg', 'jpeg'].includes(ext) && typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(960, 600)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#e6e3dc'
    ctx.fillRect(0, 0, 960, 600)
    ctx.fillStyle = '#1b1a17'
    ctx.font = '28px sans-serif'
    ctx.fillText(item.name, 40, 300)
    ctx.font = '18px sans-serif'
    ctx.fillText('Image de démonstration — déchiffrée sur cet appareil', 40, 340)
    blob = await canvas.convertToBlob({ type: 'image/png' })
  } else if (ext === 'pdf') {
    blob = tinyPdf(item.name.replace(/[^\x20-\x7e]/g, '?'))
  } else {
    blob = new Blob([new Uint8Array(Math.min(item.size, 2_000_000))], { type: 'application/octet-stream' })
  }
  generated.set(item.id, blob)
  return blob
}

/** A minimal valid one-page PDF with one line of text. */
export function tinyPdf(text: string): Blob {
  const safe = text.replace(/[()\\]/g, '')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    '',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  const stream = `BT /F1 16 Tf 60 760 Td (${safe}) Tj 0 -28 Td /F1 11 Tf (Document de demonstration - dechiffre sur cet appareil.) Tj ET`
  objects[3] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((body, i) => {
    offsets.push(out.length)
    out += `${i + 1} 0 obj\n${body}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new Blob([out], { type: 'application/pdf' })
}

// ---- Transfers (tus-like) ----
const uploads = new Map<string, { init: UploadInit; parts: Blob[]; offset: number; replaces: string | null }>()
const speed = () => (scenario().slow ? 600_000 : 6_000_000) // bytes per second

async function sleepAbortable(ms: number, signal?: AbortSignal) {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new DOMException('cancelled', 'AbortError'))
    })
  })
}

function finishUpload(fileId: string): ItemRecord {
  const upload = [...uploads.values()].find((u) => u.init.id === fileId)
  if (!upload) throw new ApiError('NOT_FOUND', 404)
  const content = new Blob(upload.parts)
  const parent = need(upload.init.parent_id)
  const name = decodeName(upload.init.enc_name) ?? 'fichier'
  usage[parent.workspace] = (usage[parent.workspace] ?? 0) + upload.init.plaintext_size
  uploads.delete(fileId)
  if (upload.replaces) {
    const item = need(upload.replaces)
    item.size = upload.init.plaintext_size
    item.versions += 1
    item.content = content
    generated.delete(item.id)
    touch(item)
    return strip(item)
  }
  const now = new Date().toISOString()
  return strip(add(upload.init.id, name, parent.id, parent.workspace, {
    kind: 'file',
    enc_name: upload.init.enc_name,
    wrapped_key: upload.init.wrapped_key,
    size: upload.init.plaintext_size,
    created_at: now,
    updated_at: now,
    content,
  }))
}

export const mockTransfer = {
  async create(init: UploadInit, replaces: string | null): Promise<string> {
    seed()
    await latency()
    if (!navigator.onLine) throw new ApiError('NETWORK')
    const parent = need(init.parent_id)
    if (parent.role === 'viewer') throw new ApiError('FORBIDDEN', 403)
    const quota = quotaFor(parent.workspace)
    if (init.plaintext_size > quota.per_file_limit) throw new ApiError('VALIDATION', 413, undefined, { size: 'too_large' })
    if (quota.used + init.plaintext_size > quota.limit) throw new ApiError('CONFLICT', 507, undefined, undefined, { reason: 'quota' })
    uploads.set(init.id, { init, parts: [], offset: 0, replaces })
    return `mock://upload/${init.id}`
  },
  async offset(url: string): Promise<number> {
    if (!navigator.onLine) throw new ApiError('NETWORK')
    return uploads.get(url.split('/').pop()!)?.offset ?? 0
  },
  async patch(url: string, offset: number, chunk: Blob, signal?: AbortSignal): Promise<number> {
    const upload = uploads.get(url.split('/').pop()!)
    if (!upload) throw new ApiError('NOT_FOUND', 404)
    // Sent in slices so a drop in the middle loses only part of the chunk.
    const slices = Math.max(1, Math.ceil(chunk.size / 500_000))
    for (let i = 0; i < slices; i++) {
      if (!navigator.onLine) throw new ApiError('NETWORK')
      await sleepAbortable(Math.max(30, (chunk.size / slices / speed()) * 1000), signal)
    }
    if (offset !== upload.offset) throw new ApiError('CONFLICT', 409)
    upload.parts.push(chunk)
    upload.offset += chunk.size
    return upload.offset
  },
  async cancel(url: string): Promise<void> {
    uploads.delete(url.split('/').pop()!)
  },
  async download(fileId: string, onProgress?: (received: number) => void, signal?: AbortSignal): Promise<Blob> {
    seed()
    await latency()
    if (!navigator.onLine) throw new ApiError('NETWORK')
    const item = need(fileId)
    const blob = await contentOf(item)
    // Progress is reported against the stored size (sample files are smaller than they claim).
    const steps = 8
    for (let i = 1; i <= steps; i++) {
      if (!navigator.onLine) throw new ApiError('NETWORK')
      await sleepAbortable(Math.min(400, Math.max(60, item.size / speed() / steps * 1000)), signal)
      onProgress?.(Math.round((item.size * i) / steps))
    }
    return blob
  },
}

// ---- Public pages: share links (/s/…) and file requests (/r/…), no account ----
/** Ready-made links and requests for /dev, one per state. */
export const PUBLIC_SAMPLES = {
  file: 'LcvKH4m8Rn',
  password: 'L8KQ2nVx7a',
  folder: 'LfPat2026x',
  expired: 'Lm3R8pQw2c',
  revoked: 'LrvK9sTq4e',
  exhausted: 'LmaxD3wn5z',
  altered: 'LaltR7dk2m',
  request: 'aAqPPBH9r8',
  requestClosed: 'rClosed2Fq',
  requestExpired: 'rExp9Lm2Qa',
} as const

const linkAttempts = new Map<string, { count: number; resetAt: number }>()

function senderOf(item: Item) {
  return { name: item.owner.name, org_name: item.workspace === 'ws-org' ? 'Clinique Atlas' : null }
}

function publicItem(item: Item): PublicItem {
  return { id: item.id, kind: item.kind, parent_id: item.parent_id, enc_name: item.enc_name, wrapped_key: item.wrapped_key, size: item.kind === 'folder' ? folderSize(item.id) : item.size, updated_at: item.updated_at }
}

function folderSize(id: string): number {
  return descendants(id).reduce((sum, child) => sum + (items.get(child)?.kind === 'file' && !items.get(child)?.trashed_at ? items.get(child)!.size : 0), 0)
}

function linkStatus(link: LinkInfo): PublicLink['status'] {
  const item = items.get(link.item_id)
  if (link.revoked_at || !item || item.trashed_at) return 'revoked'
  if (link.expires_at && Date.parse(link.expires_at) < Date.now()) return 'expired'
  if (link.max_downloads !== null && link.downloads >= link.max_downloads) return 'exhausted'
  return 'active'
}

function activeLink(linkId: string): { link: LinkInfo; root: Item } {
  const link = links.find((l) => l.id === linkId)
  if (!link) throw new ApiError('NOT_FOUND', 404)
  if (linkStatus(link) !== 'active') throw new ApiError('GONE', 410)
  return { link, root: need(link.item_id) }
}

/** The item, if it is the link's root or inside it. */
function underRoot(root: Item, id: string): Item {
  const item = need(id)
  if (item.trashed_at) throw new ApiError('NOT_FOUND', 404)
  for (let cursor: Item | undefined = item; cursor; cursor = cursor.parent_id ? items.get(cursor.parent_id) : undefined) {
    if (cursor.id === root.id) return item
  }
  throw new ApiError('NOT_FOUND', 404)
}

function requestStatus(request: FileRequestInfo): PublicRequest['status'] {
  if (request.closed_at) return 'closed'
  if (request.expires_at && Date.parse(request.expires_at) < Date.now()) return 'expired'
  return 'active'
}

const MAX_REQUEST_FILE = 2_000_000_000

export function isPublicPath(path: string): boolean {
  return /^\/(s|r)\//.test(path)
}

export async function mockPublic(method: string, path: string): Promise<unknown> {
  seed()
  await latency()
  if (!navigator.onLine) throw new ApiError('NETWORK')
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent)
  const route = `${method} ${path
    .replace(/^\/s\/[^/]+\/folders\/[^/]+$/, '/s/:id/folders/:id')
    .replace(/^\/s\/[^/]+(\/key)?$/, '/s/:id$1')
    .replace(/^\/r\/[^/]+\/uploads\/[^/]+\/finish$/, '/r/:id/uploads/:id/finish')
    .replace(/^\/r\/[^/]+$/, '/r/:id')}`

  switch (route) {
    case 'GET /s/:id': {
      const link = links.find((l) => l.id === parts[1])
      if (!link) throw new ApiError('NOT_FOUND', 404)
      const status = linkStatus(link)
      const item = items.get(link.item_id)
      const ended = status === 'revoked' ? (link.revoked_at ?? item?.trashed_at ?? null) : status === 'expired' ? link.expires_at : null
      const answer: PublicLink = {
        id: link.id,
        status,
        sender: item ? senderOf(item) : { name: me.name, org_name: null },
        created_at: link.created_at,
        expires_at: link.expires_at,
        ended_at: ended,
        max_downloads: link.max_downloads,
        downloads: link.downloads,
        has_password: link.has_password,
        item: status === 'active' && item ? publicItem(item) : null,
        record: status === 'active' && !link.has_password ? (linkRecords.get(link.id) ?? null) : null,
      }
      return answer
    }
    case 'POST /s/:id/key': {
      const { link } = activeLink(parts[1]!)
      const now = Date.now()
      const tries = linkAttempts.get(link.id)
      const current = tries && tries.resetAt > now ? tries : { count: 0, resetAt: now + 30_000 }
      if (current.count >= 5) throw new ApiError('RATE_LIMITED', 429, Math.ceil((current.resetAt - now) / 1000))
      current.count += 1
      linkAttempts.set(link.id, current)
      return { record: linkRecords.get(link.id)!, attempts_left: 5 - current.count }
    }
    case 'GET /s/:id/folders/:id': {
      const { root } = activeLink(parts[1]!)
      const folder = underRoot(root, parts[3]!)
      if (folder.kind !== 'folder') throw new ApiError('NOT_FOUND', 404)
      // The folders above this one, from the shared root down (empty for the root itself).
      const path: PublicItem[] = []
      if (folder.id !== root.id) {
        for (let cursor = folder.parent_id ? items.get(folder.parent_id) : undefined; cursor; cursor = cursor.parent_id ? items.get(cursor.parent_id) : undefined) {
          path.unshift(publicItem(cursor))
          if (cursor.id === root.id) break
        }
      }
      const answer: PublicFolder = { folder: publicItem(folder), path, items: childrenOf(folder.id).map(publicItem) }
      return answer
    }
    case 'GET /r/:id': {
      const request = requests.find((r) => r.id === parts[1])
      if (!request) throw new ApiError('NOT_FOUND', 404)
      const status = requestStatus(request)
      const folder = items.get(request.folder.id)
      const answer: PublicRequest = {
        id: request.id,
        status,
        requester: folder ? senderOf(folder) : { name: me.name, org_name: null },
        title: request.title,
        created_at: request.created_at,
        expires_at: request.expires_at,
        ended_at: status === 'closed' ? request.closed_at : status === 'expired' ? request.expires_at : null,
        max_file_size: MAX_REQUEST_FILE,
      }
      return answer
    }
    case 'POST /r/:id/uploads/:id/finish': {
      const upload = requestUploads.get(parts[3]!)
      const request = requests.find((r) => r.id === parts[1])
      if (!upload || !request || upload.requestId !== request.id) throw new ApiError('NOT_FOUND', 404)
      // (The mock "ciphertext" is the file itself, so its size isn't init.cipher_size.)
      if (!upload.parts.length && upload.init.plaintext_size > 0) throw new ApiError('CONFLICT', 409)
      const meta = JSON.parse(decodeName(upload.init.sealed_meta) ?? '{}') as { name?: string }
      const folder = need(request.folder.id)
      const now = new Date().toISOString()
      add(upload.init.id, meta.name ?? 'fichier', folder.id, folder.workspace, {
        kind: 'file',
        size: upload.init.plaintext_size,
        created_at: now,
        updated_at: now,
        content: new Blob(upload.parts),
      })
      usage[folder.workspace] = (usage[folder.workspace] ?? 0) + upload.init.plaintext_size
      request.uploads += 1
      requestUploads.delete(upload.init.id)
      return { received_at: now }
    }
  }
  throw new ApiError('NOT_FOUND', 404)
}

const requestUploads = new Map<string, { requestId: string; init: RequestUploadInit; parts: Blob[]; offset: number }>()

export const mockPublicTransfer = {
  async download(linkId: string, fileId: string, onProgress?: (received: number) => void, signal?: AbortSignal): Promise<Blob> {
    seed()
    await latency()
    if (!navigator.onLine) throw new ApiError('NETWORK')
    const { link, root } = activeLink(linkId)
    const item = underRoot(root, fileId)
    if (item.kind !== 'file') throw new ApiError('NOT_FOUND', 404)
    link.downloads += 1
    const blob = await contentOf(item)
    const steps = 8
    for (let i = 1; i <= steps; i++) {
      if (!navigator.onLine) throw new ApiError('NETWORK')
      await sleepAbortable(Math.min(400, Math.max(60, item.size / speed() / steps * 1000)), signal)
      onProgress?.(Math.round((item.size * i) / steps))
    }
    return blob
  },
  async create(requestId: string, init: RequestUploadInit): Promise<string> {
    seed()
    await latency()
    if (!navigator.onLine) throw new ApiError('NETWORK')
    const request = requests.find((r) => r.id === requestId)
    if (!request) throw new ApiError('NOT_FOUND', 404)
    if (requestStatus(request) !== 'active') throw new ApiError('GONE', 410)
    if (init.plaintext_size > MAX_REQUEST_FILE) throw new ApiError('VALIDATION', 413, undefined, { size: 'too_large' })
    if (!requestUploads.has(init.id)) requestUploads.set(init.id, { requestId, init, parts: [], offset: 0 })
    return `mock://request-upload/${init.id}`
  },
  async offset(url: string): Promise<number> {
    if (!navigator.onLine) throw new ApiError('NETWORK')
    const upload = requestUploads.get(url.split('/').pop()!)
    if (!upload) throw new ApiError('NOT_FOUND', 404)
    return upload.offset
  },
  async patch(url: string, offset: number, chunk: Blob, signal?: AbortSignal): Promise<number> {
    const upload = requestUploads.get(url.split('/').pop()!)
    if (!upload) throw new ApiError('NOT_FOUND', 404)
    const slices = Math.max(1, Math.ceil(chunk.size / 500_000))
    for (let i = 0; i < slices; i++) {
      if (!navigator.onLine) throw new ApiError('NETWORK')
      await sleepAbortable(Math.max(30, (chunk.size / slices / speed()) * 1000), signal)
    }
    if (offset !== upload.offset) throw new ApiError('CONFLICT', 409)
    upload.parts.push(chunk)
    upload.offset += chunk.size
    return upload.offset
  },
  async cancel(url: string): Promise<void> {
    requestUploads.delete(url.split('/').pop()!)
  },
}
