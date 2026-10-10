<script setup lang="ts">
import { ApiError } from '~/services/api/client'
import { adminApi, type AdminMember, type Group, type MemberRole, type MemberStatus, type Seats } from '~/services/api/admin'
import type { ActionItem } from '~/utils/menu'

// Members and invitations (sitemap §5): who is in the organization, their role, groups,
// storage, activity and whether they confirmed their recovery kit. Invite people (one by one
// or from a CSV), change roles and groups, suspend, sign out everywhere, remove (their files go
// to someone first). The filters live in the address, so a link to "invited" works.
definePageMeta({ layout: 'app', middleware: ['auth', 'admin'] })
const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const online = useOnline()
const errorMessage = useErrorMessage()
const { account } = useAccount()
const { refresh: refreshOverview } = useAdminOverview()

const members = ref<AdminMember[]>([])
const total = ref(0)
const cursor = ref<string | null>(null)
const loading = ref(true)
const loadingMore = ref(false)
const failure = shallowRef<unknown>(null)
const groups = ref<Group[]>([])
const seats = ref<Seats | null>(null)

// ---- Filters (in the address) ----
const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const status = computed<MemberStatus | ''>(() => (['active', 'invited', 'suspended'].includes(String(route.query.status)) ? (route.query.status as MemberStatus) : ''))
const role = computed<MemberRole | ''>(() => (['admin', 'member'].includes(String(route.query.role)) ? (route.query.role as MemberRole) : ''))
const statusOptions = computed(() => [
  { value: '', label: t('admin.members.filters.allStatuses') },
  { value: 'active', label: t('admin.members.status.active') },
  { value: 'invited', label: t('admin.members.status.invited') },
  { value: 'suspended', label: t('admin.members.status.suspended') },
])
const roleOptions = computed(() => [
  { value: '', label: t('admin.members.filters.allRoles') },
  { value: 'admin', label: t('admin.members.roles.admin') },
  { value: 'member', label: t('admin.members.roles.member') },
])
function setFilter(key: 'status' | 'role' | 'q', value: string) {
  router.replace({ query: { ...route.query, [key]: value || undefined } })
}
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => setFilter('q', value.trim()), 300)
})
onBeforeUnmount(() => clearTimeout(searchTimer))

let token = 0
async function load(more = false) {
  const mine = ++token
  if (more) loadingMore.value = true
  else loading.value = true
  failure.value = null
  try {
    const page = await adminApi.members({
      q: typeof route.query.q === 'string' ? route.query.q : undefined,
      status: status.value || undefined,
      role: role.value || undefined,
      cursor: more ? (cursor.value ?? undefined) : undefined,
    })
    if (mine !== token) return
    members.value = more ? [...members.value, ...page.items] : page.items
    cursor.value = page.next_cursor
    total.value = page.total
  } catch (error) {
    if (mine === token) failure.value = error
  } finally {
    if (mine === token) {
      loading.value = false
      loadingMore.value = false
    }
  }
}

async function loadSide() {
  try {
    const [g, s] = await Promise.all([adminApi.groups(), adminApi.seats()])
    groups.value = g
    seats.value = s
  } catch {
    // The table still works; invite shows its own error.
  }
}

watch(() => [route.query.q, route.query.status, route.query.role], () => load())
onMounted(() => {
  load()
  loadSide()
})

const groupName = (id: string) => groups.value.find((g) => g.id === id)?.name ?? ''
const isMe = (m: AdminMember) => m.email === account.value?.email
const domain = computed(() => account.value?.email.split('@')[1] ?? '')
const free = computed(() => (seats.value ? Math.max(0, seats.value.total - seats.value.used - seats.value.pending) : 1))

function replace(next: AdminMember) {
  members.value = members.value.map((m) => (m.id === next.id ? next : m))
}
function drop(id: string) {
  members.value = members.value.filter((m) => m.id !== id)
  total.value = Math.max(0, total.value - 1)
}
async function afterChange() {
  await Promise.all([loadSide(), refreshOverview()])
}

