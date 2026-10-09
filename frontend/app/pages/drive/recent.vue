<script setup lang="ts">
import { driveApi } from '~/services/api/drive'

// Files recently added or changed in this workspace, newest first.
definePageMeta({ layout: 'app', middleware: 'auth' })
const { t } = useI18n()
const drive = useDrive()
useHead({ title: () => `${t('app.nav.recent')} · storageGo` })

const key = computed(() => `recent:${drive.workspaceId.value}`)
const state = computed(() => drive.list(key.value))
const items = computed(() => state.value.ids.map((id) => drive.item(id)).filter((i): i is NonNullable<typeof i> => Boolean(i && !i.trashedAt)))
const load = (options: { force?: boolean } = {}) => drive.load(key.value, () => driveApi.recent(drive.workspaceId.value!), options)
watch(key, () => load(), { immediate: true })
</script>

<template>
  <div class="page">
    <DrivePageHeader :title="t('app.nav.recent')" />
    <DriveFileList
      :items="items"
      :loading="state.loading"
      :loaded="state.loaded"
      :error="state.error"
      :columns="['location', 'updated', 'size']"
      :label="t('app.nav.recent')"
      @retry="load({ force: true })"
    >
      <template #empty>
        <SgEmptyState :title="t('drive.empty.recentTitle')" :description="t('drive.empty.recent')" icon="clock" />
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
