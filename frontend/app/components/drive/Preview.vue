<script setup lang="ts">
import type { DriveItem } from '~/composables/useDrive'

// File preview, full screen (states.md, "File preview / download"):
//   downloading → decrypting on this device (with sizes) → shown, "Integrity verified".
// An altered file is a blocking error with no "open anyway". A file the user lost access to
// says who to ask. Types the browser can't show safely are offered as a download.
// ← → (mirrored in Arabic) move between the files of the list.
const { t, locale } = useI18n()
const ui = useDriveUi()
const drive = useDrive()
const transfers = useTransfers()
const menu = useItemMenu()

const state = ui.preview
const open = computed({
  get: () => Boolean(state.value),
  set: (value) => {
    if (!value) state.value = null
  },
})
const item = computed<DriveItem | null>(() => (state.value ? drive.item(state.value.ids[state.value.index]!) : null))
const kind = computed(() => (item.value?.name ? previewable(item.value.name) : null))

type Phase = 'idle' | 'downloading' | 'decrypting' | 'ready' | 'altered' | 'access' | 'error'
const phase = ref<Phase>('idle')
const done = ref(0)
const total = ref(0)
const url = ref<string | null>(null)
const text = ref('')
const failure = shallowRef<unknown>(null)
let controller: AbortController | null = null

function reset() {
  controller?.abort()
  controller = null
  if (url.value) URL.revokeObjectURL(url.value)
  url.value = null
  text.value = ''
  failure.value = null
  done.value = 0
  total.value = 0
}

async function load() {
  reset()
  const current = item.value
  if (!current || !kind.value) {
    phase.value = 'idle'
    return
  }
  controller = new AbortController()
  const signal = controller.signal
  try {
    const plain = await transfers.fetchAndDecrypt(current.id, signal, (step, d, tot) => {
      phase.value = step
      done.value = d
      total.value = tot
    })
    if (signal.aborted) return
    if (kind.value === 'text') {
      // Large text files are cut, with a note: the full file is one click away.
      text.value = await plain.slice(0, 1_000_000).text()
    } else {
      url.value = URL.createObjectURL(new Blob([plain], { type: mimeFor(current.name ?? '') }))
    }
    phase.value = 'ready'
  } catch (error) {
    if ((error as Error)?.name === 'AbortError' || signal.aborted) return
    const problem = transfers.problemOf(error)
    phase.value = problem.code === 'altered' ? 'altered' : problem.code === 'access' ? 'access' : 'error'
    failure.value = error
  }
}

watch(item, load, { immediate: true })
onBeforeUnmount(reset)
watch(open, (value) => !value && reset())

function step(by: number) {
  if (!state.value) return
  const next = state.value.index + by
  if (next < 0 || next >= state.value.ids.length) return
  state.value = { ...state.value, index: next }
}

function onKey(event: KeyboardEvent) {
  if (!open.value || (event.target as HTMLElement)?.closest('input, textarea, select')) return
  const rtl = document.documentElement.dir === 'rtl'
  if (event.key === (rtl ? 'ArrowLeft' : 'ArrowRight')) step(1)
  if (event.key === (rtl ? 'ArrowRight' : 'ArrowLeft')) step(-1)
}
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))

const progressLabel = computed(() => {
  const size = { done: formatBytes(done.value, locale.value), total: formatBytes(total.value, locale.value) }
  return phase.value === 'downloading' ? t('drive.preview.downloading', size) : t('drive.preview.decrypting', size)
})
const errorMessage = useErrorMessage()
</script>

