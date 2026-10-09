<script setup lang="ts">
import { ApiError } from '~/services/api/client'
import { signupApi } from '~/services/api/signup'

definePageMeta({ layout: 'auth', middleware: 'signup', signupStep: 'verify-email' })

const { t } = useI18n()
const toast = useToast()
const online = useOnline()
const errorMessage = useErrorMessage()
const { draft, update } = useSignup()

const code = ref('')
const error = ref('')
const verifying = ref(false)
const resending = ref(false)
const expired = ref(false)
const changePath = computed(() => (draft.value.kind === 'org' ? SIGNUP_PATHS.org : SIGNUP_PATHS.start))

// Countdown before another code can be requested, refreshed every second.
const now = ref(Date.now())
let tick: ReturnType<typeof setInterval> | undefined
onMounted(() => (tick = setInterval(() => (now.value = Date.now()), 1000)))
onBeforeUnmount(() => clearInterval(tick))
const waitSeconds = computed(() => Math.max(0, Math.ceil((draft.value.resendAt - now.value) / 1000)))
const countdown = computed(() => `${Math.floor(waitSeconds.value / 60)}:${String(waitSeconds.value % 60).padStart(2, '0')}`)

async function verify() {
  error.value = ''
  if (code.value.length !== 6) {
    error.value = t('signup.verifyEmail.errors.incomplete')
    return
  }
  verifying.value = true
  try {
    const { signup_token } = await signupApi.verifyEmail(draft.value.signupId!, code.value)
    update({ signupToken: signup_token })
    toast.success(t('signup.verifyEmail.verified'))
    await navigateTo(SIGNUP_PATHS.passphrase)
  } catch (cause) {
    if (cause instanceof ApiError && cause.code === 'SIGNUP_EXPIRED') expired.value = true
    error.value = errorMessage(cause)
    code.value = ''
    nextTick(() => document.querySelector<HTMLInputElement>('.code input')?.focus())
  } finally {
    verifying.value = false
  }
}

async function resend() {
  resending.value = true
  error.value = ''
  try {
    const { resend_after } = await signupApi.resendCode(draft.value.signupId!)
    update({ resendAt: Date.now() + resend_after * 1000 })
    code.value = ''
    toast.success(t('signup.verifyEmail.resent', { email: draft.value.email }))
  } catch (cause) {
    if (cause instanceof ApiError && cause.code === 'RATE_LIMITED' && cause.retryAfter) {
      update({ resendAt: Date.now() + cause.retryAfter * 1000 })
    }
    toast.error(errorMessage(cause))
  } finally {
    resending.value = false
  }
}

function startOver() {
  update({ signupId: null, signupToken: null, resendAt: 0 })
  return navigateTo(changePath.value)
}
</script>

<template>
  <SignupShell step="verify-email" :title="t('signup.verifyEmail.title')" :back="changePath">
    <template #lead>
      <i18n-t keypath="signup.verifyEmail.lead" scope="global">
        <template #email><bdi class="strong">{{ draft.email }}</bdi></template>
      </i18n-t>
    </template>

    <form class="form" novalidate @submit.prevent="verify">
      <SgField :label="t('signup.verifyEmail.codeLabel')" :error="error">
        <SgCodeInput v-model="code" class="code" :disabled="verifying" @complete="verify" />
      </SgField>

      <SgAlert v-if="expired" tone="warning">
        {{ t('signup.verifyEmail.expired') }}
        <template #actions>
          <SgButton size="sm" @click="startOver">{{ t('signup.verifyEmail.startOver') }}</SgButton>
        </template>
      </SgAlert>

      <div class="form__actions">
        <SgButton
          type="submit"
          variant="primary"
          size="lg"
          :loading="verifying"
          :loading-label="t('signup.verifyEmail.verifying')"
          :disabled="!online"
          :disabled-reason="t('auth.offlineReason')"
        >
          {{ t('signup.verifyEmail.verify') }}
        </SgButton>
        <SgButton
          variant="ghost"
          icon="refresh"
          :loading="resending"
          :loading-label="t('signup.sendingCode')"
          :disabled="waitSeconds > 0 || !online"
          :disabled-reason="!online ? t('auth.offlineReason') : t('signup.verifyEmail.resendWait', { time: countdown })"
          @click="resend"
        >
          {{ waitSeconds > 0 ? t('signup.verifyEmail.resendIn', { time: countdown }) : t('signup.verifyEmail.resend') }}
        </SgButton>
      </div>

      <div class="form__note">
        <p>{{ t('signup.verifyEmail.help') }}</p>
        <p>
          <button type="button" class="link" @click="startOver">{{ t('signup.verifyEmail.change') }}</button>
        </p>
      </div>
    </form>
  </SignupShell>
</template>
