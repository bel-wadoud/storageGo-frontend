<script setup lang="ts">
import type { DriveItem, SortKey } from '~/composables/useDrive'

// The file list: 46px rows, at least 11 visible at 1366×768 (principles.md §5). Each row reads
// as name, type, size, modified date and shared status. Keyboard: ↑↓ move, Shift extends the
// selection, Space selects, Enter opens, Ctrl/⌘+A selects all. Mouse: click selects (Ctrl/⌘
// adds, Shift extends), double-click opens; on touch screens a tap opens.
export type Column = 'location' | 'owner' | 'updated' | 'deleted' | 'size'

const props = withDefaults(
  defineProps<{
    items: DriveItem[]
    loading: boolean
    loaded: boolean
    error: unknown
    hasMore?: boolean
    columns: Column[]
    /** Column headers sort the list (folder views). */
    sortable?: boolean
    /** Accessible name of the table, e.g. the folder name. */
    label: string
  }>(),
  { hasMore: false, sortable: false },
)

const emit = defineEmits<{ loadMore: []; retry: [] }>()

const { t, locale } = useI18n()
const errorMessage = useErrorMessage()
const drive = useDrive()
const selection = useSelection()
const menu = useItemMenu()

// Row elements by id, for moving keyboard focus (not reactive: written while rendering).
const rows: Record<string, HTMLElement> = {}
const ids = computed(() => props.items.map((item) => item.id))
watch(ids, (value) => selection.setVisible(value), { immediate: true })

const selectedItems = computed(() => props.items.filter((item) => selection.selected.value.includes(item.id)))
const allSelected = computed(() => props.items.length > 0 && selectedItems.value.length === props.items.length)

// Text appears when loading takes more than a second (principles.md §7).
const slow = ref(false)
let slowTimer: ReturnType<typeof setTimeout> | undefined
watch(
  () => props.loading,
  (loading) => {
    clearTimeout(slowTimer)
    slow.value = false
    if (loading) slowTimer = setTimeout(() => (slow.value = true), 1000)
  },
  { immediate: true },
)

// ---- Keyboard and pointer ----
let lastPointer = 'mouse'

function focusRow(id: string) {
  selection.focused.value = id
  nextTick(() => rows[id]?.focus())
}

function onRowKey(event: KeyboardEvent, item: DriveItem, index: number) {
  if ((event.target as HTMLElement) !== event.currentTarget) return
  const go = (to: number) => {
    const next = props.items[Math.max(0, Math.min(to, props.items.length - 1))]
    if (!next) return
    if (event.shiftKey) selection.select(next.id, 'range')
    focusRow(next.id)
  }
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      return go(index + 1)
    case 'ArrowUp':
      event.preventDefault()
      return go(index - 1)
    case 'Home':
      event.preventDefault()
      return go(0)
    case 'End':
      event.preventDefault()
      return go(props.items.length - 1)
    case 'Enter':
      event.preventDefault()
      return menu.run('open', [item.id])
    case ' ':
      event.preventDefault()
      return selection.select(item.id, 'toggle')
    case 'a':
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        selection.selectAll()
      }
  }
}

function onRowClick(event: MouseEvent, item: DriveItem) {
  if ((event.target as HTMLElement).closest('button, a, input, label')) return
  if (lastPointer === 'touch' && !selection.selected.value.length) return menu.run('open', [item.id])
  if (event.shiftKey) selection.select(item.id, 'range')
  else if (event.ctrlKey || event.metaKey || (lastPointer === 'touch' && selection.selected.value.length)) selection.select(item.id, 'toggle')
  else selection.select(item.id)
}

function toggleAll() {
  if (allSelected.value) selection.clear()
  else selection.selectAll()
}

// ---- Sorting ----
function sortBy(key: SortKey) {
  const current = drive.sort.value
  drive.setSort({ key, dir: current.key === key && current.dir === 'asc' ? 'desc' : key === 'name' ? 'asc' : 'desc' })
}

function ariaSort(key: SortKey) {
  if (!props.sortable || drive.sort.value.key !== key) return undefined
  return drive.sort.value.dir === 'asc' ? 'ascending' : 'descending'
}

// ---- Loading more ----
const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | undefined
onMounted(() => {
  observer = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting) && props.hasMore && !props.loading) emit('loadMore')
  })
  watch(sentinel, (el, old) => {
    if (old) observer?.unobserve(old)
    if (el) observer?.observe(el)
  }, { immediate: true })
})
onBeforeUnmount(() => observer?.disconnect())

