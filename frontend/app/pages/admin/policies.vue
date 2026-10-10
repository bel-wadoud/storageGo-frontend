<script setup lang="ts">
import { ApiError } from '~/services/api/client'
import { adminApi, type DeviceApproval, type Policies } from '~/services/api/admin'

// Organization policies (sitemap §5), set once (personas.md, Karim): sharing, device
// approval, session length, recovery and trash. Changes are kept as a draft with a save bar
// that follows the page; leaving with unsaved changes asks first. Turning organization
// recovery off says what it means and needs the administrator's passphrase.
definePageMeta({ layout: 'app', middleware: ['auth', 'admin'] })
const { t } = useI18n()
const toast = useToast()
const online = useOnline()
const errorMessage = useErrorMessage()
const authKeyFor = useReauth()
const { refresh: refreshOverview } = useAdminOverview()

const saved = ref<Policies | null>(null)
const draft = ref<Policies | null>(null)
const loading = ref(true)
const failure = shallowRef<unknown>(null)
const saving = ref(false)

async function load() {
  loading.value = true
  failure.value = null
  try {
    saved.value = await adminApi.policies()
    draft.value = { ...saved.value }
  } catch (error) {
    failure.value = error
  } finally {
    loading.value = false
  }
}
onMounted(load)

const changes = computed<Partial<Policies>>(() => {
  if (!saved.value || !draft.value) return {}
  const out: Partial<Policies> = {}
  for (const key of Object.keys(draft.value) as (keyof Policies)[]) {
    if (draft.value[key] !== saved.value[key]) (out as Record<string, unknown>)[key] = draft.value[key]
  }
  return out
})
const dirty = computed(() => Object.keys(changes.value).length > 0)
const guard = useLeaveGuard(dirty, () => false)

// ---- Options ----
const optional = (value: string) => (value === 'none' ? null : Number(value))
const asValue = (value: number | null) => (value === null ? 'none' : String(value))
const linkDays = computed(() => [7, 30, 90, 365].map((n) => ({ value: String(n), label: t('admin.policies.days', { n }, n) })).concat({ value: 'none', label: t('admin.policies.noLimit') }))
const sessionHours = computed(() => [
  { value: '8', label: t('admin.policies.hours', { n: 8 }, 8) },
  { value: '24', label: t('admin.policies.hours', { n: 24 }, 24) },
  { value: '168', label: t('admin.policies.days', { n: 7 }, 7) },
  { value: '720', label: t('admin.policies.days', { n: 30 }, 30) },
])
const idle = computed(() => [
  { value: '15', label: t('admin.policies.minutes', { n: 15 }, 15) },
  { value: '60', label: t('admin.policies.hours', { n: 1 }, 1) },
  { value: '240', label: t('admin.policies.hours', { n: 4 }, 4) },
  { value: 'none', label: t('admin.policies.never') },
])
const trash = computed(() => [30, 60, 90].map((n) => ({ value: String(n), label: t('admin.policies.days', { n }, n) })))
const approvalChoices = computed(() => [
  { value: 'trusted_device_or_admin' as DeviceApproval, title: t('admin.policies.devices.either'), description: t('admin.policies.devices.eitherHint') },
  { value: 'trusted_device' as DeviceApproval, title: t('admin.policies.devices.own'), description: t('admin.policies.devices.ownHint') },
  { value: 'none' as DeviceApproval, title: t('admin.policies.devices.none'), description: t('admin.policies.devices.noneHint') },
])
const quorum = computed(() => [
  { value: '2' as const, title: t('admin.policies.recovery.two'), description: t('admin.policies.recovery.twoHint') },
  { value: '1' as const, title: t('admin.policies.recovery.one'), description: t('admin.policies.recovery.oneHint') },
])
const quorumValue = computed({
  get: () => (draft.value?.recovery_approvals === 1 ? '1' : '2') as '1' | '2',
  set: (value) => draft.value && (draft.value.recovery_approvals = value === '1' ? 1 : 2),
})

// ---- Saving ----
const turningOff = computed(() => saved.value?.org_recovery === true && draft.value?.org_recovery === false)
const confirmOpen = ref(false)
const passphrase = ref('')
const passphraseError = ref('')
watch(passphrase, () => (passphraseError.value = ''))

function discard() {
  if (saved.value) draft.value = { ...saved.value }
}

