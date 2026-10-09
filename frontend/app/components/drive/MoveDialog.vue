<script setup lang="ts">
// Move: browse folders and pick the destination. A folder can't go into itself or one of its
// own sub-folders, and nothing can go into a view-only folder; the dialog says why.
const props = defineProps<{ itemIds: string[] }>()
const open = defineModel<boolean>('open', { default: false })

const { t, locale } = useI18n()
const drive = useDrive()
const actions = useDriveActions()
const errorMessage = useErrorMessage()

const here = ref<string | null>(null)
const busy = ref(false)

const items = computed(() => props.itemIds.map((id) => drive.item(id)).filter(Boolean) as NonNullable<ReturnType<typeof drive.item>>[])
const rootId = computed(() => drive.workspaceOf(items.value[0]?.parentId ?? '')?.root.id ?? drive.workspace.value?.root.id ?? null)

watch(
  open,
  (value) => {
    if (!value) return
    here.value = items.value[0]?.parentId ?? rootId.value
  },
  { immediate: true },
)

watch(here, (id) => id && drive.loadFolder(id), { immediate: true })

const state = computed(() => (here.value ? drive.list(`folder:${here.value}`) : null))
const folders = computed(() => (here.value ? drive.folderItems(here.value, locale.value).filter((i) => i.kind === 'folder') : []))
const crumbs = computed(() =>
  here.value
    ? drive.ancestry(here.value).map((id) => ({
        id,
        name: drive.workspaces.value.find((w) => w.root.id === id)?.name ?? drive.item(id)?.name ?? t('drive.item.unnamed'),
      }))
    : [],
)

/** A folder being moved can't go into itself or anything below it. */
function intoItself(folderId: string): boolean {
  const chain = drive.ancestry(folderId)
  return items.value.some((item) => item.kind === 'folder' && chain.includes(item.id))
}

/** Why the current folder can't receive the items, or ''. */
function blockedReason(folderId: string): string {
  if (intoItself(folderId)) return t('drive.move.intoItself')
  const folder = drive.item(folderId)
  if (folder && folder.role === 'viewer') return t('drive.move.viewOnly')
  if (items.value.every((item) => item.parentId === folderId)) return t('drive.move.alreadyHere')
  return ''
}

const reason = computed(() => (here.value ? blockedReason(here.value) : ''))
const what = computed(() =>
  items.value.length === 1 ? (items.value[0]!.name ?? t('drive.item.unnamed')) : t('drive.count.items', { n: items.value.length }, items.value.length),
)

async function submit() {
  if (!here.value || reason.value) return
  busy.value = true
  try {
    await actions.move(props.itemIds, here.value)
    open.value = false
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <SgDialog v-model:open="open" :title="t('drive.move.title', { what })" :busy="busy">
    <div class="picker">
      <nav class="picker__path" :aria-label="t('drive.breadcrumbs')">
        <template v-for="(crumb, index) in crumbs" :key="crumb.id">
          <button v-if="index < crumbs.length - 1" type="button" class="picker__crumb" @click="here = crumb.id">
            <bdi>{{ crumb.name }}</bdi>
          </button>
          <strong v-else class="picker__crumb is-current"><bdi>{{ crumb.name }}</bdi></strong>
          <SgIcon v-if="index < crumbs.length - 1" name="chevron-end" :size="13" />
        </template>
      </nav>

      <div class="picker__list" :aria-busy="state?.loading || undefined">
        <SgSkeleton v-if="!state?.loaded && !state?.error" :lines="4" />
        <SgAlert v-else-if="state?.error && !state.loaded" tone="danger">
          {{ errorMessage(state.error) }}
          <template #actions>
            <SgButton size="sm" icon="refresh" @click="here && drive.loadFolder(here, { force: true })">{{ t('common.retry') }}</SgButton>
          </template>
        </SgAlert>
        <p v-else-if="!folders.length" class="picker__empty">{{ t('drive.move.noFolders') }}</p>
        <ul v-else>
          <li v-for="folder in folders" :key="folder.id">
            <button
              type="button"
              class="picker__folder"
              :aria-disabled="intoItself(folder.id) || undefined"
              @click="!intoItself(folder.id) && (here = folder.id)"
            >
              <SgIcon name="folder" :size="17" />
              <bdi>{{ folder.name ?? t('drive.item.unnamed') }}</bdi>
              <span v-if="intoItself(folder.id)" class="picker__why">{{ t('drive.move.intoItselfShort') }}</span>
              <SgIcon v-else class="picker__go" name="chevron-end" :size="15" />
            </button>
          </li>
        </ul>
      </div>
    </div>
    <template #footer>
      <p v-if="reason" class="picker__reason" role="status">{{ reason }}</p>
      <SgButton :disabled="busy" :disabled-reason="t('common.pleaseWait')" @click="open = false">{{ t('common.cancel') }}</SgButton>
      <SgButton
        variant="primary"
        icon="folder-move"
        :loading="busy"
        :loading-label="t('drive.move.moving')"
        :disabled="Boolean(reason)"
        :disabled-reason="reason"
        @click="submit"
      >
        {{ t('drive.move.here') }}
      </SgButton>
    </template>
  </SgDialog>
</template>

<style scoped>
.picker {
  display: grid;
  gap: var(--s-3);
}

.picker__path {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  font-size: var(--fs-sm);
  color: var(--fg-3);
}

.picker__crumb {
  padding: 2px 4px;
  border: 0;
  border-radius: var(--radius-1);
  background: none;
  color: var(--fg-2);
  font: inherit;
  cursor: pointer;
}

.picker__crumb:hover {
  background: var(--surface-2);
  color: var(--fg);
}

.picker__crumb.is-current {
  color: var(--fg);
  cursor: default;
}

.picker__list {
  min-height: 220px;
  max-height: 320px;
  overflow-y: auto;
  border: 1px solid var(--rule);
  border-radius: var(--radius-1);
  padding: var(--s-1);
}

.picker__list ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.picker__folder {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  width: 100%;
  min-height: 40px;
  padding: 0 var(--s-3);
  border: 0;
  border-radius: var(--radius-1);
  background: none;
  color: var(--fg);
  font: inherit;
  font-size: var(--fs-sm);
  text-align: start;
  cursor: pointer;
}

.picker__folder:hover {
  background: var(--surface-2);
}

.picker__folder:active {
  background: var(--surface-3);
}

.picker__folder[aria-disabled='true'] {
  color: var(--fg-3);
  cursor: not-allowed;
}

.picker__folder > .sg-icon:first-child {
  color: var(--signal-text);
}

.picker__go,
.picker__why {
  margin-inline-start: auto;
  color: var(--fg-3);
  font-size: var(--fs-xs);
}

.picker__empty {
  margin: 0;
  padding: var(--s-4);
  color: var(--fg-2);
  font-size: var(--fs-sm);
}

.picker__reason {
  margin: 0;
  margin-inline-end: auto;
  font-size: var(--fs-sm);
  color: var(--fg-2);
}
</style>
