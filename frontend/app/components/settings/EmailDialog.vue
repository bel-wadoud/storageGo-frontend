<script setup lang="ts">
import { ApiError } from '~/services/api/client'
import { accountApi, type AccountDetails } from '~/services/api/account'

// Change the account's email: a 6-digit code goes to the new address, and the change applies
// once it's confirmed. Until then, the current address keeps working.
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ changed: [details: AccountDetails] }>()

const { t } = useI18n()
const toast = useToast()
const online = useOnline()
const errorMessage = useErrorMessage()
const { account } = useAccount()
const wait = useCountdown()

const step = ref<'email' | 'code'>('email')
const email = ref('')
const code = ref('')
const changeId = ref('')
const touched = ref(false)
const busy = ref(false)
const failure = ref('')

watch(
  open,
  (value) => {
    if (!value) return
    step.value = 'email'
    email.value = code.value = changeId.value = failure.value = ''
    touched.value = false
  },
  { immediate: true },
)

const emailError = computed(() => {
  if (!touched.value) return ''
  if (!email.value.trim()) return t('signup.errors.email')
  if (!isEmail(email.value)) return t('signup.errors.emailInvalid')
  if (normalizeEmail(email.value) === account.value?.email) return t('settings.email.errors.same')
  return ''
})

async function send() {
  touched.value = true
  failure.value = ''
  if (emailError.value) return
  busy.value = true
  try {
    const { change_id, resend_after } = await accountApi.startEmailChange(normalizeEmail(email.value))
    changeId.value = change_id
    wait.until(Date.now() + resend_after * 1000)
    step.value = 'code'
  } catch (error) {
    failure.value = errorMessage(error)
  } finally {
    busy.value = false
  }
}

async function resend() {
  failure.value = ''
  try {
    const { resend_after } = await accountApi.resendEmailCode(changeId.value)
    wait.until(Date.now() + resend_after * 1000)
    toast.success(t('signup.verifyEmail.resent', { email: normalizeEmail(email.value) }))
  } catch (error) {
    toast.error(errorMessage(error))
  }
}

async function verify() {
  failure.value = ''
  if (code.value.length !== 6) {
    failure.value = t('signup.verifyEmail.errors.incomplete')
    return
  }
  busy.value = true
  try {
    const details = await accountApi.confirmEmailChange(changeId.value, code.value)
    toast.success(t('settings.email.changed', { email: details.email }))
    emit('changed', details)
    open.value = false
  } catch (error) {
    failure.value = errorMessage(error)
    if (error instanceof ApiError && error.code === 'CODE_INVALID') code.value = ''
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <SgDialog v-model:open="open" :title="t('settings.email.title')" size="sm" :busy="busy">
    <form v-if="step === 'email'" id="settings-email" class="form" novalidate @submit.prevent="send">
      <p class="email__lead">
        <i18n-t keypath="settings.email.lead" scope="global">
          <template #email><bdi class="strong">{{ account?.email }}</bdi></template>
        </i18n-t>
      </p>
      <SgField :label="t('settings.email.new')" :error="emailError" required>
        <SgInput
          v-model="email"
          type="email"
          inputmode="email"
          autocomplete="email"
          dir="ltr"
          spellcheck="false"
          autocapitalize="off"
          :placeholder="t('placeholders.email')"
          :disabled="busy"
          @blur="touched = true"
        />
      </SgField>
      <SgAlert v-if="failure" tone="danger">{{ failure }}</SgAlert>
    </form>
    <form v-else id="settings-email-code" class="form" novalidate @submit.prevent="verify">
      <p class="email__lead">
        <i18n-t keypath="signup.verifyEmail.lead" scope="global">
          <template #email><bdi class="strong">{{ normalizeEmail(email) }}</bdi></template>
        </i18n-t>
      </p>
      <SgField :label="t('signup.verifyEmail.codeLabel')">
        <SgCodeInput v-model="code" :disabled="busy" @complete="verify" />
      </SgField>
      <SgAlert v-if="failure" tone="danger">{{ failure }}</SgAlert>
      <div class="form__actions">
        <SgButton
          variant="ghost"
          size="sm"
          icon="refresh"
          :disabled="wait.seconds.value > 0 || !online"
          :disabled-reason="!online ? t('auth.offlineReason') : t('signup.verifyEmail.resendWait', { time: wait.label.value })"
          @click="resend"
        >
          {{ wait.seconds.value > 0 ? t('signup.verifyEmail.resendIn', { time: wait.label.value }) : t('signup.verifyEmail.resend') }}
        </SgButton>
        <button type="button" class="link" @click="step = 'email'">{{ t('signup.verifyEmail.change') }}</button>
      </div>
    </form>
    <template #footer>
      <SgButton :disabled="busy" :disabled-reason="t('common.pleaseWait')" @click="open = false">{{ t('common.cancel') }}</SgButton>
      <SgButton
        v-if="step === 'email'"
        type="submit"
        form="settings-email"
        variant="primary"
        :loading="busy"
        :loading-label="t('signup.sendingCode')"
        :disabled="!online"
        :disabled-reason="t('auth.offlineReason')"
      >
        {{ t('signup.sendCode') }}
      </SgButton>
      <SgButton v-else type="submit" form="settings-email-code" variant="primary" :loading="busy" :loading-label="t('signup.verifyEmail.verifying')">
        {{ t('settings.email.confirm') }}
      </SgButton>
    </template>
  </SgDialog>
</template>

<style scoped>
.email__lead {
  margin: 0;
  color: var(--fg-2);
}
</style>
