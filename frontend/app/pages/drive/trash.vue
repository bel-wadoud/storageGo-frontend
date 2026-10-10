<script setup lang="ts">
import { driveApi } from '~/services/api/drive'

// Trash: items stay 30 days (org policy can change it), then are destroyed with their keys.
definePageMeta({ layout: 'app', middleware: 'auth' })
const { t } = useI18n()
const online = useOnline()
const drive = useDrive()
const ui = useDriveUi()
useHead({ title: () => `${t('app.nav.trash')} · storageGo` })

const key = computed(() => `trash:${drive.workspaceId.value}`)
const state = computed(() => drive.list(key.value))
const items = computed(() =>
  state.value.ids
    .map((id) => drive.item(id))
    .filter((i): i is NonNullable<typeof i> => Boolean(i && i.trashedAt))
    .sort((a, b) => Date.parse(b.trashedAt!) - Date.parse(a.trashedAt!)),
)
const load = (options: { more?: boolean; force?: boolean } = {}) =>
  drive.load(key.value, (cursor) => driveApi.trash(drive.workspaceId.value!, cursor), options)
watch(key, () => load(), { immediate: true })

const own = computed(() => items.value.filter((i) => i.role !== 'viewer'))
</script>

<template>
  <div class="page">
    <DrivePageHeader :title="t('app.nav.trash')" :note="t('drive.trash.note')" info="trash">
      <template #actions>
        <SgButton
          variant="danger"
          icon="trash"
          :disabled="!own.length || !online"
          :disabled-reason="!online ? t('auth.offlineReason') : t('drive.trash.nothing')"
          @click="ui.open({ kind: 'delete-forever', itemIds: own.map((i) => i.id), emptyTrash: true })"
        >
          {{ t('drive.trash.empty') }}
        </SgButton>
      </template>
    </DrivePageHeader>
    <DriveFileList
      :items="items"
      :loading="state.loading"
      :loaded="state.loaded"
      :error="state.error"
      :has-more="Boolean(state.cursor)"
      :columns="['location', 'deleted', 'size']"
      :label="t('app.nav.trash')"
      @load-more="load({ more: true })"
      @retry="load({ force: true })"
    >
      <template #empty>
        <SgEmptyState :title="t('drive.empty.trashTitle')" :description="t('drive.empty.trash')" icon="trash" />
      </template>
    </DriveFileList>
  </div>
</template>

<style scoped>
.page {
  display: grid;
  gap: var(--s-4);
}
</style>
