// Organization administration endpoints of the Go API (/v1/admin), for administrators only
// (sitemap §5). The server still never sees file names or content: the audit log records who
// did what to which item id, and the recovery flow moves only sealed keys.
import { api } from './client'
import type { Person } from './drive'
import type { SignedIdentity } from './signup'

export type MemberRole = 'admin' | 'member'
export type MemberStatus = 'active' | 'invited' | 'suspended'

export interface AdminMember {
  id: string
  name: string
  email: string
  role: MemberRole
  status: MemberStatus
  group_ids: string[]
  /** Bytes stored in the organization's space. */
  storage_used: number
  last_active_at: string | null
  joined_at: string | null
  invited_at: string | null
  /** The member confirmed their recovery kit (or made one). */
  kit_confirmed: boolean
  /** An administrator who holds a share of the organization recovery key. */
  holds_recovery_key: boolean
  devices: number
}

export interface Page<T> {
  items: T[]
  next_cursor: string | null
  total: number
}

export interface Seats {
  used: number
  total: number
  /** Invitations count as seats until they expire or are cancelled. */
  pending: number
}

export interface InviteOutcome {
  sent: string[]
  /** Already members or already invited. */
  skipped: { email: string; reason: 'member' | 'invited' }[]
}

export interface Group {
  id: string
  name: string
  description: string
  member_ids: string[]
  created_at: string
}

export type RecoveryStatus = 'pending' | 'waiting_second' | 'approved' | 'denied' | 'expired'

export interface RecoveryRequest {
  id: string
  member: Person
  status: RecoveryStatus
  created_at: string
  /** 72 hours after the request. */
  expires_at: string
  /** The device that asked: "Chrome on Android", and where the network places it. */
  device: string
  location: string | null
  /** What the member wrote when asking. */
  reason: string
  /** Administrators who approved so far. */
  approvals: { admin: Person; at: string }[]
  /** Approvals needed (organization policy). */
  required: number
  decided_at: string | null
  denied_reason: string | null
}

/**
 * What an approving administrator's device needs (contract/recovery_material.json): their own
 * share of the organization recovery key, any share another administrator sealed to them, the
 * member's identity escrowed to the organization key, and the requesting device's public key.
 */
export interface RecoveryMaterial {
  request_id: string
  threshold: number
  my_share: string
  received: string[]
  /** The other key holders, for a first approval to seal its share to them. */
  holders: SignedIdentity[]
  identity_by_org: string
  requester_public_key: string
}

/** A quorum step: a share passed on to the other holders, or the finished result. */
export type QuorumResult =
  | { kind: 'partial'; shares: { admin_id: string; sealed: string }[] }
  | { kind: 'final'; payload: string }

export interface GrantMaterial {
  admin_id: string
  threshold: number
  my_share: string
  received: string[]
  holders: SignedIdentity[]
  /** The administrator receiving a share. */
  recipient: SignedIdentity
}

export interface OrgDevice {
  id: string
  member: Person
  name: string
  location: string | null
  status: 'trusted' | 'pending'
  public_key: string
  created_at: string
  last_active_at: string
}

export type DeviceApproval = 'none' | 'trusted_device' | 'trusted_device_or_admin'

export interface Policies {
  links_allowed: boolean
  /** Longest a share link can stay valid, in days (null: no limit). */
  max_link_days: number | null
  link_password_required: boolean
  requests_allowed: boolean
  device_approval: DeviceApproval
  /** Hours a session lasts before signing in again. */
  session_hours: number
  /** Minutes of inactivity before the keys are cleared from the tab (null: never). */
  idle_lock_minutes: number | null
  org_recovery: boolean
  recovery_approvals: 1 | 2
  kit_required: boolean
  trash_days: number
}

export type AuditAction =
  | 'signed_in'
  | 'sign_in_failed'
  | 'device_added'
  | 'device_approved'
  | 'device_revoked'
  | 'passphrase_changed'
  | 'kit_regenerated'
  | 'file_uploaded'
  | 'file_downloaded'
  | 'file_deleted'
  | 'item_shared'
  | 'link_created'
  | 'link_opened'
  | 'link_revoked'
  | 'request_upload'
  | 'member_invited'
  | 'member_joined'
  | 'member_suspended'
  | 'member_removed'
  | 'role_changed'
  | 'recovery_requested'
  | 'recovery_approved'
  | 'recovery_denied'
  | 'policy_changed'
  | 'export_created'

