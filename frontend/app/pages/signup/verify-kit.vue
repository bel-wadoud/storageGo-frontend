<script setup lang="ts">
import { signupApi } from '~/services/api/signup'

definePageMeta({ layout: 'auth', middleware: 'signup', signupStep: 'verify-kit' })

const { t } = useI18n()
const toast = useToast()
const online = useOnline()
const errorMessage = useErrorMessage()
const { draft, update, reset, kitPhrase, wipeKitPhrase } = useSignup()

const words = computed(() => kitPhrase.value?.split(' ') ?? [])

// Two different positions, picked once and kept, so a reload doesn't change the question.
if (!draft.value.kitChallenge && words.value.length) {
  const picks = crypto.getRandomValues(new Uint32Array(2))
  const first = (picks[0]! % words.value.length) + 1
  let second = (picks[1]! % (words.value.length - 1)) + 1
  if (second >= first) second += 1
  update({ kitChallenge: first < second ? [first, second] : [second, first] })
}
const positions = computed(() => draft.value.kitChallenge ?? [1, 2])

const answers = reactive(['', ''])
const wrong = reactive([false, false])
const attempts = ref(0)
const checking = ref(false)
const failure = ref('')
const submitted = ref(false)

const errors = computed(() =>
  positions.value.map((position, i) => {
    if (submitted.value && !answers[i]!.trim()) return t('signup.verifyKit.errors.empty', { n: position })
    if (wrong[i]) return t('signup.verifyKit.errors.wrong', { n: position })
    return ''
  }),
)

// Typing again clears the "wrong word" mark for that box.
watch(
  () => [...answers],
  (now, before) => now.forEach((value, i) => value !== before[i] && (wrong[i] = false)),
)

const clean = (value: string) => value.normalize('NFC').trim().toLowerCase()

async function submit() {
  submitted.value = true
  failure.value = ''
  if (errors.value.some(Boolean)) return focusInvalid()

  positions.value.forEach((position, i) => (wrong[i] = clean(answers[i]!) !== words.value[position - 1]))
  if (wrong.some(Boolean)) {
    attempts.value += 1
    return focusInvalid()
  }

  checking.value = true
  try {
    await signupApi.confirmKitVerified()
    update({ kitVerified: true })
    wipeKitPhrase()
    const { account, setAccount } = useAccount()
    if (account.value) setAccount({ ...account.value, kit_verified: true })
    toast.success(t('signup.verifyKit.confirmed'))
    if (draft.value.kind === 'org' && !draft.value.member) {
      await navigateTo(SIGNUP_PATHS['org-recovery'], { replace: true })
    } else {
      reset()
      await navigateTo(SIGNUP_PATHS.done, { replace: true })
    }
  } catch (error) {
    failure.value = errorMessage(error)
  } finally {
    checking.value = false
  }
}

function focusInvalid() {
  nextTick(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
}

const { asking: leaving, stay, leave } = useLeaveGuard(
  computed(() => Boolean(kitPhrase.value) && !draft.value.kitVerified),
  (to) => to.path === SIGNUP_PATHS['recovery-kit'] || to.path === SIGNUP_PATHS['verify-kit'],
)
</script>

<template>
  <div>
    <SignupShell
      step="verify-kit"
      :title="t('signup.verifyKit.title')"
      :lead="t('signup.verifyKit.lead')"
      :back="kitPhrase ? SIGNUP_PATHS['recovery-kit'] : undefined"
    >
      <SignupKitLost v-if="!kitPhrase" />

      <form v-else class="form" novalidate @submit.prevent="submit">
        <div class="form__pair">
          <SgField
            v-for="(position, i) in positions"
            :key="position"
            :label="t('signup.verifyKit.word', { n: position })"
            :error="errors[i]"
            required
          >
            <SgInput
              v-model="answers[i]"
              class="mono"
              dir="ltr"
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
              :placeholder="t('placeholders.kitWord')"
              :disabled="checking"
            />
          </SgField>
        </div>

        <SgAlert v-if="attempts >= 3" tone="info">
          {{ t('signup.verifyKit.stuck') }}
          <template #actions>
            <SgButton size="sm" icon="arrow-start" :to="SIGNUP_PATHS['recovery-kit']">{{ t('signup.verifyKit.showAgain') }}</SgButton>
          </template>
        </SgAlert>
        <SgAlert v-if="failure" tone="danger">{{ failure }}</SgAlert>

        <div class="form__actions">
          <SgButton
            type="submit"
            variant="primary"
            size="lg"
            :loading="checking"
            :loading-label="t('signup.verifyKit.checking')"
            :disabled="!online"
            :disabled-reason="t('auth.offlineReason')"
          >
            {{ t('signup.verifyKit.submit') }}
          </SgButton>
        </div>
      </form>
    </SignupShell>

    <SgDialog v-model:open="leaving" :title="t('signup.leave.title')" size="sm">
      <p>{{ t('signup.leave.body') }}</p>
      <template #footer>
        <SgButton @click="leave">{{ t('signup.leave.leave') }}</SgButton>
        <SgButton variant="primary" @click="stay">{{ t('signup.leave.stay') }}</SgButton>
      </template>
    </SgDialog>
  </div>
</template>
