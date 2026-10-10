<script setup lang="ts">
// Choosing a passphrase outside signup: after a recovery, and when joining from an invitation.
// Same rules as signup: strength meter, typed twice, and the "storageGo can't reset it" notice
// acknowledged with a deliberate tick (principles.md §3). The passphrase leaves this
// component only through `submit`; the parent clears it with `clear()` once used.
defineProps<{
  email: string
  notice: string
  submitLabel: string
  busy: boolean
  busyLabel: string
  disabledReason?: string
}>()
const emit = defineEmits<{ submit: [passphrase: string] }>()

const { t } = useI18n()
const passphrase = ref('')
const confirmation = ref('')
const understood = ref(false)
const submitted = ref(false)
const touchedConfirm = ref(false)

const errors = computed(() => ({
  passphrase:
    submitted.value && !passphraseAcceptable(passphrase.value)
      ? passphrase.value
        ? t('signup.passphrase.errors.weak')
        : t('signup.passphrase.errors.empty')
      : '',
  confirmation: (submitted.value || touchedConfirm.value) && confirmation.value !== passphrase.value ? t('signup.passphrase.errors.mismatch') : '',
  understood: submitted.value && !understood.value ? t('signup.passphrase.errors.understood') : '',
}))
const matches = computed(() => Boolean(confirmation.value) && confirmation.value === passphrase.value)

function submit() {
  submitted.value = true
  if (Object.values(errors.value).some(Boolean)) {
    nextTick(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
    return
  }
  emit('submit', passphrase.value)
}

defineExpose({
  clear() {
    passphrase.value = ''
    confirmation.value = ''
  },
})
</script>

<template>
  <form class="form" novalidate @submit.prevent="submit">
    <!-- Lets password managers store the passphrase under the right account. -->
    <input class="sr-only" type="email" autocomplete="username" :value="email" tabindex="-1" aria-hidden="true" readonly />

    <SgField :label="t('auth.newPassphrase.label')" :hint="t('signup.passphrase.hint')" :error="errors.passphrase" required>
      <SgPassphraseInput v-model="passphrase" autocomplete="new-password" size="lg" :placeholder="t('placeholders.newPassphrase')" :disabled="busy" />
    </SgField>

    <SgField :label="t('signup.passphrase.confirm')" :error="errors.confirmation" required>
      <SgPassphraseInput
        v-model="confirmation"
        autocomplete="new-password"
        :meter="false"
        :placeholder="t('placeholders.confirmPassphrase')"
        :disabled="busy"
        @blur="touchedConfirm = true"
      />
    </SgField>
    <p v-if="matches" class="form__ok" role="status"><SgIcon name="check" :size="14" />{{ t('signup.passphrase.matches') }}</p>

    <div class="notice">
      <p class="notice__title">{{ t('signup.passphrase.noticeTitle') }}</p>
      <p>{{ notice }}</p>
      <SgCheckbox v-model="understood" :invalid="Boolean(errors.understood)" :disabled="busy">
        {{ t('signup.passphrase.understood') }}
      </SgCheckbox>
      <p v-if="errors.understood" class="form__error" role="alert"><SgIcon name="alert" :size="14" />{{ errors.understood }}</p>
    </div>

    <slot />

    <div class="form__actions">
      <SgButton type="submit" variant="primary" size="lg" :loading="busy" :loading-label="busyLabel" :disabled="Boolean(disabledReason)" :disabled-reason="disabledReason">
        {{ submitLabel }}
      </SgButton>
    </div>
    <div v-if="busy" aria-live="polite"><SgProgress :label="busyLabel" /></div>
  </form>
</template>
