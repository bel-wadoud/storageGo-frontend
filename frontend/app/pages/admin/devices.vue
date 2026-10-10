<script setup lang="ts">
import { ApiError } from '~/services/api/client'
import { adminApi, type OrgDevice, type Policies } from '~/services/api/admin'

// Every device in the organization (sitemap §5): a lost laptop is revoked here, from any
// computer or phone. A new device waiting for approval can be approved by an administrator
// when the policy allows it, after comparing its two-word code with the member by phone
// (key-model-ux.md §4).
definePageMeta({ layout: 'app', middleware: ['auth', 'admin'] })
const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const online = useOnline()
const errorMessage = useErrorMessage()
const { refresh: refreshOverview } = useAdminOverview()

const devices = ref<OrgDevice[]>([])
const total = ref(0)
const cursor = ref<string | null>(null)
const policies = ref<Policies | null>(null)
const loading = ref(true)
const loadingMore = ref(false)
const failure = shallowRef<unknown>(null)

const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const pendingOnly = computed(() => route.query.status === 'pending')
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => router.replace({ query: { ...route.query, q: value.trim() || undefined } }), 300)
})
onBeforeUnmount(() => clearTimeout(searchTimer))
function setPending(on: boolean) {
  router.replace({ query: { ...route.query, status: on ? 'pending' : undefined } })
}

let token = 0
async function load(more = false) {
  const mine = ++token
  if (more) loadingMore.value = true
  else loading.value = true
  failure.value = null
  try {
    const [page, rules] = await Promise.all([
      adminApi.devices({ q: typeof route.query.q === 'string' ? route.query.q : undefined, status: pendingOnly.value ? 'pending' : undefined, cursor: more ? (cursor.value ?? undefined) : undefined }),
      policies.value ? Promise.resolve(policies.value) : adminApi.policies(),
    ])
    if (mine !== token) return
    devices.value = more ? [...devices.value, ...page.items] : page.items
    cursor.value = page.next_cursor
    total.value = page.total
    policies.value = rules
  } catch (error) {
    if (mine === token) failure.value = error
  } finally {
    if (mine === token) {
      loading.value = false
      loadingMore.value = false
    }
  }
}
watch(() => [route.query.q, route.query.status], () => load())
onMounted(() => load())

const adminCanApprove = computed(() => policies.value?.device_approval === 'trusted_device_or_admin')

// ---- Approve (compare the code by phone first) ----
const approving = ref<OrgDevice | null>(null)
const approveOpen = computed({ get: () => approving.value !== null, set: (v) => !v && (approving.value = null) })
const code = ref<[string, string] | null>(null)
const compared = ref(false)
const approveBusy = ref(false)
watch(approving, async (device) => {
  code.value = null
  compared.value = false
  if (device) code.value = await (await useCrypto()).safetyCode(device.public_key)
})
async function approve() {
  const device = approving.value
  if (!device || !compared.value) return
  approveBusy.value = true
  try {
    const updated = await adminApi.approveDevice(device.id)
    devices.value = pendingOnly.value ? devices.value.filter((d) => d.id !== device.id) : devices.value.map((d) => (d.id === device.id ? updated : d))
    approving.value = null
    toast.success(t('admin.devices.done.approved', { device: device.name, name: device.member.name }))
    refreshOverview()
  } catch (error) {
    toast.error(error instanceof ApiError && error.data?.reason === 'policy' ? t('admin.devices.policyOnly') : errorMessage(error))
  } finally {
    approveBusy.value = false
  }
}

// ---- Revoke / deny ----
const revoking = ref<OrgDevice | null>(null)
const revokeOpen = computed({ get: () => revoking.value !== null, set: (v) => !v && (revoking.value = null) })
async function revoke() {
  const device = revoking.value!
  await adminApi.revokeDevice(device.id)
  devices.value = devices.value.filter((d) => d.id !== device.id)
  total.value = Math.max(0, total.value - 1)
  toast.success(device.status === 'pending' ? t('admin.devices.done.denied', { device: device.name }) : t('admin.devices.done.revoked', { device: device.name, name: device.member.name }))
  refreshOverview()
}
</script>