/** Never a file name or content: the server doesn't have them. Items appear by id. */
export interface AuditEvent {
  id: string
  at: string
  action: AuditAction
  actor: Person | null
  /** The member, link or item acted on: a person, or an id with its kind. */
  target: { kind: 'member'; person: Person } | { kind: 'item' | 'link' | 'device' | 'policy'; id: string } | null
  ip: string | null
  location: string | null
}

export interface AuditQuery {
  actor?: string
  action?: AuditAction
  from?: string
  to?: string
  cursor?: string
}

export interface ExportJob {
  id: string
  status: 'preparing' | 'ready' | 'failed'
  /** 0–1 while preparing. */
  progress: number
  url: string | null
  /** The file name the download will have. */
  file_name: string
}

export interface Residency {
  datacenters: { wilaya: string; city: string; role: 'primary' | 'replica'; operator: string }[]
  certificate: {
    number: string
    issued_at: string
    valid_until: string
    issuer: string
  }
  dpa: { signed_at: string | null; signed_by: Person | null }
}

export interface OrgPlan {
  name: string
  /** Monthly price per seat, in dinars. */
  seat_price: number
  /** Bytes per seat, pooled for the organization. */
  storage_per_seat: number
}

export interface OrgBilling {
  plan: OrgPlan
  plans: OrgPlan[]
  seats: Seats
  storage: { used: number; limit: number }
  renews_at: string
  payment_method: { kind: 'cib' | 'edahabia'; last4: string } | { kind: 'transfer'; reference: string } | null
  /** Bank details for a transfer (virement). */
  transfer: { bank: string; account_name: string; rib: string; reference: string }
}

export interface OrgInvoice {
  id: string
  date: string
  amount: number
  status: 'paid' | 'due' | 'overdue'
  url: string
}

export interface Organization {
  id: string
  name: string
  sector: string
  domain: string | null
  domain_status: 'verified' | 'pending' | 'none'
  /** The DNS TXT record proving the domain. */
  domain_record: { name: string; value: string } | null
  logo_url: string | null
  created_at: string
  admins: { person: Person; holds_recovery_key: boolean; pending_key: boolean }[]
  recovery_threshold: number
}

export interface Overview {
  seats: Seats
  storage: { used: number; limit: number }
  pending: { recovery: number; devices: number; invites: number }
  health: {
    domain_verified: boolean
    key_holders: number
    org_recovery: boolean
    device_approval: DeviceApproval
    kits_missing: number
  }
  recent: AuditEvent[]
}

const id = (value: string) => encodeURIComponent(value)

