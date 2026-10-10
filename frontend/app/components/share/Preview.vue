<script setup lang="ts">
import type { LinkFile, LinkFileState } from '~/composables/useLinkFiles'

// A shared file shown in the page, decrypted on this device. Same rules as the drive preview:
// progress while it downloads and decrypts, "Integrity verified" once shown, and an altered
// file is a blocking error.
const props = defineProps<{
  file: LinkFile
  state: LinkFileState
  sender: string
  open: (file: LinkFile) => Promise<Blob>
}>()
const emit = defineEmits<{ save: [] }>()
const visible = defineModel<boolean>('visible', { required: true })

const { t, locale } = useI18n()
const errorMessage = useErrorMessage()
const kind = computed(() => previewable(props.file.name))
const url = ref<string | null>(null)
const text = ref('')
const failed = shallowRef<unknown>(null)

async function load() {
  failed.value = null
  try {
    const blob = await props.open(props.file)
    if (kind.value === 'text') text.value = await blob.slice(0, 1_000_000).text()
    else url.value = URL.createObjectURL(new Blob([blob], { type: mimeFor(props.file.name) }))
  } catch (error) {
    failed.value = error
  }
}

watch(visible, (value) => value && load(), { immediate: true })
onBeforeUnmount(() => url.value && URL.revokeObjectURL(url.value))

const busy = computed(() => props.state.phase === 'downloading' || props.state.phase === 'decrypting')
const progress = computed(() => {
  const sizes = { done: formatBytes(props.state.done, locale.value), total: formatBytes(props.state.total, locale.value) }
  return props.state.phase === 'downloading' ? t('receive.file.downloading', sizes) : t('receive.file.decrypting', sizes)
})
const shown = computed(() => props.state.phase === 'done' && (url.value || text.value))
</script>

<template>
  <SgDialog v-model:open="visible" :title="file.name" size="lg">
    <div class="spv">
      <div class="spv__bar">
        <span class="spv__meta">{{ t(`drive.type.${fileType(file.name)}`) }} · {{ formatBytes(file.size, locale) }}</span>
        <span v-if="shown" class="spv__verified"><SgIcon name="check-circle" :size="15" />{{ t('receive.file.verified') }}</span>
        <SgButton
          class="spv__save"
          size="sm"
          icon="download"
          :disabled="state.phase === 'altered' || busy"
          :disabled-reason="state.phase === 'altered' ? t('receive.file.alteredShort') : t('common.pleaseWait')"
          @click="emit('save')"
        >
          {{ t('receive.file.save') }}
        </SgButton>
      </div>

      <div class="spv__stage">
        <div v-if="busy || (!shown && !failed && state.phase !== 'altered')" class="spv__work" aria-live="polite">
          <SgProgress :value="busy ? state.done : null" :max="Math.max(state.total, 1)" :label="busy ? progress : t('common.loading')" :show-value="busy" />
          <p class="spv__note"><SgIcon name="lock" :size="14" />{{ t('receive.file.onDevice') }}</p>
        </div>
        <template v-else-if="shown">
          <img v-if="kind === 'image' && url" :src="url" :alt="file.name" class="spv__image" />
          <iframe v-else-if="kind === 'pdf' && url" :src="url" :title="file.name" class="spv__frame" />
          <video v-else-if="kind === 'video' && url" :src="url" controls class="spv__media" />
          <audio v-else-if="kind === 'audio' && url" :src="url" controls />
          <div v-else-if="kind === 'text'" class="spv__text-wrap">
            <pre class="spv__text" dir="auto">{{ text }}</pre>
            <p v-if="file.size > 1_000_000" class="spv__note">{{ t('drive.preview.textCut') }}</p>
          </div>
        </template>
        <SgAlert v-else-if="state.phase === 'altered'" tone="danger" :title="t('receive.file.alteredTitle')">
          {{ t('receive.file.altered', { name: sender }) }}
        </SgAlert>
        <SgAlert v-else tone="danger">
          {{ errorMessage(failed) }}
          <template #actions><SgButton size="sm" icon="refresh" @click="load">{{ t('common.retry') }}</SgButton></template>
        </SgAlert>
      </div>
    </div>
  </SgDialog>
</template>

<style scoped>
.spv {
  display: grid;
  gap: var(--s-4);
}

.spv__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s-2) var(--s-4);
  font-size: var(--fs-sm);
  color: var(--fg-2);
}

.spv__verified {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--success);
}

.spv__save {
  margin-inline-start: auto;
}

.spv__stage {
  display: grid;
  place-items: center;
  min-height: 280px;
}

.spv__work {
  display: grid;
  gap: var(--s-3);
  width: min(100%, 420px);
}

.spv__note {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: var(--fs-xs);
  color: var(--fg-2);
}

.spv__image,
.spv__media {
  max-width: 100%;
  max-height: 65vh;
  border-radius: var(--radius-1);
}

.spv__frame {
  width: 100%;
  height: 65vh;
  border: 1px solid var(--rule);
  border-radius: var(--radius-1);
  background: #fff;
}

.spv__text-wrap {
  width: 100%;
}

.spv__text {
  max-height: 60vh;
  margin: 0;
  padding: var(--s-4);
  overflow: auto;
  border: 1px solid var(--rule);
  border-radius: var(--radius-1);
  background: var(--surface-2);
  font-family: var(--font-mono);
  font-size: var(--fs-sm);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
