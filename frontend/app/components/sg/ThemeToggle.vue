<script setup lang="ts">
import type { IconName } from '~/utils/icons'

// System / Light / Dark. "System" follows the device and is the default; picking
// another one is remembered in the sg_theme cookie.
const colorMode = useColorMode()
const { t } = useI18n()

const options: { value: 'system' | 'light' | 'dark'; icon: IconName }[] = [
  { value: 'system', icon: 'monitor' },
  { value: 'light', icon: 'sun' },
  { value: 'dark', icon: 'moon' },
]
</script>

<template>
  <div class="sg-seg" role="group" :aria-label="t('theme.label')">
    <SgButton
      v-for="option in options"
      :key="option.value"
      variant="ghost"
      size="sm"
      icon-only
      :icon="option.icon"
      :label="t(`theme.${option.value}`)"
      :pressed="colorMode.preference === option.value"
      @click="colorMode.preference = option.value"
    />
  </div>
</template>

<style scoped>
.sg-seg {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--rule);
  border-radius: var(--radius-2);
  background: var(--surface);
}

.sg-seg :deep(.sg-btn[aria-pressed='true']) {
  background: var(--surface-3);
  color: var(--fg);
}
</style>
