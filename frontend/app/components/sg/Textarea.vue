<script setup lang="ts">
// Multi-line text, wired to <SgField> like <SgInput>. Grows with its content up to `maxRows`.
defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    rows?: number
    maxRows?: number
    placeholder?: string
    dir?: 'ltr' | 'rtl' | 'auto'
    disabled?: boolean
    invalid?: boolean
  }>(),
  { rows: 3, maxRows: 10, placeholder: undefined, dir: 'auto' },
)

const model = defineModel<string>({ default: '' })
const field = inject(fieldKey, null)
const attrs = useAttrs()
const el = ref<HTMLTextAreaElement | null>(null)

function fit() {
  const area = el.value
  if (!area) return
  const line = Number.parseFloat(getComputedStyle(area).lineHeight) || 20
  area.style.height = 'auto'
  area.style.height = `${Math.min(area.scrollHeight + 2, line * props.maxRows + 16)}px`
}

watch(model, () => nextTick(fit))
onMounted(fit)
defineExpose({ focus: () => el.value?.focus(), el })
</script>

<template>
  <textarea
    v-bind="attrs"
    :id="field?.id"
    ref="el"
    v-model="model"
    class="sg-textarea"
    :class="{ 'is-invalid': invalid || field?.invalid.value }"
    :rows="rows"
    :placeholder="placeholder"
    :dir="dir === 'auto' && !model ? undefined : dir"
    :data-auto-dir="dir === 'auto' || undefined"
    :disabled="disabled"
    :required="field?.required.value || undefined"
    :aria-invalid="invalid || field?.invalid.value || undefined"
    :aria-describedby="field?.describedBy.value"
  />
</template>

<style scoped>
.sg-textarea {
  display: block;
  width: 100%;
  min-height: calc(var(--control-h) * 2);
  padding: var(--s-2) var(--s-3);
  border: 1px solid var(--rule-input);
  border-radius: var(--radius-1);
  background: var(--surface);
  color: var(--fg);
  font: inherit;
  line-height: var(--lh-ui);
  resize: vertical;
  outline: none;
  transition:
    border-color var(--dur-1) var(--ease),
    box-shadow var(--dur-1) var(--ease);
}

.sg-textarea:hover {
  border-color: var(--fg-2);
}

.sg-textarea:focus {
  border-color: var(--signal);
  box-shadow: 0 0 0 1px var(--signal);
}

.sg-textarea.is-invalid {
  border-color: var(--danger);
}

.sg-textarea::placeholder {
  color: var(--fg-3);
}

/* See SgInput: empty follows the page's direction; typed text keeps its own, page-aligned. */
.sg-textarea[data-auto-dir] {
  text-align: left;
}

[dir='rtl'] .sg-textarea[data-auto-dir] {
  text-align: right;
}

.sg-textarea:disabled {
  background: var(--surface-2);
  border-color: var(--rule);
  color: var(--fg-3);
  cursor: not-allowed;
}
</style>
