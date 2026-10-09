<script setup lang="ts">
// Initials in a circle. Decorative: the name is always written next to it.
const props = withDefaults(defineProps<{ name: string; size?: number }>(), { size: 32 })

const initials = computed(() => {
  const words = props.name.trim().split(/\s+/).filter(Boolean)
  return words
    .slice(0, 2)
    .map((word) => [...word][0] ?? '')
    .join('')
    .toUpperCase()
})
</script>

<template>
  <span class="sg-avatar" :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.38)}px` }" aria-hidden="true">
    {{ initials }}
  </span>
</template>

<style scoped>
.sg-avatar {
  display: inline-grid;
  place-items: center;
  flex: none;
  border-radius: var(--radius-full);
  background: var(--surface-3);
  color: var(--fg);
  font-weight: var(--fw-medium);
  letter-spacing: 0;
}
</style>