// ---- Row actions ----
function actionsFor(m: AdminMember): ActionItem[] {
  if (m.status === 'invited') {
    return [
      { key: 'resend', label: t('admin.members.actions.resend'), icon: 'mail' },
      { key: 'cancel', label: t('admin.members.actions.cancelInvite'), icon: 'x', danger: true, divider: true },
    ]
  }
  const self = isMe(m)
  const items: ActionItem[] = [
    { key: 'groups', label: t('admin.members.actions.groups'), icon: 'users' },
    m.role === 'admin'
      ? { key: 'demote', label: t('admin.members.actions.demote'), icon: 'user', disabled: self, reason: t('admin.members.errors.selfShort') }
      : { key: 'promote', label: t('admin.members.actions.promote'), icon: 'key' },
    { key: 'signout', label: t('admin.members.actions.signOut'), icon: 'logout' },
  ]
  if (m.status === 'suspended') items.push({ key: 'reactivate', label: t('admin.members.actions.reactivate'), icon: 'restore', divider: true })
  else items.push({ key: 'suspend', label: t('admin.members.actions.suspend'), icon: 'lock', divider: true, disabled: self, reason: t('admin.members.errors.selfShort') })
  items.push({ key: 'remove', label: t('admin.members.actions.remove'), icon: 'trash', danger: true, disabled: self, reason: t('admin.members.errors.selfShort') })
  return items
}

type Confirm = { title: string; body: string; note?: string; label: string; busy: string; danger?: boolean; run: () => Promise<unknown> }
const confirming = ref<Confirm | null>(null)
const confirmOpen = computed({ get: () => confirming.value !== null, set: (v) => !v && (confirming.value = null) })
const editingGroups = ref<AdminMember | null>(null)
const removing = ref<AdminMember | null>(null)
const removeOpen = computed({ get: () => removing.value !== null, set: (v) => !v && (removing.value = null) })
const everyone = ref<AdminMember[]>([])

function conflictMessage(error: unknown): string {
  if (error instanceof ApiError && error.data?.reason === 'last_admin') return t('admin.members.errors.lastAdmin')
  if (error instanceof ApiError && error.data?.reason === 'last_key_holder') return t('admin.members.errors.lastKeyHolder')
  if (error instanceof ApiError && error.data?.reason === 'self') return t('admin.members.errors.self')
  return errorMessage(error)
}

async function act(m: AdminMember, key: string) {
  const name = m.name || m.email
  switch (key) {
    case 'resend':
      try {
        await adminApi.resendInvite(m.id)
        toast.success(t('admin.members.done.resent', { email: m.email }))
      } catch (error) {
        toast.error(errorMessage(error))
      }
      return
    case 'cancel':
      confirming.value = {
        title: t('admin.members.confirm.cancelTitle', { email: m.email }),
        body: t('admin.members.confirm.cancelBody'),
        label: t('admin.members.actions.cancelInvite'),
        busy: t('admin.members.busy.cancelling'),
        danger: true,
        run: async () => {
          await adminApi.cancelInvite(m.id)
          drop(m.id)
          toast.success(t('admin.members.done.cancelled', { email: m.email }))
          afterChange()
        },
      }
      return
    case 'groups':
      editingGroups.value = m
      return
    case 'promote':
      confirming.value = {
        title: t('admin.members.confirm.promoteTitle', { name }),
        body: t('admin.members.confirm.promoteBody'),
        note: t('admin.members.confirm.promoteNote'),
        label: t('admin.members.actions.promote'),
        busy: t('admin.members.busy.saving'),
        run: async () => {
          replace(await adminApi.setRole(m.id, 'admin'))
          toast.success(t('admin.members.done.promoted', { name }))
          afterChange()
        },
      }
      return
    case 'demote':
      confirming.value = {
        title: t('admin.members.confirm.demoteTitle', { name }),
        body: m.holds_recovery_key ? t('admin.members.confirm.demoteHolderBody') : t('admin.members.confirm.demoteBody'),
        label: t('admin.members.actions.demote'),
        busy: t('admin.members.busy.saving'),
        danger: m.holds_recovery_key,
        run: async () => {
          replace(await adminApi.setRole(m.id, 'member'))
          toast.success(t('admin.members.done.demoted', { name }))
          afterChange()
        },
      }
      return
    case 'signout':
      confirming.value = {
        title: t('admin.members.confirm.signOutTitle', { name }),
        body: t('admin.members.confirm.signOutBody'),
        label: t('admin.members.actions.signOut'),
        busy: t('admin.members.busy.signingOut'),
        run: async () => {
          const { ended } = await adminApi.signOutEverywhere(m.id)
          toast.success(t('admin.members.done.signedOut', { name, n: ended }, ended))
        },
      }
      return
    case 'suspend':
      confirming.value = {
        title: t('admin.members.confirm.suspendTitle', { name }),
        body: t('admin.members.confirm.suspendBody'),
        note: t('admin.members.confirm.suspendNote'),
        label: t('admin.members.actions.suspend'),
        busy: t('admin.members.busy.suspending'),
        danger: true,
        run: async () => {
          replace(await adminApi.suspend(m.id))
          toast.success(t('admin.members.done.suspended', { name }))
          afterChange()
        },
      }
      return
    case 'reactivate':
      try {
        replace(await adminApi.reactivate(m.id))
        toast.success(t('admin.members.done.reactivated', { name }))
        afterChange()
      } catch (error) {
        toast.error(errorMessage(error))
      }
      return
    case 'remove':
      everyone.value = await loadEveryone()
      removing.value = m
  }
}

