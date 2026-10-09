<script setup lang="ts" generic="T extends string">
import type { IconName } from '~/utils/icons'

// A single choice shown as large options, each with a one-sentence explanation
// (e.g. "Organization" or "Individual"). Native radios underneath: arrow keys, forms
// and screen readers work as usual.
defineProps<{
  legend: string
  options: { value: T; title: string; description?: string; icon?: IconName }[]
  disabled?: boolean
}>()

const model = defineModel<T | null>({ default: null })
const name = useId()
</script>

<template>
  <fieldset class="sg-choice" :disabled="disabled">
    <legend class="sg-choice__legend">{{ legend }}</legend>
    <div class="sg-choice__options">
      <label v-for="option in options" :key="option.value" class="sg-choice__option" :class="{ 'is-checked': model === option.value }">
        <input v-model="model" class="sg-choice__radio" type="radio" :name="name" :value="option.value" />
        <span class="sg-choice__mark" aria-hidden="true" />
        <span class="sg-choice__text">
          <span class="sg-choice__title">
            <SgIcon v-if="option.icon" :name="option.icon" :size="16" />
            {{ option.title }}
          </span>
          <span v-if="option.description" class="sg-choice__desc">{{ option.description }}</span>
        </span>
      </label>
    </div>
  </fieldset>
</template>

<style scoped>
.sg-choice {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.sg-choice__legend {
  margin-bottom: var(--s-2);
  padding: 0;
  font-size: var(--fs-sm);
  font-weight: var(--fw-medium);
  color: var(--fg);
}

.sg-choice__options {
  display: grid;
  gap: var(--s-2);
}

.sg-choice__option {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: var(--s-3);
  padding: var(--s-4);
  border: 1px solid var(--rule-input);
  border-radius: var(--radius-1);
  background: var(--surface);
  cursor: pointer;
  transition:
    border-color var(--dur-1) var(--ease),
    background-color var(--dur-1) var(--ease);
}

.sg-choice__option:hover {
  border-color: var(--fg-2);
}

.sg-choice__option:active {
  background: var(--surface-2);
}

.sg-choice__option.is-checked {
  border-color: var(--signal);
  box-shadow: 0 0 0 1px var(--signal);
}

/* The real radio covers the whole option, invisible, so the native behaviour is kept. */
.sg-choice__radio {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

.sg-choice__option:has(.sg-choice__radio:focus-visible) {
  outline: var(--focus-w) solid var(--signal);
  outline-offset: 2px;
}

.sg-choice__mark {
  flex: none;
  width: 18px;
  height: 18px;
  margin-top: 2px;
  border: 1px solid var(--rule-input);
  border-radius: var(--radius-full);
  background: var(--surface);
  transition:
    border-color var(--dur-1) var(--ease),
    border-width var(--dur-1) var(--ease);
}

.sg-choice__option.is-checked .sg-choice__mark {
  border: 5px solid var(--signal);
}

.sg-choice__text {
  display: grid;
  gap: 2px;
}

.sg-choice__title {
  display: inline-flex;
  align-items: center;
  gap: var(--s-2);
  font-weight: var(--fw-medium);
  color: var(--fg);
}

.sg-choice__desc {
  font-size: var(--fs-sm);
  color: var(--fg-2);
}

.sg-choice:disabled .sg-choice__option {
  background: var(--surface-2);
  border-color: var(--rule);
  cursor: not-allowed;
}

.sg-choice:disabled .sg-choice__title,
.sg-choice:disabled .sg-choice__desc {
  color: var(--fg-3);
}
</style>
