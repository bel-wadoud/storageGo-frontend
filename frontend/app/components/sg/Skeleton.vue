<script setup lang="ts">
// Placeholder shaped like the content that is loading. The container that is loading
// should carry aria-busy="true"; skeletons themselves are hidden from screen readers.
withDefaults(
  defineProps<{
    variant?: 'text' | 'block' | 'circle'
    width?: string
    height?: string
    /** Number of text lines (the last one is shorter, like real text). */
    lines?: number
  }>(),
  { variant: 'text', width: undefined, height: undefined, lines: 1 },
)
</script>

<template>
  <span v-if="variant === 'text'" class="sg-skel-lines" aria-hidden="true">
    <span
      v-for="n in lines"
      :key="n"
      class="sg-skel sg-skel--text"
      :style="{ width: n === lines && lines > 1 ? '60%' : (width ?? '100%') }"
    />
  </span>
  <span
    v-else
    class="sg-skel"
    :class="`sg-skel--${variant}`"
    :style="{ width: width ?? (variant === 'circle' ? '32px' : '100%'), height: height ?? (variant === 'circle' ? '32px' : '48px') }"
    aria-hidden="true"
  />
</template>

<style scoped>
.sg-skel-lines {
  display: grid;
  gap: 8px;
  width: 100%;
}

.sg-skel {
  display: block;
  background: var(--surface-3);
  border-radius: var(--radius-1);
  /* A slow, gentle pulse (no shimmer): it reads as "loading", not as decoration. */
  animation: sg-skel-pulse 1.6s ease-in-out infinite;
}

.sg-skel--text {
  height: 0.8em;
}

.sg-skel--circle {
  border-radius: var(--radius-full);
}

@keyframes sg-skel-pulse {
  50% {
    opacity: 0.55;
  }
}
</style>
