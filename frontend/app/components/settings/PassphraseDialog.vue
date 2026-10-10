<script setup lang="ts">
import { ApiError } from '~/services/api/client'
import { accountApi } from '~/services/api/account'

// Change passphrase: prove the current one, choose a new one. The new keys are made on this
// device; other devices are signed out and use the new passphrase from now on.
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ changed: [] }>()

const { t } = useI18n()
const toast = useToast()
const errorMessage = useErrorMessage()
const authKeyFor = useReauth()
const { account } = useAccount()

const current = ref('')
const next = ref('')
const confirmation = ref('')
const submitted = ref(false)
const phase = ref<'idle' | 'checking' | 'creating' | 'saving'>('idle')
const currentError = ref('')
const failure = ref('')

watch(
  open,
  (value) => {
    if (!value) return
    current.value = next.value = confirmation.value = ''
    submitted.value = false
    currentError.value = failure.value = ''
  },
  { immediate: true },
)
watch(current, (value) => value && (currentError.value = ''))

const busy = computed(() => phase.value !== 'idle')
const phaseLabel = computed(
  () => ({ idle: '', checking: t('settings.passphrase.checking'), creating: t('signup.passphrase.creating'), saving: t('settings.passphrase.saving') })[phase.value],
)
const errors = computed(() => ({
  current: currentError.value || (submitted.value && !current.value ? t('signin.passphrase.errors.empty') : ''),
  next:
    submitted.value && !passphraseAcceptable(next.value)
      ? next.value
        ? t('signup.passphrase.errors.weak')
        : t('signup.passphrase.errors.empty')
      : submitted.value && next.value === current.value
        ? t('settings.passphrase.errors.same')
        : '',
  confirmation: submitted.value && confirmation.value !== next.value ? t('signup.passphrase.errors.mismatch') : '',
}))

async function submit() {
  submitted.value = true
  failure.value = ''
  if (Object.values(errors.value).some(Boolean)) return
  try {
    phase.value = 'checking'
    const authKey = await authKeyFor(current.value)
    phase.value = 'creating'
    const change = await (await useCrypto()).changePassphrase(next.value)
    phase.value = 'saving'
    await accountApi.changePassphrase(authKey, change)
    current.value = next.value = confirmation.value = ''
    toast.success(t('settings.passphrase.changed'))
    emit('changed')
    open.value = false
  } catch (error) {
    if (error instanceof ApiError && error.code === 'INVALID_CREDENTIALS') currentError.value = t('settings.passphrase.errors.current')
    else failure.value = errorMessage(error)
  } finally {
    phase.value = 'idle'
  }
}
</script>

<template>
  <SgDialog v-model:open="open" :title="t('settings.passphrase.title')" :description="t('settings.passphrase.lead')" :busy="busy">
    <form id="settings-passphrase" class="form" novalidate @submit.prevent="submit">
      <input class="sr-only" type="email" autocomplete="username" :value="account?.email" tabindex="-1" aria-hidden="true" readonly />
      <SgField :label="t('settings.passphrase.current')" :error="errors.current" required>
        <SgPassphraseInput v-model="current" autocomplete="current-password" :placeholder="t('placeholders.passphrase')" :disabled="busy" />
      </SgField>
      <SgField :label="t('settings.passphrase.new')" :hint="t('signup.passphrase.hint')" :error="errors.next" required>
        <SgPassphraseInput v-model="next" autocomplete="new-password" :placeholder="t('placeholders.newPassphrase')" :disabled="busy" />
      </SgField>
      <SgField :label="t('signup.passphrase.confirm')" :error="errors.confirmation" required>
        <SgPassphraseInput v-model="confirmation" autocomplete="new-password" :meter="false" :placeholder="t('placeholders.confirmPassphrase')" :disabled="busy" />
      </SgField>
      <div class="notice">
        <p class="notice__title">{{ t('signup.passphrase.noticeTitle') }}</p>
        <p>{{ t('settings.passphrase.notice') }}</p>
      </div>
      <div v-if="busy" aria-live="polite"><SgProgress :label="phaseLabel" /></div>
      <SgAlert v-if="failure" tone="danger">{{ failure }}</SgAlert>
    </form>
    <template #footer>
      <SgButton :disabled="busy" :disabled-reason="t('common.pleaseWait')" @click="open = false">{{ t('common.cancel') }}</SgButton>
      <SgButton type="submit" form="settings-passphrase" variant="primary" icon="key" :loading="busy" :loading-label="phaseLabel">
        {{ t('settings.passphrase.submit') }}
      </SgButton>
    </template>
  </SgDialog>
</template>
