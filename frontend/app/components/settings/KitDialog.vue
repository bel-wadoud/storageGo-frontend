<script setup lang="ts">
import { ApiError } from '~/services/api/client'
import { accountApi } from '~/services/api/account'

// A new recovery kit (key-model-ux.md §4): the consequence first (the old kit stops working),
// the passphrase as the deliberate act, then the same steps as at signup: save the 24 words,
// check two of them. The dialog can't be closed while the new kit is unsaved, since the old
// one no longer works by then.
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ done: [confirmedAt: string] }>()

const { t, locale } = useI18n()
const toast = useToast()
const errorMessage = useErrorMessage()
const authKeyFor = useReauth()
const downloadKit = useKitFile()
const { account } = useAccount()

type Step = 'confirm' | 'save' | 'check'
const step = ref<Step>('confirm')
const passphrase = ref('')
const passphraseError = ref('')
const busy = ref(false)
const failure = ref('')
// The words live only here, in memory, until the kit is checked.
const words = shallowRef<string[]>([])
const saved = reactive({ downloaded: false, printed: false })
const positions = ref<[number, number]>([1, 2])
const answers = reactive(['', ''])
const wrong = reactive([false, false])
const created = computed(() => formatDate(new Date(), locale.value))
const recoverUrl = computed(() => (import.meta.client ? `${window.location.host}/recover` : '/recover'))

watch(
  open,
  (value) => {
    if (!value) {
      words.value = []
      return
    }
    step.value = 'confirm'
    passphrase.value = passphraseError.value = failure.value = ''
    saved.downloaded = saved.printed = false
    answers[0] = answers[1] = ''
    wrong[0] = wrong[1] = false
  },
  { immediate: true },
)
watch(passphrase, (value) => value && (passphraseError.value = ''))

const lockedReason = computed(() => (step.value === 'confirm' ? undefined : t('settings.kit.finishFirst')))

async function regenerate() {
  failure.value = ''
  if (!passphrase.value) {
    passphraseError.value = t('signin.passphrase.errors.empty')
    return
  }
  busy.value = true
  try {
    const authKey = await authKeyFor(passphrase.value)
    const kit = await (await useCrypto()).regenerateKit()
    await accountApi.regenerateKit(authKey, kit.identity_by_recovery)
    passphrase.value = ''
    words.value = kit.recovery_phrase.split(' ')
    const picks = crypto.getRandomValues(new Uint32Array(2))
    const first = (picks[0]! % words.value.length) + 1
    let second = (picks[1]! % (words.value.length - 1)) + 1
    if (second >= first) second += 1
    positions.value = first < second ? [first, second] : [second, first]
    step.value = 'save'
  } catch (error) {
    if (error instanceof ApiError && error.code === 'INVALID_CREDENTIALS') passphraseError.value = t('settings.passphrase.errors.current')
    else failure.value = errorMessage(error)
  } finally {
    busy.value = false
  }
}

function download() {
  downloadKit({ words: words.value, email: account.value?.email ?? '', orgName: account.value?.org_name, created: created.value, recoverUrl: recoverUrl.value })
  saved.downloaded = true
  toast.success(t('signup.kit.downloaded'))
}

// Printing shows only the kit sheet (it's outside the app, see the Teleport below).
function print() {
  document.documentElement.classList.add('sg-print-kit')
  window.addEventListener(
    'afterprint',
    () => {
      document.documentElement.classList.remove('sg-print-kit')
      saved.printed = true
    },
    { once: true },
  )
  window.print()
}

