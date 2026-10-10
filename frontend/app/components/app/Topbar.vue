<script setup lang="ts">
// Search, Upload, notifications and the account. On phones: the menu button opens the
// navigation drawer, Upload and Me live in the bottom bar, and the search field opens here.
//
// Search follows the typing: results update on every keystroke (they're filtered on this
// device, the server isn't asked), the address bar follows quietly, and an empty field brings
// back the files (/drive) while keeping the cursor in the field.
const { t } = useI18n()
// The recovery-kit reminder waits in the account menu.
const kitDue = computed(() => Boolean(useAccount().account.value?.kit_reminder_due))
const route = useRoute()
const drive = useDrive()
const ui = useDriveUi()
const upload = useUploadTarget()

const query = ui.searchQuery
const onSearch = computed(() => route.path === '/drive/search')
const field = ref<{ focus: () => void } | null>(null)

// Queries this field put in the address bar: when they come back from the router they're not
// news (and must not overwrite what was typed since).
const sent = new Set<string>()
let syncing: ReturnType<typeof setTimeout> | undefined
let opening = false

// The address bar is the source when the user arrives with a link, or goes back/forward.
watch(
  () => route.query.q,
  (q) => {
    if (typeof q !== 'string' || !onSearch.value) return
    if (sent.delete(q)) return
    if (q !== query.value) query.value = q
  },
  { immediate: true },
)
// Leaving the results (a sidebar link, a folder) clears the field and any pending update.
watch(onSearch, (now) => {
  opening = false
  if (now) return
  clearTimeout(syncing)
  sent.clear()
  query.value = ''
})

function go(q: string, replace: boolean) {
  sent.add(q)
  navigateTo({ path: '/drive/search', query: { q } }, { replace })
}

function onInput() {
  clearTimeout(syncing)
  const q = query.value.trim()
  if (!q) {
    // Empty: back to the files, without adding a history entry for the search.
    opening = false
    if (onSearch.value) navigateTo('/drive', { replace: true })
    return
  }
  if (!onSearch.value && !opening) {
    // First character: open the results (one history entry, so Back returns to the folder).
    opening = true
    go(q, false)
    return
  }
  // Results already follow the field; the address bar catches up without flooding history.
  syncing = setTimeout(() => go(q, true), 300)
}

function clear() {
  query.value = ''
  onInput()
  field.value?.focus()
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && query.value) {
    event.preventDefault()
    clear()
  }
}

/** Phones: close the search field (and the results). */
function closeSearch() {
  ui.searchOpen.value = false
  if (query.value) clear()
}

// The name index starts loading as soon as the field is used, so the first keystroke is instant.
function warm() {
  drive.loadIndex()
}

// Phones: opening search (bottom bar, "/" shortcut) focuses the field.
watch(
  () => ui.searchOpen.value,
  (open) => open && nextTick(() => field.value?.focus()),
)
</script>

<template>
  <header class="top" :class="{ 'is-searching': ui.searchOpen.value || onSearch }">
    <SgButton class="top__menu" variant="ghost" icon="menu" icon-only :label="t('app.nav.open')" @click="ui.drawerOpen.value = true" />
    <SgLogo class="top__logo" to="/drive" />

    <form class="top__search" role="search" @submit.prevent="onInput">
      <label class="sr-only" for="app-search">{{ t('app.search.label') }}</label>
      <SgInput
        id="app-search"
        ref="field"
        v-model="query"
        type="search"
        :placeholder="t('app.search.placeholder')"
        autocomplete="off"
        enterkeyhint="search"
        @input="onInput"
        @focus="warm"
        @keydown="onKey"
      >
        <template #prefix><SgIcon name="search" :size="16" /></template>
        <template v-if="query" #suffix>
          <SgButton variant="ghost" size="sm" icon-only icon="x" :label="t('app.search.clear')" @click="clear" />
        </template>
      </SgInput>
      <SgButton class="top__search-close" variant="ghost" icon="x" icon-only :label="t('app.search.close')" @click="closeSearch" />
    </form>

    <div class="top__actions">
      <SgButton
        class="top__upload"
        variant="primary"
        icon="upload"
        :disabled="Boolean(upload.blocked.value)"
        :disabled-reason="upload.blocked.value"
        @click="upload.pickFiles()"
      >
        {{ t('drive.upload.button') }}
      </SgButton>
      <AppNotifications />
      <SgPopover
        class="top__account"
        :label="t('app.account.label')"
        :badge-label="t('app.account.labelReminder')"
        icon="user"
        :badge="kitDue ? 1 : 0"
        :width="300"
      >
        <template #default="{ close }">
          <AppAccountPanel @done="close(false)" />
        </template>
      </SgPopover>
    </div>
  </header>
</template>

<style scoped>
.top {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  min-height: 60px;
  padding: var(--s-2) var(--s-5);
  border-bottom: 1px solid var(--rule);
  background: var(--bg);
}

.top__menu,
.top__logo,
.top__search-close {
  display: none;
}

.top__search {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--s-2);
  max-width: 520px;
}

.top__search > :first-of-type {
  flex: 1;
}

/* The browser's own clear button would duplicate ours. */
.top__search :deep(input[type='search']::-webkit-search-cancel-button) {
  display: none;
}

.top__actions {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  margin-inline-start: auto;
}

@media (max-width: 899px) {
  .top {
    padding-inline: var(--s-3);
  }

  .top__menu,
  .top__logo {
    display: inline-flex;
  }

  /* Upload and the account live in the bottom bar; search opens here on demand. */
  .top__search,
  .top__upload,
  .top :deep(.top__account) {
    display: none;
  }

  .top.is-searching .top__menu,
  .top.is-searching .top__logo,
  .top.is-searching .top__actions {
    display: none;
  }

  .top.is-searching .top__search {
    display: flex;
    max-width: none;
  }

  .top__search-close {
    display: inline-flex;
  }
}
</style>
