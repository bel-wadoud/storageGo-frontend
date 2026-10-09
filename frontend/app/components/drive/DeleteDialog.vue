<script setup lang="ts">
// Delete forever (from Trash): the consequence in one sentence, no safety net, and a deliberate
// act: typing the number of items (principles.md §3, user-flows.md F12).
const props = defineProps<{ itemIds: string[]; emptyTrash?: boolean }>()
const open = defineModel<boolean>('open', { default: false })

const { t, locale } = useI18n()
const errorMessage = useErrorMessage()
const actions = useDriveActions()

const typed = ref('')
const busy = ref(false)
const failure = ref('')
const count = computed(() => props.itemIds.length)
const expected = computed(() => formatNumber(count.value, locale.value))
const matches = computed(() => typed.value.trim() === expected.value || typed.value.trim() === String(count.value))

watch(open, (value) => {
  if (value) {
    typed.value = ''
    failure.value = ''
  }
})

async function submit() {
  if (!matches.value) return
  busy.value = true
  failure.value = ''
  try {
    await actions.deleteForever(props.itemIds)
    open.value = false
  } catch (cause) {
    failure.value = errorMessage(cause)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <SgDialog
    v-model:open="open"
    :title="emptyTrash ? t('drive.delete.emptyTitle') : t('drive.delete.title', { n: count }, count)"
    size="sm"
    :busy="busy"
  >
    <form id="drive-delete-form" class="form" novalidate @submit.prevent="submit">
      <SgAlert tone="danger">{{ t('drive.delete.consequence', { n: count }, count) }}</SgAlert>
      <SgField :label="t('drive.delete.typeLabel', { n: expected })" :hint="t('drive.delete.typeHint')">
        <SgInput v-model="typed" inputmode="numeric" autocomplete="off" dir="ltr" :disabled="busy" />
      </SgField>
      <SgAlert v-if="failure" tone="danger">{{ failure }}</SgAlert>
    </form>
    <template #footer>
      <SgButton :disabled="busy" :disabled-reason="t('common.pleaseWait')" @click="open = false">{{ t('common.cancel') }}</SgButton>
      <SgButton
        type="submit"
        form="drive-delete-form"
        variant="danger"
        :loading="busy"
        :loading-label="t('drive.delete.deleting')"
        :disabled="!matches"
        :disabled-reason="t('drive.delete.typeFirst', { n: expected })"
      >
        {{ t('drive.delete.confirm', { n: count }, count) }}
      </SgButton>
    </template>
  </SgDialog>
</template>
