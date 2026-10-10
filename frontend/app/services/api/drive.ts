// Drive endpoints of the Go API (/v1). The server stores structure (ids, parents, sizes,
// dates, who has access) and encrypted blobs. Names and keys arrive encrypted and are only
// opened on the device, by the crypto core.
import { api } from './client'
import type { SignedIdentity } from './signup'

export type ItemKind = 'folder' | 'file'
export type Role = 'owner' | 'editor' | 'viewer'
export type ShareRole = 'editor' | 'viewer'

export interface Person {
  user_id: string
  name: string
  email: string
}

/** What the server holds about a file or folder. */
export interface ItemRecord {
  id: string
  kind: ItemKind
  parent_id: string | null
  /** The name, encrypted under the item's own key (AAD = item id). */
  enc_name: string
  /** The item key wrapped by its parent folder's key. */
  wrapped_key: string
  /** Items shared with me: the item key sealed to my identity (HPKE) instead. */
  sealed_key?: string | null
  /**
   * Ancestors from the workspace root down to the parent, for lists that mix folders (recent,
   * starred, trash, search): the device opens each key on the way down.
   */
  path?: ItemRecord[]
  /** Plaintext size in bytes (0 for folders). */
  size: number
  created_at: string
  updated_at: string
  trashed_at?: string | null
  owner: Person
  role: Role
  /** Shared with someone or reachable by a link. */
  shared: boolean
  starred: boolean
  versions: number
}

export interface Page<T> {
  items: T[]
  next_cursor: string | null
}

export interface FolderPage extends Page<ItemRecord> {
  /** The folder itself, with its path, for breadcrumbs and permissions. */
  folder: ItemRecord
}

export interface Workspace {
  id: string
  kind: 'personal' | 'org'
  name: string
  /** The root folder record (sealed to me for an organization). */
  root: ItemRecord
  /** In an organization: whether I administer it. */
  admin: boolean
}

export interface Quota {
  used: number
  limit: number
  /** Largest single file accepted. */
  per_file_limit: number
  /** Wilaya codes of the datacenters holding the data, e.g. ["16", "31"]. */
  wilayas: string[]
  /** Who can add space (organizations), named in the "storage full" message. */
  contact: Person | null
}

export interface Member {
  person: Person
  role: ShareRole
  /** Fingerprint of their identity key, grouped ("7F3A 91C0 …"). */
  fingerprint: string
  /** Their identity key changed since this share was made. */
  key_changed: boolean
  since: string
}

export interface LinkInfo {
  id: string
  item_id: string
  created_at: string
  expires_at: string | null
  max_downloads: number | null
  downloads: number
  has_password: boolean
  revoked_at: string | null
  /** On the "My links" page: the item, to show its name. */
  item?: ItemRecord
}

export interface Access {
  owner: Person
  members: Member[]
  links: LinkInfo[]
  /** Organization policy: external links allowed, and the longest expiry permitted (days, null = no limit). */
  policy: { links_allowed: boolean; max_link_days: number | null; policy_contact: Person | null }
}

export interface DirectoryEntry {
  person: Person
  identity: SignedIdentity
  fingerprint: string
  /** The identity I last shared with, when it differs from the current one (key change). */
  last_seen: SignedIdentity | null
}

export interface Version {
  id: string
  size: number
  created_at: string
  created_by: Person
  current: boolean
}

export type ActivityAction =
  | 'created'
  | 'uploaded'
  | 'renamed'
  | 'moved'
  | 'shared'
  | 'unshared'
  | 'link_created'
  | 'link_revoked'
  | 'downloaded'
  | 'trashed'
  | 'restored'
  | 'version_restored'

/** Events never contain names or content: the server doesn't have them. */
export interface ActivityEvent {
  id: string
  action: ActivityAction
  actor: Person
  at: string
}

export interface FileRequestInfo {
  id: string
  folder: ItemRecord
  title: string
  created_at: string
  expires_at: string | null
  uploads: number
  closed_at: string | null
}

export interface Notification {
  id: string
  /** `recovery`: a member asked administrators for their access back (admins only). */
  kind: 'shared' | 'device' | 'request_upload' | 'storage' | 'recovery'
  actor: Person | null
  at: string
  read: boolean
  item?: ItemRecord
}

/** Built by the crypto core (contract/share_grant.json). */
export interface ShareGrant {
  item_id: string
  recipient_id: string
  role: ShareRole
  sealed_key: string
  recipient_fingerprint: string
}

/** Built by the crypto core (contract/link_record.json). */
export interface LinkRecord {
  link_id: string
  wrapped_key: string
  password?: { salt: string; kdf: { m_kib: number; t: number; p: number } } | null
}

/** Built by the crypto core (contract/file_request.json). */
export interface FileRequestRecord {
  request_id: string
  folder_id: string
  public_key: string
  wrapped_secret: string
}

/** Built by the crypto core (contract/new_folder.json). */
export interface NewFolder {
  id: string
  parent_id: string
  enc_name: string
  wrapped_key: string
}

