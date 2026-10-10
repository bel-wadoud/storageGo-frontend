<script setup lang="ts">
import { driveApi } from '~/services/api/drive'

// Files and folders colleagues shared with me (their keys are sealed to my identity).
definePageMeta({ layout: 'app', middleware: 'auth' })
const { t } = useI18n()
const drive = useDrive()
useHead({ title: () => `${t('app.nav.shared')} · storageGo` })

const key = 'shared'
const state = computed(() => drive.list(key))
const items = computed(() => state.value.ids.map((id) => drive.item(id)).filter((i): i is NonNullable<typeof i> => Boolean(i && !i.trashedAt)))
const load = (options: { more?: boolean; force?: boolean } = {}) => drive.load(key, (cursor) => driveApi.sharedWithMe(cursor), options)
onMounted(() => load())
</script>

<template>
  <div class="page">
    <DrivePageHeader :title="t('app.nav.shared')" :note="t('drive.shared.note')" info="sharedWithMe" />
    <DriveFileList
      :items="items"
      :loading="state.loading"
      :loaded="state.loaded"
      :error="state.error"
      :has-more="Boolean(state.cursor)"
      :columns="['owner', 'updated', 'size']"
      :label="t('app.nav.shared')"
      @load-more="load({ more: true })"
      @retry="load({ force: true })"
    >
      <template #empty>
        <SgEmptyState :title="t('drive.empty.sharedTitle')" :description="t('drive.empty.shared')" icon="users" />
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
