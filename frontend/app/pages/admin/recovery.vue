<script setup lang="ts">
import { ApiError } from '~/services/api/client'
import { adminApi, type Organization, type Policies, type RecoveryRequest } from '~/services/api/admin'

// The recovery queue (user-flows.md F10, states.md "Admin"): members who lost their
// passphrase and recovery kit ask the organization for their access back. Each request says
// who, when, from which device and where, and why. Approving needs the identity checks and
// the administrator's passphrase; a two-admin quorum waits for a second approval. Requests
// expire after 72 hours. Denying needs a reason, which the member sees.
definePageMeta({ layout: 'app', middleware: ['auth', 'admin'] })
const { t, locale } = useI18n()
const route = useRoute()
const toast = useToast()
const online = useOnline()
const errorMessage = useErrorMessage()
const { account } = useAccount()
const { refresh: refreshOverview } = useAdminOverview()

type Tab = 'open' | 'history'
const tab = ref<Tab>(route.query.tab === 'history' ? 'history' : 'open')
const open = ref<RecoveryRequest[]>([])
const history = ref<RecoveryRequest[] | null>(null)
const org = ref<Organization | null>(null)
const policies = ref<Policies | null>(null)
const loading = ref(true)
const failure = shallowRef<unknown>(null)
const now = ref(Date.now())
let tick: ReturnType<typeof setInterval> | undefined

async function load() {
  loading.value = true
  failure.value = null
  try {
    const [requests, organization, rules] = await Promise.all([adminApi.recoveryRequests('open'), adminApi.organization(), adminApi.policies()])
    open.value = requests
    org.value = organization
    policies.value = rules
    if (tab.value === 'history') await loadHistory()
  } catch (error) {
    failure.value = error
  } finally {
    loading.value = false
  }
}

async function loadHistory() {
  try {
    history.value = await adminApi.recoveryRequests('history')
  } catch (error) {
    failure.value = error
  }
}

watch(tab, (value) => {
  navigateTo({ query: { ...route.query, tab: value === 'history' ? 'history' : undefined } }, { replace: true })
  if (value === 'history' && !history.value) loadHistory()
})

onMounted(() => {
  load()
  tick = setInterval(() => (now.value = Date.now()), 30_000)
})
onBeforeUnmount(() => clearInterval(tick))

const myEmail = computed(() => account.value?.email)
const iHoldKey = computed(() => org.value?.admins.some((a) => a.person.email === myEmail.value && a.holds_recovery_key) ?? false)
const holders = computed(() => (org.value?.admins ?? []).filter((a) => a.holds_recovery_key).map((a) => a.person.name))
const listFormat = computed(() => new Intl.ListFormat(intlLocale(locale.value), { type: 'conjunction' }))
const iApproved = (r: RecoveryRequest) => r.approvals.some((a) => a.admin.email === myEmail.value)

function expiresIn(r: RecoveryRequest): string {
  const ms = Date.parse(r.expires_at) - now.value
  const rtf = new Intl.RelativeTimeFormat(intlLocale(locale.value), { numeric: 'always', style: 'long' })
  const hours = Math.max(0, Math.round(ms / 3_600_000))
  return hours >= 48 ? rtf.format(Math.round(hours / 24), 'day') : rtf.format(Math.max(1, hours), 'hour')
}
const soon = (r: RecoveryRequest) => Date.parse(r.expires_at) - now.value < 12 * 3_600_000

function stateOf(r: RecoveryRequest): string {
  if (iApproved(r)) return t('admin.recovery.state.youApproved')
  if (r.approvals.length) return t('admin.recovery.state.approvedBy', { name: r.approvals.map((a) => a.admin.name).join(', ') })
  return r.required > 1 ? t('admin.recovery.state.needs', { n: r.required }) : t('admin.recovery.state.needsOne')
}

function approveBlocked(r: RecoveryRequest): string {
  if (!online.value) return t('auth.offlineReason')
  if (!policies.value?.org_recovery) return t('admin.recovery.offShort')
  if (!iHoldKey.value) return t('admin.recovery.noKeyShort')
  if (iApproved(r)) return t('admin.recovery.alreadyShort')
  return ''
}

// ---- Approve ----
const approving = ref<RecoveryRequest | null>(null)
const approveOpen = computed({ get: () => approving.value !== null, set: (v) => !v && (approving.value = null) })
function approved(r: RecoveryRequest) {
  if (r.status === 'approved') {
    open.value = open.value.filter((x) => x.id !== r.id)
    history.value = history.value ? [r, ...history.value] : null
    toast.success(t('admin.recovery.done.approved', { name: r.member.name }))
  } else {
    open.value = open.value.map((x) => (x.id === r.id ? r : x))
    toast.success(t('admin.recovery.done.firstApproval', { name: r.member.name }))
  }
  refreshOverview()
}
function expired() {
  toast.warning(t('admin.recovery.done.expired'))
  load()
  refreshOverview()
}