/** Everyone active, for choosing who receives a removed member's files. */
async function loadEveryone(): Promise<AdminMember[]> {
  const all: AdminMember[] = []
  let next: string | undefined
  try {
    do {
      const page = await adminApi.members({ status: 'active', cursor: next })
      all.push(...page.items)
      next = page.next_cursor ?? undefined
    } while (next && all.length < 5000)
  } catch (error) {
    toast.error(errorMessage(error))
  }
  return all
}

async function removed() {
  const name = removing.value?.name || removing.value?.email
  if (removing.value) drop(removing.value.id)
  toast.success(t('admin.members.done.removed', { name }))
  afterChange()
}

// ---- Groups of one member ----
const memberGroups = ref<string[]>([])
const savingGroups = ref(false)
watch(editingGroups, (m) => (memberGroups.value = m ? [...m.group_ids] : []))
const groupsOpen = computed({ get: () => editingGroups.value !== null, set: (v) => !v && (editingGroups.value = null) })
async function saveGroups() {
  if (!editingGroups.value) return
  savingGroups.value = true
  try {
    replace(await adminApi.setGroups(editingGroups.value.id, memberGroups.value))
    toast.success(t('admin.members.done.groups', { name: editingGroups.value.name || editingGroups.value.email }))
    editingGroups.value = null
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    savingGroups.value = false
  }
}

const inviteOpen = ref(false)
function invited(outcome: { sent: string[] }) {
  if (outcome.sent.length) {
    load()
    afterChange()
  }
}
</script>

