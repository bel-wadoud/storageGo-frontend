<script setup lang="ts">
import { ApiError } from '~/services/api/client'
import { adminApi, type RecoveryRequest } from '~/services/api/admin'

// Approving a recovery (user-flows.md F10). Social engineering is the main threat, so the
// identity checks are a required checklist, not help text. Then the administrator's
// passphrase: their share of the organization recovery key is opened on this device only.
// With a two-admin quorum, the first approval waits for a second administrator.
const props = defineProps<{ request: RecoveryRequest }>()
const emit = defineEmits<{ done: [request: RecoveryRequest]; expired: [] }>()
const open = defineModel<boolean>('open', { required: true })

const { t } = useI18n()
const online = useOnline()
const errorMessage = useErrorMessage()
const authKeyFor = useReauth()

const checks = reactive({ called: false, identity: false, request: false })
const passphrase = ref('')
const passphraseError = ref('')
const failure = ref('')
const phase = ref<'idle' | 'checking' | 'working' | 'saving'>('idle')
const busy = computed(() => phase.value !== 'idle')
const allChecked = computed(() => checks.called && checks.identity && checks.request)
const name = computed(() => props.request.member.name)

watch(passphrase, () => (passphraseError.value = ''))

const blocked = computed(() => {
  if (!online.value) return t('auth.offlineReason')
  if (!allChecked.value) return t('admin.recovery.approve.checkFirst')
  return ''
})
const busyLabel = computed(() => ({ idle: '', checking: t('settings.passphrase.checking'), working: t('admin.recovery.approve.working'), saving: t('settings.saving') })[phase.value])

async function approve() {
  if (blocked.value || busy.value) return
  if (!passphrase.value) {
    passphraseError.value = t('signin.passphrase.errors.empty')
    return
  }
  failure.value = ''
  try {
    phase.value = 'checking'
    const authKey = await authKeyFor(passphrase.value)
    phase.value = 'working'
    const material = await adminApi.recoveryMaterial(props.request.id)
    const result = await (await useCrypto()).approveRecovery(material)
    phase.value = 'saving'
    const updated = await adminApi.approveRecovery(props.request.id, authKey, result)
    passphrase.value = ''
    emit('done', updated)
    open.value = false
  } catch (error) {
    if (error instanceof ApiError && error.code === 'INVALID_CREDENTIALS') passphraseError.value = t('settings.passphrase.errors.current')
    else if (error instanceof ApiError && error.code === 'GONE') {
      emit('expired')
      open.value = false
    } else if (error instanceof ApiError && error.data?.reason === 'no_key') failure.value = t('admin.recovery.noKey')
    else if (error instanceof ApiError && error.data?.reason === 'already') failure.value = t('admin.recovery.already')
    else failure.value = errorMessage(error)
  } finally {
    phase.value = 'idle'
  }
}
</script>

<template>
  <SgDialog v-model:open="open" :title="t('admin.recovery.approve.title', { name })" :busy="busy">
    <form id="admin-approve-recovery" class="apr" novalidate @submit.prevent="approve">
      <SgAlert tone="warning" :title="t('admin.recovery.approve.riskTitle')">{{ t('admin.recovery.approve.risk', { name }) }}</SgAlert>

      <fieldset class="apr__checks">
        <legend>{{ t('admin.recovery.approve.checklist') }}</legend>
        <SgCheckbox v-model="checks.called" :label="t('admin.recovery.approve.called', { name })" :description="t('admin.recovery.approve.calledHint')" :disabled="busy" />
        <SgCheckbox v-model="checks.identity" :label="t('admin.recovery.approve.identity')" :description="t('admin.recovery.approve.identityHint')" :disabled="busy" />
        <SgCheckbox
          v-model="checks.request"
          :label="t('admin.recovery.approve.request', { name, device: request.device })"
          :description="request.location ? t('admin.recovery.approve.requestHint', { place: request.location }) : undefined"
          :disabled="busy"
        />
      </fieldset>

      <SgField :label="t('admin.recovery.approve.passphrase')" :hint="t('admin.recovery.approve.passphraseHint')" :error="passphraseError" required>
        <SgPassphraseInput v-model="passphrase" autocomplete="current-password" :placeholder="t('placeholders.passphrase')" :disabled="busy || !allChecked" />
      </SgField>

      <p v-if="request.required > 1" class="form__note">
        {{ request.approvals.length ? t('admin.recovery.approve.completes') : t('admin.recovery.approve.first', { n: request.required }) }}
      </p>
      <div v-if="busy" aria-live="polite"><SgProgress :label="busyLabel" /></div>
      <SgAlert v-if="failure" tone="danger">{{ failure }}</SgAlert>
    </form>
    <template #footer>
      <SgButton :disabled="busy" :disabled-reason="t('common.pleaseWait')" @click="open = false">{{ t('common.cancel') }}</SgButton>
      <SgButton type="submit" form="admin-approve-recovery" variant="primary" icon="key" :loading="busy" :loading-label="busyLabel" :disabled="Boolean(blocked)" :disabled-reason="blocked">
        {{ t('admin.recovery.approve.submit') }}
      </SgButton>
    </template>
  </SgDialog>
</template>

<style scoped>
.apr {
  display: grid;
  gap: var(--s-4);
}

.apr__checks {
  display: grid;
  gap: var(--s-3);
  margin: 0;
  padding: 0;
  border: 0;
}

.apr__checks legend {
  margin-bottom: var(--s-2);
  padding: 0;
  font-weight: var(--fw-medium);
}
</style>