// ---- Deny ----
const denying = ref<RecoveryRequest | null>(null)
const denyOpen = computed({ get: () => denying.value !== null, set: (v) => !v && (denying.value = null) })
const reason = ref('')
const reasonError = ref('')
const denyBusy = ref(false)
const denyFailure = ref('')
watch(denying, () => {
  reason.value = ''
  reasonError.value = ''
  denyFailure.value = ''
})
watch(reason, () => (reasonError.value = ''))
async function deny() {
  const r = denying.value
  if (!r) return
  if ([...reason.value.trim()].length < 5) {
    reasonError.value = t('admin.recovery.deny.reasonEmpty')
    return
  }
  denyBusy.value = true
  denyFailure.value = ''
  try {
    const updated = await adminApi.denyRecovery(r.id, reason.value.trim())
    open.value = open.value.filter((x) => x.id !== r.id)
    history.value = history.value ? [updated, ...history.value] : null
    denying.value = null
    toast.success(t('admin.recovery.done.denied', { name: r.member.name }))
    refreshOverview()
  } catch (error) {
    if (error instanceof ApiError && error.code === 'GONE') {
      denying.value = null
      expired()
    } else denyFailure.value = errorMessage(error)
  } finally {
    denyBusy.value = false
  }
}

const tabs = computed(() => [
  { key: 'open' as const, label: t('admin.recovery.tabs.open'), count: open.value.length || undefined },
  { key: 'history' as const, label: t('admin.recovery.tabs.history') },
])
</script>

<template info="recoveryRequest">
  <AdminShell :title="t('admin.recovery.title')" :lead="t('admin.recovery.lead')">
    <SgAlert v-if="failure" tone="danger">
      {{ errorMessage(failure) }}
      <template #actions><SgButton size="sm" icon="refresh" @click="load">{{ t('common.retry') }}</SgButton></template>
    </SgAlert>
    <div v-else-if="loading" aria-busy="true"><SgSkeleton :lines="7" /></div>

    <template v-else>
      <SgAlert v-if="policies && !policies.org_recovery" tone="warning" :title="t('admin.recovery.offTitle')">
        {{ t('admin.recovery.off') }}
        <template #actions><SgButton size="sm" to="/admin/policies#recovery">{{ t('admin.overview.health.openPolicies') }}</SgButton></template>
      </SgAlert>
      <SgAlert v-else-if="!iHoldKey" tone="info">
        {{ t('admin.recovery.noKey') }} {{ holders.length ? t('admin.recovery.holders', { names: listFormat.format(holders) }) : '' }}
      </SgAlert>

      <p v-if="policies" class="rec__policy">
        <SgIcon name="key" :size="14" />
        {{ policies.recovery_approvals > 1 ? t('admin.recovery.policyTwo') : t('admin.recovery.policyOne') }}
        · <NuxtLink to="/admin/policies#recovery">{{ t('admin.recovery.changePolicy') }}</NuxtLink>
      </p>

      <SgTabs v-model="tab" :label="t('admin.recovery.title')" :tabs="tabs">
        <template #open>
          <SgEmptyState v-if="!open.length" icon="check-circle" :title="t('admin.recovery.emptyTitle')" :description="t('admin.recovery.empty')" />
          <ul v-else class="rec__list">
            <li v-for="r in open" :key="r.id" class="rec" :class="{ 'is-mine-done': iApproved(r) }">
              <div class="rec__head">
                <SgAvatar :name="r.member.name" :size="36" />
                <div class="rec__who">
                  <p class="rec__name"><bdi>{{ r.member.name }}</bdi></p>
                  <p class="rec__email"><bdi dir="ltr">{{ r.member.email }}</bdi></p>
                </div>
                <span class="tag" :class="{ 'is-signal': !iApproved(r) }">{{ stateOf(r) }}</span>
              </div>
              <dl class="facts-grid rec__facts">
                <div><dt>{{ t('admin.recovery.asked') }}</dt><dd>{{ formatDateTime(r.created_at, locale) }}</dd></div>
                <div><dt>{{ t('admin.recovery.from') }}</dt><dd>{{ r.device }}<template v-if="r.location"> · <bdi>{{ r.location }}</bdi></template></dd></div>
                <div>
                  <dt>{{ t('admin.recovery.expires') }}</dt>
                  <dd :class="{ 'rec__soon': soon(r) }">{{ expiresIn(r) }}</dd>
                </div>
              </dl>
              <figure class="rec__reason">
                <figcaption>{{ t('admin.recovery.reason', { name: r.member.name }) }}</figcaption>
                <blockquote dir="auto">{{ r.reason }}</blockquote>
              </figure>
              <div class="rec__actions">
                <SgButton variant="primary" icon="key" :disabled="Boolean(approveBlocked(r))" :disabled-reason="approveBlocked(r)" @click="approving = r">
                  {{ r.approvals.length && !iApproved(r) ? t('admin.recovery.approveSecond') : t('admin.recovery.approveAction') }}
                </SgButton>
                <SgButton variant="ghost" icon="x" :disabled="!online" :disabled-reason="t('auth.offlineReason')" @click="denying = r">{{ t('admin.recovery.denyAction') }}</SgButton>
              </div>
            </li>
          </ul>
        </template>

        <template #history>
          <div v-if="!history" aria-busy="true"><SgSkeleton :lines="5" /></div>
          <SgEmptyState v-else-if="!history.length" icon="history" :title="t('admin.recovery.historyEmpty')" />
          <div v-else class="table-scroll">
          <table class="table">
            <thead>
              <tr>
                <th scope="col">{{ t('admin.recovery.cols.member') }}</th>
                <th scope="col">{{ t('admin.recovery.cols.outcome') }}</th>
                <th scope="col" class="table__meta">{{ t('admin.recovery.asked') }}</th>
                <th scope="col" class="table__meta">{{ t('admin.recovery.cols.by') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in history" :key="r.id">
                <td>
                  <span class="table__strong"><bdi>{{ r.member.name }}</bdi></span>
                  <span class="table__sub">{{ r.device }}<template v-if="r.location"> · <bdi>{{ r.location }}</bdi></template></span>
                </td>
                <td>
                  <span class="status" :class="{ 'is-active': r.status === 'approved', 'is-revoked': r.status === 'denied' }">{{ t(`admin.recovery.status.${r.status}`) }}</span>
                  <span v-if="r.denied_reason" class="table__sub"><bdi>{{ r.denied_reason }}</bdi></span>
                </td>
                <td class="table__meta">{{ formatWhen(r.created_at, locale) }}</td>
                <td class="table__meta">
                  <template v-if="r.approvals.length"><bdi>{{ r.approvals.map((a) => a.admin.name).join(', ') }}</bdi></template>
                  <template v-else>—</template>
                </td>
              </tr>
            </tbody>
          </table>
          </div>
        </template>
      </SgTabs>
    </template>

    <AdminApproveRecoveryDialog v-if="approving" v-model:open="approveOpen" :request="approving" @done="approved" @expired="expired" />

    <SgDialog v-if="denying" v-model:open="denyOpen" :title="t('admin.recovery.deny.title', { name: denying.member.name })" size="sm" :busy="denyBusy">
      <form id="admin-deny-recovery" class="rec__deny" novalidate @submit.prevent="deny">
        <p class="rec__deny-text">{{ t('admin.recovery.deny.body', { name: denying.member.name }) }}</p>
        <SgField :label="t('admin.recovery.deny.reason')" :hint="t('admin.recovery.deny.reasonHint', { name: denying.member.name })" :error="reasonError" required>
          <SgTextarea v-model="reason" :rows="3" :placeholder="t('admin.recovery.deny.placeholder')" :disabled="denyBusy" />
        </SgField>
        <SgAlert v-if="denyFailure" tone="danger">{{ denyFailure }}</SgAlert>
      </form>
      <template #footer>
        <SgButton :disabled="denyBusy" :disabled-reason="t('common.pleaseWait')" @click="denying = null">{{ t('common.cancel') }}</SgButton>
        <SgButton type="submit" form="admin-deny-recovery" variant="danger" :loading="denyBusy" :loading-label="t('admin.recovery.deny.denying')" :disabled="!online" :disabled-reason="t('auth.offlineReason')">
          {{ t('admin.recovery.denyAction') }}
        </SgButton>
      </template>
    </SgDialog>
  </AdminShell>
</template>

<style scoped>
.rec__policy {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s-2);
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--fg-2);
}

