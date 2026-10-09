<script setup lang="ts">
import { authApi } from '~/services/api/auth'

definePageMeta({ layout: 'auth', middleware: 'signin', signinStep: 'email' })

const { t } = useI18n()
const route = useRoute()
const online = useOnline()
const errorMessage = useErrorMessage()
const { draft, update } = useSignin()

// Coming back from signup ("Sign in to continue"): the address is already known.
const email = ref(draft.value.email || useSignup().draft.value.email)
const touched = ref(false)
const submitted = ref(false)
const sending = ref(false)
const failure = ref('')

const expired = computed(() => route.query.reason === 'expired')

const error = computed(() => {
  if (!(touched.value || submitted.value)) return ''
  if (!email.value.trim()) return t('signup.errors.email')
  if (!isEmail(email.value)) return t('signup.errors.emailInvalid')
  return ''
})

async function submit() {
  submitted.value = true
  failure.value = ''
  if (error.value) {
    nextTick(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
    return
  }
  sending.value = true
  try {
    const address = normalizeEmail(email.value)
    // Same answer for every address, so nothing here reveals whether an account exists.
    const prelogin = await authApi.prelogin(address)
    update({ email: address, prelogin, deviceId: null, safetyCode: null })
    await navigateTo(SIGNIN_PATHS.passphrase)
  } catch (cause) {
    failure.value = errorMessage(cause)
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <AuthShell :title="t('signin.email.title')" :lead="t('signin.email.lead')">
    <form class="form" novalidate @submit.prevent="submit">
      <SgAlert v-if="expired" tone="info">{{ t('signin.email.expired') }}</SgAlert>

      <SgField :label="t('signup.fields.email')" :error="error" required>
        <SgInput
          v-model="email"
          type="email"
          inputmode="email"
          autocomplete="username"
          dir="ltr"
          spellcheck="false"
          autocapitalize="off"
          size="lg"
          @blur="touched = true"
        />
      </SgField>

      <SgAlert v-if="failure" tone="danger">{{ failure }}</SgAlert>

      <div class="form__actions">
        <SgButton
          type="submit"
          variant="primary"
          size="lg"
          icon-end="arrow-end"
          :loading="sending"
          :loading-label="t('signin.email.checking')"
          :disabled="!online"
          :disabled-reason="t('auth.offlineReason')"
        >
          {{ t('common.continue') }}
        </SgButton>
      </div>

      <p class="form__aside">
        {{ t('signin.email.noAccount') }}
        <NuxtLink to="/signup">{{ t('signin.email.create') }}</NuxtLink>
      </p>
    </form>
  </AuthShell>
</template>
