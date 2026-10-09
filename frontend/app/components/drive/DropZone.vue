<script setup lang="ts">
// Drag files or whole folders onto the page to upload them into this folder. Folders keep
// their structure (user-flows.md F4). While something is dragged over, the area is outlined
// and says where the files will go.
const props = defineProps<{ folderId: string | null; folderName: string; disabled?: boolean; reason?: string }>()

const { t } = useI18n()
const toast = useToast()
const transfers = useTransfers()
const over = ref(false)
let depth = 0

function hasFiles(event: DragEvent) {
  return [...(event.dataTransfer?.types ?? [])].includes('Files')
}

function onEnter(event: DragEvent) {
  if (!hasFiles(event)) return
  event.preventDefault()
  depth += 1
  over.value = true
}

function onOver(event: DragEvent) {
  if (!hasFiles(event)) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = props.disabled ? 'none' : 'copy'
}

function onLeave() {
  depth = Math.max(0, depth - 1)
  if (!depth) over.value = false
}

/** Walks a dropped folder (FileSystemEntry API) into files with their relative paths. */
async function walk(entry: FileSystemEntry, path: string[], out: { path: string[]; file: File }[]) {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject))
    out.push({ path, file })
    return
  }
  const reader = (entry as FileSystemDirectoryEntry).createReader()
  // readEntries returns at most ~100 entries per call: keep reading until it returns none.
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject))
    if (!batch.length) break
    for (const child of batch) await walk(child, [...path, entry.name], out)
  }
}

async function onDrop(event: DragEvent) {
  if (!hasFiles(event)) return
  event.preventDefault()
  depth = 0
  over.value = false
  if (props.disabled || !props.folderId) {
    if (props.reason) toast.info(props.reason)
    return
  }
  const items = [...(event.dataTransfer?.items ?? [])]
  const entries = items.map((item) => item.webkitGetAsEntry?.()).filter(Boolean) as FileSystemEntry[]
  if (entries.some((entry) => entry.isDirectory)) {
    const files: { path: string[]; file: File }[] = []
    try {
      for (const entry of entries) await walk(entry, [], files)
    } catch {
      toast.error(t('drive.drop.unreadable'))
      return
    }
    await transfers.uploadTree(files, props.folderId)
  } else {
    await transfers.upload([...(event.dataTransfer?.files ?? [])], props.folderId)
  }
}
</script>

<template>
  <div class="drop" :class="{ 'is-over': over, 'is-blocked': over && disabled }" @dragenter="onEnter" @dragover="onOver" @dragleave="onLeave" @drop="onDrop">
    <slot />
    <div v-if="over" class="drop__hint" aria-hidden="true">
      <SgIcon :name="disabled ? 'lock' : 'upload'" :size="22" />
      <span>{{ disabled ? reason : t('drive.drop.hint', { folder: folderName }) }}</span>
    </div>
  </div>
</template>

<style scoped>
.drop {
  position: relative;
  min-height: 100%;
}

.drop.is-over::after {
  content: '';
  position: absolute;
  inset: -8px;
  border: 2px dashed var(--signal);
  border-radius: var(--radius-2);
  background: var(--signal-soft);
  opacity: 0.5;
  pointer-events: none;
}

.drop.is-blocked::after {
  border-color: var(--rule-input);
  background: var(--surface-2);
}

.drop__hint {
  position: fixed;
  bottom: var(--s-8);
  left: 50%;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: var(--s-2);
  padding: var(--s-3) var(--s-4);
  border-radius: var(--radius-2);
  background: var(--fg);
  color: var(--bg);
  font-size: var(--fs-sm);
  transform: translateX(-50%);
  pointer-events: none;
}
</style>
