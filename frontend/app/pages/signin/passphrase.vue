<script setup lang="ts">
import { ApiError } from '~/services/api/client'
import { authApi } from '~/services/api/auth'
import { CryptoError } from '~/services/crypto/types'

definePageMeta({ layout: 'auth', middleware: 'signin', signinStep: 'passphrase' })

const { t } = useI18n()
const online = useOnline()
const errorMessage = useErrorMessage()
const { draft, update, complete } = useSignin()
const engine = useEngineStatus()
const pause = useCountdown()

const passphrase = ref('')
const submitted = ref(false)
// 'keys': Argon2id on this device. 'checking': the server checks the auth key.
// 'opening': the key bundle is opened on this device.
const phase = ref<'idle' | 'keys' | 'checking' | 'opening'>('idle')
const fieldError = ref('')
const failure = ref('')
const keyChanged = ref(false)

const busy = computed(() => phase.value !== 'idle')
const phaseLabel = computed(
  () => ({ idle: '', keys: t('signin.passphrase.unlocking'), checking: t('signin.passphrase.checking'), opening: t('signin.passphrase.opening') })[phase.value],
)
const emptyError = computed(() => (submitted.value && !passphrase.value ? t('signin.passphrase.errors.empty') : ''))
const blockedReason = computed(() => {
  if (!engine.supported.value) return t('signup.passphrase.unsupportedShort')
  if (!online.value) return t('auth.offlineReason')
  if (engine.state.value === 'failed') return t('signup.passphrase.engineFailedShort')
  if (pause.seconds.value > 0) return t('signin.passphrase.pausedFor', { time: pause.label.value })
  return ''
})

// Typing again clears the "doesn't match" message (but clearing the field after a failure doesn't).
watch(passphrase, (value) => value && (fieldError.value = ''))

function changeEmail() {
  update({ prelogin: null })
  return navigateTo(SIGNIN_PATHS.email)
}

async function submit() {
  submitted.value = true
  failure.value = ''
  fieldError.value = ''
  if (!passphrase.value) return focusField()
  if (blockedReason.value) return

  try {
    phase.value = 'keys'
    const vault = await useCrypto()
    await vault.ready()
    const request = await vault.loginRequest(draft.value.email, passphrase.value, draft.value.prelogin!)

    phase.value = 'checking'
    const device = await vault.deviceIdentity()
    const result = await authApi.login(request, { public_key: device.public_key, name: deviceName() })
    passphrase.value = ''

    if (result.status === 'device_approval') {
      update({
        deviceId: result.device_id,
        deviceExpiresAt: Date.now() + result.expires_in * 1000,
        safetyCode: device.safety_code,
        accountKind: result.account_kind,
      })
      await navigateTo(SIGNIN_PATHS['approve-device'], { replace: true })
      return
    }

    phase.value = 'opening'
    await vault.unlock(result.bundle)
    await complete(result.account)
  } catch (error) {
    if (error instanceof ApiError && error.code === 'INVALID_CREDENTIALS') {
      fieldError.value = errorMessage(error)
      passphrase.value = ''
      focusField()
    } else if (error instanceof ApiError && error.code === 'RATE_LIMITED') {
      pause.until(Date.now() + (error.retryAfter ?? 60) * 1000)
      failure.value = errorMessage(error)
    } else if (error instanceof CryptoError && error.code === 'SG_ERR_KEY_CHANGED') {
      keyChanged.value = true
    } else {
      failure.value = errorMessage(error)
    }
  } finally {
    phase.value = 'idle'
  }
}

function focusField() {
  nextTick(() => document.querySelector<HTMLInputElement>('.sg-pass input')?.focus())
}

// The pause message disappears by itself when the pause is over.
watch(
  () => pause.seconds.value,
  (left, before) => {
    if (left === 0 && before > 0) failure.value = ''
  },
)
</script>

<template>
  <AuthShell :title="t('signin.passphrase.title')" :back="SIGNIN_PATHS.email">
    <template #lead>
      <i18n-t keypath="signin.passphrase.as" scope="global">
        <template #email><bdi class="strong">{{ draft.email }}</bdi></template>
      </i18n-t>
      <button type="button" class="link signin-change" @click="changeEmail">{{ t('signin.passphrase.change') }}</button>
    </template>

    <AuthEngineAlert :supported="engine.supported.value" :state="engine.state.value" :error="engine.error.value" @retry="engine.retry" />

    <SgAlert v-if="keyChanged" tone="danger" :title="t('signin.passphrase.keyChangedTitle')">
      {{ t('errors.keyChanged') }}
    </SgAlert>

    <form v-else class="form" novalidate @submit.prevent="submit">
      <!-- Lets password managers match the saved passphrase to this account. -->
      <input class="sr-only" type="email" autocomplete="username" :value="draft.email" tabindex="-1" aria-hidden="true" readonly />

      <SgField :label="t('signup.passphrase.label')" :error="fieldError || emptyError" required>
        <SgPassphraseInput v-model="passphrase" autocomplete="current-password" size="lg" :placeholder="t('placeholders.passphrase')" :disabled="busy" autofocus />
      </SgField>

      <SgAlert v-if="failure" :tone="pause.seconds.value > 0 ? 'warning' : 'danger'">
        {{ pause.seconds.value > 0 ? t('signin.passphrase.paused', { time: pause.label.value }) : failure }}
      </SgAlert>

      <div class="form__actions">
        <SgButton
          type="submit"
          variant="primary"
          size="lg"
          :loading="busy"
          :loading-label="phaseLabel"
          :disabled="Boolean(blockedReason)"
          :disabled-reason="blockedReason"
        >
          {{ t('signin.passphrase.submit') }}
        </SgButton>
        <NuxtLink to="/recover" class="signin-forgot">{{ t('signin.passphrase.forgot') }}</NuxtLink>
      </div>

      <div v-if="busy" aria-live="polite">
        <SgProgress :label="phaseLabel" />
      </div>

      <details class="details">
        <summary>{{ t('signup.passphrase.detailsTitle') }}</summary>
        <p>{{ t('signin.passphrase.details') }}</p>
      </details>
    </form>
  </AuthShell>
</template>

<style scoped>
.signin-change {
  margin-inline-start: var(--s-2);
}

.signin-forgot {
  font-size: var(--fs-sm);
}
</style>
