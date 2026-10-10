<script setup lang="ts">
import { ApiError } from '~/services/api/client'
import { authApi, type SessionInfo } from '~/services/api/auth'

// The session is still valid but the keys aren't in this tab's memory (the page was
// reloaded, or the app locked itself after a period of inactivity). Only the passphrase is
// needed; the server already knows who this is.
definePageMeta({ layout: 'auth' })

const { t } = useI18n()
const route = useRoute()
const online = useOnline()
const errorMessage = useErrorMessage()
const { update, complete } = useSignin()
const engine = useEngineStatus()
const pause = useCountdown()

const next = safeNext(route.query.next)
const idle = route.query.reason === 'idle'
const session = shallowRef<SessionInfo | null>(null)
const loading = ref(true)
const loadError = ref('')

const passphrase = ref('')
const submitted = ref(false)
const phase = ref<'idle' | 'keys' | 'checking' | 'opening'>('idle')
const fieldError = ref('')
const failure = ref('')

const busy = computed(() => phase.value !== 'idle')
const phaseLabel = computed(
  () => ({ idle: '', keys: t('signin.passphrase.unlocking'), checking: t('signin.passphrase.checking'), opening: t('signin.passphrase.opening') })[phase.value],
)
const blockedReason = computed(() => {
  if (!engine.supported.value) return t('signup.passphrase.unsupportedShort')
  if (!online.value) return t('auth.offlineReason')
  if (engine.state.value === 'failed') return t('signup.passphrase.engineFailedShort')
  if (pause.seconds.value > 0) return t('signin.passphrase.pausedFor', { time: pause.label.value })
  return ''
})

function toSignin() {
  return navigateTo({ path: SIGNIN_PATHS.email, query: { reason: 'expired', ...(next ? { next } : {}) } }, { replace: true })
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    if (cryptoSupported() && (await (await useCrypto()).isUnlocked())) {
      // Already unlocked in this tab (e.g. opened twice): nothing to ask.
      await navigateTo(next ?? SIGNUP_PATHS.done, { replace: true })
      return
    }
    session.value = await authApi.session()
  } catch (error) {
    if (error instanceof ApiError && error.code === 'UNAUTHORIZED') return toSignin()
    loadError.value = errorMessage(error)
  } finally {
    loading.value = false
  }
}

onMounted(load)
// Typing again clears the "doesn't match" message (but clearing the field after a failure doesn't).
watch(passphrase, (value) => value && (fieldError.value = ''))

async function submit() {
  submitted.value = true
  failure.value = ''
  fieldError.value = ''
  if (!passphrase.value) {
    fieldError.value = t('signin.passphrase.errors.empty')
    return
  }
  if (blockedReason.value || !session.value) return

  try {
    phase.value = 'keys'
    const vault = await useCrypto()
    await vault.ready()
    const request = await vault.loginRequest(session.value.account.email, passphrase.value, session.value.prelogin)
    phase.value = 'checking'
    const { bundle, account } = await authApi.unlock(request.auth_key)
    passphrase.value = ''
    phase.value = 'opening'
    await vault.unlock(bundle)
    update({ next })
    await complete(account)
  } catch (error) {
    if (error instanceof ApiError && error.code === 'UNAUTHORIZED') return toSignin()
    if (error instanceof ApiError && error.code === 'INVALID_CREDENTIALS') {
      fieldError.value = errorMessage(error)
      passphrase.value = ''
      nextTick(() => document.querySelector<HTMLInputElement>('.sg-pass input')?.focus())
    } else if (error instanceof ApiError && error.code === 'RATE_LIMITED') {
      pause.until(Date.now() + (error.retryAfter ?? 60) * 1000)
      failure.value = errorMessage(error)
    } else {
      failure.value = errorMessage(error)
    }
  } finally {
    phase.value = 'idle'
  }
}

watch(
  () => pause.seconds.value,
  (left, before) => {
    if (left === 0 && before > 0) failure.value = ''
  },
)
</script>

<template>
  <AuthShell :title="t('signin.unlock.title')" :lead="idle ? t('signin.unlock.leadIdle') : t('signin.unlock.lead')">
    <div v-if="loading" class="form" aria-busy="true">
      <SgSkeleton variant="block" height="64px" />
      <SgSkeleton variant="block" height="48px" />
    </div>

    <SgAlert v-else-if="loadError" tone="danger">
      {{ loadError }}
      <template #actions>
        <SgButton size="sm" icon="refresh" @click="load">{{ t('common.retry') }}</SgButton>
      </template>
    </SgAlert>

    <form v-else-if="session" class="form" novalidate @submit.prevent="submit">
      <AuthEngineAlert :supported="engine.supported.value" :state="engine.state.value" :error="engine.error.value" @retry="engine.retry" />

      <div class="who">
        <span class="who__mark" aria-hidden="true">{{ session.account.name.trim().charAt(0).toUpperCase() }}</span>
        <div class="who__text">
          <p class="who__name"><bdi>{{ session.account.name }}</bdi></p>
          <p class="who__meta">
            <bdi>{{ session.account.email }}</bdi>
            <template v-if="session.account.org_name"> · <bdi>{{ session.account.org_name }}</bdi></template>
          </p>
        </div>
      </div>

      <input class="sr-only" type="email" autocomplete="username" :value="session.account.email" tabindex="-1" aria-hidden="true" readonly />

      <SgField :label="t('signup.passphrase.label')" :error="fieldError" required>
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
          icon="key"
          :loading="busy"
          :loading-label="phaseLabel"
          :disabled="Boolean(blockedReason)"
          :disabled-reason="blockedReason"
        >
          {{ t('signin.unlock.submit') }}
        </SgButton>
        <NuxtLink to="/recover" class="unlock-forgot">{{ t('signin.passphrase.forgot') }}</NuxtLink>
      </div>

      <div v-if="busy" aria-live="polite">
        <SgProgress :label="phaseLabel" />
      </div>

      <p class="form__aside">
        {{ t('signin.unlock.notYou') }}
        <NuxtLink to="/signout">{{ t('signin.unlock.signOut') }}</NuxtLink>
      </p>
    </form>
  </AuthShell>
</template>

<style scoped>
.who {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  padding: var(--s-4);
  border: 1px solid var(--rule);
  border-radius: var(--radius-2);
  background: var(--surface);
}

.who__mark {
  display: inline-grid;
  place-items: center;
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  background: var(--surface-3);
  font-weight: var(--fw-medium);
}

.who__text {
  min-width: 0;
}

.who__name,
.who__meta {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.who__name {
  font-weight: var(--fw-medium);
}

.who__meta {
  font-size: var(--fs-sm);
  color: var(--fg-2);
}

.unlock-forgot {
  font-size: var(--fs-sm);
}
</style>
