<script setup lang="ts">
// New folder / Rename. The name is checked as it's typed (empty, "/" or "\", too long, already
// used in this folder). On rename, only the part before the extension is selected.
const props = defineProps<{ mode: 'new-folder' | 'rename'; parentId: string | null; itemId: string | null }>()
const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const toast = useToast()
const errorMessage = useErrorMessage()
const drive = useDrive()
const actions = useDriveActions()

const name = ref('')
const touched = ref(false)
const busy = ref(false)
const failure = ref('')
const input = ref<{ el: HTMLInputElement | null } | null>(null)

const item = computed(() => (props.itemId ? drive.item(props.itemId) : null))
const parent = computed(() => props.parentId ?? item.value?.parentId ?? null)

watch(
  open,
  async (value) => {
    if (!value) return
    name.value = props.mode === 'rename' ? (item.value?.name ?? '') : ''
    touched.value = false
    failure.value = ''
    await nextTick()
    const el = input.value?.el
    if (!el) return
    el.focus()
    // "Bilan 2025.pdf": select "Bilan 2025" so typing keeps the extension.
    const dot = name.value.lastIndexOf('.')
    el.setSelectionRange(0, props.mode === 'rename' && item.value?.kind === 'file' && dot > 0 ? dot : name.value.length)
  },
  { immediate: true },
)

const siblings = computed(() =>
  Object.values(drive.records.value)
    .filter((r) => r.parent_id === parent.value && !r.trashed_at && r.id !== props.itemId)
    .map((r) => drive.item(r.id)?.name?.toLowerCase())
    .filter(Boolean) as string[],
)

const error = computed(() => {
  const value = name.value.trim()
  if (!touched.value && !value) return ''
  if (!value) return t('drive.name.errors.empty')
  if (/[/\\]/.test(value)) return t('drive.name.errors.slash')
  if (value === '.' || value === '..') return t('drive.name.errors.dots')
  if ([...value].length > 255) return t('drive.name.errors.long')
  if (siblings.value.includes(value.toLowerCase())) return t('drive.name.errors.taken', { name: value })
  return ''
})

async function submit() {
  touched.value = true
  failure.value = ''
  if (error.value) return
  const value = name.value.trim().normalize('NFC')
  if (props.mode === 'rename' && value === item.value?.name) {
    open.value = false
    return
  }
  busy.value = true
  try {
    if (props.mode === 'new-folder') {
      await actions.createFolder(parent.value!, value)
      toast.success(t('drive.toast.folderCreated', { name: value }))
    } else {
      await actions.rename(props.itemId!, value)
      toast.success(t('drive.toast.renamed', { name: value }))
    }
    open.value = false
  } catch (cause) {
    failure.value = errorMessage(cause)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <SgDialog v-model:open="open" :title="mode === 'new-folder' ? t('drive.name.newTitle') : t('drive.name.renameTitle')" size="sm" :busy="busy">
    <form id="drive-name-form" class="form" novalidate @submit.prevent="submit">
      <SgField :label="mode === 'new-folder' ? t('drive.name.folderLabel') : t('drive.name.label')" :error="error">
        <SgInput ref="input" v-model="name" autocomplete="off" spellcheck="false" :disabled="busy" @blur="touched = true" @input="touched = true" />
      </SgField>
      <SgAlert v-if="failure" tone="danger">{{ failure }}</SgAlert>
    </form>
    <template #footer>
      <SgButton :disabled="busy" :disabled-reason="t('common.pleaseWait')" @click="open = false">{{ t('common.cancel') }}</SgButton>
      <SgButton
        type="submit"
        form="drive-name-form"
        variant="primary"
        :loading="busy"
        :loading-label="mode === 'new-folder' ? t('drive.name.creating') : t('drive.name.renaming')"
      >
        {{ mode === 'new-folder' ? t('drive.name.create') : t('drive.name.rename') }}
      </SgButton>
    </template>
  </SgDialog>
</template>
