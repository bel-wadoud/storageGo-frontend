<script setup lang="ts">
// Attributes like `name`, `id` or `required` go to the real checkbox; class and style stay on the label.
defineOptions({ inheritAttrs: false })

defineProps<{
  label?: string
  /** Smaller explanatory text under the label. */
  description?: string
  disabled?: boolean
  invalid?: boolean
}>()

const model = defineModel<boolean>({ default: false })
const attrs = useAttrs()
const uid = useId()
const id = computed(() => (attrs.id as string | undefined) ?? uid)
const inputAttrs = computed(() => {
  const { class: _class, style: _style, ...rest } = attrs
  return rest
})
</script>

<template>
  <label
    class="sg-check"
    :class="[attrs.class, { 'is-disabled': disabled, 'is-invalid': invalid }]"
    :style="attrs.style as string | undefined"
    :for="id"
  >
    <input
      v-bind="inputAttrs"
      :id="id"
      v-model="model"
      class="sg-check__box"
      type="checkbox"
      :disabled="disabled"
      :aria-invalid="invalid || undefined"
      :aria-describedby="description ? `${id}-desc` : undefined"
    />
    <span class="sg-check__mark" aria-hidden="true"><SgIcon name="check" :size="14" /></span>
    <span class="sg-check__text">
      <span class="sg-check__label"><slot>{{ label }}</slot></span>
      <span v-if="description" :id="`${id}-desc`" class="sg-check__desc">{{ description }}</span>
    </span>
  </label>
</template>

<style scoped>
.sg-check {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: var(--s-3);
  font-size: var(--fs-sm);
  cursor: pointer;
}

/* The real checkbox stays in place (for keyboard, forms and screen readers) but invisible. */
.sg-check__box {
  position: absolute;
  inset-inline-start: 0;
  top: 2px;
  width: 18px;
  height: 18px;
  margin: 0;
  opacity: 0;
  cursor: inherit;
}

.sg-check__mark {
  display: grid;
  flex: none;
  place-items: center;
  width: 18px;
  height: 18px;
  margin-top: 2px;
  border: 1px solid var(--rule-input);
  border-radius: var(--radius-1);
  background: var(--surface);
  color: transparent;
  transition:
    background var(--dur-1) var(--ease),
    border-color var(--dur-1) var(--ease),
    color var(--dur-1) var(--ease);
}

.sg-check:hover .sg-check__mark {
  border-color: var(--fg-2);
}

.sg-check__box:checked + .sg-check__mark {
  background: var(--signal);
  border-color: var(--signal);
  color: var(--signal-ink);
}

.sg-check__box:focus-visible + .sg-check__mark {
  outline: var(--focus-w) solid var(--signal);
  outline-offset: 2px;
}

.sg-check:active .sg-check__mark {
  transform: scale(0.94);
}

.sg-check.is-invalid .sg-check__mark {
  border-color: var(--danger);
}

.sg-check.is-disabled {
  color: var(--fg-3);
  cursor: not-allowed;
}

.sg-check.is-disabled .sg-check__mark {
  background: var(--surface-2);
  border-color: var(--rule);
}

.sg-check__text {
  display: grid;
  gap: 2px;
}

.sg-check__desc {
  font-size: var(--fs-xs);
  color: var(--fg-2);
}
</style>
