<script setup lang="ts">
import { authApi } from '~/services/api/auth'
import { ApiError } from '~/services/api/client'
import { recoveryApi, type InviteInfo } from '~/services/api/recovery'
import type { SignupResult } from '~/services/crypto/types'

// Joining an organization from an invitation (sitemap §2): who invited you and as what,
// your name and passphrase (keys made on this device), then the recovery kit, then the drive.
// Expired, used and cancelled invitations say what to do instead.
definePageMeta({ layout: 'auth' })
const { t } = useI18n()
const route = useRoute()
const online = useOnline()
const errorMessage = useErrorMessage()
const engine = useEngineStatus()
const { account } = useAccount()

const token = computed(() => String(route.params.token))
const invite = ref<InviteInfo | null>(null)
const screen = ref<'loading' | 'notFound' | 'error' | 'ready'>('loading')
const failure = ref('')
const loadError = shallowRef<unknown>(null)

// Who is signed in on this browser, even after a reload (the account summary isn't kept).
const signedInAs = ref<string | null>(null)

async function load() {
  screen.value = 'loading'
  loadError.value = null
  try {
    const [info, session] = await Promise.all([recoveryApi.invite(token.value), authApi.session().catch(() => null)])
    signedInAs.value = account.value?.email ?? session?.account.email ?? null
    invite.value = info
    screen.value = 'ready'
  } catch (error) {
    if (error instanceof ApiError && error.code === 'NOT_FOUND') screen.value = 'notFound'
    else {
      loadError.value = error
      screen.value = 'error'
    }
  }
}
onMounted(load)

// Signed in as someone else on this browser: joining would mix two accounts.
const otherAccount = computed(() => Boolean(signedInAs.value && invite.value && signedInAs.value !== invite.value.email))
const sameAccount = computed(() => Boolean(signedInAs.value && invite.value && signedInAs.value === invite.value.email))

const name = ref('')
const nameTouched = ref(false)
const nameError = computed(() => (nameTouched.value && !name.value.trim() ? t('signup.errors.name') : ''))
const blocked = computed(() => {
  if (!engine.supported.value) return t('signup.passphrase.unsupportedShort')
  if (!online.value) return t('auth.offlineReason')
  if (engine.state.value === 'failed') return t('signup.passphrase.engineFailedShort')
  return ''
})

const phase = ref<'idle' | 'keys' | 'saving'>('idle')
// Keys already made but not saved (the network failed): a retry reuses them and the same
// Idempotency-Key, so Argon2id doesn't run again and no second account can be created.
const made = shallowRef<{ result: SignupResult; idempotencyKey: string } | null>(null)
const form = ref<{ clear: () => void } | null>(null)

