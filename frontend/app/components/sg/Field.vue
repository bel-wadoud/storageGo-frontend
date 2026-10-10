<script setup lang="ts">
const props = defineProps<{
  label: string
  hint?: string
  /** Shown inline under the control; also marks the control as invalid. */
  error?: string
  required?: boolean
  /** Adds "(optional)" after the label. */
  optional?: boolean
  /** A circled "i" after the label, explaining a hard word (glossary key, see SgInfo). */
  info?: string
}>()

const { t } = useI18n()
const id = useId()
const hintId = `${id}-hint`
const errorId = `${id}-error`

const describedBy = computed(() => [props.hint ? hintId : '', props.error ? errorId : ''].filter(Boolean).join(' ') || undefined)

provide(fieldKey, {
  id,
  describedBy,
  invalid: computed(() => Boolean(props.error)),
  required: computed(() => Boolean(props.required)),
})
</script>

<template>
  <div class="sg-field" :class="{ 'is-invalid': error }">
    <div class="sg-field__head">
      <label class="sg-field__label" :for="id">
        {{ label }}
        <span v-if="optional" class="sg-field__optional">({{ t('common.optional') }})</span>
      </label>
      <SgInfo v-if="info" :term="info" />
    </div>
    <slot />
    <p v-if="hint" :id="hintId" class="sg-field__hint">{{ hint }}</p>
    <!-- Always rendered so screen readers announce errors as they appear. -->
    <p :id="errorId" class="sg-field__error" aria-live="polite">
      <template v-if="error">
        <SgIcon name="alert" :size="14" />
        <span>{{ error }}</span>
      </template>
    </p>
  </div>
</template>

<style scoped>
.sg-field__head {
  display: flex;
  align-items: center;
  gap: var(--s-1);
  margin-bottom: var(--s-2);
}

.sg-field__label {
  display: block;
  font-size: var(--fs-sm);
  font-weight: var(--fw-regular);
}

.sg-field__optional {
  color: var(--fg-2);
  font-weight: var(--fw-light);
}

.sg-field__hint {
  margin: var(--s-2) 0 0;
  font-size: var(--fs-xs);
  color: var(--fg-2);
}

/* Empty but present (and 0 px tall), so the live region is ready before an error appears. */
.sg-field__error {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: var(--fs-xs);
  color: var(--danger);
}

.sg-field__error:not(:empty) {
  margin-top: 6px;
}
</style>