const id = (value: string) => encodeURIComponent(value)

export const driveApi = {
  workspaces: () => api<Workspace[]>('/account/workspaces'),
  quota: (workspaceId: string) => api<Quota>(`/workspaces/${id(workspaceId)}/quota`),

  children: (folderId: string, cursor?: string | null) =>
    api<FolderPage>(`/drive/items/${id(folderId)}/children`, { query: { cursor: cursor ?? undefined, limit: 200 } }),
  item: (itemId: string) => api<ItemRecord>(`/drive/items/${id(itemId)}`),

  recent: (workspaceId: string) => api<Page<ItemRecord>>(`/workspaces/${id(workspaceId)}/recent`),
  starred: (workspaceId: string) => api<Page<ItemRecord>>(`/workspaces/${id(workspaceId)}/starred`),
  trash: (workspaceId: string, cursor?: string | null) =>
    api<Page<ItemRecord>>(`/workspaces/${id(workspaceId)}/trash`, { query: { cursor: cursor ?? undefined } }),
  sharedWithMe: (cursor?: string | null) => api<Page<ItemRecord>>('/drive/shared', { query: { cursor: cursor ?? undefined } }),
  /** Every item of a workspace (paged), for searching names on the device. */
  index: (workspaceId: string, cursor?: string | null) =>
    api<Page<ItemRecord>>(`/workspaces/${id(workspaceId)}/index`, { query: { cursor: cursor ?? undefined, limit: 1000 } }),

  createFolder: (folder: NewFolder, idempotencyKey: string) =>
    api<ItemRecord>('/drive/folders', { method: 'POST', body: folder, idempotencyKey }),
  rename: (itemId: string, encName: string) =>
    api<ItemRecord>(`/drive/items/${id(itemId)}`, { method: 'PATCH', body: { enc_name: encName } }),
  move: (itemId: string, parentId: string, wrappedKey: string) =>
    api<ItemRecord>(`/drive/items/${id(itemId)}/move`, { method: 'POST', body: { parent_id: parentId, wrapped_key: wrappedKey } }),
  setStarred: (itemId: string, starred: boolean) =>
    api<void>(`/drive/items/${id(itemId)}/star`, { method: starred ? 'PUT' : 'DELETE' }),
  trashItems: (ids: string[]) => api<void>('/drive/trash', { method: 'POST', body: { ids } }),
  restoreItems: (ids: string[]) => api<void>('/drive/trash/restore', { method: 'POST', body: { ids } }),
  /** Destroys the items and their keys. Not even a backup can open them afterwards. */
  deleteForever: (ids: string[]) => api<void>('/drive/trash/delete', { method: 'POST', body: { ids } }),

  versions: (itemId: string) => api<Version[]>(`/drive/items/${id(itemId)}/versions`),
  restoreVersion: (itemId: string, versionId: string) =>
    api<ItemRecord>(`/drive/items/${id(itemId)}/versions/${id(versionId)}/restore`, { method: 'POST' }),
  activity: (itemId: string) => api<ActivityEvent[]>(`/drive/items/${id(itemId)}/activity`),

  access: (itemId: string) => api<Access>(`/drive/items/${id(itemId)}/access`),
  directory: (query: string) => api<DirectoryEntry[]>('/org/directory', { query: { q: query } }),
  share: (grant: ShareGrant) => api<Member>(`/drive/items/${id(grant.item_id)}/shares`, { method: 'POST', body: grant }),
  changeRole: (itemId: string, userId: string, role: ShareRole) =>
    api<void>(`/drive/items/${id(itemId)}/shares/${id(userId)}`, { method: 'PATCH', body: { role } }),
  unshare: (itemId: string, userId: string) =>
    api<void>(`/drive/items/${id(itemId)}/shares/${id(userId)}`, { method: 'DELETE' }),

  createLink: (itemId: string, record: LinkRecord, options: { expires_at: string | null; max_downloads: number | null }) =>
    api<LinkInfo>(`/drive/items/${id(itemId)}/links`, { method: 'POST', body: { record, ...options } }),
  revokeLink: (linkId: string) => api<void>(`/links/${id(linkId)}`, { method: 'DELETE' }),
  myLinks: (workspaceId: string) => api<Page<LinkInfo>>(`/workspaces/${id(workspaceId)}/links`),

  requests: (workspaceId: string) => api<Page<FileRequestInfo>>(`/workspaces/${id(workspaceId)}/requests`),
  createRequest: (record: FileRequestRecord, options: { title: string; expires_at: string | null }) =>
    api<FileRequestInfo>('/requests', { method: 'POST', body: { record, ...options } }),
  closeRequest: (requestId: string) => api<void>(`/requests/${id(requestId)}`, { method: 'DELETE' }),

  notifications: () => api<Notification[]>('/notifications'),
  markNotificationsRead: () => api<void>('/notifications/read', { method: 'POST' }),
}
