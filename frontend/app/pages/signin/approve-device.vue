<script setup lang="ts">
import { ApiError } from '~/services/api/client'
import { authApi } from '~/services/api/auth'
import { CryptoError } from '~/services/crypto/types'

definePageMeta({ layout: 'auth', middleware: 'signin', signinStep: 'approve-device' })

const { t } = useI18n()
const toast = useToast()
const online = useOnline()
const errorMessage = useErrorMessage()
const { draft, update, complete } = useSignin()
const expiry = useCountdown()

type State = 'waiting' | 'approved' | 'denied' | 'expired' | 'gone' | 'reenter'
const state = ref<State>('waiting')
const connectionLost = ref(false)
const renewing = ref(false)
const asking = ref(false)
const askedAdmin = ref(false)
const thisDevice = import.meta.client ? deviceName() : ''

expiry.until(draft.value.deviceExpiresAt)

// Polls the request: every 3 s while the page is visible, every 10 s in a background tab,
// and right away when the user comes back to it. Network errors back off up to 15 s.
let timer: ReturnType<typeof setTimeout> | undefined
let failures = 0
let stopped = false

function schedule(ms = document.hidden ? 10_000 : 3_000) {
  clearTimeout(timer)
  if (!stopped && state.value === 'waiting') timer = setTimeout(poll, ms)
}

async function poll() {
  if (stopped || state.value !== 'waiting') return
  try {
    const result = await authApi.deviceStatus(draft.value.deviceId!)
    failures = 0
    connectionLost.value = false
    if (result.status === 'pending') {
      if (expiry.seconds.value === 0) state.value = 'expired'
      return schedule()
    }
    if (result.status === 'denied' || result.status === 'expired') {
      state.value = result.status
      return
    }
    state.value = 'approved'
    try {
      const vault = await useCrypto()
      await vault.unlock(result.bundle)
      await complete(result.account)
    } catch (error) {
      // The page was reloaded while waiting, so the key derived from the passphrase is gone.
      // The device is approved now: one more passphrase entry finishes the sign-in.
      if (error instanceof CryptoError && error.code === 'SG_ERR_ARG') state.value = 'reenter'
      else {
        state.value = 'waiting'
        toast.error(errorMessage(error))
      }
    }
  } catch (error) {
    // The server no longer knows this request (cleaned up, or replaced by a newer sign-in).
    if (error instanceof ApiError && error.code === 'NOT_FOUND') {
      state.value = 'gone'
      return
    }
    failures += 1
    connectionLost.value = true
    schedule(Math.min(3_000 * 2 ** failures, 15_000))
  }
}

function onVisibility() {
  if (!document.hidden) schedule(0)
}

onMounted(() => {
  document.addEventListener('visibilitychange', onVisibility)
  poll()
})
onBeforeUnmount(() => {
  stopped = true
  clearTimeout(timer)
  document.removeEventListener('visibilitychange', onVisibility)
})

// The countdown reaching zero is checked against the server on the next poll.
watch(
  () => expiry.seconds.value,
  (left) => left === 0 && state.value === 'waiting' && schedule(0),
)

async function renew() {
  renewing.value = true
  try {
    const { expires_in } = await authApi.renewDevice(draft.value.deviceId!)
    const until = Date.now() + expires_in * 1000
    update({ deviceExpiresAt: until })
    expiry.until(until)
    askedAdmin.value = false
    state.value = 'waiting'
    toast.success(t('signin.approve.renewed'))
    schedule(1_000)
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    renewing.value = false
  }
}

async function askAdmin() {
  asking.value = true
  try {
    await authApi.askAdmin(draft.value.deviceId!)
    // Confirmed inline, right where the button was.
    askedAdmin.value = true
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    asking.value = false
  }
}

function startOver() {
  update({ deviceId: null, safetyCode: null, deviceExpiresAt: 0, prelogin: null })
  return navigateTo(SIGNIN_PATHS.email, { replace: true })
}

function reenter() {
  update({ deviceId: null, safetyCode: null, deviceExpiresAt: 0 })
  return navigateTo(SIGNIN_PATHS.passphrase, { replace: true })
}
</script>