.rec__list {
  display: grid;
  gap: var(--s-4);
  margin: var(--s-4) 0 0;
  padding: 0;
  list-style: none;
}

.rec {
  display: grid;
  gap: var(--s-4);
  padding: var(--s-5);
  border: 1px solid var(--rule);
  border-inline-start: 3px solid var(--signal);
  border-radius: var(--radius-2);
  background: var(--surface);
}

.rec.is-mine-done {
  border-inline-start-color: var(--rule);
}

.rec__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s-3);
}

.rec__who {
  flex: 1;
  min-width: 12rem;
}

.rec__name,
.rec__email {
  margin: 0;
}

.rec__name {
  font-weight: var(--fw-medium);
}

.rec__email {
  font-size: var(--fs-sm);
  color: var(--fg-2);
}

.rec__facts {
  margin: 0;
}

.rec__soon {
  color: var(--danger);
  font-weight: var(--fw-medium);
}

.rec__reason {
  display: grid;
  gap: var(--s-1);
  margin: 0;
  /* The bar follows the page; the quote inside keeps its own direction. */
  padding-inline-start: var(--s-3);
  border-inline-start: 2px solid var(--rule);
}

.rec__reason figcaption {
  font-size: var(--fs-xs);
  color: var(--fg-2);
}

.rec__reason blockquote {
  margin: 0;
  font-style: italic;
  overflow-wrap: anywhere;
  text-align: left;
}

[dir='rtl'] .rec__reason blockquote {
  text-align: right;
}

.rec__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2);
}

.rec__deny {
  display: grid;
  gap: var(--s-4);
}

.rec__deny-text {
  margin: 0;
  color: var(--fg-2);
}
</style>
