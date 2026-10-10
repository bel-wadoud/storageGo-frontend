<script setup lang="ts">
import { ApiError } from '~/services/api/client'
import { recoveryApi, type KitRecoveryStart } from '~/services/api/recovery'
import { CryptoError } from '~/services/crypto/types'

// Back in with the recovery kit (key-model-ux.md §4): the 24 words open the identity keys on
// this device, then the user chooses a new passphrase and is signed in. The kit keeps working.
// The words never leave this page's memory; a reload starts over, on purpose.
definePageMeta({ layout: 'auth' })
const { t } = useI18n()
const toast = useToast()
const online = useOnline()
const errorMessage = useErrorMessage()
const engine = useEngineStatus()
const signin = useSignin()

const step = ref<'kit' | 'passphrase'>('kit')
const email = ref(signin.draft.value.email)
const words = ref('')
const submitted = ref(false)
const phase = ref<'idle' | 'starting' | 'opening' | 'saving'>('idle')
const busy = computed(() => phase.value !== 'idle')
const failure = ref('')
const wordsError = ref('')
let started: KitRecoveryStart | null = null

/** "01 almond 02 basket…", pasted or typed, becomes the list of words. */
const list = computed(() => words.value.toLowerCase().match(/\p{L}+/gu) ?? [])
watch(words, () => (wordsError.value = ''))
watch(email, () => (wordsError.value = ''))

const errors = computed(() => ({
  email: submitted.value ? (!email.value.trim() ? t('signup.errors.email') : !isEmail(email.value) ? t('signup.errors.emailInvalid') : '') : '',
  words: wordsError.value || (submitted.value && list.value.length !== 24 ? t('recover.kit.errors.count', { n: list.value.length }) : ''),
}))
const blocked = computed(() => {
  if (!engine.supported.value) return t('signup.passphrase.unsupportedShort')
  if (!online.value) return t('auth.offlineReason')
  if (engine.state.value === 'failed') return t('signup.passphrase.engineFailedShort')
  return ''
})

// The kit file: the numbered lines ("01  almond") are the words; the rest is ignored.
const picker = ref<HTMLInputElement | null>(null)
async function openFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (file.size > 64_000) {
    toast.error(t('recover.kit.fileUnreadable', { name: file.name }))
    return
  }
  const text = await file.text()
  const found = [...text.matchAll(/^\s*\d{1,2}[.)]?\s+(\p{L}+)\s*$/gmu)].map((m) => m[1]!.toLowerCase())
  if (found.length !== 24) {
    toast.error(t('recover.kit.fileUnreadable', { name: file.name }))
    return
  }
  words.value = found.join(' ')
  toast.success(t('recover.kit.fileRead', { name: file.name }))
}

async function check() {
  submitted.value = true
  failure.value = ''
  if (errors.value.email || errors.value.words) {
    nextTick(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
    return
  }
  try {
    phase.value = 'starting'
    started = await recoveryApi.startKit(normalizeEmail(email.value))
    phase.value = 'opening'
    await (await useCrypto()).openRecoveryKit(list.value.join(' '), started.identity_by_recovery)
    words.value = ''
    step.value = 'passphrase'
  } catch (error) {
    if (error instanceof CryptoError && error.code === 'SG_ERR_FORMAT') wordsError.value = t('recover.kit.errors.format')
    else if (error instanceof CryptoError && error.code === 'SG_ERR_AUTH') wordsError.value = t('recover.kit.errors.wrongAccount', { email: isolate(normalizeEmail(email.value)) })
    else failure.value = errorMessage(error)
  } finally {
    phase.value = 'idle'
  }
}

const form = ref<{ clear: () => void } | null>(null)
async function finish(passphrase: string) {
  if (!started) return
  failure.value = ''
  try {
    phase.value = 'saving'
    const { change, proof } = await (await useCrypto()).finishRecovery(normalizeEmail(email.value), passphrase, started.challenge)
    const { account } = await recoveryApi.finishKit(started.recovery_id, proof, change)
    form.value?.clear()
    started = null
    useAccount().setAccount(account)
    signin.reset()
    toast.success(t('recover.done'))
    await navigateTo('/drive', { replace: true })
  } catch (error) {
    failure.value = error instanceof ApiError && error.code === 'NOT_FOUND' ? t('recover.kit.errors.expired') : errorMessage(error)
  } finally {
    phase.value = 'idle'
  }
}

function startOver() {
  started = null
  step.value = 'kit'
  submitted.value = false
}
</script>

<template>
  <AuthShell
    :title="step === 'kit' ? t('recover.kit.title') : t('recover.kit.passphraseTitle')"
    :lead="step === 'kit' ? t('recover.kit.lead') : t('recover.kit.passphraseLead')"
    :back="step === 'kit' ? '/recover' : undefined"
  >
    <AuthEngineAlert :supported="engine.supported.value" :state="engine.state.value" :error="engine.error.value" @retry="engine.retry" />

    <form v-if="step === 'kit'" class="form" novalidate @submit.prevent="check">
      <SgField :label="t('signup.fields.email')" :error="errors.email" required>
        <SgInput v-model="email" type="email" dir="ltr" autocomplete="username" inputmode="email" :placeholder="t('placeholders.email')" :disabled="busy" />
      </SgField>

      <SgField :label="t('recover.kit.words')" :hint="t('recover.kit.wordsHint')" :error="errors.words" required info="recoveryKit">
        <SgTextarea
          v-model="words"
          class="mono"
          dir="ltr"
          :rows="5"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          :placeholder="t('recover.kit.wordsPlaceholder')"
          :disabled="busy"
        />
      </SgField>
      <div class="kitr__row">
        <p class="form__note" aria-live="polite">{{ t('recover.kit.count', { n: list.length }) }}</p>
        <SgButton size="sm" variant="ghost" icon="file" :disabled="busy" :disabled-reason="t('common.pleaseWait')" @click="picker?.click()">{{ t('recover.kit.openFile') }}</SgButton>
        <input ref="picker" class="sr-only" type="file" accept=".txt,text/plain" tabindex="-1" aria-hidden="true" @change="openFile" />
      </div>

      <SgAlert v-if="failure" tone="danger">{{ failure }}</SgAlert>

      <div class="form__actions">
        <SgButton
          type="submit"
          variant="primary"
          size="lg"
          icon="key"
          :loading="busy"
          :loading-label="phase === 'opening' ? t('recover.kit.opening') : t('recover.kit.starting')"
          :disabled="Boolean(blocked)"
          :disabled-reason="blocked"
        >
          {{ t('recover.kit.submit') }}
        </SgButton>
      </div>
      <p class="form__note"><SgIcon name="lock" :size="14" /> {{ t('recover.kit.onDevice') }}</p>
    </form>

    <template v-else>
      <SgAlert tone="success">{{ t('recover.kit.opened') }}</SgAlert>
      <AuthNewPassphrase
        ref="form"
        :email="normalizeEmail(email)"
        :notice="t('recover.kit.notice')"
        :submit-label="t('recover.newPassphrase.submit')"
        :busy="busy"
        :busy-label="t('recover.newPassphrase.saving')"
        :disabled-reason="blocked"
        @submit="finish"
      >
        <SgAlert v-if="failure" tone="danger">
          {{ failure }}
          <template #actions><SgButton size="sm" @click="startOver">{{ t('recover.startOver') }}</SgButton></template>
        </SgAlert>
      </AuthNewPassphrase>
    </template>
  </AuthShell>
</template>

<style scoped>
.kitr__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-2);
  margin-top: calc(-1 * var(--s-2));
}

.kitr__row .form__note {
  margin: 0;
}
</style>
