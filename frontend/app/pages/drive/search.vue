<script setup lang="ts">
import type { DriveItem } from '~/composables/useDrive'

// Search looks at file names only, decrypted on this device: the server has no names to
// search, and contents are encrypted (states.md, "Empty: search"). The workspace's names are
// fetched and opened once (see useDrive.loadIndex); each keystroke only filters them here.
definePageMeta({ layout: 'app', middleware: 'auth' })
const { t, locale } = useI18n()
const drive = useDrive()
const ui = useDriveUi()

// What's typed in the top bar, so results follow every keystroke (deleting included). The top
// bar fills it from the address bar when the page is opened from a link.
const query = computed(() => ui.searchQuery.value.trim())
useHead({ title: () => `${query.value || t('app.nav.search')} · storageGo` })

// Nothing to search for: the files are where the user belongs.
watch(
  query,
  (q) => {
    if (!q) navigateTo('/drive', { replace: true })
  },
  { immediate: true },
)

const state = computed(() => drive.list(drive.indexKey()))
watch(() => drive.workspaceId.value, () => drive.loadIndex(), { immediate: true })

/** Names normalized once per change of the index, not once per keystroke. */
const entries = computed(() =>
  state.value.ids
    .map((id) => drive.item(id))
    .filter((item): item is DriveItem => Boolean(item && item.name && !item.trashedAt))
    .map((item) => ({ item, text: normalizeForSearch(item.name!) })),
)

const results = computed(() => {
  const words = normalizeForSearch(query.value).split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const first = words.join(' ')
  return entries.value
    .filter((entry) => words.every((word) => entry.text.includes(word)))
    // Names that start with what was typed first, then the most recently changed.
    .sort((a, b) => Number(b.text.startsWith(first)) - Number(a.text.startsWith(first)) || Date.parse(b.item.updatedAt) - Date.parse(a.item.updatedAt))
    .map((entry) => entry.item)
})

// Results show as soon as the first page of names is open, while the rest keeps coming.
const shown = computed(() => state.value.loaded || state.value.ids.length > 0)
</script>

<template>
  <div v-if="query" class="page">
    <DrivePageHeader :title="t('drive.search.titleFor', { q: query })" :note="t('drive.search.note')" />

    <p v-if="state.loading" class="page__progress" role="status">
      <SgSpinner decorative size="sm" />
      {{ t('drive.search.decrypting', { n: formatNumber(state.ids.length, locale) }) }}
    </p>

    <DriveFileList
      :items="results"
      :loading="state.loading"
      :loaded="shown"
      :error="state.error"
      :columns="['location', 'updated', 'size']"
      :label="t('drive.search.titleFor', { q: query })"
      @retry="drive.loadIndex()"
    >
      <template #empty>
        <SgEmptyState
          v-if="!state.loading"
          :title="t('drive.search.noneTitle', { q: query })"
          :description="t('drive.search.none')"
          icon="search"
        />
      </template>
    </DriveFileList>
  </div>
</template>

<style scoped>
.page {
  display: grid;
  gap: var(--s-4);
}

.page__progress {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--fg-2);
}
</style>
