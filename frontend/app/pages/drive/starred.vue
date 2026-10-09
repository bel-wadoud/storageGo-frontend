<script setup lang="ts">
import { driveApi } from '~/services/api/drive'

// Items I starred, to find them quickly. Unstarring removes them from here at once.
definePageMeta({ layout: 'app', middleware: 'auth' })
const { t, locale } = useI18n()
const drive = useDrive()
useHead({ title: () => `${t('app.nav.starred')} · storageGo` })

const key = computed(() => `starred:${drive.workspaceId.value}`)
const state = computed(() => drive.list(key.value))
const items = computed(() =>
  drive.sorted(
    state.value.ids.map((id) => drive.item(id)).filter((i): i is NonNullable<typeof i> => Boolean(i && i.starred && !i.trashedAt)),
    locale.value,
  ),
)
const load = (options: { force?: boolean } = {}) => drive.load(key.value, () => driveApi.starred(drive.workspaceId.value!), options)
watch(key, () => load(), { immediate: true })
</script>

<template>
  <div class="page">
    <DrivePageHeader :title="t('app.nav.starred')" />
    <DriveFileList
      :items="items"
      :loading="state.loading"
      :loaded="state.loaded"
      :error="state.error"
      :columns="['location', 'updated', 'size']"
      :label="t('app.nav.starred')"
      @retry="load({ force: true })"
    >
      <template #empty>
        <SgEmptyState :title="t('drive.empty.starredTitle')" :description="t('drive.empty.starred')" icon="star" />
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
