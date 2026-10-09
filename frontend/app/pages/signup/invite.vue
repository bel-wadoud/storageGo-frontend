<script setup lang="ts">
import { signupApi, type InviteResult, type InviteRole } from '~/services/api/signup'

definePageMeta({ layout: 'auth', middleware: 'signup', signupStep: 'invite' })

const MAX_INVITES = 500
const MAX_CSV_BYTES = 1024 * 1024

const { t, locale } = useI18n()
const toast = useToast()
const online = useOnline()
const errorMessage = useErrorMessage()
const { draft, reset } = useSignup()

const list = ref('')
const role = ref<InviteRole>('member')
const sending = ref(false)
const failure = ref('')
const result = ref<InviteResult | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const importing = ref(false)

const parsed = computed(() => parseEmailList(list.value))
const own = computed(() => parsed.value.valid.filter((email) => email !== draft.value.email))
const domain = computed(() => draft.value.email.split('@')[1] ?? '')
const roles = computed(() => [
  { value: 'member', label: t('signup.invite.roles.member') },
  { value: 'admin', label: t('signup.invite.roles.admin') },
])

const listError = computed(() => {
  if (parsed.value.invalid.length) return t('signup.invite.errors.invalid', { list: parsed.value.invalid.slice(0, 3).join(', ') }, parsed.value.invalid.length)
  if (own.value.length > MAX_INVITES) return t('signup.invite.errors.tooMany', { max: formatNumber(MAX_INVITES, locale.value) })
  return ''
})

const blockedReason = computed(() => {
  if (!online.value) return t('auth.offlineReason')
  if (!own.value.length) return t('signup.invite.errors.none')
  if (listError.value) return t('signup.invite.errors.fixFirst')
  return ''
})

async function importCsv(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (file.size > MAX_CSV_BYTES) {
    toast.error(t('signup.invite.csvTooLarge'))
    return
  }
  importing.value = true
  try {
    const found = parseEmailList(await file.text())
    if (!found.valid.length) {
      toast.warning(t('signup.invite.csvEmpty', { name: file.name }))
      return
    }
    const before = new Set(parsed.value.valid)
    const added = found.valid.filter((email) => !before.has(email))
    list.value = [list.value.trim(), ...added].filter(Boolean).join('\n')
    toast.success(t('signup.invite.csvImported', { n: added.length, name: file.name }, added.length))
  } catch {
    toast.error(t('signup.invite.csvUnreadable', { name: file.name }))
  } finally {
    importing.value = false
  }
}

async function send() {
  failure.value = ''
  if (blockedReason.value) return
  sending.value = true
  try {
    const outcome = await signupApi.invite(own.value.map((email) => ({ email, role: role.value })))
    if (!outcome.skipped.length) {
      toast.success(t('signup.invite.sent', { n: outcome.sent.length }, outcome.sent.length))
      return finish()
    }
    // Some were not sent: stay and show exactly which ones and why.
    result.value = outcome
    list.value = ''
  } catch (error) {
    failure.value = errorMessage(error)
  } finally {
    sending.value = false
  }
}

function finish() {
  reset()
  return navigateTo(SIGNUP_PATHS.done, { replace: true })
}
</script>

<template>
  <SignupShell step="invite" :title="t('signup.invite.title')" :lead="t('signup.invite.lead')">
    <div v-if="result" class="form">
      <SgAlert v-if="result.sent.length" tone="success">{{ t('signup.invite.sent', { n: result.sent.length }, result.sent.length) }}</SgAlert>
      <SgAlert tone="warning" :title="t('signup.invite.skippedTitle', { n: result.skipped.length }, result.skipped.length)">
        <ul class="notice__list">
          <li v-for="item in result.skipped" :key="item.email">
            <bdi>{{ item.email }}</bdi> · {{ t(`signup.invite.reasons.${item.reason}`) }}
          </li>
        </ul>
      </SgAlert>
      <div class="form__actions">
        <SgButton variant="primary" size="lg" icon-end="arrow-end" @click="finish">{{ t('signup.invite.toDrive') }}</SgButton>
        <SgButton variant="ghost" @click="result = null">{{ t('signup.invite.more') }}</SgButton>
      </div>
    </div>

    <form v-else class="form" novalidate @submit.prevent="send">
      <SgField :label="t('signup.invite.label')" :hint="t('signup.invite.hint')" :error="listError">
        <SgTextarea
          v-model="list"
          :rows="4"
          dir="ltr"
          spellcheck="false"
          autocapitalize="off"
          :placeholder="t('signup.invite.placeholder', { domain: domain || 'clinique-atlas.dz' })"
          :disabled="sending"
        />
      </SgField>

      <div class="invite-tools">
        <p class="form__note" aria-live="polite">
          {{ own.length ? t('signup.invite.count', { n: formatNumber(own.length, locale) }, own.length) : t('signup.invite.countNone') }}
        </p>
        <SgButton size="sm" icon="file" :loading="importing" :loading-label="t('signup.invite.importing')" :disabled="sending" @click="fileInput?.click()">
          {{ t('signup.invite.csv') }}
        </SgButton>
        <input ref="fileInput" class="sr-only" type="file" accept=".csv,.txt,text/csv,text/plain" tabindex="-1" aria-hidden="true" @change="importCsv" />
      </div>

      <SgField :label="t('signup.invite.role')" :hint="t('signup.invite.roleHint')">
        <SgSelect v-model="role" :options="roles" :disabled="sending" />
      </SgField>

      <SgAlert v-if="failure" tone="danger">{{ failure }}</SgAlert>

      <div class="form__actions">
        <SgButton
          type="submit"
          variant="primary"
          size="lg"
          icon="mail"
          :loading="sending"
          :loading-label="t('signup.invite.sending')"
          :disabled="Boolean(blockedReason)"
          :disabled-reason="blockedReason"
        >
          {{ own.length ? t('signup.invite.send', { n: formatNumber(own.length, locale) }, own.length) : t('signup.invite.sendNone') }}
        </SgButton>
        <SgButton variant="ghost" :disabled="sending" :disabled-reason="t('common.pleaseWait')" @click="finish">
          {{ t('signup.invite.skip') }}
        </SgButton>
      </div>

      <p class="form__note">{{ t('signup.invite.later') }}</p>
    </form>
  </SignupShell>
</template>

<style scoped>
.invite-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-3);
  margin-top: calc(-1 * var(--s-3));
}
</style>