export const adminApi = {
  overview: () => api<Overview>('/admin/overview'),

  // ---- Members ----
  members: (query: { q?: string; status?: MemberStatus; role?: MemberRole; cursor?: string }) =>
    api<Page<AdminMember>>('/admin/members', { query }),
  seats: () => api<Seats>('/admin/seats'),
  invite: (invites: { email: string; role: MemberRole; group_ids: string[] }[]) =>
    api<InviteOutcome>('/admin/invites', { method: 'POST', body: { invites } }),
  resendInvite: (memberId: string) => api<void>(`/admin/invites/${id(memberId)}/resend`, { method: 'POST' }),
  cancelInvite: (memberId: string) => api<void>(`/admin/invites/${id(memberId)}`, { method: 'DELETE' }),
  setRole: (memberId: string, role: MemberRole) => api<AdminMember>(`/admin/members/${id(memberId)}`, { method: 'PATCH', body: { role } }),
  setGroups: (memberId: string, groupIds: string[]) =>
    api<AdminMember>(`/admin/members/${id(memberId)}`, { method: 'PATCH', body: { group_ids: groupIds } }),
  suspend: (memberId: string) => api<AdminMember>(`/admin/members/${id(memberId)}/suspend`, { method: 'POST' }),
  reactivate: (memberId: string) => api<AdminMember>(`/admin/members/${id(memberId)}/reactivate`, { method: 'POST' }),
  /** Ends every session of the member (a lost laptop, someone leaving). */
  signOutEverywhere: (memberId: string) => api<{ ended: number }>(`/admin/members/${id(memberId)}/sessions`, { method: 'DELETE' }),
  /** Their files in the organization go to `transferTo` first; then the member is removed. */
  remove: (memberId: string, transferTo: string) =>
    api<void>(`/admin/members/${id(memberId)}`, { method: 'DELETE', body: { transfer_to: transferTo } }),

  // ---- Groups ----
  groups: () => api<Group[]>('/admin/groups'),
  createGroup: (group: { name: string; description: string; member_ids: string[] }) => api<Group>('/admin/groups', { method: 'POST', body: group }),
  updateGroup: (groupId: string, change: Partial<Pick<Group, 'name' | 'description' | 'member_ids'>>) =>
    api<Group>(`/admin/groups/${id(groupId)}`, { method: 'PATCH', body: change }),
  deleteGroup: (groupId: string) => api<void>(`/admin/groups/${id(groupId)}`, { method: 'DELETE' }),

  // ---- Recovery ----
  recoveryRequests: (scope: 'open' | 'history') => api<RecoveryRequest[]>('/admin/recovery', { query: { scope } }),
  recoveryMaterial: (requestId: string) => api<RecoveryMaterial>(`/admin/recovery/${id(requestId)}/material`),
  /** Proves this admin's passphrase (auth key) and hands in this admin's quorum step. */
  approveRecovery: (requestId: string, authKey: string, result: QuorumResult) =>
    api<RecoveryRequest>(`/admin/recovery/${id(requestId)}/approve`, { method: 'POST', body: { auth_key: authKey, result }, timeout: 30_000 }),
  denyRecovery: (requestId: string, reason: string) =>
    api<RecoveryRequest>(`/admin/recovery/${id(requestId)}/deny`, { method: 'POST', body: { reason } }),

  // ---- Devices ----
  devices: (query: { q?: string; status?: 'pending'; cursor?: string }) => api<Page<OrgDevice>>('/admin/devices', { query }),
  approveDevice: (deviceId: string) => api<OrgDevice>(`/admin/devices/${id(deviceId)}/approve`, { method: 'POST' }),
  revokeDevice: (deviceId: string) => api<void>(`/admin/devices/${id(deviceId)}`, { method: 'DELETE' }),

  // ---- Policies ----
  policies: () => api<Policies>('/admin/policies'),
  /** Turning org recovery off needs the admin's passphrase (auth key). */
  updatePolicies: (change: Partial<Policies>, authKey?: string) =>
    api<Policies>('/admin/policies', { method: 'PATCH', body: { ...change, ...(authKey ? { auth_key: authKey } : {}) } }),

  // ---- Audit ----
  audit: (query: AuditQuery) => api<Page<AuditEvent>>('/admin/audit', { query: { ...query } }),
  exportAudit: (query: AuditQuery & { format: 'csv' | 'pdf' }) => api<ExportJob>('/admin/audit/exports', { method: 'POST', body: query }),
  exportJob: (jobId: string) => api<ExportJob>(`/admin/exports/${id(jobId)}`),

  // ---- Compliance ----
  residency: () => api<Residency>('/admin/compliance'),
  /** The signed residency certificate (PDF) or the data location statement. */
  document: (kind: 'certificate' | 'location' | 'dpa' | 'whitepaper') => api<{ url: string; file_name: string }>(`/admin/compliance/${kind}`),
  exportPack: (range: { from: string; to: string }) => api<ExportJob>('/admin/compliance/exports', { method: 'POST', body: range }),
  signDpa: (signerName: string) => api<Residency>('/admin/compliance/dpa', { method: 'POST', body: { signer_name: signerName } }),

  // ---- Billing ----
  billing: () => api<OrgBilling>('/admin/billing'),
  setSeats: (total: number) => api<{ billing: OrgBilling; checkout_url: string | null }>('/admin/billing/seats', { method: 'POST', body: { total } }),
  setPlan: (name: string) => api<{ billing: OrgBilling; checkout_url: string | null }>('/admin/billing/plan', { method: 'POST', body: { plan: name } }),
  setPaymentMethod: (kind: 'card' | 'transfer') => api<{ checkout_url: string | null; billing: OrgBilling }>('/admin/billing/payment-method', { method: 'POST', body: { kind } }),
  invoices: () => api<OrgInvoice[]>('/admin/billing/invoices'),

  // ---- Organization ----
  organization: () => api<Organization>('/admin/organization'),
  updateOrganization: (change: { name?: string; sector?: string; domain?: string | null }) =>
    api<Organization>('/admin/organization', { method: 'PATCH', body: change }),
  checkDomain: () => api<Organization>('/admin/organization/domain/check', { method: 'POST' }),
  /** PNG, JPEG or SVG, 1 MB at most; sent as a data URL. */
  setLogo: (dataUrl: string | null) => api<Organization>('/admin/organization/logo', { method: 'PUT', body: { data_url: dataUrl } }),
  grantMaterial: (adminId: string) => api<GrantMaterial>(`/admin/organization/admins/${id(adminId)}/recovery-key`),
  grantRecoveryKey: (adminId: string, authKey: string, result: QuorumResult) =>
    api<Organization>(`/admin/organization/admins/${id(adminId)}/recovery-key`, { method: 'POST', body: { auth_key: authKey, result } }),
}