// ---- Cells ----
function location(item: DriveItem): { name: string; to: string } | null {
  if (!item.parentId) return null
  const parent = drive.item(item.parentId)
  const root = drive.workspaces.value.find((w) => w.root.id === item.parentId)
  const name = root?.name ?? parent?.name ?? t('drive.item.unnamed')
  return { name, to: root ? '/drive' : `/drive/f/${encodeURIComponent(item.parentId)}` }
}

function typeLabel(item: DriveItem) {
  return t(`drive.type.${item.type}`)
}
</script>

<template>
  <div class="list" :aria-busy="loading || undefined">
    <SgAlert v-if="error && loaded" tone="danger" class="list__error">
      {{ errorMessage(error) }}
      <template #actions>
        <SgButton size="sm" icon="refresh" @click="emit('retry')">{{ t('common.retry') }}</SgButton>
      </template>
    </SgAlert>


    <SgAlert v-if="error && !loaded" tone="danger">
      {{ errorMessage(error) }}
      <template #actions>
        <SgButton size="sm" icon="refresh" @click="emit('retry')">{{ t('common.retry') }}</SgButton>
      </template>
    </SgAlert>

    <template v-else-if="!loaded">
      <p v-if="slow" class="list__slow" role="status">
        <SgSpinner decorative size="sm" />
        {{ t('drive.list.decrypting') }}
      </p>
      <div class="list__skeleton" aria-hidden="true">
        <div v-for="n in 11" :key="n" class="list__skeleton-row">
          <SgSkeleton variant="block" width="20px" height="20px" />
          <SgSkeleton variant="text" :width="`${35 + ((n * 37) % 40)}%`" />
        </div>
      </div>
      <span class="sr-only" role="status">{{ t('common.loading') }}</span>
    </template>

    <div v-else-if="!items.length && !error" class="list__empty">
      <slot name="empty" />
    </div>

    <div v-else-if="items.length" class="list__table">
        <!-- Selection bar: covers the column headers (same height), so selecting never moves the rows. -->
      <div v-if="selectedItems.length" class="list__bulk" role="region" :aria-label="t('drive.selection.label')">
        <span class="list__bulk-count" aria-live="polite">{{ t('drive.selection.count', { n: selectedItems.length }, selectedItems.length) }}</span>
        <SgButton
          v-for="action in menu.bulkFor(selectedItems)"
          :key="action.key"
          size="sm"
          :variant="action.key === 'trash' || action.key === 'delete-forever' ? 'danger' : 'secondary'"
          :disabled="action.disabled"
          :disabled-reason="action.reason"
          @click="menu.run(action.key, selectedItems.map((i) => i.id))"
        >
          {{ action.label }}
        </SgButton>
        <SgButton size="sm" variant="ghost" icon="x" @click="selection.clear()">{{ t('drive.selection.clear') }}</SgButton>
      </div>
    <table class="files">
      <caption class="sr-only">{{ label }}</caption>
      <thead>
        <tr>
          <th scope="col" class="files__check">
            <input
              type="checkbox"
              class="files__box"
              :checked="allSelected"
              :indeterminate="selectedItems.length > 0 && !allSelected"
              :aria-label="t('drive.selection.all')"
              @change="toggleAll"
            />
          </th>
          <th scope="col" class="files__name" :aria-sort="ariaSort('name')">
            <button v-if="sortable" type="button" class="files__sort" @click="sortBy('name')">
              {{ t('drive.column.name') }}
              <SgIcon v-if="drive.sort.value.key === 'name'" :name="drive.sort.value.dir === 'asc' ? 'arrow-up' : 'arrow-down'" :size="13" />
            </button>
            <template v-else>{{ t('drive.column.name') }}</template>
          </th>
          <th v-if="columns.includes('location')" scope="col" class="files__meta">{{ t('drive.column.location') }}</th>
          <th v-if="columns.includes('owner')" scope="col" class="files__meta">{{ t('drive.column.owner') }}</th>
          <th v-if="columns.includes('updated')" scope="col" class="files__meta" :aria-sort="ariaSort('updated')">
            <button v-if="sortable" type="button" class="files__sort" @click="sortBy('updated')">
              {{ t('drive.column.updated') }}
              <SgIcon v-if="drive.sort.value.key === 'updated'" :name="drive.sort.value.dir === 'asc' ? 'arrow-up' : 'arrow-down'" :size="13" />
            </button>
            <template v-else>{{ t('drive.column.updated') }}</template>
          </th>
          <th v-if="columns.includes('deleted')" scope="col" class="files__meta">{{ t('drive.column.deleted') }}</th>
          <th v-if="columns.includes('size')" scope="col" class="files__meta files__num" :aria-sort="ariaSort('size')">
            <button v-if="sortable" type="button" class="files__sort" @click="sortBy('size')">
              {{ t('drive.column.size') }}
              <SgIcon v-if="drive.sort.value.key === 'size'" :name="drive.sort.value.dir === 'asc' ? 'arrow-up' : 'arrow-down'" :size="13" />
            </button>
            <template v-else>{{ t('drive.column.size') }}</template>
          </th>
          <th scope="col" class="files__actions"><span class="sr-only">{{ t('drive.column.actions') }}</span></th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(item, index) in items"
          :key="item.id"
          :ref="(el) => { if (el) rows[item.id] = el as HTMLElement }"
          class="files__row"
          :class="{ 'is-selected': selection.selected.value.includes(item.id), 'is-unreadable': !item.name }"
          :tabindex="selection.focused.value === item.id || (!selection.focused.value && index === 0) ? 0 : -1"
          @keydown="onRowKey($event, item, index)"
          @pointerdown="lastPointer = $event.pointerType"
          @click="onRowClick($event, item)"
          @dblclick="menu.run('open', [item.id])"
          @focus="selection.focused.value = item.id"
        >
          <td class="files__check">
            <input
              type="checkbox"
              class="files__box"
              :checked="selection.selected.value.includes(item.id)"
              :aria-label="t('drive.selection.one', { name: item.name ?? t('drive.item.unnamed') })"
              tabindex="-1"
              @change="selection.select(item.id, 'toggle')"
            />
          </td>
          <td class="files__name">
            <div class="files__cell">
            <span class="files__icon" :class="`is-${item.type}`" aria-hidden="true">
              <SgIcon :name="fileIcon(item.type)" :size="18" />
            </span>
            <span class="files__title">
              <button v-if="item.name" type="button" class="files__open" dir="auto" tabindex="-1" @click="menu.run('open', [item.id])">
                <SgFileName :name="item.name" />
              </button>
              <span v-else class="files__broken">
                <SgIcon name="alert" :size="14" />
                {{ t('drive.item.unreadable') }}
              </span>
              <span class="files__sub">
                {{ typeLabel(item) }}<template v-if="item.kind === 'file'"> · {{ formatBytes(item.size, locale) }}</template>
                · {{ formatWhen(item.updatedAt, locale) }}
              </span>
            </span>
            <span v-if="item.shared" class="files__shared" :title="t('drive.item.shared')">
              <SgIcon name="users" :size="14" />
              <span class="sr-only">{{ t('drive.item.shared') }}</span>
            </span>
            </div>
          </td>
          <td v-if="columns.includes('location')" class="files__meta">
            <NuxtLink v-if="location(item)" :to="location(item)!.to" class="files__link" tabindex="-1">
              <bdi>{{ location(item)!.name }}</bdi>
            </NuxtLink>
          </td>
          <td v-if="columns.includes('owner')" class="files__meta">
            <span class="files__owner">
              <SgAvatar :name="item.owner.name" :size="22" />
              <bdi>{{ item.owner.name }}</bdi>
            </span>
          </td>
          <td v-if="columns.includes('updated')" class="files__meta">
            <time :datetime="item.updatedAt" :title="formatDateTime(item.updatedAt, locale)">{{ formatWhen(item.updatedAt, locale) }}</time>
          </td>
          <td v-if="columns.includes('deleted')" class="files__meta">
            <time v-if="item.trashedAt" :datetime="item.trashedAt" :title="formatDateTime(item.trashedAt, locale)">{{ formatWhen(item.trashedAt, locale) }}</time>
          </td>
          <td v-if="columns.includes('size')" class="files__meta files__num">
            <template v-if="item.kind === 'file'">{{ formatBytes(item.size, locale) }}</template>
            <span v-else aria-hidden="true">—</span>
          </td>
          <td class="files__actions">
            <SgButton
              v-if="!item.trashedAt"
              class="files__star"
              :class="{ 'is-on': item.starred }"
              variant="ghost"
              size="sm"
              icon-only
              icon="star"
              :label="item.starred ? t('drive.action.unstar') : t('drive.action.star')"
              :pressed="item.starred"
              tabindex="-1"
              @click="menu.run(item.starred ? 'unstar' : 'star', [item.id])"
            />
            <SgActionMenu
              :label="t('drive.item.menu', { name: item.name ?? t('drive.item.unnamed') })"
              :items="menu.menuFor(item)"
              tabindex="-1"
              @select="(key) => menu.run(key, [item.id])"
            />
          </td>
        </tr>
      </tbody>
    </table>
    </div>

    <div v-if="loaded && hasMore" ref="sentinel" class="list__more">
      <SgButton size="sm" :loading="loading" :loading-label="t('common.loading')" @click="emit('loadMore')">{{ t('drive.list.more') }}</SgButton>
    </div>
  </div>