<template info="roles">
  <AdminShell :title="t('admin.members.title')" :lead="t('admin.members.lead')">
    <template #actions>
      <SgButton
        variant="primary"
        icon="user-plus"
        :disabled="!online || (seats !== null && !free)"
        :disabled-reason="!online ? t('auth.offlineReason') : t('admin.invite.noSeatsShort')"
        @click="inviteOpen = true"
      >
        {{ t('admin.members.invite') }}
      </SgButton>
    </template>

    <p v-if="seats" class="mem__seats">
      {{ t('admin.overview.seats', { used: formatNumber(seats.used, locale), total: formatNumber(seats.total, locale) }) }}
      <template v-if="seats.pending"> · {{ t('admin.overview.seatsPending', { n: seats.pending }, seats.pending) }}</template>
      · <NuxtLink to="/admin/billing#seats">{{ t('admin.overview.addSeats') }}</NuxtLink>
    </p>

    <div class="mem__filters" role="search">
      <SgInput v-model="search" type="search" :placeholder="t('admin.members.search')" :aria-label="t('admin.members.search')">
        <template #prefix><SgIcon name="search" :size="16" /></template>
      </SgInput>
      <SgSelect :model-value="status" :options="statusOptions" :aria-label="t('admin.members.filters.status')" @update:model-value="(v: string) => setFilter('status', v)" />
      <SgSelect :model-value="role" :options="roleOptions" :aria-label="t('admin.members.filters.role')" @update:model-value="(v: string) => setFilter('role', v)" />
    </div>

    <SgAlert v-if="failure" tone="danger">
      {{ errorMessage(failure) }}
      <template #actions><SgButton size="sm" icon="refresh" @click="load()">{{ t('common.retry') }}</SgButton></template>
    </SgAlert>
    <div v-else-if="loading && !members.length" aria-busy="true"><SgSkeleton :lines="8" /></div>
    <SgEmptyState
      v-else-if="!members.length"
      icon="users"
      :title="t('admin.members.emptyTitle')"
      :description="route.query.q || status || role ? t('admin.members.emptyFiltered') : t('admin.members.empty')"
    />

    <div v-else class="mem__table-wrap" :class="{ 'is-stale': loading }" :aria-busy="loading || undefined">
      <div class="table-scroll">
      <table class="table mem__table">
        <caption class="sr-only">{{ t('admin.members.caption', { n: total }, total) }}</caption>
        <thead>
          <tr>
            <th scope="col">{{ t('admin.members.cols.member') }}</th>
            <th scope="col">{{ t('admin.members.cols.status') }}</th>
            <th scope="col" class="table__meta">{{ t('admin.members.cols.groups') }}</th>
            <th scope="col" class="table__meta mem__num mem__wide">{{ t('admin.members.cols.storage') }}</th>
            <th scope="col" class="table__meta">{{ t('admin.members.cols.active') }}</th>
            <th scope="col" class="table__meta">{{ t('admin.members.cols.kit') }}<SgInfo term="recoveryKit" /></th>
            <th scope="col"><span class="sr-only">{{ t('admin.members.cols.actions') }}</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in members" :key="m.id">
            <td>
              <div class="mem__who">
                <SgAvatar :name="m.name || m.email" :size="30" />
                <div class="mem__names">
                  <span class="table__strong"><bdi>{{ m.name || m.email }}</bdi></span>
                  <span v-if="m.name" class="table__sub"><bdi dir="ltr">{{ m.email }}</bdi></span>
                  <span class="mem__tags">
                    <span v-if="isMe(m)" class="tag is-signal">{{ t('admin.members.you') }}</span>
                    <span v-if="m.role === 'admin'" class="tag">{{ t('admin.members.roles.admin') }}</span>
                    <span v-if="m.holds_recovery_key" class="tag"><SgIcon name="key" :size="12" />{{ t('admin.members.keyHolder') }}</span>
                  </span>
                </div>
              </div>
            </td>
            <td>
              <span class="status" :class="{ 'is-active': m.status === 'active', 'is-revoked': m.status === 'suspended' }">{{ t(`admin.members.status.${m.status}`) }}</span>
              <span v-if="m.status === 'invited' && m.invited_at" class="table__sub">{{ formatWhen(m.invited_at, locale) }}</span>
            </td>
            <td class="table__meta">
              <span v-if="m.group_ids.length" class="mem__groups">{{ m.group_ids.map(groupName).filter(Boolean).join(', ') }}</span>
              <span v-else class="table__muted">{{ t('admin.members.noGroup') }}</span>
            </td>
            <td class="table__meta mem__num mem__wide">{{ m.status === 'invited' ? '—' : formatBytes(m.storage_used, locale) }}</td>
            <td class="table__meta">{{ m.last_active_at ? formatWhen(m.last_active_at, locale) : '—' }}</td>
            <td class="table__meta">
              <template v-if="m.status !== 'invited'">
                <span v-if="m.kit_confirmed" class="mem__kit is-ok"><SgIcon name="check" :size="14" />{{ t('admin.members.kitOk') }}</span>
                <span v-else class="mem__kit is-missing"><SgIcon name="alert" :size="14" />{{ t('admin.members.kitMissing') }}</span>
              </template>
              <template v-else>—</template>
            </td>
            <td class="table__actions">
              <SgActionMenu
                :label="t('admin.members.actionsFor', { name: m.name || m.email })"
                :items="actionsFor(m)"
                :disabled="!online"
                :disabled-reason="t('auth.offlineReason')"
                @select="(key: string) => act(m, key)"
              />
            </td>
          </tr>
        </tbody>
      </table>
      </div>
      <div class="mem__more">
        <p class="form__note">{{ t('admin.members.shown', { n: members.length, total }, total) }}</p>
        <SgButton v-if="cursor" size="sm" :loading="loadingMore" :loading-label="t('common.loading')" @click="load(true)">{{ t('admin.members.more') }}</SgButton>
      </div>
    </div>

    <AdminInviteDialog v-if="inviteOpen && seats" v-model:open="inviteOpen" :seats="seats" :groups="groups" :domain="domain" @sent="invited" />

    <AdminConfirmDialog
      v-if="confirming"
      v-model:open="confirmOpen"
      :title="confirming.title"
      :body="confirming.body"
      :note="confirming.note"
      :confirm-label="confirming.label"
      :busy-label="confirming.busy"
      :danger="confirming.danger"
      :run="confirming.run"
      :explain="conflictMessage"
    />

    <AdminRemoveMemberDialog v-if="removing" v-model:open="removeOpen" :member="removing" :candidates="everyone" @removed="removed" />

    <SgDialog v-if="editingGroups" v-model:open="groupsOpen" :title="t('admin.members.groupsTitle', { name: editingGroups.name || editingGroups.email })" size="sm" :busy="savingGroups">
      <div class="mem__group-list">
        <p v-if="!groups.length" class="form__note">{{ t('admin.groups.empty') }}</p>
        <SgCheckbox
          v-for="group in groups"
          :key="group.id"
          :model-value="memberGroups.includes(group.id)"
          :label="group.name"
          :description="group.description || undefined"
          :disabled="savingGroups"
          @update:model-value="(on) => (memberGroups = on ? [...memberGroups, group.id] : memberGroups.filter((id) => id !== group.id))"
        />
      </div>
      <template #footer>
        <SgButton :disabled="savingGroups" :disabled-reason="t('common.pleaseWait')" @click="editingGroups = null">{{ t('common.cancel') }}</SgButton>
        <SgButton variant="primary" :loading="savingGroups" :loading-label="t('settings.saving')" @click="saveGroups">{{ t('settings.save') }}</SgButton>
      </template>
    </SgDialog>
  </AdminShell>