<template>
  <AdminShell :title="t('admin.devices.title')" :lead="t('admin.devices.lead')">
    <div class="dev__filters" role="search">
      <SgInput v-model="search" type="search" :placeholder="t('admin.devices.search')" :aria-label="t('admin.devices.search')">
        <template #prefix><SgIcon name="search" :size="16" /></template>
      </SgInput>
      <SgCheckbox :model-value="pendingOnly" :label="t('admin.devices.pendingOnly')" @update:model-value="setPending" />
    </div>

    <p v-if="policies" class="dev__policy">
      <SgIcon name="info" :size="14" />{{ t(`admin.devices.policy.${policies.device_approval}`) }} ·
      <NuxtLink to="/admin/policies#devices">{{ t('admin.recovery.changePolicy') }}</NuxtLink>
    </p>

    <SgAlert v-if="failure" tone="danger">
      {{ errorMessage(failure) }}
      <template #actions><SgButton size="sm" icon="refresh" @click="load()">{{ t('common.retry') }}</SgButton></template>
    </SgAlert>
    <div v-else-if="loading && !devices.length" aria-busy="true"><SgSkeleton :lines="8" /></div>
    <SgEmptyState
      v-else-if="!devices.length"
      icon="monitor"
      :title="pendingOnly ? t('admin.devices.nonePending') : t('admin.devices.emptyTitle')"
      :description="route.query.q ? t('admin.members.emptyFiltered') : undefined"
    />

    <div v-else :class="{ 'is-stale': loading }" class="dev__wrap" :aria-busy="loading || undefined">
      <div class="table-scroll">
      <table class="table">
        <caption class="sr-only">{{ t('admin.devices.caption', { n: total }, total) }}</caption>
        <thead>
          <tr>
            <th scope="col">{{ t('admin.devices.cols.device') }}</th>
            <th scope="col">{{ t('admin.devices.cols.member') }}</th>
            <th scope="col" class="table__meta">{{ t('admin.devices.cols.active') }}</th>
            <th scope="col" class="table__meta">{{ t('admin.devices.cols.added') }}</th>
            <th scope="col"><span class="sr-only">{{ t('admin.members.cols.actions') }}</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in devices" :key="d.id" :class="{ 'dev__pending': d.status === 'pending' }">
            <td>
              <span class="table__strong">{{ d.name }}</span>
              <span class="table__sub">
                <template v-if="d.status === 'pending'"><span class="tag is-signal">{{ t('admin.devices.waiting') }}</span> </template>
                <template v-if="d.location"><bdi>{{ d.location }}</bdi></template>
              </span>
            </td>
            <td>
              <span class="table__strong"><bdi>{{ d.member.name }}</bdi></span>
              <span class="table__sub"><bdi dir="ltr">{{ d.member.email }}</bdi></span>
            </td>
            <td class="table__meta">{{ formatWhen(d.last_active_at, locale) }}</td>
            <td class="table__meta">{{ formatDate(new Date(d.created_at), locale) }}</td>
            <td class="table__actions">
              <template v-if="d.status === 'pending'">
                <SgButton
                  size="sm"
                  variant="primary"
                  :disabled="!online || !adminCanApprove"
                  :disabled-reason="!online ? t('auth.offlineReason') : t('admin.devices.policyOnly')"
                  @click="approving = d"
                >
                  {{ t('admin.devices.approve') }}
                </SgButton>
                <SgButton size="sm" variant="ghost" :disabled="!online" :disabled-reason="t('auth.offlineReason')" @click="revoking = d">{{ t('admin.devices.deny') }}</SgButton>
              </template>
              <SgButton v-else size="sm" variant="ghost" icon="logout" :disabled="!online" :disabled-reason="t('auth.offlineReason')" @click="revoking = d">
                {{ t('admin.devices.revoke') }}
              </SgButton>
            </td>
          </tr>
        </tbody>
      </table>
      </div>
      <div class="dev__more">
        <p class="form__note">{{ t('admin.devices.shown', { n: devices.length, total }, total) }}</p>
        <SgButton v-if="cursor" size="sm" :loading="loadingMore" :loading-label="t('common.loading')" @click="load(true)">{{ t('admin.members.more') }}</SgButton>
      </div>
    </div>

    <SgDialog v-if="approving" v-model:open="approveOpen" :title="t('admin.devices.approveTitle', { device: approving.name, name: approving.member.name })" size="sm" :busy="approveBusy">
      <div class="dev__approve">
        <p class="dev__text">{{ t('admin.devices.approveBody', { name: approving.member.name }) }}</p>
        <p class="dev__code" dir="ltr" translate="no" aria-live="polite">
          <template v-if="code"><span>{{ code[0] }}</span><span>{{ code[1] }}</span></template>
          <SgSpinner v-else size="sm" :label="t('common.loading')" />
        </p>
        <p class="form__note">{{ t('admin.devices.requested', { when: formatWhen(approving.created_at, locale) }) }}<template v-if="approving.location"> · <bdi>{{ approving.location }}</bdi></template></p>
        <SgCheckbox v-model="compared" :label="t('admin.devices.compared', { name: approving.member.name })" :disabled="approveBusy || !code" />
      </div>
      <template #footer>
        <SgButton :disabled="approveBusy" :disabled-reason="t('common.pleaseWait')" @click="approving = null">{{ t('common.cancel') }}</SgButton>
        <SgButton variant="primary" :loading="approveBusy" :loading-label="t('settings.devices.approving')" :disabled="!compared || !online" :disabled-reason="!online ? t('auth.offlineReason') : t('admin.devices.compareFirst')" @click="approve">
          {{ t('admin.devices.approve') }}
        </SgButton>
      </template>
    </SgDialog>

    <AdminConfirmDialog
      v-if="revoking"
      v-model:open="revokeOpen"
      :title="revoking.status === 'pending' ? t('admin.devices.denyTitle', { device: revoking.name }) : t('admin.devices.revokeTitle', { device: revoking.name, name: revoking.member.name })"
      :body="revoking.status === 'pending' ? t('admin.devices.denyBody', { name: revoking.member.name }) : t('admin.devices.revokeBody', { name: revoking.member.name })"
      :confirm-label="revoking.status === 'pending' ? t('admin.devices.deny') : t('admin.devices.revoke')"
      :busy-label="t('settings.devices.revoking')"
      danger
      :run="revoke"
    />
  </AdminShell>
</template>

<style scoped>
.dev__filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s-3) var(--s-5);
}

.dev__filters > :first-child {
  flex: 1;
  min-width: 14rem;
}

.dev__policy {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s-2);
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--fg-2);
}

.dev__wrap {
  transition: opacity var(--dur-1) var(--ease);
}

.dev__wrap.is-stale {
  opacity: 0.6;
}

.dev__pending td {
  background: var(--signal-soft);
}

.dev__more {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-3);
  padding-top: var(--s-3);
}

.dev__more .form__note {
  margin: 0;
}

.dev__approve {
  display: grid;
  gap: var(--s-3);
}

.dev__text {
  margin: 0;
  color: var(--fg-2);
}

.dev__code {
  display: flex;
  justify-content: center;
  gap: var(--s-4);
  margin: 0;
  padding: var(--s-4);
  border: 1px solid var(--rule);
  border-radius: var(--radius-2);
  background: var(--surface-2);
  font-family: var(--font-mono);
  font-size: var(--fs-xl);
}
</style>