<template>
  <AuthShell :title="t('signin.approve.title')" :lead="t('signin.approve.lead')" info="deviceApproval">
    <div class="form">
      <div class="code-box" :class="`is-${state}`">
        <p class="code-box__label">{{ t('signin.approve.codeLabel') }}<SgInfo term="safetyCode" /></p>
        <p class="code-box__words" dir="ltr" translate="no" :aria-label="draft.safetyCode?.join(' ')">
          <span v-for="word in draft.safetyCode" :key="word">{{ word }}</span>
        </p>
        <p class="code-box__device">
          <SgIcon name="monitor" :size="14" />
          <bdi>{{ thisDevice }}</bdi>
        </p>
      </div>

      <!-- Waiting -->
      <template v-if="state === 'waiting'">
        <ol class="approve-steps">
          <li>{{ t('signin.approve.step1') }}</li>
          <li>{{ t('signin.approve.step2') }}</li>
          <li>{{ t('signin.approve.step3') }}</li>
        </ol>

        <div class="approve-status">
          <p role="status">
            <SgSpinner decorative size="sm" />
            {{ connectionLost || !online ? t('signin.approve.reconnecting') : t('signin.approve.waiting') }}
          </p>
          <p class="approve-status__time" aria-hidden="true">{{ t('signin.approve.expiresIn', { time: expiry.label.value }) }}</p>
        </div>

        <div class="notice">
          <p class="notice__title">{{ t('signin.approve.noDeviceTitle') }}</p>
          <template v-if="draft.accountKind === 'org'">
            <p v-if="!askedAdmin">{{ t('signin.approve.noDeviceOrg') }}</p>
            <p v-else role="status" class="form__ok">
              <SgIcon name="check" :size="14" />
              {{ t('signin.approve.adminAsked') }}
            </p>
          </template>
          <p v-else>{{ t('signin.approve.noDeviceIndividual') }}</p>
          <div class="form__actions">
            <SgButton
              v-if="draft.accountKind === 'org' && !askedAdmin"
              size="sm"
              icon="users"
              :loading="asking"
              :loading-label="t('signin.approve.asking')"
              :disabled="!online"
              :disabled-reason="t('auth.offlineReason')"
              @click="askAdmin"
            >
              {{ t('signin.approve.askAdmin') }}
            </SgButton>
            <SgButton size="sm" variant="ghost" icon="key" to="/recover/kit">{{ t('signin.approve.useKit') }}</SgButton>
          </div>
        </div>

        <div class="form__actions">
          <SgButton variant="ghost" @click="startOver">{{ t('signin.approve.cancel') }}</SgButton>
        </div>
      </template>

      <!-- Approved: opening the keys -->
      <div v-else-if="state === 'approved'" aria-live="polite">
        <SgProgress :label="t('signin.approve.approved')" />
      </div>

      <!-- Approved, but the page was reloaded meanwhile -->
      <SgAlert v-else-if="state === 'reenter'" tone="success" :title="t('signin.approve.reenterTitle')">
        {{ t('signin.approve.reenter') }}
        <template #actions>
          <SgButton size="sm" variant="primary" icon-end="arrow-end" @click="reenter">{{ t('signin.approve.reenterAction') }}</SgButton>
        </template>
      </SgAlert>

      <!-- Declined on the other device -->
      <SgAlert v-else-if="state === 'denied'" tone="danger" :title="t('signin.approve.deniedTitle')">
        {{ t('signin.approve.denied') }}
        <template #actions>
          <SgButton size="sm" @click="startOver">{{ t('signin.approve.startOver') }}</SgButton>
        </template>
      </SgAlert>

      <!-- The request no longer exists on the server -->
      <SgAlert v-else-if="state === 'gone'" tone="warning" :title="t('signin.approve.goneTitle')">
        {{ t('signin.approve.gone') }}
        <template #actions>
          <SgButton size="sm" variant="primary" @click="startOver">{{ t('signin.approve.startOver') }}</SgButton>
        </template>
      </SgAlert>

      <!-- Expired after 10 minutes -->
      <SgAlert v-else-if="state === 'expired'" tone="warning" :title="t('signin.approve.expiredTitle')">
        {{ t('signin.approve.expired') }}
        <template #actions>
          <SgButton
            size="sm"
            variant="primary"
            icon="refresh"
            :loading="renewing"
            :loading-label="t('signin.approve.renewing')"
            :disabled="!online"
            :disabled-reason="t('auth.offlineReason')"
            @click="renew"
          >
            {{ t('signin.approve.renew') }}
          </SgButton>
          <SgButton size="sm" variant="ghost" @click="startOver">{{ t('signin.approve.cancel') }}</SgButton>
        </template>
      </SgAlert>
    </div>
  </AuthShell>
</template>

<style scoped>
.code-box {
  display: grid;
  gap: var(--s-2);
  padding: var(--s-5);
  border: 1px solid var(--rule);
  border-inline-start: 3px solid var(--signal);
  border-radius: var(--radius-2);
  background: var(--surface);
}

.code-box.is-denied,
.code-box.is-expired,
.code-box.is-gone {
  border-inline-start-color: var(--rule-input);
  opacity: 0.7;
}

.code-box.is-approved,
.code-box.is-reenter {
  border-inline-start-color: var(--success);
}

.code-box__label {
  margin: 0;
  font-size: var(--fs-xs);
  color: var(--fg-2);
}

.code-box__words {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2) var(--s-5);
  margin: 0;
  font-family: var(--font-mono);
  font-size: var(--fs-xl);
  font-weight: var(--fw-medium);
  letter-spacing: 0.02em;
}

/* The words read left to right in every language, but sit on the start side of the box. */
[dir='rtl'] .code-box__words {
  justify-content: flex-end;
}

.code-box__device {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--fg-2);
}

.approve-steps {
  display: grid;
  gap: var(--s-2);
  margin: 0;
  padding-inline-start: var(--s-5);
  color: var(--fg-2);
}

.approve-status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-2) var(--s-4);
  padding-block: var(--s-3);
  border-block: 1px solid var(--rule);
  font-size: var(--fs-sm);
}

.approve-status p {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  margin: 0;
}

.approve-status__time {
  color: var(--fg-2);
  font-variant-numeric: tabular-nums;
}
</style>