</template>

<style scoped>
.list {
  display: grid;
  gap: var(--s-3);
}

.list__table {
  position: relative;
}

.list__bulk {
  /* Sticky but taking no space (negative margin): it sits over the header row and stays
     visible while the list scrolls. */
  position: sticky;
  top: 0;
  z-index: 5;
  margin-bottom: -44px;
  display: flex;
  align-items: center;
  gap: var(--s-2);
  height: 44px;
  padding: 0 var(--s-2);
  overflow-x: auto;
  border-bottom: 1px solid var(--rule);
  background: var(--signal-soft);
  scrollbar-width: none;
}

.list__bulk > * {
  flex: none;
}

.list__bulk-count {
  margin-inline-end: auto;
  font-size: var(--fs-sm);
  font-weight: var(--fw-medium);
}

.list__slow {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--fg-2);
}

.list__skeleton-row {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  height: 46px;
  padding: 0 var(--s-3);
  border-bottom: 1px solid var(--rule-soft);
}

.list__more {
  display: flex;
  justify-content: center;
  padding: var(--s-4);
}

.files {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: var(--fs-sm);
}

.files thead th {
  position: sticky;
  top: 0;
  z-index: 4;
  height: 44px;
  background: var(--bg);
  padding: 0 var(--s-2);
  border-bottom: 1px solid var(--rule);
  color: var(--fg-2);
  font-size: var(--fs-xs);
  font-weight: var(--fw-medium);
  text-align: start;
  white-space: nowrap;
}

