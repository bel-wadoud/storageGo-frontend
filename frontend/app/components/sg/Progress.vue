<script setup lang="ts">
// Determinate when `value` is a number, indeterminate (moving bar) when it is null.
const props = withDefaults(
  defineProps<{
    value?: number | null
    max?: number
    /** Visible text above the bar, e.g. "Encrypting on this device". */
    label?: string
    /** Show the percentage next to the label. */
    showValue?: boolean
    tone?: 'signal' | 'neutral' | 'success' | 'danger'
  }>(),
  { value: null, max: 100, label: undefined, showValue: false, tone: 'signal' },
)

const { locale } = useI18n()
const id = useId()

const ratio = computed(() => (props.value === null ? null : Math.min(Math.max(props.value / props.max, 0), 1)))
const percentText = computed(() =>
  ratio.value === null ? '' : new Intl.NumberFormat(locale.value, { style: 'percent', maximumFractionDigits: 0 }).format(ratio.value),
)
</script>

<template>
  <div class="sg-progress" :class="`sg-progress--${tone}`">
    <div v-if="label || showValue" class="sg-progress__head">
      <span v-if="label" :id="`${id}-label`">{{ label }}</span>
      <span v-if="showValue && ratio !== null" class="sg-progress__value">{{ percentText }}</span>
    </div>
    <div
      class="sg-progress__track"
      role="progressbar"
      :aria-labelledby="label ? `${id}-label` : undefined"
      aria-valuemin="0"
      :aria-valuemax="max"
      :aria-valuenow="value ?? undefined"
      :aria-valuetext="ratio === null ? undefined : percentText"
    >
      <i class="sg-progress__bar" :class="{ 'is-indeterminate': ratio === null }" :style="ratio === null ? undefined : { width: `${ratio * 100}%` }" />
    </div>
  </div>
</template>

<style scoped>
.sg-progress {
  display: grid;
  gap: 6px;
}

.sg-progress__head {
  display: flex;
  justify-content: space-between;
  gap: var(--s-3);
  font-size: var(--fs-xs);
  color: var(--fg-2);
}

.sg-progress__value {
  font-variant-numeric: tabular-nums;
}

.sg-progress__track {
  position: relative;
  height: 4px;
  overflow: hidden;
  border-radius: 2px;
  background: var(--surface-3);
}

.sg-progress__bar {
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  display: block;
  border-radius: 2px;
  background: var(--signal);
  transition: width var(--dur-2) var(--ease);
}

.sg-progress--neutral .sg-progress__bar {
  background: var(--fg);
}

.sg-progress--success .sg-progress__bar {
  background: var(--success);
}

.sg-progress--danger .sg-progress__bar {
  background: var(--danger);
}

.sg-progress__bar.is-indeterminate {
  width: 35%;
  animation: sg-progress-slide 1.2s var(--ease) infinite;
}

[dir='rtl'] .sg-progress__bar.is-indeterminate {
  animation-name: sg-progress-slide-rtl;
}

@keyframes sg-progress-slide {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(300%);
  }
}

@keyframes sg-progress-slide-rtl {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(-300%);
  }
}

/* Without motion, an indeterminate bar is a static half bar plus its label: still visible feedback. */
@media (prefers-reduced-motion: reduce) {
  .sg-progress__bar.is-indeterminate {
    width: 50%;
    transform: none;
    opacity: 0.6;
  }
}
</style>
