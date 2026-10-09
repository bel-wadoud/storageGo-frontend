<script setup lang="ts">
import type { OrgSector } from '~/services/api/signup'

definePageMeta({ layout: 'auth', middleware: 'signup', signupStep: 'org' })

const { t } = useI18n()
const online = useOnline()
const errorMessage = useErrorMessage()
const { draft, update, startSignup } = useSignup()

// Opening this page directly (e.g. from "Pricing → Organization") means an organization signup.
if (draft.value.kind !== 'org') update({ kind: 'org' })

const field = <K extends 'orgName' | 'name' | 'email'>(key: K) =>
  computed({ get: () => draft.value[key], set: (value: string) => update({ [key]: value }) })
const orgName = field('orgName')
const name = field('name')
const email = field('email')
const sector = computed({ get: () => draft.value.sector, set: (value) => update({ sector: value as OrgSector }) })
const terms = ref(false)

const submitted = ref(false)
const touched = reactive({ orgName: false, name: false, email: false, sector: false })
const sending = ref(false)
const failure = ref('')

const sectors = computed(() =>
  (['health', 'legal', 'finance', 'public', 'education', 'other'] as const).map((value) => ({
    value,
    label: t(`signup.org.sectors.${value}`),
  })),
)

const show = (key: keyof typeof touched) => touched[key] || submitted.value
const errors = computed(() => ({
  orgName: show('orgName') && !orgName.value.trim() ? t('signup.org.errors.orgName') : '',
  sector: show('sector') && !sector.value ? t('signup.org.errors.sector') : '',
  name: show('name') && !name.value.trim() ? t('signup.errors.name') : '',
  email:
    show('email') && !isEmail(email.value)
      ? email.value.trim()
        ? t('signup.errors.emailInvalid')
        : t('signup.errors.email')
      : '',
  terms: submitted.value && !terms.value ? t('signup.errors.terms') : '',
}))

// Shown as a fact once the address is valid: invitations to the same domain are the common case.
const domain = computed(() => (isEmail(email.value) ? normalizeEmail(email.value).split('@')[1] : ''))

async function submit() {
  submitted.value = true
  failure.value = ''
  if (Object.values(errors.value).some(Boolean)) {
    nextTick(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
    return
  }
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
  <SignupShell step="org" :title="t('signup.org.title')" :lead="t('signup.org.lead')" :back="SIGNUP_PATHS.start">
    <form class="form" novalidate @submit.prevent="submit">
      <SgField :label="t('signup.org.orgName')" :error="errors.orgName" required>
        <SgInput v-model="orgName" autocomplete="organization" @blur="touched.orgName = true" />
      </SgField>
      <SgField :label="t('signup.org.sector')" :error="errors.sector" required>
        <SgSelect v-model="sector" :options="sectors" :placeholder="t('signup.org.sectorPlaceholder')" @blur="touched.sector = true" />
      </SgField>
      <SgField :label="t('signup.fields.name')" :hint="t('signup.org.nameHint')" :error="errors.name" required>
        <SgInput v-model="name" autocomplete="name" @blur="touched.name = true" />
      </SgField>
      <SgField :label="t('signup.org.email')" :hint="t('signup.org.emailHint')" :error="errors.email" required>
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
      <p v-if="domain" class="form__note">
        <i18n-t keypath="signup.org.domainNote" scope="global">
          <template #domain><bdi class="mono">{{ domain }}</bdi></template>
        </i18n-t>
      </p>
      <SignupTerms v-model="terms" :error="errors.terms" />

      <SgAlert v-if="failure" tone="danger">{{ failure }}</SgAlert>

      <div class="form__actions">
        <SgButton
          type="submit"
          variant="primary"
          size="lg"
          :loading="sending"
          :loading-label="t('signup.sendingCode')"
          :disabled="!online"
          :disabled-reason="t('auth.offlineReason')"
        >
          {{ t('signup.sendCode') }}
        </SgButton>
      </div>
    </form>
  </SignupShell>
</template>
