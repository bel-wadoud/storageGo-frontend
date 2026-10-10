<script setup lang="ts">
import { signupApi } from '~/services/api/signup'

definePageMeta({ layout: 'auth', middleware: 'signup', signupStep: 'recovery-kit' })

const { t, locale } = useI18n()
const toast = useToast()
const errorMessage = useErrorMessage()
const { draft, update, kitPhrase, setKitPhrase } = useSignup()
const downloadKit = useKitFile()

const words = computed(() => kitPhrase.value?.split(' ') ?? [])
const state = ref<'ready' | 'restoring' | 'lost'>(kitPhrase.value ? 'ready' : 'restoring')
const created = computed(() => formatDate(new Date(), locale.value))
const recoverUrl = computed(() => (import.meta.client ? `${window.location.host}/recover` : '/recover'))
const saved = reactive({ downloaded: false, printed: false })

// Words missing but keys unlocked (the user just signed in to finish signup): make a new kit.
onMounted(async () => {
  if (kitPhrase.value) return
  try {
    const engine = await useCrypto()
    if (!(await engine.isUnlocked())) {
      state.value = 'lost'
      return
    }
    const kit = await engine.regenerateKit()
    await signupApi.replaceRecoveryKit(kit.identity_by_recovery)
    setKitPhrase(kit.recovery_phrase)
    update({ kitSaved: false, kitChallenge: null })
    state.value = 'ready'
  } catch (error) {
    state.value = 'lost'
    toast.error(errorMessage(error))
  }
})

function markSaved(how: 'downloaded' | 'printed') {
  saved[how] = true
  update({ kitSaved: true })
}

function download() {
  downloadKit({
    words: words.value,
    email: draft.value.email,
    orgName: draft.value.kind === 'org' ? draft.value.orgName : null,
    created: created.value,
    recoverUrl: recoverUrl.value,
  })
  markSaved('downloaded')
  toast.success(t('signup.kit.downloaded'))
}

function print() {
  window.addEventListener('afterprint', () => markSaved('printed'), { once: true })
  window.print()
}

const { asking: leaving, stay, leave } = useLeaveGuard(
  computed(() => state.value === 'ready'),
  (to) => to.path === SIGNUP_PATHS['verify-kit'] || to.path === SIGNUP_PATHS['recovery-kit'],
)
</script>

<template>
  <div>
    <SignupShell class="no-print" step="recovery-kit" :title="t('signup.kit.title')" :lead="t('signup.kit.lead')">
      <SignupKitLost v-if="state === 'lost'" />

      <div v-else-if="state === 'restoring'" class="form" aria-busy="true">
        <SgProgress :label="t('signup.kit.restoring')" />
        <SgSkeleton variant="block" height="280px" />
      </div>

      <div v-else class="form">
        <p class="form__note">
          {{ t('signup.kit.facts', { count: words.length, date: created }) }}
        </p>

        <SgWordGrid :words="words" />

        <div class="form__actions">
          <SgButton variant="primary" icon="download" @click="download">{{ t('signup.kit.download') }}</SgButton>
          <SgButton icon="printer" @click="print">{{ t('signup.kit.print') }}</SgButton>
        </div>
        <ul v-if="saved.downloaded || saved.printed" class="form__ok-list" role="status">
          <li v-if="saved.downloaded"><SgIcon name="check" :size="14" />{{ t('signup.kit.didDownload') }}</li>
          <li v-if="saved.printed"><SgIcon name="check" :size="14" />{{ t('signup.kit.didPrint') }}</li>
        </ul>

        <div class="notice">
          <p class="notice__title">{{ t('signup.kit.keepTitle') }}</p>
          <ul class="notice__list">
            <li>{{ t('signup.kit.keep1') }}</li>
            <li>{{ t('signup.kit.keep2') }}</li>
            <li>{{ draft.kind === 'org' ? t('signup.kit.keep3Org') : t('signup.kit.keep3Individual') }}</li>
          </ul>
        </div>

        <div class="form__actions">
          <SgButton
            variant="primary"
            size="lg"
            icon-end="arrow-end"
            :disabled="!draft.kitSaved"
            :disabled-reason="t('signup.kit.saveFirst')"
            @click="navigateTo(SIGNUP_PATHS['verify-kit'])"
          >
            {{ t('signup.kit.continue') }}
          </SgButton>
        </div>
      </div>
    </SignupShell>

    <SignupKitSheet
      v-if="state === 'ready'"
      :words="words"
      :email="draft.email"
      :org-name="draft.kind === 'org' ? draft.orgName : undefined"
      :created="created"
      :recover-url="recoverUrl"
    />

    <SgDialog v-model:open="leaving" :title="t('signup.leave.title')" size="sm">
      <p>{{ t('signup.leave.body') }}</p>
      <template #footer>
        <SgButton @click="leave">{{ t('signup.leave.leave') }}</SgButton>
        <SgButton variant="primary" @click="stay">{{ t('signup.leave.stay') }}</SgButton>
      </template>
    </SgDialog>
  </div>
</template>
