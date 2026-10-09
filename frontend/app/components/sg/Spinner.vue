<script setup lang="ts">
// `decorative` is for spinners inside an element that already says what is happening
// (a button showing "Unlocking…"); otherwise the spinner announces itself as a status.
const props = withDefaults(defineProps<{ size?: 'sm' | 'md' | 'lg'; label?: string; showLabel?: boolean; decorative?: boolean }>(), {
  size: 'md',
  label: undefined,
  showLabel: false,
  decorative: false,
})

const { t } = useI18n()
const text = computed(() => props.label ?? t('common.loading'))
</script>

<template>
  <span class="sg-spinner" :class="`sg-spinner--${size}`" :role="decorative ? undefined : 'status'" :aria-hidden="decorative || undefined">
    <svg class="sg-spinner__ring" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <circle class="sg-spinner__track" cx="10" cy="10" r="8" />
      <path class="sg-spinner__arc" d="M10 2a8 8 0 0 1 8 8" />
    </svg>
    <span v-if="!decorative" :class="showLabel ? 'sg-spinner__label' : 'sr-only'">{{ text }}</span>
  </span>
</template>

<style scoped>
.sg-spinner {
  display: inline-flex;
  align-items: center;
  gap: var(--s-2);
  color: currentColor;
}

.sg-spinner__ring {
  fill: none;
  stroke-width: 2.2;
  stroke-linecap: round;
  animation: sg-spin 0.8s linear infinite;
}

.sg-spinner--sm .sg-spinner__ring {
  width: 14px;
  height: 14px;
}

.sg-spinner--md .sg-spinner__ring {
  width: 18px;
  height: 18px;
}

.sg-spinner--lg .sg-spinner__ring {
  width: 28px;
  height: 28px;
}

.sg-spinner__track {
  stroke: currentColor;
  opacity: 0.2;
}

.sg-spinner__arc {
  stroke: currentColor;
}

.sg-spinner__label {
  font-size: var(--fs-sm);
  color: var(--fg-2);
}

@keyframes sg-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