async function check() {
  failure.value = ''
  positions.value.forEach((position, i) => (wrong[i] = answers[i]!.normalize('NFC').trim().toLowerCase() !== words.value[position - 1]))
  if (wrong.some(Boolean)) return
  busy.value = true
  try {
    const { kit_confirmed_at } = await accountApi.confirmKit()
    words.value = []
    toast.success(t('settings.kit.confirmed'))
    emit('done', kit_confirmed_at)
    step.value = 'confirm'
    open.value = false
  } catch (error) {
    failure.value = errorMessage(error)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <SgDialog
    v-model:open="open"
    class="no-print"
    :title="step === 'confirm' ? t('settings.kit.title') : step === 'save' ? t('signup.kit.title') : t('signup.verifyKit.title')"
    :busy="busy"
    :locked-reason="lockedReason"
    size="lg"
  >
    <!-- 1. Consequence + passphrase -->
    <form v-if="step === 'confirm'" id="settings-kit" class="form" novalidate @submit.prevent="regenerate">
      <SgAlert tone="warning" :title="t('settings.kit.consequenceTitle')">
        {{ account?.kind === 'org' ? t('settings.kit.consequenceOrg') : t('settings.kit.consequenceIndividual') }}
      </SgAlert>
      <input class="sr-only" type="email" autocomplete="username" :value="account?.email" tabindex="-1" aria-hidden="true" readonly />
      <SgField :label="t('settings.kit.passphrase')" :hint="t('settings.kit.passphraseHint')" :error="passphraseError" required>
        <SgPassphraseInput v-model="passphrase" autocomplete="current-password" :placeholder="t('placeholders.passphrase')" :disabled="busy" />
      </SgField>
      <div v-if="busy" aria-live="polite"><SgProgress :label="t('settings.kit.making')" /></div>
      <SgAlert v-if="failure" tone="danger">{{ failure }}</SgAlert>
    </form>

    <!-- 2. Save it -->
    <div v-else-if="step === 'save'" class="form">
      <p class="kitd__lead">{{ t('signup.kit.lead') }}</p>
      <SgWordGrid :words="words" />
      <div class="form__actions">
        <SgButton variant="primary" icon="download" @click="download">{{ t('signup.kit.download') }}</SgButton>
        <SgButton icon="printer" @click="print">{{ t('signup.kit.print') }}</SgButton>
      </div>
      <ul v-if="saved.downloaded || saved.printed" class="form__ok-list" role="status">
        <li v-if="saved.downloaded"><SgIcon name="check" :size="14" />{{ t('signup.kit.didDownload') }}</li>
        <li v-if="saved.printed"><SgIcon name="check" :size="14" />{{ t('signup.kit.didPrint') }}</li>
      </ul>
    </div>

    <!-- 3. Check it -->
    <form v-else id="settings-kit-check" class="form" novalidate @submit.prevent="check">
      <p class="kitd__lead">{{ t('signup.verifyKit.lead') }}</p>
      <div class="form__pair">
        <SgField
          v-for="(position, i) in positions"
          :key="position"
          :label="t('signup.verifyKit.word', { n: position })"
          :error="wrong[i] ? t('signup.verifyKit.errors.wrong', { n: position }) : ''"
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
            :disabled="busy"
            @input="wrong[i] = false"
          />
        </SgField>
      </div>
      <SgAlert v-if="failure" tone="danger">{{ failure }}</SgAlert>
    </form>

    <template #footer>
      <template v-if="step === 'confirm'">
        <SgButton :disabled="busy" :disabled-reason="t('common.pleaseWait')" @click="open = false">{{ t('common.cancel') }}</SgButton>
        <SgButton type="submit" form="settings-kit" variant="primary" icon="key" :loading="busy" :loading-label="t('settings.kit.making')">
          {{ t('settings.kit.submit') }}
        </SgButton>
      </template>
      <template v-else-if="step === 'save'">
        <SgButton
          variant="primary"
          icon-end="arrow-end"
          :disabled="!saved.downloaded && !saved.printed"
          :disabled-reason="t('signup.kit.saveFirst')"
          @click="step = 'check'"
        >
          {{ t('signup.kit.continue') }}
        </SgButton>
      </template>
      <template v-else>
        <SgButton icon="arrow-start" :disabled="busy" @click="step = 'save'">{{ t('signup.verifyKit.showAgain') }}</SgButton>
        <SgButton type="submit" form="settings-kit-check" variant="primary" :loading="busy" :loading-label="t('signup.verifyKit.checking')">
          {{ t('signup.verifyKit.submit') }}
        </SgButton>
      </template>
    </template>
  </SgDialog>

  <!-- The printed sheet: outside the app, so printing shows only the kit. -->
  <Teleport to="body">
    <div v-if="words.length" class="kitd-print">
      <SignupKitSheet :words="words" :email="account?.email ?? ''" :org-name="account?.org_name ?? undefined" :created="created" :recover-url="recoverUrl" />
    </div>
  </Teleport>
</template>

<style scoped>
.kitd__lead {
  margin: 0;
  color: var(--fg-2);
}
</style>