.files__sort {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 24px;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.files__sort:hover {
  color: var(--fg);
}

.files__row {
  height: 46px;
  border-bottom: 1px solid var(--rule-soft);
  cursor: default;
  transition: background-color var(--dur-1) var(--ease);
}

.files__row:hover {
  background: var(--surface-2);
}

.files__row:focus-visible {
  outline: var(--focus-w) solid var(--signal);
  outline-offset: -2px;
}

.files__row.is-selected {
  background: var(--signal-soft);
}

.files td {
  padding: 0 var(--s-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.files__check {
  width: 36px;
}

.files__box {
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: var(--signal);
  cursor: pointer;
}

.files__name {
  width: auto;
}

.files__cell {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  min-width: 0;
}

.files__icon {
  display: inline-grid;
  place-items: center;
  flex: none;
  color: var(--fg-2);
}

.files__icon.is-folder {
  color: var(--signal-text);
}

.files__title {
  display: grid;
  /* minmax(0, 1fr): a long name or sub-line truncates instead of widening the column. */
  grid-template-columns: minmax(0, 1fr);
  min-width: 0;
}

.files__open {
  /* dir="auto": a long French name is cut at its end even in Arabic, and an Arabic name at
     its own end; the rules below keep it aligned with the page either way. */
  min-width: 0;
  padding: 0;
  overflow: hidden;
  border: 0;
  background: none;
  color: var(--fg);
  font: inherit;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

/* Aligned with the page whatever the text's own direction (Chrome ignores match-parent here). */
[dir='rtl'] .files__open {
  text-align: right;
}

.files__open:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.files__broken {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--danger);
  font-style: italic;
}

.files__sub {
  display: none;
  overflow: hidden;
  font-size: var(--fs-xs);
  color: var(--fg-2);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.files__shared {
  display: inline-flex;
  flex: none;
  color: var(--fg-2);
}

.files__meta {
  width: 150px;
  color: var(--fg-2);
}

.files__num {
  width: 100px;
  font-variant-numeric: tabular-nums;
  text-align: end;
}

.files thead .files__num {
  text-align: end;
}

.files__link {
  color: var(--fg-2);
  text-decoration: none;
}

.files__link:hover {
  color: var(--fg);
  text-decoration: underline;
}

.files__owner {
  display: inline-flex;
  align-items: center;
  gap: var(--s-2);
}

.files__actions {
  width: 84px;
  text-align: end;
}

.files__actions > * {
  vertical-align: middle;
}

.files__star {
  opacity: 0;
}

.files__star.is-on,
.files__row:hover .files__star,
.files__row:focus-within .files__star {
  opacity: 1;
}

/* A star is a toggle shown by its fill, not by a pressed box. */
.files__star[aria-pressed='true'] {
  background: transparent;
  border-color: transparent;
}

.files__star.is-on :deep(.sg-icon) {
  fill: var(--signal);
  color: var(--signal-text);
}

@media (hover: none) {
  .files__star {
    opacity: 1;
  }
}

@media (max-width: 899px) {
  .files thead .files__meta,
  .files td.files__meta {
    display: none;
  }

  .files__sub {
    display: block;
  }

  .files__row {
    height: 56px;
  }

  .files__check {
    width: 32px;
  }
}
</style>
