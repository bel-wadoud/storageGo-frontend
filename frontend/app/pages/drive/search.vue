<script setup lang="ts">
import { driveApi } from '~/services/api/drive'

// Search looks at file names only, decrypted on this device: the server has no names to
// search, and contents are encrypted (states.md, "Empty: search"). The workspace's names are
// opened once per session; typing then filters instantly.
definePageMeta({ layout: 'app', middleware: 'auth' })
const { t, locale } = useI18n()
const route = useRoute()
const drive = useDrive()
useHead({ title: () => `${t('app.nav.search')} · storageGo` })

const query = computed(() => (typeof route.query.q === 'string' ? route.query.q.trim() : ''))
const key = computed(() => `index:${drive.workspaceId.value}`)
const state = computed(() => drive.list(key.value))

/** Loads every page of the index (the list shows how many names are being opened). */
async function loadAll(force = false) {
  await drive.load(key.value, (cursor) => driveApi.index(drive.workspaceId.value!, cursor), { force })
  while (drive.list(key.value).cursor && !drive.list(key.value).error) {
    await drive.load(key.value, (cursor) => driveApi.index(drive.workspaceId.value!, cursor), { more: true })
  }
}
watch(key, () => loadAll(), { immediate: true })

const results = computed(() => {
  if (!query.value) return []
  const found = state.value.ids
    .map((id) => drive.item(id))
    .filter((i): i is NonNullable<typeof i> => Boolean(i && i.name && !i.trashedAt && matchesQuery(i.name, query.value)))
  // Names that start with the query first, then the most recently changed.
  const q = normalizeForSearch(query.value)
  return found.sort((a, b) => {
    const starts = Number(normalizeForSearch(b.name!).startsWith(q)) - Number(normalizeForSearch(a.name!).startsWith(q))
    return starts || Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
  })
})

// Phones have no search field in the top bar: the page has its own.
const local = ref(query.value)
watch(query, (q) => (local.value = q))
let typing: ReturnType<typeof setTimeout> | undefined
watch(local, (value) => {
  clearTimeout(typing)
  typing = setTimeout(() => navigateTo({ path: '/drive/search', query: value.trim() ? { q: value.trim() } : {} }, { replace: true }), 250)
})
</script>

<template>
  <div class="page">
    <DrivePageHeader :title="query ? t('drive.search.titleFor', { q: query }) : t('app.nav.search')" :note="t('drive.search.note')" />

    <form class="page__search" role="search" @submit.prevent>
      <label class="sr-only" for="page-search">{{ t('app.search.label') }}</label>
      <SgInput id="page-search" v-model="local" type="search" :placeholder="t('app.search.placeholder')" autocomplete="off" enterkeyhint="search">
        <template #prefix><SgIcon name="search" :size="16" /></template>
      </SgInput>
    </form>

    <p v-if="state.loading" class="page__progress" role="status">
      <SgSpinner decorative size="sm" />
      {{ t('drive.search.decrypting', { n: formatNumber(state.ids.length, locale) }) }}
    </p>

    <SgEmptyState v-if="!query && state.loaded" :title="t('drive.search.promptTitle')" :description="t('drive.search.prompt', { n: formatNumber(state.ids.length, locale) })" icon="search" />

    <DriveFileList
      v-else-if="query"
      :items="results"
      :loading="state.loading"
      :loaded="state.loaded"
      :error="state.error"
      :columns="['location', 'updated', 'size']"
      :label="t('drive.search.titleFor', { q: query })"
      @retry="loadAll(true)"
    >
      <template #empty>
        <SgEmptyState :title="t('drive.search.noneTitle', { q: query })" :description="t('drive.search.none')" icon="search" />
      </template>
    </DriveFileList>
  </div>
</template>

<style scoped>
.page {
  display: grid;
  gap: var(--s-4);
}

.page__search {
  display: none;
}

.page__progress {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--fg-2);
}

@media (max-width: 899px) {
  .page__search {
    display: block;
  }
}
</style>