</template>

<style scoped>
.mem__seats {
  margin: calc(-1 * var(--s-3)) 0 0;
  font-size: var(--fs-sm);
  color: var(--fg-2);
}

.mem__filters {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 180px 180px;
  gap: var(--s-3);
}

.mem__table-wrap {
  transition: opacity var(--dur-1) var(--ease);
}

.mem__table-wrap.is-stale {
  opacity: 0.6;
}

.mem__who {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  min-width: 0;
}

.mem__names {
  display: grid;
  min-width: 0;
}

.mem__tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-1);
  margin-top: 2px;
}

.mem__tags:empty {
  display: none;
}

.mem__tags .tag {
  gap: 3px;
}

.mem__groups {
  display: -webkit-box;
  max-width: 18ch;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

/* Laptops: the table fits without scrolling; storage is on the overview and in billing. */
@media (max-width: 1399px) {
  .mem__table .mem__wide {
    display: none;
  }
}

.mem__num {
  font-variant-numeric: tabular-nums;
  text-align: end;
}

.mem__kit {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.mem__kit.is-ok {
  color: var(--success);
}

.mem__kit.is-missing {
  color: var(--fg-2);
}

.mem__more {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-3);
  padding-top: var(--s-3);
}

.mem__more .form__note {
  margin: 0;
}

.mem__group-list {
  display: grid;
  gap: var(--s-3);
}

@media (max-width: 699px) {
  .mem__filters {
    grid-template-columns: 1fr 1fr;
  }

  .mem__filters > :first-child {
    grid-column: 1 / -1;
  }
}
</style>
