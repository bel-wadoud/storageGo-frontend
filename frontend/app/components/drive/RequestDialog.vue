<script setup lang="ts">
import { driveApi, type FileRequestInfo } from '~/services/api/drive'

// A file request: a link that lets someone without an account upload into one of my folders.
// Their files are encrypted in their browser for this folder's key, and they can't see
// anything already in it (01-crypto-design.md §4).
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ created: [request: FileRequestInfo] }>()

const { t, locale } = useI18n()
const errorMessage = useErrorMessage()
const online = useOnline()
const drive = useDrive()
const ui = useDriveUi()

const title = ref('')
const folderId = ref('')
const expiry = ref('30')
const touched = ref(false)
const busy = ref(false)
const failure = ref('')
const created = ref<{ url: string; base: string; fragment: string } | null>(null)

const rootId = computed(() => drive.workspace.value?.root.id ?? null)
watch(rootId, (id) => id && drive.loadFolder(id), { immediate: true })

const folders = computed(() => {
  if (!rootId.value) return []
  const root = { value: rootId.value, label: drive.workspace.value?.name ?? '' }
  const children = drive
    .folderItems(rootId.value, locale.value)
    .filter((i) => i.kind === 'folder' && i.role !== 'viewer' && i.name)
    .map((i) => ({ value: i.id, label: `${root.label} / ${i.name}` }))
  return [root, ...children]
})

// Runs at once: the dialog is mounted already open.
watch(
  open,
  (value) => {
    if (!value) return
    title.value = ''
    folderId.value = ui.currentFolderId.value ?? rootId.value ?? ''
    expiry.value = '30'
    touched.value = false
    failure.value = ''
    created.value = null
  },
  { immediate: true },
)
// The workspace root may arrive after the dialog opened.
watch(rootId, (id) => {
  if (!folderId.value && id) folderId.value = id
})

const titleError = computed(() => (touched.value && !title.value.trim() ? t('drive.request.errors.title') : ''))
const folderError = computed(() => (touched.value && !folderId.value ? t('drive.request.errors.folder') : ''))
const expiries = computed(() => [
  { value: '7', label: t('drive.link.days', { n: 7 }, 7) },
  { value: '30', label: t('drive.link.days', { n: 30 }, 30) },
  { value: 'never', label: t('drive.link.never') },
])

async function submit() {
  touched.value = true
  if (titleError.value || folderError.value) return
  busy.value = true
  failure.value = ''
  try {
    const engine = await useCrypto()
    const record = await engine.createFileRequest(folderId.value)
    const request = await driveApi.createRequest(record, {
      title: title.value.trim(),
      expires_at: expiry.value === 'never' ? null : new Date(Date.now() + Number(expiry.value) * 86_400_000).toISOString(),
    })
    await drive.absorb([request.folder])
    const base = `${window.location.origin}/r/${encodeURIComponent(request.id)}`
    const fragment = `k=${record.public_key}`
    created.value = { url: `${base}#${fragment}`, base, fragment }
    emit('created', request)
  } catch (error) {
    failure.value = errorMessage(error)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <SgDialog v-model:open="open" :title="t('drive.request.title')" :description="created ? undefined : t('drive.request.lead')" :busy="busy">
    <div v-if="created" class="form" role="status">
      <p class="req__done"><SgIcon name="check-circle" :size="16" />{{ t('drive.request.created') }}</p>
      <p class="req__url" dir="ltr" translate="no"><span>{{ created.base }}</span><mark>#{{ created.fragment }}</mark></p>
      <div class="form__actions">
        <SgCopyButton :value="created.url" variant="primary" :label="t('drive.link.copy')" />
      </div>
      <p class="form__note">{{ t('drive.request.onceNote') }}</p>
    </div>
    <form v-else id="drive-request-form" class="form" novalidate @submit.prevent="submit">
      <SgField :label="t('drive.request.name')" :hint="t('drive.request.nameHint')" :error="titleError" required>
        <SgInput v-model="title" autocomplete="off" :placeholder="t('placeholders.requestTitle')" :disabled="busy" @blur="touched = true" />
      </SgField>
      <SgField :label="t('drive.request.folder')" :error="folderError">
        <SgSelect v-model="folderId" :options="folders" :disabled="busy" />
      </SgField>
      <SgField :label="t('drive.request.expiry')">
        <SgSelect v-model="expiry" :options="expiries" :disabled="busy" />
      </SgField>
      <SgAlert v-if="failure" tone="danger">{{ failure }}</SgAlert>
    </form>
    <template #footer>
      <SgButton v-if="created" variant="primary" @click="open = false">{{ t('drive.request.done') }}</SgButton>
      <template v-else>
        <SgButton :disabled="busy" :disabled-reason="t('common.pleaseWait')" @click="open = false">{{ t('common.cancel') }}</SgButton>
        <SgButton
          type="submit"
          form="drive-request-form"
          variant="primary"
          icon="inbox"
          :loading="busy"
          :loading-label="t('drive.request.creating')"
          :disabled="!online"
          :disabled-reason="t('auth.offlineReason')"
        >
          {{ t('drive.request.create') }}
        </SgButton>
      </template>
    </template>
  </SgDialog>
</template>

<style scoped>
.req__done {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  margin: 0;
  color: var(--success);
  font-weight: var(--fw-medium);
}

.req__url {
  margin: 0;
  padding: var(--s-2) var(--s-3);
  overflow-wrap: anywhere;
  border: 1px solid var(--rule-input);
  border-radius: var(--radius-1);
  background: var(--surface-2);
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
  user-select: all;
}

.req__url mark {
  background: var(--signal-soft);
  color: var(--signal-text);
}
</style>
