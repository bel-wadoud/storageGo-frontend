<script setup lang="ts">
import type { IconName } from '~/utils/icons'

const props = withDefaults(defineProps<{ name: IconName; size?: number }>(), { size: 18 })

const mirrored = computed(() => directionalIcons.has(props.name))
</script>

<template>
  <svg
    class="sg-icon"
    :class="{ 'sg-icon--dir': mirrored }"
    :width="size"
    :height="size"
    viewBox="0 0 20 20"
    aria-hidden="true"
    focusable="false"
  >
    <path :d="icons[name]" />
  </svg>
</template>

<style scoped>
.sg-icon {
  flex: none;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

[dir='rtl'] .sg-icon--dir {
  transform: scaleX(-1);
}
</style>
