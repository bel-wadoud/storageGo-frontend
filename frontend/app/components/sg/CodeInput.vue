<script setup lang="ts">
// A one-time code (e.g. the 6-digit email verification code): one box per digit,
// auto-advance, backspace goes back, and pasting the whole code fills every box.
const props = withDefaults(defineProps<{ length?: number; disabled?: boolean; invalid?: boolean }>(), { length: 6 })

const emit = defineEmits<{ complete: [code: string] }>()
const model = defineModel<string>({ default: '' })
const { t } = useI18n()
const field = inject(fieldKey, null)
const inputs = ref<HTMLInputElement[]>([])

const digits = computed(() => Array.from({ length: props.length }, (_, i) => model.value[i] ?? ''))
const isInvalid = computed(() => props.invalid || Boolean(field?.invalid.value))

function setDigits(values: string[]) {
  const code = values.join('').replace(/\D/g, '').slice(0, props.length)
  model.value = code
  if (code.length === props.length) emit('complete', code)
}

function focusBox(index: number) {
  const box = inputs.value[Math.max(0, Math.min(index, props.length - 1))]
  box?.focus()
  box?.select()
}

function onInput(index: number, event: Event) {
  const target = event.target as HTMLInputElement
  const typed = target.value.replace(/\D/g, '')
  const values = [...digits.value]
  if (typed.length > 1) {
    // Autofill or a fast typist: spread the digits from this box onwards.
    typed.split('').forEach((d, offset) => {
      if (index + offset < props.length) values[index + offset] = d
    })
    setDigits(values)
    focusBox(index + typed.length)
    return
  }
  values[index] = typed
  setDigits(values)
  target.value = typed
  if (typed) focusBox(index + 1)
}

function onKeydown(index: number, event: KeyboardEvent) {
  // The boxes are always laid out left to right (digits), so arrows never flip in Arabic.
  const forward = 'ArrowRight'
  const backward = 'ArrowLeft'
  if (event.key === 'Backspace' && !digits.value[index] && index > 0) {
    event.preventDefault()
    const values = [...digits.value]
    values[index - 1] = ''
    setDigits(values)
    focusBox(index - 1)
  } else if (event.key === backward) {
    event.preventDefault()
    focusBox(index - 1)
  } else if (event.key === forward) {
    event.preventDefault()
    focusBox(index + 1)
  }
}

function onPaste(event: ClipboardEvent) {
  const pasted = event.clipboardData?.getData('text') ?? ''
  if (!pasted) return
  event.preventDefault()
  setDigits(pasted.split(''))
  focusBox(Math.min(pasted.replace(/\D/g, '').length, props.length - 1))
}
</script>

<template>
  <div
    class="sg-code"
    :class="{ 'is-invalid': isInvalid }"
    role="group"
    :aria-label="t('code.label')"
    :aria-describedby="field?.describedBy.value"
    dir="ltr"
  >
    <input
      v-for="(digit, i) in digits"
      :id="i === 0 ? field?.id : undefined"
      :key="i"
      ref="inputs"
      class="sg-code__box"
      :value="digit"
      type="text"
      inputmode="numeric"
      :autocomplete="i === 0 ? 'one-time-code' : 'off'"
      :disabled="disabled"
      :aria-label="t('code.digit', { n: i + 1, total: length })"
      :aria-invalid="isInvalid || undefined"
      @input="onInput(i, $event)"
      @keydown="onKeydown(i, $event)"
      @paste="onPaste"
      @focus="($event.target as HTMLInputElement).select()"
    />
  </div>
</template>

<style scoped>
.sg-code {
  display: flex;
  gap: var(--s-2);
}

.sg-code__box {
  width: 44px;
  height: var(--control-h-lg);
  padding: 0;
  border: 1px solid var(--rule-input);
  border-radius: var(--radius-1);
  background: var(--surface);
  color: var(--fg);
  font-family: var(--font-mono);
  font-size: var(--fs-xl);
  text-align: center;
  caret-color: var(--signal);
  transition:
    border-color var(--dur-1) var(--ease),
    box-shadow var(--dur-1) var(--ease);
}

.sg-code__box:hover {
  border-color: var(--fg-2);
}

.sg-code__box:focus {
  outline: none;
  border-color: var(--signal);
  box-shadow: 0 0 0 1px var(--signal);
}

.sg-code.is-invalid .sg-code__box {
  border-color: var(--danger);
}

.sg-code__box:disabled {
  background: var(--surface-2);
  color: var(--fg-3);
  cursor: not-allowed;
}

@media (max-width: 380px) {
  .sg-code__box {
    width: 38px;
  }
}
</style>
