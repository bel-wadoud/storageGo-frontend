<script setup lang="ts">
import { signupApi } from '~/services/api/signup'
import type { SignupResult } from '~/services/crypto/types'

definePageMeta({ layout: 'auth', middleware: 'signup', signupStep: 'passphrase' })

const { t } = useI18n()
const online = useOnline()
const errorMessage = useErrorMessage()
const { draft, update, setKitPhrase } = useSignup()

const passphrase = ref('')
const confirmation = ref('')
const understood = ref(false)
const submitted = ref(false)
const touchedConfirm = ref(false)

// 'keys': Argon2id and key generation in the worker. 'saving': sending the wrapped keys.
const phase = ref<'idle' | 'keys' | 'saving'>('idle')
const failure = ref('')

// The engine loads while the user types, so "Create passphrase" doesn't wait for the WASM.
const engine = useEngineStatus()

// Keys already made but not yet saved (the network failed): retrying reuses them and the same
// Idempotency-Key, so Argon2id doesn't run again and the server can't create two accounts.
const made = shallowRef<{ result: SignupResult; idempotencyKey: string; for: string } | null>(null)
watch(passphrase, () => (made.value = null))

const errors = computed(() => ({
  passphrase:
    submitted.value && !passphraseAcceptable(passphrase.value)
      ? passphrase.value
        ? t('signup.passphrase.errors.weak')
        : t('signup.passphrase.errors.empty')
      : '',
  confirmation:
    (submitted.value || touchedConfirm.value) && confirmation.value !== passphrase.value
      ? t('signup.passphrase.errors.mismatch')
      : '',
  understood: submitted.value && !understood.value ? t('signup.passphrase.errors.understood') : '',
}))

const matches = computed(() => Boolean(confirmation.value) && confirmation.value === passphrase.value)
const busy = computed(() => phase.value !== 'idle')
const blockedReason = computed(() => {
  if (!engine.supported.value) return t('signup.passphrase.unsupportedShort')
  if (!online.value) return t('auth.offlineReason')
  if (engine.state.value === 'failed') return t('signup.passphrase.engineFailedShort')
  return ''
})

async function submit() {
  submitted.value = true
  failure.value = ''
  if (Object.values(errors.value).some(Boolean)) {
    nextTick(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
    return
  }

  try {
    if (!made.value || made.value.for !== passphrase.value) {
      phase.value = 'keys'
      const vault = await useCrypto()
      await vault.ready()
      made.value = {
        result: await vault.signup(draft.value.email, passphrase.value),
        idempotencyKey: crypto.randomUUID(),
        for: passphrase.value,
      }
    }
    phase.value = 'saving'
    const { result, idempotencyKey } = made.value
    const { user_id, org_id } = await signupApi.complete(draft.value.signupToken!, result.request, idempotencyKey)
    // Signed in from here on (the server set the session cookie; the keys are unlocked).
    useAccount().setAccount({
      user_id,
      email: draft.value.email,
      name: draft.value.name,
      kind: draft.value.kind ?? 'individual',
      org_id: org_id ?? null,
      org_name: draft.value.kind === 'org' ? draft.value.orgName : null,
      kit_verified: false,
    })

    setKitPhrase(result.recovery_phrase)
    made.value = null
    // The passphrase leaves this page's memory as soon as it is no longer needed.
    passphrase.value = ''
    confirmation.value = ''
    update({ accountCreated: true, signupToken: null, orgId: org_id ?? null, kitSaved: false, kitChallenge: null })
    await navigateTo(SIGNUP_PATHS['recovery-kit'], { replace: true })
  } catch (error) {
    failure.value = errorMessage(error)
  } finally {
    phase.value = 'idle'
  }
}
</script>

<template>
  <SignupShell step="passphrase" :title="t('signup.passphrase.title')" :lead="t('signup.passphrase.lead')">
    <AuthEngineAlert
      :supported="engine.supported.value"
      :state="engine.state.value"
      :error="engine.error.value"
      @retry="engine.retry"
    />

    <form class="form" novalidate @submit.prevent="submit">
      <!-- Lets password managers store the passphrase under the right account. -->
      <input class="sr-only" type="email" autocomplete="username" :value="draft.email" tabindex="-1" aria-hidden="true" readonly />

      <SgField :label="t('signup.passphrase.label')" :hint="t('signup.passphrase.hint')" :error="errors.passphrase" required>
        <SgPassphraseInput v-model="passphrase" autocomplete="new-password" size="lg" :disabled="busy" />
      </SgField>

      <SgField :label="t('signup.passphrase.confirm')" :error="errors.confirmation" required>
        <SgPassphraseInput
          v-model="confirmation"
          autocomplete="new-password"
          :meter="false"
          :disabled="busy"
          @blur="touchedConfirm = true"
        />
      </SgField>
      <p v-if="matches" class="form__ok" role="status">
        <SgIcon name="check" :size="14" />
        {{ t('signup.passphrase.matches') }}
      </p>

      <div class="notice">
        <p class="notice__title">{{ t('signup.passphrase.noticeTitle') }}</p>
        <p>{{ draft.kind === 'org' ? t('signup.passphrase.noticeOrg') : t('signup.passphrase.noticeIndividual') }}</p>
        <SgCheckbox v-model="understood" :invalid="Boolean(errors.understood)" :disabled="busy">
          {{ t('signup.passphrase.understood') }}
        </SgCheckbox>
        <p v-if="errors.understood" class="form__error" role="alert"><SgIcon name="alert" :size="14" />{{ errors.understood }}</p>
      </div>

      <SgAlert v-if="failure" tone="danger">{{ failure }}</SgAlert>

      <div class="form__actions">
        <SgButton
          type="submit"
          variant="primary"
          size="lg"
          :loading="busy"
          :loading-label="phase === 'saving' ? t('signup.passphrase.saving') : t('signup.passphrase.creating')"
          :disabled="Boolean(blockedReason)"
          :disabled-reason="blockedReason"
        >
          {{ made ? t('common.retry') : t('signup.passphrase.submit') }}
        </SgButton>
      </div>

      <div v-if="busy" class="work" aria-live="polite">
        <SgProgress :label="phase === 'saving' ? t('signup.passphrase.saving') : t('signup.passphrase.creating')" />
        <ol class="work__steps">
          <li :class="phase === 'keys' ? 'is-current' : 'is-done'">
            <SgIcon :name="phase === 'keys' ? 'key' : 'check'" :size="14" />
            {{ t('signup.passphrase.workKeys') }}
          </li>
          <li :class="phase === 'saving' ? 'is-current' : ''">
            <SgIcon name="arrow-end" :size="14" />
            {{ t('signup.passphrase.workSave') }}
          </li>
        </ol>
      </div>

      <details class="details">
        <summary>{{ t('signup.passphrase.detailsTitle') }}</summary>
        <p>{{ t('signup.passphrase.details') }}</p>
      </details>
    </form>
  </SignupShell>
</template>
