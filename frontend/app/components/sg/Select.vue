<script setup lang="ts">
// A styled native <select>: the phone's own picker on mobile, full keyboard support everywhere.
defineOptions({ inheritAttrs: false })

withDefaults(
  defineProps<{
    options: { value: string; label: string }[]
    /** Shown as a first, unselectable option while nothing is chosen. */
    placeholder?: string
    disabled?: boolean
    invalid?: boolean
  }>(),
  { placeholder: undefined },
)

const model = defineModel<string>({ default: '' })
const field = inject(fieldKey, null)
const attrs = useAttrs()
const selectAttrs = computed(() => {
  const { class: _class, style: _style, ...rest } = attrs
  return rest
})
</script>

<template>
  <div
    class="sg-select"
    :class="[attrs.class, { 'is-invalid': invalid || field?.invalid.value, 'is-disabled': disabled, 'is-empty': !model }]"
    :style="attrs.style as string | undefined"
  >
    <select
      v-bind="selectAttrs"
      :id="field?.id"
      v-model="model"
      class="sg-select__control"
      :disabled="disabled"
      :required="field?.required.value || undefined"
      :aria-invalid="invalid || field?.invalid.value || undefined"
      :aria-describedby="field?.describedBy.value"
    >
      <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
      <option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option>
    </select>
    <SgIcon class="sg-select__chevron" name="chevron-down" :size="16" />
  </div>
</template>

<style scoped>
.sg-select {
  position: relative;
  display: flex;
  align-items: center;
  height: var(--control-h);
  border: 1px solid var(--rule-input);
  border-radius: var(--radius-1);
  background: var(--surface);
  transition:
    border-color var(--dur-1) var(--ease),
    box-shadow var(--dur-1) var(--ease);
}

.sg-select:hover {
  border-color: var(--fg-2);
}

.sg-select:focus-within {
  border-color: var(--signal);
  box-shadow: 0 0 0 1px var(--signal);
}

.sg-select.is-invalid {
  border-color: var(--danger);
}

.sg-select.is-disabled {
  background: var(--surface-2);
  border-color: var(--rule);
}

.sg-select__control {
  width: 100%;
  height: 100%;
  padding-block: 0;
  padding-inline: var(--s-3) calc(var(--s-3) + 20px);
  border: 0;
  background: none;
  color: var(--fg);
  font: inherit;
  appearance: none;
  outline: none;
  cursor: pointer;
}

.sg-select.is-empty .sg-select__control {
  color: var(--fg-3);
}

.sg-select__control:disabled {
  color: var(--fg-3);
  cursor: not-allowed;
}

.sg-select__control option {
  color: var(--fg);
  background: var(--surface);
}

.sg-select__chevron {
  position: absolute;
  inset-inline-end: var(--s-3);
  color: var(--fg-2);
  pointer-events: none;
}
</style>
