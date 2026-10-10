<script setup lang="ts">
import { adminApi, type AdminMember, type AuditAction, type AuditEvent, type AuditQuery } from '~/services/api/admin'

// The audit log (sitemap §5; personas.md, Samia: "filtered by person and date"): every
// sign-in, share, download and admin action, never content. storageGo doesn't know file names,
// so files appear by their id. Filters live in the address; the export (CSV or PDF) uses
// the same filters and is prepared on the server.
definePageMeta({ layout: 'app', middleware: ['auth', 'admin'] })
const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const online = useOnline()
const errorMessage = useErrorMessage()
const words = useAuditText()
const exporter = useExportJob()

const ACTIONS: AuditAction[] = [
  'signed_in', 'sign_in_failed', 'device_added', 'device_approved', 'device_revoked', 'passphrase_changed', 'kit_regenerated',
  'file_uploaded', 'file_downloaded', 'file_deleted', 'item_shared', 'link_created', 'link_opened', 'link_revoked', 'request_upload',
  'member_invited', 'member_joined', 'member_suspended', 'member_removed', 'role_changed',
  'recovery_requested', 'recovery_approved', 'recovery_denied', 'policy_changed', 'export_created',
]

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10)
const filters = computed<AuditQuery>(() => ({
  actor: typeof route.query.actor === 'string' ? route.query.actor : undefined,
  action: ACTIONS.includes(route.query.action as AuditAction) ? (route.query.action as AuditAction) : undefined,
  from: typeof route.query.from === 'string' ? route.query.from : day(-30),
  to: typeof route.query.to === 'string' ? route.query.to : day(0),
}))
function setFilter(key: keyof AuditQuery, value: string) {
  router.replace({ query: { ...route.query, [key]: value || undefined } })
}
const rangeError = computed(() => (filters.value.from && filters.value.to && filters.value.from > filters.value.to ? t('admin.audit.rangeError') : ''))

const people = ref<AdminMember[]>([])
const events = ref<AuditEvent[]>([])
const total = ref(0)
const cursor = ref<string | null>(null)
const loading = ref(true)
const loadingMore = ref(false)
const failure = shallowRef<unknown>(null)

