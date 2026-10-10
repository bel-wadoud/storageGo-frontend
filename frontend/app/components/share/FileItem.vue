<script setup lang="ts">
import type { LinkFile, LinkFileState } from '~/composables/useLinkFiles'

// One file of a share link: what it is, and where it stands on this device
// (downloading → decrypting → verified and saved). An altered file can't be saved or
// previewed: there is no "open anyway" (states.md). `featured`: the single file of a file link.
const props = defineProps<{ file: LinkFile; state: LinkFileState; sender: string; featured?: boolean; broken?: boolean }>()
const emit = defineEmits<{ save: []; preview: [] }>()

const { t, locale } = useI18n()
const errorMessage = useErrorMessage()
const online = useOnline()

const type = computed(() => fileType(props.file.name))
const canPreview = computed(() => !props.broken && previewable(props.file.name) !== null)
const busy = computed(() => props.state.phase === 'downloading' || props.state.phase === 'decrypting')
const progress = computed(() => {
  const sizes = { done: formatBytes(props.state.done, locale.value), total: formatBytes(props.state.total, locale.value) }
  return props.state.phase === 'downloading' ? t('receive.file.downloading', sizes) : t('receive.file.decrypting', sizes)
})
</script>

<template>
  <div class="fitem" :class="{ 'fitem--featured': featured, 'is-altered': state.phase === 'altered' }">
    <div class="fitem__head">
      <span class="fitem__icon" aria-hidden="true"><SgIcon :name="fileIcon(type)" :size="featured ? 24 : 18" /></span>
      <div class="fitem__main">
        <p class="fitem__name">
          <span v-if="broken" class="fitem__broken">{{ t('receive.file.unreadable') }}</span>
          <SgFileName v-else :name="file.name" />
        </p>
        <p class="fitem__meta">{{ t(`drive.type.${type}`) }} · {{ formatBytes(file.size, locale) }}</p>
      </div>
      <div class="fitem__actions">
        <SgButton
          v-if="canPreview"
          :size="featured ? 'md' : 'sm'"
          variant="ghost"
          icon="eye"
          :icon-only="!featured"
          :label="t('receive.file.preview')"
          :disabled="busy || state.phase === 'altered' || (!online && state.phase !== 'done')"
          :disabled-reason="state.phase === 'altered' ? t('receive.file.alteredShort') : !online ? t('auth.offlineReason') : t('common.pleaseWait')"
          @click="emit('preview')"
        >
          {{ t('receive.file.preview') }}
        </SgButton>
        <SgButton
          :size="featured ? 'md' : 'sm'"
          :variant="featured ? 'primary' : 'secondary'"
          icon="download"
          :loading="busy"
          :loading-label="state.phase === 'decrypting' ? t('receive.file.decryptingShort') : t('receive.file.downloadingShort')"
          :disabled="broken || state.phase === 'altered' || (!online && state.phase !== 'done')"
          :disabled-reason="broken ? t('receive.file.unreadableShort') : state.phase === 'altered' ? t('receive.file.alteredShort') : t('auth.offlineReason')"
          @click="emit('save')"
        >
          {{ state.saved ? t('receive.file.saveAgain') : t('receive.file.save') }}
        </SgButton>
      </div>
    </div>

    <div v-if="busy" class="fitem__state" aria-live="polite">
      <SgProgress :value="state.done" :max="Math.max(state.total, 1)" :label="progress" show-value />
    </div>
    <p v-else-if="state.phase === 'done'" class="fitem__state fitem__ok" role="status">
      <SgIcon name="check-circle" :size="15" />
      <span>{{ state.saved ? t('receive.file.savedVerified') : t('receive.file.verified') }}<SgInfo term="integrity" /></span>
    </p>
    <SgAlert v-else-if="state.phase === 'altered'" class="fitem__state" tone="danger" :title="t('receive.file.alteredTitle')">
      {{ t('receive.file.altered', { name: sender }) }}
    </SgAlert>
    <SgAlert v-else-if="state.phase === 'failed'" class="fitem__state" tone="danger">
      {{ errorMessage(state.error) }}
      <template #actions>
        <SgButton size="sm" icon="refresh" :disabled="!online" :disabled-reason="t('auth.offlineReason')" @click="emit('save')">{{ t('common.retry') }}</SgButton>
      </template>
    </SgAlert>
  </div>
</template>

<style scoped>
.fitem {
  display: grid;
  gap: var(--s-3);
  min-width: 0;
}

.fitem--featured {
  padding: var(--s-5);
  border: 1px solid var(--rule);
  border-radius: var(--radius-2);
  background: var(--surface);
}

.fitem__head {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  min-width: 0;
}

.fitem__icon {
  display: inline-flex;
  flex: none;
  color: var(--fg-2);
}

.fitem__main {
  flex: 1;
  min-width: 0;
}

.fitem__name,
.fitem__meta {
  margin: 0;
}

.fitem__name {
  overflow: hidden;
  font-weight: var(--fw-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fitem__name :deep(.sg-fname) {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
}

.fitem--featured .fitem__name {
  overflow: visible;
  font-size: var(--fs-lg);
  white-space: normal;
  overflow-wrap: anywhere;
}

.fitem--featured .fitem__name :deep(.sg-fname) {
  overflow: visible;
  white-space: normal;
}

.fitem__broken {
  color: var(--fg-2);
  font-style: italic;
}

.fitem__meta {
  font-size: var(--fs-sm);
  color: var(--fg-2);
}

.fitem__actions {
  display: flex;
  flex: none;
  gap: var(--s-2);
}

.fitem__ok {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--success);
}

/* On a phone, names get two lines instead of being cut: the name is how the file is recognised. */
@media (max-width: 599px) {
  .fitem__name,
  .fitem__name :deep(.sg-fname) {
    display: -webkit-box;
    overflow: hidden;
    white-space: normal;
    overflow-wrap: anywhere;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }
}

/* A featured file on a phone: name on its own line, the buttons below, full width. */
@media (max-width: 599px) {
  .fitem--featured .fitem__head {
    flex-wrap: wrap;
  }

  .fitem--featured .fitem__actions {
    flex-basis: 100%;
  }

  .fitem--featured .fitem__actions > :deep(*) {
    flex: 1;
  }
}
</style>
