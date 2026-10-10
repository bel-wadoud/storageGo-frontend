<script setup lang="ts">
// A key fingerprint shown the way people compare them: groups of 4, monospace,
// always left to right (also in Arabic), with a copy button.
const props = withDefaults(
  defineProps<{
    /** Hex, with or without spaces. */
    value: string
    label?: string
    copyable?: boolean
  }>(),
  { label: undefined, copyable: true },
)

const { t } = useI18n()
const groups = computed(() => props.value.replace(/\s+/g, '').toUpperCase().match(/.{1,4}/g) ?? [])
const formatted = computed(() => groups.value.join(' '))
const labelId = useId()
</script>

<template>
  <div class="sg-fp">
    <span class="sg-fp__head">
      <span :id="labelId" class="sg-fp__label">{{ label ?? t('fingerprint.label') }}</span>
      <SgInfo term="fingerprint" />
    </span>
    <div class="sg-fp__row">
      <code class="sg-fp__value" dir="ltr" translate="no" :aria-labelledby="labelId">
        <span v-for="(group, i) in groups" :key="i" class="sg-fp__group">{{ group }}</span>
      </code>
      <SgCopyButton v-if="copyable" :value="formatted" icon-only variant="ghost" size="sm" />
    </div>
  </div>
</template>

<style scoped>
.sg-fp {
  display: grid;
  gap: var(--s-1);
}

.sg-fp__head {
  display: flex;
  align-items: center;
  gap: 2px;
}

.sg-fp__label {
  font-size: var(--fs-xs);
  color: var(--fg-2);
}

.sg-fp__row {
  display: flex;
  align-items: center;
  gap: var(--s-2);
}

.sg-fp__value {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25em 0.75em;
  font-family: var(--font-mono);
  font-size: var(--fs-sm);
  letter-spacing: 0.04em;
  color: var(--fg);
  user-select: all;
}
</style>