let token = 0
async function load(more = false) {
  if (rangeError.value) return
  const mine = ++token
  if (more) loadingMore.value = true
  else loading.value = true
  failure.value = null
  try {
    const page = await adminApi.audit({ ...filters.value, cursor: more ? (cursor.value ?? undefined) : undefined })
    if (mine !== token) return
    events.value = more ? [...events.value, ...page.items] : page.items
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

async function loadPeople() {
  try {
    const all: AdminMember[] = []
    let next: string | undefined
    do {
      const page = await adminApi.members({ cursor: next })
      all.push(...page.items.filter((m) => m.status !== 'invited'))
      next = page.next_cursor ?? undefined
    } while (next && all.length < 5000)
    people.value = all
  } catch {
    // The person filter stays on "Everyone"; the log itself still loads.
  }
}

watch(filters, () => load(), { deep: true })
onMounted(() => {
  load()
  loadPeople()
})

const personOptions = computed(() => [{ value: '', label: t('admin.audit.everyone') }, ...people.value.map((p) => ({ value: p.id, label: p.name || p.email }))])
const actionOptions = computed(() => [{ value: '', label: t('admin.audit.allActions') }, ...ACTIONS.map((a) => ({ value: a, label: t(`admin.audit.actions.${a}`) }))])
const filtered = computed(() => Boolean(route.query.actor || route.query.action || route.query.from || route.query.to))

async function exportAs(format: 'csv' | 'pdf') {
  const result = await exporter.start(() => adminApi.exportAudit({ ...filters.value, format }))
  if (result?.status === 'ready') toast.success(t('admin.audit.exported', { name: result.file_name }))
  else if (result?.status === 'failed' || exporter.failure.value) toast.error(exporter.failure.value ? errorMessage(exporter.failure.value) : t('admin.audit.exportFailed'))
}
</script>

<template info="auditLog">
  <AdminShell :title="t('admin.audit.title')" :lead="t('admin.audit.lead')">
    <template #actions>
      <SgButton icon="download" :loading="exporter.running.value" :loading-label="t('admin.audit.preparing')" :disabled="!online || Boolean(rangeError)" :disabled-reason="!online ? t('auth.offlineReason') : rangeError" @click="exportAs('csv')">
        {{ t('admin.audit.exportCsv') }}
      </SgButton>
      <SgButton icon="file" :disabled="!online || exporter.running.value || Boolean(rangeError)" :disabled-reason="!online ? t('auth.offlineReason') : exporter.running.value ? t('common.pleaseWait') : rangeError" @click="exportAs('pdf')">
        {{ t('admin.audit.exportPdf') }}
      </SgButton>
    </template>

    <div v-if="exporter.running.value && exporter.job.value" class="aud__export" aria-live="polite">
      <SgProgress :value="Math.round(exporter.job.value.progress * 100)" :label="t('admin.audit.preparingFile', { name: exporter.job.value.file_name })" show-value />
    </div>

    <div class="aud__filters" role="search">
      <SgField :label="t('admin.audit.person')">
        <SgSelect :model-value="filters.actor ?? ''" :options="personOptions" @update:model-value="(v: string) => setFilter('actor', v)" />
      </SgField>
      <SgField :label="t('admin.audit.action')">
        <SgSelect :model-value="filters.action ?? ''" :options="actionOptions" @update:model-value="(v: string) => setFilter('action', v)" />
      </SgField>
      <SgField :label="t('admin.audit.from')" :error="rangeError">
        <SgInput type="date" :model-value="filters.from" @update:model-value="(v: string) => setFilter('from', v)" />
      </SgField>
      <SgField :label="t('admin.audit.to')">
        <SgInput type="date" :model-value="filters.to" @update:model-value="(v: string) => setFilter('to', v)" />
      </SgField>
    </div>

    <p class="aud__note"><SgIcon name="lock" :size="14" />{{ t('admin.audit.noContent') }}</p>

    <SgAlert v-if="failure" tone="danger">
      {{ errorMessage(failure) }}
      <template #actions><SgButton size="sm" icon="refresh" @click="load()">{{ t('common.retry') }}</SgButton></template>
    </SgAlert>
    <div v-else-if="loading && !events.length" aria-busy="true"><SgSkeleton :lines="10" /></div>
    <SgEmptyState v-else-if="!events.length" icon="history" :title="t('admin.audit.emptyTitle')" :description="filtered ? t('admin.audit.emptyFiltered') : t('admin.audit.empty')">
      <SgButton v-if="filtered" size="sm" @click="router.replace({ query: {} })">{{ t('admin.audit.clear') }}</SgButton>
    </SgEmptyState>

    <div v-else class="aud__wrap" :class="{ 'is-stale': loading }" :aria-busy="loading || undefined">
      <div class="table-scroll">
      <table class="table aud__table">
        <caption class="sr-only">{{ t('admin.audit.caption', { n: total }, total) }}</caption>
        <thead>
          <tr>
            <th scope="col">{{ t('admin.audit.cols.when') }}</th>
            <th scope="col">{{ t('admin.audit.cols.who') }}</th>
            <th scope="col">{{ t('admin.audit.cols.what') }}</th>
            <th scope="col" class="table__meta">{{ t('admin.audit.cols.where') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="event in events" :key="event.id">
            <td class="aud__when">{{ formatDateTime(event.at, locale) }}</td>
            <td>
              <span class="table__strong"><bdi>{{ words.actor(event) }}</bdi></span>
              <span v-if="event.actor?.name" class="table__sub"><bdi dir="ltr">{{ event.actor.email }}</bdi></span>
            </td>
            <td>
              <span :class="{ 'aud__fail': event.action === 'sign_in_failed' || event.action === 'recovery_denied' }">{{ words.action(event) }}</span>
              <span v-if="words.target(event)" class="table__sub"><bdi>{{ words.target(event) }}</bdi></span>
            </td>
            <td class="table__meta">
              <template v-if="event.location"><bdi>{{ event.location }}</bdi></template>
              <span v-if="event.ip" class="table__sub" dir="ltr">{{ event.ip }}</span>
            </td>
          </tr>
        </tbody>
      </table>
      </div>
      <div class="aud__more">
        <p class="form__note">{{ t('admin.audit.shown', { n: events.length, total }, total) }}</p>
        <SgButton v-if="cursor" size="sm" :loading="loadingMore" :loading-label="t('common.loading')" @click="load(true)">{{ t('admin.members.more') }}</SgButton>
      </div>
    </div>
  </AdminShell>
</template>

<style scoped>
.aud__export {
  max-width: 520px;
}

.aud__filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
  gap: var(--s-3);
}

.aud__note {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--fg-2);
}

.aud__wrap {
  transition: opacity var(--dur-1) var(--ease);
}

.aud__wrap.is-stale {
  opacity: 0.6;
}

.aud__when {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.aud__fail {
  color: var(--danger);
}

.aud__more {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-3);
  padding-top: var(--s-3);
}

.aud__more .form__note {
  margin: 0;
}

@media (max-width: 899px) {
  .aud__when {
    white-space: normal;
  }
}
</style>
