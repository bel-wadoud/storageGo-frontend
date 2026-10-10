<script setup lang="ts">
import { ApiError } from '~/services/api/client'
import { recoveryApi, type AdminRequestState } from '~/services/api/recovery'

// Asking the organization for access back (user-flows.md F9 → F10). The member says who they
// are and why; their administrators call them to check it's really them, then approve. This
// page waits with them: it checks every 15 seconds, and the email says when it's done. The
// request (not the keys) is remembered in this tab, so a reload comes back to the waiting screen.
definePageMeta({ layout: 'auth' })
const { t, locale } = useI18n()
const online = useOnline()
const errorMessage = useErrorMessage()
const engine = useEngineStatus()
const signin = useSignin()
const { draft, clear } = useSessionDraft<{ email: string; requestId: string | null; expiresAt: string | null }>('sg_recover_admin', () => ({
  email: '',
  requestId: null,
  expiresAt: null,
}))

const email = ref(draft.value.email || signin.draft.value.email)
const reason = ref('')
const submitted = ref(false)
const sending = ref(false)
const failure = ref('')
const state = ref<AdminRequestState | null>(null)
const checking = ref(false)
let timer: ReturnType<typeof setInterval> | undefined

const errors = computed(() => ({
  email: submitted.value ? (!email.value.trim() ? t('signup.errors.email') : !isEmail(email.value) ? t('signup.errors.emailInvalid') : '') : '',
  reason: submitted.value && [...reason.value.trim()].length < 10 ? t('recover.admin.errors.reason') : '',
}))
const blocked = computed(() => {
  if (!engine.supported.value) return t('signup.passphrase.unsupportedShort')
  if (!online.value) return t('auth.offlineReason')
  return ''
})

