<script setup lang="ts">
import { onUnauthorized } from '~/services/api/client'

// The signed-in app: sidebar (inline-start), top bar, the page, the details panel
// (inline-end), the transfer tray and every dialog. On phones the sidebar becomes a drawer and
// the bottom bar appears (sitemap.md, navigation model).
const { t } = useI18n()
const route = useRoute()
const toast = useToast()
const online = useOnline()
const errorMessage = useErrorMessage()
const drive = useDrive()
const ui = useDriveUi()
const selection = useSelection()
const menu = useItemMenu()
const upload = useUploadTarget()

// ---- Workspaces and quota ----
const ready = useState('drive:ready', () => false)
const initError = ref('')

async function init() {
  initError.value = ''
  try {
    await drive.init()
    ready.value = true
  } catch (error) {
    initError.value = errorMessage(error)
  }
}

// A request answered 401 (session ended elsewhere, or expired): sign in again and come back.
onMounted(() => {
  onUnauthorized(() => {
    if (route.path.startsWith('/signin')) return
    navigateTo({ path: '/signin', query: { reason: 'expired', next: route.fullPath } }, { replace: true })
  })
  try {
    ui.detailsOpen.value = localStorage.getItem('sg_details') === '1'
  } catch {
    // Per-viewer convenience only.
  }
  init()
})
onBeforeUnmount(() => onUnauthorized(null))

// The drawer closes when the page changes.
watch(() => route.fullPath, () => (ui.drawerOpen.value = false))

// ---- Keyboard shortcuts ----
const selectedOne = computed(() => (selection.selected.value.length === 1 ? drive.item(selection.selected.value[0]!) : null))

useShortcuts({
  search: () => {
    const field = document.getElementById('app-search')
    // Phones: the field is hidden until search is opened (it focuses itself then).
    if (field && field.offsetParent) field.focus()
    else ui.searchOpen.value = true
  },
  upload: () => (upload.blocked.value ? toast.info(upload.blocked.value) : upload.pickFiles()),
  newFolder: () => {
    if (ui.currentFolderId.value && ui.canAddHere.value) ui.open({ kind: 'new-folder', parentId: ui.currentFolderId.value })
    else toast.info(ui.currentFolderId.value ? t('drive.upload.viewOnly') : t('drive.shortcut.openFolder'))
  },
  share: () => {
    if (selectedOne.value && menu.canEdit(selectedOne.value) && !selectedOne.value.trashedAt) menu.run('share', [selectedOne.value.id])
    else toast.info(t('drive.shortcut.selectOne'))
  },
  details: () => ui.toggleDetails(),
  trash: () => {
    const ids = selection.selected.value.filter((id) => !drive.item(id)?.trashedAt)
    if (ids.length) menu.run('trash', ids)
  },
  help: () => ui.open({ kind: 'shortcuts' }),
})
</script>

<template>
  <div class="app">
    <aside class="app__side"><AppSidebar /></aside>

    <!-- Phones: the sidebar as a drawer. -->
    <div v-if="ui.drawerOpen.value" class="app__drawer">
      <div class="app__scrim" aria-hidden="true" @click="ui.drawerOpen.value = false" />
      <div class="app__drawer-panel" role="dialog" aria-modal="true" :aria-label="t('app.nav.label')" @keydown.esc="ui.drawerOpen.value = false">
        <div class="app__drawer-head">
          <SgLogo to="/drive" />
          <SgButton variant="ghost" icon="x" icon-only :label="t('app.nav.close')" autofocus @click="ui.drawerOpen.value = false" />
        </div>
        <AppSidebar />
      </div>
    </div>

    <div class="app__main">
      <AppTopbar />
      <div v-if="!online" class="app__offline" role="status">
        <SgIcon name="cloud-off" :size="15" />{{ t('app.offline') }}
      </div>

      <div class="app__body">
        <main id="main" class="app__content">
          <SgAlert v-if="initError" tone="danger" :title="t('app.initFailed')">
            {{ initError }}
            <template #actions>
              <SgButton size="sm" icon="refresh" @click="init">{{ t('common.retry') }}</SgButton>
            </template>
          </SgAlert>
          <slot v-else-if="ready" />
          <div v-else class="app__loading" aria-busy="true">
            <SgSkeleton variant="text" width="240px" />
            <SgSkeleton :lines="6" />
          </div>
        </main>
        <!-- Details belong to the drive: not shown over Settings or Administration. -->
        <DriveDetailsPanel v-if="ui.detailsOpen.value && ready && route.path.startsWith('/drive')" class="app__details" @close="ui.toggleDetails(false)" />
      </div>
    </div>

    <DriveTransferTray />
    <AppBottomBar />
    <DriveDialogHost v-if="ready" />
  </div>
</template>

<style scoped>
.app {
  display: grid;
  grid-template-columns: 248px minmax(0, 1fr);
  min-height: 100dvh;
}

.app__side {
  position: sticky;
  top: 0;
  height: 100dvh;
  border-inline-end: 1px solid var(--rule);
  background: var(--surface);
  overflow-x: hidden;
  overflow-y: auto;
}

.app__main {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.app__offline {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  padding: var(--s-2) var(--s-5);
  border-bottom: 1px solid var(--rule);
  background: var(--signal-soft);
  font-size: var(--fs-sm);
}

.app__body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.app__content {
  flex: 1;
  min-width: 0;
  padding: var(--s-5) var(--s-6) var(--s-10);
}

.app__loading {
  display: grid;
  gap: var(--s-4);
}

.app__details {
  position: sticky;
  top: 0;
  flex: none;
  width: 340px;
  height: calc(100dvh - 61px);
  border-inline-start: 1px solid var(--rule);
  background: var(--surface);
}

.app__drawer {
  display: none;
}

@media (max-width: 1199px) {
  /* The details panel covers the content instead of squeezing it. */
  .app__details {
    position: fixed;
    inset-block: 0;
    inset-inline-end: 0;
    z-index: 35;
    width: min(380px, 100vw);
    height: 100dvh;
    box-shadow: var(--shadow-pop);
  }
}

@media (max-width: 899px) {
  .app {
    grid-template-columns: minmax(0, 1fr);
  }

  .app__side {
    display: none;
  }

  .app__content {
    padding: var(--s-4) var(--s-4) calc(88px + env(safe-area-inset-bottom));
  }

  .app__offline {
    padding-inline: var(--s-4);
  }

  .app__drawer {
    position: fixed;
    inset: 0;
    z-index: 45;
    display: block;
  }

  .app__scrim {
    position: absolute;
    inset: 0;
    background: var(--scrim);
  }

  .app__drawer-panel {
    overflow-x: hidden;
    position: absolute;
    inset-block: 0;
    inset-inline-start: 0;
    display: flex;
    flex-direction: column;
    width: min(300px, 86vw);
    background: var(--surface);
    box-shadow: var(--shadow-pop);
    overflow-y: auto;
  }

  .app__drawer-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--s-3) var(--s-4);
    border-bottom: 1px solid var(--rule);
  }
}
</style>
