<script setup lang="ts">
import type { IconName } from '~/utils/icons'

// System / Light / Dark, as a small dropdown. "System" follows the device and is the default;
// another choice is remembered in the sg_theme cookie. The trigger shows the current choice.
type Preference = 'system' | 'light' | 'dark'

const colorMode = useColorMode()
const { t } = useI18n()

const icons: Record<Preference, IconName> = { system: 'monitor', light: 'sun', dark: 'moon' }
const preference = computed(() => colorMode.preference as Preference)
const options = computed(() =>
  (['system', 'light', 'dark'] as const).map((value) => ({ value, label: t(`theme.${value}`), icon: icons[value] })),
)
</script>

<template>
  <SgMenu
    :label="t('theme.label')"
    :options="options"
    :model-value="preference"
    :icon="icons[preference] ?? 'monitor'"
    @select="(value) => (colorMode.preference = value)"
  />
</template>
