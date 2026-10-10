<script setup lang="ts">
// Asks before a consequential admin action (principles.md §3): the consequence in one
// sentence, the safety net if there is one, and, for actions that can't be undone, a
// deliberate act: typing a word (`confirmWord`). The action runs here, with its progress and
// its error in place; the dialog closes only when it succeeded.
const props = defineProps<{
  title: string
  /** The consequence, in one sentence. */
  body: string
  /** The safety net that applies, or the fact that none does. */
  note?: string
  confirmLabel: string
  busyLabel: string
  danger?: boolean
  /** The user types this to confirm (an email, a name, a number). */
  confirmWord?: string
  run: () => Promise<unknown>
  /** Turns a failure into a sentence when the generic one isn't enough (e.g. "last administrator"). */
  explain?: (error: unknown) => string
}>()
const emit = defineEmits<{ done: [] }>()
const open = defineModel<boolean>('open', { required: true })

const { t } = useI18n()
const online = useOnline()
const errorMessage = useErrorMessage()
const typed = ref('')
const busy = ref(false)
const failure = ref('')

const matches = computed(() => !props.confirmWord || typed.value.trim().toLowerCase() === props.confirmWord.trim().toLowerCase())
watch(open, (value) => {
  if (value) {
    typed.value = ''
    failure.value = ''
  }
}, { immediate: true })

async function confirm() {
  if (!matches.value || busy.value) return
  busy.value = true
  failure.value = ''
  try {
    await props.run()
    emit('done')
    open.value = false
  } catch (error) {
    failure.value = props.explain?.(error) ?? errorMessage(error)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <SgDialog v-model:open="open" :title="title" size="sm" :busy="busy">
    <form class="cdlg" novalidate @submit.prevent="confirm">
      <p class="cdlg__body">{{ body }}</p>
      <SgAlert v-if="note" :tone="danger ? 'warning' : 'info'">{{ note }}</SgAlert>
      <slot />
      <SgField v-if="confirmWord" :label="t('admin.confirm.type', { word: confirmWord })">
        <SgInput v-model="typed" dir="auto" autocomplete="off" :placeholder="confirmWord" :disabled="busy" />
      </SgField>
      <SgAlert v-if="failure" tone="danger">{{ failure }}</SgAlert>
    </form>
    <template #footer>
      <SgButton :disabled="busy" :disabled-reason="t('common.pleaseWait')" @click="open = false">{{ t('common.cancel') }}</SgButton>
      <SgButton
        :variant="danger ? 'danger' : 'primary'"
        :loading="busy"
        :loading-label="busyLabel"
        :disabled="!matches || !online"
        :disabled-reason="!online ? t('auth.offlineReason') : t('admin.confirm.typeFirst', { word: confirmWord ?? '' })"
        @click="confirm"
      >
        {{ confirmLabel }}
      </SgButton>
    </template>
  </SgDialog>
</template>

<style scoped>
.cdlg {
  display: grid;
  gap: var(--s-4);
}

.cdlg__body {
  margin: 0;
  color: var(--fg-2);
}
</style>