async function save() {
  if (!dirty.value || saving.value) return
  if (turningOff.value && !confirmOpen.value) {
    passphrase.value = ''
    confirmOpen.value = true
    return
  }
  saving.value = true
  try {
    let authKey: string | undefined
    if (turningOff.value) {
      if (!passphrase.value) {
        passphraseError.value = t('signin.passphrase.errors.empty')
        return
      }
      authKey = await authKeyFor(passphrase.value)
    }
    saved.value = await adminApi.updatePolicies(changes.value, authKey)
    draft.value = { ...saved.value }
    confirmOpen.value = false
    passphrase.value = ''
    toast.success(t('admin.policies.saved'))
    refreshOverview()
  } catch (error) {
    if (error instanceof ApiError && error.code === 'INVALID_CREDENTIALS') passphraseError.value = t('settings.passphrase.errors.current')
    else if (error instanceof ApiError && error.data?.reason === 'holders') {
      confirmOpen.value = false
      toast.error(t('admin.policies.recovery.needHolders'))
    } else {
      confirmOpen.value = false
      toast.error(errorMessage(error))
    }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AdminShell :title="t('admin.policies.title')" :lead="t('admin.policies.lead')">
    <SgAlert v-if="failure" tone="danger">
      {{ errorMessage(failure) }}
      <template #actions><SgButton size="sm" icon="refresh" @click="load">{{ t('common.retry') }}</SgButton></template>
    </SgAlert>
    <div v-else-if="loading || !draft" aria-busy="true"><SgSkeleton :lines="10" /></div>

    <form v-else class="pol" novalidate @submit.prevent="save">
      <SettingsSection id="sharing" :title="t('admin.policies.sharing.title')" :description="t('admin.policies.sharing.hint')">
        <SgCheckbox v-model="draft.links_allowed" :label="t('admin.policies.sharing.links')" :description="t('admin.policies.sharing.linksHint')" :disabled="saving" />
        <div class="pol__indent">
          <SgField :label="t('admin.policies.sharing.maxDays')" :hint="t('admin.policies.sharing.maxDaysHint')">
            <SgSelect
              :model-value="asValue(draft.max_link_days)"
              :options="linkDays"
              :disabled="saving || !draft.links_allowed"
              @update:model-value="(v: string) => draft && (draft.max_link_days = optional(v))"
            />
          </SgField>
          <SgCheckbox v-model="draft.link_password_required" :label="t('admin.policies.sharing.password')" :description="t('admin.policies.sharing.passwordHint')" :disabled="saving || !draft.links_allowed" />
        </div>
        <SgCheckbox v-model="draft.requests_allowed" :label="t('admin.policies.sharing.requests')" :description="t('admin.policies.sharing.requestsHint')" :disabled="saving" />
      </SettingsSection>

      <SettingsSection id="devices" :title="t('admin.policies.devices.title')" :description="t('admin.policies.devices.hint')">
        <SgChoice v-model="draft.device_approval" :legend="t('admin.policies.devices.title')" legend-hidden :options="approvalChoices" :disabled="saving" />
        <SgAlert v-if="draft.device_approval === 'none'" tone="warning">{{ t('admin.policies.devices.noneWarning') }}</SgAlert>
      </SettingsSection>

      <SettingsSection id="sessions" :title="t('admin.policies.sessions.title')" :description="t('admin.policies.sessions.hint')">
        <div class="pol__pair">
          <SgField :label="t('admin.policies.sessions.length')" :hint="t('admin.policies.sessions.lengthHint')">
            <SgSelect :model-value="String(draft.session_hours)" :options="sessionHours" :disabled="saving" @update:model-value="(v: string) => draft && (draft.session_hours = Number(v))" />
          </SgField>
          <SgField :label="t('admin.policies.sessions.idle')" :hint="t('admin.policies.sessions.idleHint')">
            <SgSelect :model-value="asValue(draft.idle_lock_minutes)" :options="idle" :disabled="saving" @update:model-value="(v: string) => draft && (draft.idle_lock_minutes = optional(v))" />
          </SgField>
        </div>
      </SettingsSection>

      <SettingsSection id="recovery" :title="t('admin.policies.recovery.title')" :description="t('admin.policies.recovery.hint')">
        <SgCheckbox v-model="draft.org_recovery" :label="t('admin.policies.recovery.on')" :description="t('admin.policies.recovery.onHint')" :disabled="saving" />
        <SgAlert v-if="turningOff" tone="danger" :title="t('admin.policies.recovery.offTitle')">{{ t('admin.policies.recovery.offBody') }}</SgAlert>
        <template v-if="draft.org_recovery">
          <SgChoice v-model="quorumValue" :legend="t('admin.policies.recovery.approvals')" :options="quorum" :disabled="saving" />
          <SgCheckbox v-model="draft.kit_required" :label="t('admin.policies.recovery.kit')" :description="t('admin.policies.recovery.kitHint')" :disabled="saving" />
        </template>
      </SettingsSection>

      <SettingsSection id="trash" :title="t('admin.policies.trash.title')" :description="t('admin.policies.trash.hint')">
        <SgField :label="t('admin.policies.trash.keep')">
          <SgSelect :model-value="String(draft.trash_days)" :options="trash" :disabled="saving" @update:model-value="(v: string) => draft && (draft.trash_days = Number(v))" />
        </SgField>
      </SettingsSection>

      <!-- Follows the page while something is unsaved -->
      <div class="pol__bar" :class="{ 'is-dirty': dirty }" role="region" :aria-label="t('admin.policies.saveBar')">
        <p class="pol__state" aria-live="polite">
          <template v-if="dirty"><SgIcon name="pencil" :size="14" />{{ t('admin.policies.unsaved', { n: Object.keys(changes).length }, Object.keys(changes).length) }}</template>
          <template v-else><SgIcon name="check" :size="14" />{{ t('admin.policies.allSaved') }}</template>
        </p>
        <div class="pol__buttons">
          <SgButton :disabled="!dirty || saving" :disabled-reason="t('settings.noChanges')" @click="discard">{{ t('admin.policies.discard') }}</SgButton>
          <SgButton
            type="submit"
            variant="primary"
            :loading="saving && !confirmOpen"
            :loading-label="t('settings.saving')"
            :disabled="!dirty || !online"
            :disabled-reason="!online ? t('auth.offlineReason') : t('settings.noChanges')"
          >
            {{ t('admin.policies.save') }}
          </SgButton>
        </div>
      </div>
    </form>

    <SgDialog v-model:open="confirmOpen" :title="t('admin.policies.recovery.confirmTitle')" size="sm" :busy="saving">
      <form id="admin-recovery-off" class="pol__confirm" novalidate @submit.prevent="save">
        <p>{{ t('admin.policies.recovery.offBody') }}</p>
        <SgField :label="t('admin.recovery.approve.passphrase')" :error="passphraseError" required>
          <SgPassphraseInput v-model="passphrase" autocomplete="current-password" :placeholder="t('placeholders.passphrase')" :disabled="saving" />
        </SgField>
      </form>
      <template #footer>
        <SgButton :disabled="saving" :disabled-reason="t('common.pleaseWait')" @click="confirmOpen = false">{{ t('common.cancel') }}</SgButton>
        <SgButton type="submit" form="admin-recovery-off" variant="danger" :loading="saving" :loading-label="t('settings.passphrase.checking')">{{ t('admin.policies.recovery.confirmOff') }}</SgButton>
      </template>
    </SgDialog>

    <SgDialog v-model:open="guard.asking.value" :title="t('admin.policies.leaveTitle')" size="sm">
      <p class="pol__leave">{{ t('admin.policies.leaveBody') }}</p>
      <template #footer>
        <SgButton @click="guard.leave()">{{ t('admin.policies.leaveAnyway') }}</SgButton>
        <SgButton variant="primary" @click="guard.stay()">{{ t('admin.policies.stay') }}</SgButton>
      </template>
    </SgDialog>
  </AdminShell>
</template>

<style scoped>
.pol {
  display: grid;
  gap: var(--s-6);
  max-width: 760px;
}

.pol__indent {
  display: grid;
  gap: var(--s-4);
  padding-inline-start: var(--s-7);
}

.pol__pair {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: var(--s-4);
}

.pol__bar {
  position: sticky;
  bottom: var(--s-3);
  z-index: 5;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-3);
  padding: var(--s-3) var(--s-4);
  border: 1px solid var(--rule);
  border-radius: var(--radius-2);
  background: var(--surface);
  transition:
    border-color var(--dur-1) var(--ease),
    box-shadow var(--dur-1) var(--ease);
}

/* Follows the page only while something is unsaved; otherwise it sits at the end. */
.pol__bar:not(.is-dirty) {
  position: static;
}

.pol__bar.is-dirty {
  border-color: var(--signal);
  box-shadow: var(--shadow-pop);
}

.pol__state {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--fg-2);
}

.pol__buttons {
  display: flex;
  gap: var(--s-2);
}

.pol__confirm {
  display: grid;
  gap: var(--s-4);
}

.pol__confirm p,
.pol__leave {
  margin: 0;
  color: var(--fg-2);
}

/* Phones: above the bottom navigation bar. */
@media (max-width: 899px) {
  .pol__bar {
    bottom: calc(var(--bottom-bar-h, 64px) + var(--s-2));
  }

  .pol__indent {
    padding-inline-start: var(--s-5);
  }
}
</style>
