<script setup lang="ts">
// Every drive dialog lives here, once, driven by useDriveUi(): pages and menus only say which
// one to open. Closing any of them returns focus to what opened it (native <dialog>).
const ui = useDriveUi()
const transfers = useTransfers()

const dialog = ui.dialog
function isOpen(kind: string) {
  return computed({
    get: () => dialog.value?.kind === kind,
    set: (value) => {
      if (!value && dialog.value?.kind === kind) ui.close()
    },
  })
}

const newFolder = isOpen('new-folder')
const rename = isOpen('rename')
const move = isOpen('move')
const share = isOpen('share')
const remove = isOpen('delete-forever')
const request = isOpen('request')
const shortcuts = isOpen('shortcuts')
const requestCreated = useState('drive:request-created', () => 0)
</script>

<template>
  <DriveNameDialog v-if="dialog?.kind === 'new-folder'" v-model:open="newFolder" mode="new-folder" :parent-id="dialog.parentId" :item-id="null" />
  <DriveNameDialog v-if="dialog?.kind === 'rename'" v-model:open="rename" mode="rename" :parent-id="null" :item-id="dialog.itemId" />
  <DriveMoveDialog v-if="dialog?.kind === 'move'" v-model:open="move" :item-ids="dialog.itemIds" />
  <DriveShareDialog v-if="dialog?.kind === 'share'" v-model:open="share" :item-id="dialog.itemId" :tab="dialog.tab" />
  <DriveDeleteDialog v-if="dialog?.kind === 'delete-forever'" v-model:open="remove" :item-ids="dialog.itemIds" :empty-trash="dialog.emptyTrash" />
  <DriveRequestDialog v-if="dialog?.kind === 'request'" v-model:open="request" @created="requestCreated++" />
  <AppShortcutSheet v-if="dialog?.kind === 'shortcuts'" v-model:open="shortcuts" />
  <DriveConflictDialog v-if="transfers.conflict.value" />
  <DrivePreview v-if="ui.preview.value" />
</template>
