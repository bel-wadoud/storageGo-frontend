<script setup lang="ts">
import type { AccountKind } from '~/services/api/signup'

definePageMeta({ layout: 'auth', middleware: 'signup', signupStep: 'start' })

const { t } = useI18n()
const online = useOnline()
const errorMessage = useErrorMessage()
const { draft, update, startSignup } = useSignup()

const kind = computed({
  get: () => draft.value.kind,
  set: (value: AccountKind | null) => update({ kind: value }),
})
const name = computed({ get: () => draft.value.name, set: (value) => update({ name: value }) })
const email = computed({ get: () => draft.value.email, set: (value) => update({ email: value }) })
const terms = ref(false)

const submitted = ref(false)
const touched = reactive({ name: false, email: false })
const sending = ref(false)
const failure = ref('')

const errors = computed(() => ({
  kind: submitted.value && !kind.value ? t('signup.start.errors.kind') : '',
  name: (touched.name || submitted.value) && !name.value.trim() ? t('signup.errors.name') : '',
  email:
    (touched.email || submitted.value) && !isEmail(email.value)
      ? email.value.trim()
        ? t('signup.errors.emailInvalid')
        : t('signup.errors.email')
      : '',
  terms: submitted.value && !terms.value ? t('signup.errors.terms') : '',
}))

const options = computed(() => [
  { value: 'org' as const, title: t('signup.start.org'), description: t('signup.start.orgHint'), icon: 'building' as const },
  { value: 'individual' as const, title: t('signup.start.individual'), description: t('signup.start.individualHint'), icon: 'user' as const },
])

function focusFirstError() {
  nextTick(() => document.querySelector<HTMLElement>('[aria-invalid="true"], .sg-choice input')?.focus())
}

async function submit() {
  submitted.value = true
  failure.value = ''
  if (!kind.value) return focusFirstError()
  if (kind.value === 'org') return navigateTo(SIGNUP_PATHS.org)
  if (Object.values(errors.value).some(Boolean)) return focusFirstError()

  sending.value = true
  try {
    update({ email: normalizeEmail(email.value) })
    await startSignup()
    await navigateTo(SIGNUP_PATHS['verify-email'])
  } catch (error) {
    failure.value = errorMessage(error)
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <SignupShell step="start" :title="t('signup.start.title')" :lead="t('signup.start.lead')">
    <form class="form" novalidate @submit.prevent="submit">
      <div>
        <SgChoice v-model="kind" :legend="t('signup.start.kindLabel')" :options="options" />
        <p v-if="errors.kind" class="form__error" role="alert"><SgIcon name="alert" :size="14" />{{ errors.kind }}</p>
      </div>

      <template v-if="kind === 'individual'">
        <SgField :label="t('signup.fields.name')" :error="errors.name" required>
          <SgInput v-model="name" autocomplete="name" @blur="touched.name = true" />
        </SgField>
        <SgField :label="t('signup.fields.email')" :hint="t('signup.fields.emailHint')" :error="errors.email" required>
          <SgInput
            v-model="email"
            type="email"
            inputmode="email"
            autocomplete="email"
            dir="ltr"
            spellcheck="false"
            autocapitalize="off"
            @blur="touched.email = true"
          />
        </SgField>
        <SignupTerms v-model="terms" :error="errors.terms" />
      </template>

      <SgAlert v-if="failure" tone="danger">{{ failure }}</SgAlert>

      <div class="form__actions">
        <SgButton
          type="submit"
          variant="primary"
          size="lg"
          :icon-end="kind === 'individual' ? undefined : 'arrow-end'"
          :loading="sending"
          :loading-label="t('signup.sendingCode')"
          :disabled="kind === 'individual' && !online"
          :disabled-reason="t('auth.offlineReason')"
        >
          {{ kind === 'individual' ? t('signup.sendCode') : t('common.continue') }}
        </SgButton>
      </div>

      <p class="form__aside">
        {{ t('signup.haveAccount') }}
        <NuxtLink to="/signin">{{ t('signup.signIn') }}</NuxtLink>
      </p>
    </form>
  </SignupShell>
</template>