async function join(passphrase: string) {
  nameTouched.value = true
  if (!name.value.trim() || !invite.value) {
    nextTick(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
    return
  }
  failure.value = ''
  try {
    if (!made.value) {
      phase.value = 'keys'
      const vault = await useCrypto()
      await vault.ready()
      made.value = { result: await vault.signup(invite.value.email, passphrase, invite.value.org_recovery_key), idempotencyKey: crypto.randomUUID() }
    }
    phase.value = 'saving'
    const joined = await recoveryApi.acceptInvite(token.value, name.value.trim(), made.value.result.request, made.value.idempotencyKey)
    const phrase = made.value.result.recovery_phrase
    made.value = null
    form.value?.clear()
    useAccount().setAccount(joined.account)
    // The kit step shows the words made with these keys. resumeKit starts a fresh signup
    // state (which forgets words), so they're handed over right after it starts.
    const signup = useSignup()
    const going = signup.resumeKit(joined.account, { member: true })
    signup.setKitPhrase(phrase)
    await going
  } catch (error) {
    failure.value = error instanceof ApiError && error.code === 'GONE' ? t('invite.errors.gone') : errorMessage(error)
    if (error instanceof ApiError && error.code === 'GONE') load()
  } finally {
    phase.value = 'idle'
  }
}

const title = computed(() => {
  if (screen.value === 'notFound') return t('invite.notFoundTitle')
  if (screen.value === 'error') return t('invite.errorTitle')
  if (screen.value === 'loading' || !invite.value) return t('invite.loading')
  if (invite.value.status !== 'valid') return t(`invite.${invite.value.status}Title`)
  return t('invite.title', { org: isolate(invite.value.org_name) })
})
</script>

<template>
  <AuthShell :title="title">
    <div v-if="screen === 'loading'" aria-busy="true"><SgSkeleton :lines="5" /></div>

    <p v-else-if="screen === 'notFound'" class="inv-lead">{{ t('invite.notFound') }}</p>

    <SgAlert v-else-if="screen === 'error'" tone="danger">
      {{ errorMessage(loadError) }}
      <template #actions><SgButton size="sm" icon="refresh" :disabled="!online" :disabled-reason="t('auth.offlineReason')" @click="load">{{ t('common.retry') }}</SgButton></template>
    </SgAlert>

    <template v-else-if="invite && invite.status !== 'valid'">
      <p class="inv-lead">{{ t(`invite.${invite.status}`, { name: invite.inviter.name, org: invite.org_name }) }}</p>
      <div class="form__actions">
        <SgButton v-if="invite.status === 'used'" variant="primary" to="/signin">{{ t('invite.toSignin') }}</SgButton>
      </div>
    </template>

    <template v-else-if="invite">
      <ShareSender :sender="{ name: invite.inviter.name, org_name: invite.org_name }" :note="invite.role === 'admin' ? t('invite.asAdmin') : t('invite.asMember')" />

      <!-- Already in -->
      <template v-if="sameAccount">
        <p class="inv-lead">{{ t('invite.already') }}</p>
        <div class="form__actions"><SgButton variant="primary" to="/drive">{{ t('signup.invite.toDrive') }}</SgButton></div>
      </template>

      <!-- Someone else is signed in here -->
      <template v-else-if="otherAccount">
        <SgAlert tone="warning" :title="t('invite.otherTitle')">{{ t('invite.other', { current: isolate(signedInAs ?? ''), invited: isolate(invite.email) }) }}</SgAlert>
        <div class="form__actions"><SgButton variant="primary" icon="logout" to="/signout">{{ t('signin.unlock.signOut') }}</SgButton></div>
      </template>

      <template v-else>
        <p class="inv-lead">{{ t('invite.lead') }}</p>
        <AuthEngineAlert :supported="engine.supported.value" :state="engine.state.value" :error="engine.error.value" @retry="engine.retry" />
        <dl class="facts-grid inv-facts">
          <div><dt>{{ t('signup.fields.email') }}</dt><dd><bdi dir="ltr">{{ invite.email }}</bdi></dd></div>
          <div><dt>{{ t('invite.role') }}</dt><dd>{{ invite.role === 'admin' ? t('admin.members.roles.admin') : t('admin.members.roles.member') }}</dd></div>
        </dl>
        <SgField :label="t('signup.fields.name')" :hint="t('invite.nameHint')" :error="nameError" required>
          <SgInput v-model="name" dir="auto" autocomplete="name" :placeholder="t('placeholders.name')" :disabled="phase !== 'idle'" @blur="nameTouched = true" />
        </SgField>
        <AuthNewPassphrase
          ref="form"
          :email="invite.email"
          :notice="invite.org_recovery ? t('invite.noticeOrg', { org: invite.org_name }) : t('signup.passphrase.noticeIndividual')"
          :submit-label="made ? t('common.retry') : t('invite.submit')"
          :busy="phase !== 'idle'"
          :busy-label="phase === 'saving' ? t('signup.passphrase.saving') : t('signup.passphrase.creating')"
          :disabled-reason="blocked"
          @submit="join"
        >
          <SgAlert v-if="failure" tone="danger">{{ failure }}</SgAlert>
        </AuthNewPassphrase>
      </template>
    </template>
  </AuthShell>
</template>

<style scoped>
.inv-lead {
  margin: 0 0 var(--s-5);
  color: var(--fg-2);
}

.inv-facts {
  margin: var(--s-5) 0;
}
</style>