async function send() {
  submitted.value = true
  failure.value = ''
  if (errors.value.email || errors.value.reason) {
    nextTick(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
    return
  }
  sending.value = true
  try {
    const publicKey = await (await useCrypto()).recoveryDeviceKey()
    const sent = await recoveryApi.requestAdmin(normalizeEmail(email.value), reason.value.trim(), publicKey)
    draft.value = { email: normalizeEmail(email.value), requestId: sent.request_id, expiresAt: sent.expires_at }
    reason.value = ''
    await poll()
  } catch (error) {
    failure.value = error instanceof ApiError && error.data?.reason === 'not_org' ? t('recover.admin.errors.notOrg') : errorMessage(error)
  } finally {
    sending.value = false
  }
}

async function poll() {
  if (!draft.value.requestId) return
  checking.value = true
  try {
    state.value = await recoveryApi.adminStatus(draft.value.requestId)
    failure.value = ''
  } catch (error) {
    if (error instanceof ApiError && error.code === 'NOT_FOUND') startOver()
    else failure.value = errorMessage(error)
  } finally {
    checking.value = false
  }
}

const waiting = computed(() => state.value?.status === 'pending' || state.value?.status === 'waiting_second')
watch(waiting, (on) => {
  clearInterval(timer)
  if (on) timer = setInterval(() => !document.hidden && online.value && poll(), 15_000)
})
onMounted(() => draft.value.requestId && poll())
onBeforeUnmount(() => clearInterval(timer))

function startOver() {
  clearInterval(timer)
  clear()
  state.value = null
  submitted.value = false
}

const title = computed(() => {
  switch (state.value?.status) {
    case 'pending':
    case 'waiting_second':
      return t('recover.admin.waitingTitle')
    case 'approved':
      return t('recover.admin.approvedTitle')
    case 'denied':
      return t('recover.admin.deniedTitle')
    case 'expired':
      return t('recover.admin.expiredTitle')
    default:
      return draft.value.requestId ? t('recover.admin.waitingTitle') : t('recover.admin.title')
  }
})
</script>

<template>
  <AuthShell :title="title" :lead="draft.requestId ? undefined : t('recover.admin.lead')" :back="draft.requestId ? undefined : '/recover'">
    <!-- Ask -->
    <form v-if="!draft.requestId" class="form" novalidate @submit.prevent="send">
      <AuthEngineAlert :supported="engine.supported.value" :state="engine.state.value" :error="engine.error.value" @retry="engine.retry" />
      <SgField :label="t('signup.fields.email')" :hint="t('recover.admin.emailHint')" :error="errors.email" required>
        <SgInput v-model="email" type="email" dir="ltr" autocomplete="username" inputmode="email" :placeholder="t('placeholders.email')" :disabled="sending" />
      </SgField>
      <SgField :label="t('recover.admin.reason')" :hint="t('recover.admin.reasonHint')" :error="errors.reason" required>
        <SgTextarea v-model="reason" :rows="3" :placeholder="t('recover.admin.reasonPlaceholder')" :disabled="sending" />
      </SgField>
      <div class="notice">
        <p class="notice__title">{{ t('recover.admin.whatNextTitle') }}</p>
        <ol class="notice__list">
          <li>{{ t('recover.admin.next1') }}</li>
          <li>{{ t('recover.admin.next2') }}</li>
          <li>{{ t('recover.admin.next3') }}</li>
        </ol>
      </div>
      <SgAlert v-if="failure" tone="danger">{{ failure }}</SgAlert>
      <div class="form__actions">
        <SgButton type="submit" variant="primary" size="lg" icon="mail" :loading="sending" :loading-label="t('recover.admin.sending')" :disabled="Boolean(blocked)" :disabled-reason="blocked">
          {{ t('recover.admin.submit') }}
        </SgButton>
      </div>
    </form>

    <!-- Following the request -->
    <div v-else class="req">
      <div v-if="!state" aria-busy="true"><SgSkeleton :lines="4" /></div>

      <template v-else-if="waiting">
        <p class="req__lead">{{ t('recover.admin.waitingLead', { email: isolate(draft.email) }) }}</p>
        <SgProgress :value="state.approvals" :max="state.required" :label="t('recover.admin.approvals', { n: state.approvals, total: state.required })" />
        <dl class="facts-grid">
          <div><dt>{{ t('recover.admin.expires') }}</dt><dd>{{ formatDateTime(state.expires_at, locale) }}</dd></div>
        </dl>
        <p class="form__note">{{ t('recover.admin.keepOpen') }}</p>
        <div class="form__actions">
          <SgButton icon="refresh" :loading="checking" :loading-label="t('recover.admin.checking')" :disabled="!online" :disabled-reason="t('auth.offlineReason')" @click="poll">
            {{ t('recover.admin.checkNow') }}
          </SgButton>
          <SgButton variant="ghost" @click="startOver">{{ t('recover.admin.cancel') }}</SgButton>
        </div>
      </template>

      <template v-else-if="state.status === 'approved'">
        <p class="req__lead">{{ t('recover.admin.approvedLead') }}</p>
        <div class="form__actions">
          <SgButton variant="primary" size="lg" icon="key" to="/recover/new-passphrase">{{ t('recover.admin.choose') }}</SgButton>
        </div>
      </template>

      <template v-else-if="state.status === 'denied'">
        <p class="req__lead">{{ t('recover.admin.deniedLead') }}</p>
        <figure v-if="state.denied_reason" class="req__reason">
          <figcaption>{{ t('recover.admin.theirReason') }}</figcaption>
          <blockquote dir="auto">{{ state.denied_reason }}</blockquote>
        </figure>
        <div class="form__actions">
          <SgButton @click="startOver">{{ t('recover.admin.again') }}</SgButton>
          <SgButton variant="ghost" to="/signin">{{ t('recover.backToSignin') }}</SgButton>
        </div>
      </template>

      <template v-else>
        <p class="req__lead">{{ t('recover.admin.expiredLead') }}</p>
        <div class="form__actions">
          <SgButton variant="primary" @click="startOver">{{ t('recover.admin.again') }}</SgButton>
        </div>
      </template>

      <SgAlert v-if="failure" tone="danger">{{ failure }}</SgAlert>
    </div>
  </AuthShell>
</template>

<style scoped>
.req {
  display: grid;
  gap: var(--s-5);
}

.req__lead {
  margin: 0;
  color: var(--fg-2);
}

.req__reason {
  display: grid;
  gap: var(--s-1);
  margin: 0;
  padding-inline-start: var(--s-3);
  border-inline-start: 2px solid var(--rule);
}

.req__reason figcaption {
  font-size: var(--fs-xs);
  color: var(--fg-2);
}

.req__reason blockquote {
  margin: 0;
  font-style: italic;
  overflow-wrap: anywhere;
  text-align: left;
}

[dir='rtl'] .req__reason blockquote {
  text-align: right;
}
</style>
