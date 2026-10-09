<script setup lang="ts">
// Search, Upload, notifications and the account. On phones: the menu button opens the
// navigation drawer, and Upload/Search/Me live in the bottom bar.
const { t } = useI18n()
const route = useRoute()
const ui = useDriveUi()
const upload = useUploadTarget()

const query = ref(typeof route.query.q === 'string' ? route.query.q : '')
watch(
  () => route.query.q,
  (q) => {
    if (typeof q === 'string' && q !== query.value) query.value = q
  },
)

let typing: ReturnType<typeof setTimeout> | undefined
function onInput() {
  // On the search page, results follow the typing; elsewhere Enter starts the search.
  if (route.path !== '/drive/search') return
  clearTimeout(typing)
  typing = setTimeout(() => navigateTo({ path: '/drive/search', query: query.value ? { q: query.value } : {} }, { replace: true }), 250)
}

function submit() {
  clearTimeout(typing)
  navigateTo({ path: '/drive/search', query: query.value.trim() ? { q: query.value.trim() } : {} })
}
</script>

<template>
  <header class="top">
    <SgButton class="top__menu" variant="ghost" icon="menu" icon-only :label="t('app.nav.open')" @click="ui.drawerOpen.value = true" />
    <SgLogo class="top__logo" to="/drive" />

    <form class="top__search" role="search" @submit.prevent="submit">
      <label class="sr-only" for="app-search">{{ t('app.search.label') }}</label>
      <SgInput
        id="app-search"
        v-model="query"
        type="search"
        :placeholder="t('app.search.placeholder')"
        autocomplete="off"
        enterkeyhint="search"
        @input="onInput"
      >
        <template #prefix><SgIcon name="search" :size="16" /></template>
      </SgInput>
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
      <SgPopover class="top__account" :label="t('app.account.label')" icon="user" :width="300">
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
.top__logo {
  display: none;
}

.top__search {
  flex: 1;
  max-width: 520px;
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

  /* Search, Upload and the account move to the bottom bar. */
  .top__search,
  .top__upload,
  .top__account {
    display: none;
  }
}
</style>
