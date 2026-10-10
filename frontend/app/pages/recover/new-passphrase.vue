<script setup lang="ts">
import { ApiError } from '~/services/api/client'
import { recoveryApi } from '~/services/api/recovery'

// The last step of an administrator-approved recovery: the identity keys the administrators
// sealed to this device are opened here, the member chooses a new passphrase, and is signed
// in. Their old kit is lost, so they make a new one right away (the drive stays closed until then).
definePageMeta({ layout: 'auth' })
const { t } = useI18n()
const toast = useToast()
const online = useOnline()
const errorMessage = useErrorMessage()
const { draft, clear } = useSessionDraft<{ email: string; requestId: string | null; expiresAt: string | null }>('sg_recover_admin', () => ({
  email: '',
  requestId: null,
  expiresAt: null,
}))

const state = ref<'loading' | 'ready' | 'notApproved' | 'error'>('loading')
const failure = ref('')
const saving = ref(false)
let challenge = ''

async function open() {
  state.value = 'loading'
  failure.value = ''
  if (!draft.value.requestId) return navigateTo('/recover', { replace: true })
  try {
    const status = await recoveryApi.adminStatus(draft.value.requestId)
    if (status.status !== 'approved' || !status.sealed_identity || !status.challenge) {
      state.value = 'notApproved'
      return
    }
    await (await useCrypto()).openAdminRecovery(status.sealed_identity)
    challenge = status.challenge
    state.value = 'ready'
  } catch (error) {
    if (error instanceof ApiError && error.code === 'NOT_FOUND') {
      clear()
      return navigateTo('/recover', { replace: true })
    }
    failure.value = errorMessage(error)
    state.value = 'error'
  }
}
onMounted(open)

const form = ref<{ clear: () => void } | null>(null)
async function finish(passphrase: string) {
  saving.value = true
  failure.value = ''
  try {
    const { change, proof } = await (await useCrypto()).finishRecovery(draft.value.email, passphrase, challenge)
    const { account } = await recoveryApi.finishAdmin(draft.value.requestId!, proof, change)
    form.value?.clear()
    clear()
    useAccount().setAccount(account)
    useSignin().reset()
    toast.success(t('recover.doneAdmin'))
    await useSignup().resumeKit(account, { member: true })
  } catch (error) {
    failure.value = errorMessage(error)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AuthShell :title="t('recover.newPassphrase.title')" :lead="state === 'ready' ? t('recover.newPassphrase.lead') : undefined">
    <div v-if="state === 'loading'" aria-busy="true">
      <SgSkeleton :lines="4" />
      <p class="form__note" role="status"><SgSpinner decorative size="sm" /> {{ t('recover.newPassphrase.opening') }}</p>
    </div>

    <template v-else-if="state === 'notApproved'">
      <SgAlert tone="info">{{ t('recover.newPassphrase.notApproved') }}</SgAlert>
      <div class="form__actions"><SgButton to="/recover/admin-request">{{ t('recover.newPassphrase.toRequest') }}</SgButton></div>
    </template>

    <SgAlert v-else-if="state === 'error'" tone="danger">
      {{ failure }}
      <template #actions><SgButton size="sm" icon="refresh" :disabled="!online" :disabled-reason="t('auth.offlineReason')" @click="open">{{ t('common.retry') }}</SgButton></template>
    </SgAlert>

    <AuthNewPassphrase
      v-else
      ref="form"
      :email="draft.email"
      :notice="t('recover.newPassphrase.notice')"
      :submit-label="t('recover.newPassphrase.submit')"
      :busy="saving"
      :busy-label="t('recover.newPassphrase.saving')"
      :disabled-reason="online ? undefined : t('auth.offlineReason')"
      @submit="finish"
    >
      <SgAlert v-if="failure" tone="danger">{{ failure }}</SgAlert>
    </AuthNewPassphrase>
  </AuthShell>
</template>
