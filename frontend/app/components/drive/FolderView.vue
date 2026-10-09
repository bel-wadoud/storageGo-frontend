<script setup lang="ts">
import { ApiError } from '~/services/api/client'

// One folder: breadcrumbs, the "New" menu, the file list, dropping files to upload, and the
// empty states of states.md (new organization, empty folder, view-only folder).
const props = defineProps<{ folderId: string }>()

const { t, locale } = useI18n()
const drive = useDrive()
const ui = useDriveUi()
const upload = useUploadTarget()

const state = computed(() => drive.list(`folder:${props.folderId}`))
const items = computed(() => drive.folderItems(props.folderId, locale.value))
const workspace = computed(() => drive.workspaces.value.find((w) => w.root.id === props.folderId) ?? null)
const folder = computed(() => drive.item(props.folderId))
const name = computed(() => workspace.value?.name ?? folder.value?.name ?? '')
const isRoot = computed(() => Boolean(workspace.value))
const canAdd = computed(() => (folder.value ? folder.value.role !== 'viewer' : isRoot.value))
const missing = computed(() => state.value.error instanceof ApiError && ['NOT_FOUND', 'FORBIDDEN'].includes(state.value.error.code))

const crumbs = computed(() =>
  drive.ancestry(props.folderId).map((id) => {
    const root = drive.workspaces.value.find((w) => w.root.id === id)
    return {
      id,
      name: root?.name ?? drive.item(id)?.name ?? t('drive.item.unnamed'),
      to: root ? '/drive' : `/drive/f/${encodeURIComponent(id)}`,
    }
  }),
)

function load(force = false) {
  drive.loadFolder(props.folderId, { force })
}

watch(() => props.folderId, () => load(), { immediate: true })

// This folder is where Upload / New folder go while it's on screen.
watchEffect(() => {
  ui.currentFolderId.value = props.folderId
  ui.canAddHere.value = canAdd.value
})
onBeforeUnmount(() => {
  // The next folder's view may already have set itself (it mounts before this one unmounts).
  if (ui.currentFolderId.value !== props.folderId) return
  ui.currentFolderId.value = null
  ui.canAddHere.value = false
})

useHead({ title: () => `${name.value || t('app.nav.files')} · storageGo` })

const newItems = computed(() => [
  { key: 'folder', label: t('drive.new.folder'), icon: 'folder-plus' as const },
  { key: 'files', label: t('drive.new.files'), icon: 'upload' as const, disabled: Boolean(upload.blocked.value), reason: upload.blocked.value, divider: true },
  { key: 'tree', label: t('drive.new.tree'), icon: 'folder' as const, disabled: Boolean(upload.blocked.value), reason: upload.blocked.value },
])

function onNew(key: string) {
  if (key === 'folder') ui.open({ kind: 'new-folder', parentId: props.folderId })
  if (key === 'files') upload.pickFiles()
  if (key === 'tree') upload.pickFolder()
}

const isNewOrg = computed(() => isRoot.value && workspace.value?.kind === 'org' && workspace.value.admin)
const where = computed(() => {
  const names = (drive.quota.value?.wilayas ?? []).map((code) => t('storage.wilaya', { name: t(`wilayas.${code}`), code }))
  return names.length ? new Intl.ListFormat(intlLocale(locale.value), { type: 'conjunction' }).format(names) : ''
})
</script>

<template>
  <div class="folder">
    <SgAlert v-if="missing" tone="warning" :title="t('drive.folder.missingTitle')">
      {{ t('drive.folder.missing') }}
      <template #actions>
        <SgButton size="sm" to="/drive" icon="arrow-start">{{ t('drive.folder.backToFiles') }}</SgButton>
      </template>
    </SgAlert>

    <template v-else>
      <DrivePageHeader>
        <template #title>
          <DriveBreadcrumbs :crumbs="crumbs" />
        </template>
        <template v-if="!canAdd && folder" #note>
          <SgIcon name="eye" :size="14" />
          {{ t('drive.folder.viewOnly', { owner: folder.owner.name }) }}
        </template>
        <template #actions>
          <SgActionMenu
            v-if="canAdd"
            :label="t('drive.new.label')"
            :text="t('drive.new.label')"
            icon="plus"
            variant="secondary"
            size="md"
            :items="newItems"
            @select="onNew"
          />
          <SgButton
            variant="ghost"
            icon="info"
            icon-only
            :label="ui.detailsOpen.value ? t('drive.details.close') : t('drive.details.open')"
            :pressed="ui.detailsOpen.value"
            @click="ui.toggleDetails()"
          />
        </template>
      </DrivePageHeader>

      <DriveQuotaBanner />

      <DriveDropZone :folder-id="canAdd ? folderId : null" :folder-name="name" :disabled="!canAdd || Boolean(upload.blocked.value)" :reason="!canAdd ? t('drive.upload.viewOnly') : upload.blocked.value">
        <DriveFileList
          :items="items"
          :loading="state.loading"
          :loaded="state.loaded"
          :error="state.error"
          :has-more="Boolean(state.cursor)"
          :columns="['updated', 'size']"
          sortable
          :label="name"
          @load-more="drive.loadFolder(folderId, { more: true })"
          @retry="load(true)"
        >
          <template #empty>
            <!-- A new organization: three starter actions and where files are kept. -->
            <SgEmptyState v-if="isNewOrg" :title="t('drive.empty.orgTitle')" :description="where ? t('drive.empty.orgWhere', { where }) : undefined" icon="building">
              <SgButton variant="primary" icon="upload" :disabled="Boolean(upload.blocked.value)" :disabled-reason="upload.blocked.value" @click="upload.pickFiles()">
                {{ t('drive.new.files') }}
              </SgButton>
              <SgButton icon="folder-plus" @click="ui.open({ kind: 'new-folder', parentId: folderId })">{{ t('drive.new.folder') }}</SgButton>
              <SgButton icon="user-plus" to="/admin/members">{{ t('drive.empty.invite') }}</SgButton>
            </SgEmptyState>
            <SgEmptyState v-else-if="canAdd" :title="t('drive.empty.folderTitle')" :description="t('drive.empty.folderHint')" icon="folder">
              <SgButton variant="primary" icon="upload" :disabled="Boolean(upload.blocked.value)" :disabled-reason="upload.blocked.value" @click="upload.pickFiles()">
                {{ t('drive.upload.button') }}
              </SgButton>
            </SgEmptyState>
            <SgEmptyState v-else :title="t('drive.empty.folderTitle')" :description="t('drive.empty.viewOnly', { owner: folder?.owner.name ?? '' })" icon="eye" />
          </template>
        </DriveFileList>
      </DriveDropZone>
    </template>
  </div>
</template>

<style scoped>
.folder {
  display: grid;
  gap: var(--s-4);
}
</style>