<template>
  <SgDialog v-model:open="open" class="preview" :title="item?.name ?? ''" size="lg">
    <div v-if="item" class="preview__body">
      <div class="preview__bar">
        <span class="preview__meta">{{ t(`drive.type.${item.type}`) }} · {{ formatBytes(item.size, locale) }}</span>
        <span v-if="phase === 'ready'" class="preview__verified" :title="t('drive.preview.verifiedHint')">
          <SgIcon name="check-circle" :size="15" />{{ t('drive.preview.verified') }}
        </span>
        <SgInfo v-if="phase === 'ready'" term="integrity" />
        <div class="preview__actions">
          <SgButton size="sm" icon="download" :disabled="phase === 'altered'" :disabled-reason="t('drive.preview.alteredShort')" @click="menu.run('download', [item.id])">
            {{ t('drive.action.download') }}
          </SgButton>
          <SgButton v-if="item.role !== 'viewer'" size="sm" icon="users" @click="menu.run('share', [item.id])">{{ t('drive.action.share') }}</SgButton>
          <SgButton size="sm" variant="ghost" icon="info" icon-only :label="t('drive.action.details')" @click="(state = null), menu.run('details', [item.id])" />
        </div>
      </div>

      <div class="preview__stage">
        <!-- Working -->
        <div v-if="phase === 'downloading' || phase === 'decrypting'" class="preview__work" aria-live="polite">
          <SgProgress :value="done" :max="Math.max(total, 1)" :label="progressLabel" show-value />
          <p class="preview__note"><SgIcon name="lock" :size="14" />{{ t('drive.preview.onDevice') }}</p>
        </div>

        <!-- Shown -->
        <template v-else-if="phase === 'ready'">
          <img v-if="kind === 'image' && url" :src="url" :alt="item.name ?? ''" class="preview__image" />
          <iframe v-else-if="kind === 'pdf' && url" :src="url" :title="item.name ?? ''" class="preview__frame" />
          <video v-else-if="kind === 'video' && url" :src="url" controls class="preview__media" />
          <audio v-else-if="kind === 'audio' && url" :src="url" controls class="preview__audio" />
          <div v-else-if="kind === 'text'" class="preview__text-wrap">
            <pre class="preview__text" dir="auto">{{ text }}</pre>
            <p v-if="item.size > 1_000_000" class="preview__note">{{ t('drive.preview.textCut') }}</p>
          </div>
        </template>

        <!-- Altered: never "open anyway" -->
        <SgAlert v-else-if="phase === 'altered'" tone="danger" :title="t('drive.preview.alteredTitle')">
          {{ t('drive.preview.altered') }}
          <template #actions>
            <SgButton v-if="item.versions > 1" size="sm" icon="history" @click="(state = null), menu.run('details', [item.id])">{{ t('drive.preview.restoreVersion') }}</SgButton>
          </template>
        </SgAlert>

        <SgAlert v-else-if="phase === 'access'" tone="warning" :title="t('drive.preview.noAccessTitle')">
          {{ t('drive.preview.noAccess', { owner: item.owner.name }) }}
        </SgAlert>

        <SgAlert v-else-if="phase === 'error'" tone="danger">
          {{ errorMessage(failure) }}
          <template #actions>
            <SgButton size="sm" icon="refresh" @click="load">{{ t('common.retry') }}</SgButton>
          </template>
        </SgAlert>

        <!-- Can't be shown in the browser -->
        <div v-else class="preview__none">
          <SgIcon :name="fileIcon(item.type)" :size="40" />
          <p class="preview__name"><bdi>{{ item.name }}</bdi></p>
          <p class="preview__note">{{ t('drive.preview.unsupported') }}</p>
          <SgButton variant="primary" icon="download" @click="menu.run('download', [item.id])">{{ t('drive.action.download') }}</SgButton>
        </div>
      </div>

      <div v-if="state && state.ids.length > 1" class="preview__nav">
        <SgButton size="sm" variant="ghost" icon="arrow-start" :disabled="state.index === 0" :disabled-reason="t('drive.preview.first')" @click="step(-1)">
          {{ t('drive.preview.previous') }}
        </SgButton>
        <span class="preview__count">{{ t('drive.preview.position', { n: state.index + 1, total: state.ids.length }) }}</span>
        <SgButton size="sm" variant="ghost" icon-end="arrow-end" :disabled="state.index === state.ids.length - 1" :disabled-reason="t('drive.preview.last')" @click="step(1)">
          {{ t('drive.preview.next') }}
        </SgButton>
      </div>
    </div>
  </SgDialog>
</template>

<style scoped>
.preview__body {
  display: grid;
  gap: var(--s-4);
}

.preview__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s-2) var(--s-4);
}

.preview__meta {
  font-size: var(--fs-sm);
  color: var(--fg-2);
}

.preview__verified {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--fs-sm);
  color: var(--success);
}

.preview__actions {
  display: flex;
  gap: var(--s-2);
  margin-inline-start: auto;
}

.preview__stage {
  display: grid;
  place-items: center;
  min-height: 360px;
  border: 1px solid var(--rule);
  border-radius: var(--radius-2);
  background: var(--surface-2);
  overflow: hidden;
}

.preview__stage > :deep(.sg-alert) {
  align-self: start;
  width: calc(100% - 2 * var(--s-4));
  margin: var(--s-4);
}

.preview__work {
  width: min(420px, 90%);
  display: grid;
  gap: var(--s-3);
}

.preview__note {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--fg-2);
}

.preview__image {
  max-width: 100%;
  max-height: 65dvh;
  object-fit: contain;
}

.preview__frame {
  width: 100%;
  height: 65dvh;
  border: 0;
  background: var(--surface);
}

.preview__media {
  max-width: 100%;
  max-height: 65dvh;
}

.preview__audio {
  width: min(480px, 90%);
}

.preview__text-wrap {
  align-self: stretch;
  justify-self: stretch;
  display: grid;
  gap: var(--s-2);
  padding: var(--s-4);
}

.preview__text {
  max-height: 60dvh;
  margin: 0;
  overflow: auto;
  font-family: var(--font-mono);
  font-size: var(--fs-sm);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.preview__none {
  display: grid;
  justify-items: center;
  gap: var(--s-3);
  padding: var(--s-6);
  color: var(--fg-2);
  text-align: center;
}

.preview__name {
  margin: 0;
  color: var(--fg);
  font-weight: var(--fw-medium);
}

.preview__nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.preview__count {
  font-size: var(--fs-sm);
  color: var(--fg-2);
}
</style>
