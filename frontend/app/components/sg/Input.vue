<script setup lang="ts">
defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    type?: 'text' | 'email' | 'password' | 'search' | 'tel' | 'url' | 'date' | 'number'
    placeholder?: string
    autocomplete?: string
    inputmode?: 'text' | 'email' | 'numeric' | 'tel' | 'url' | 'search' | 'none'
    /** Emails, phone numbers and codes stay left-to-right even in Arabic. */
    dir?: 'auto' | 'ltr' | 'rtl'
    size?: 'md' | 'lg'
    disabled?: boolean
    readonly?: boolean
    /** Marks the control invalid when it is not inside an <SgField> with an error. */
    invalid?: boolean
  }>(),
  {
    type: 'text',
    placeholder: undefined,
    autocomplete: undefined,
    inputmode: undefined,
    dir: 'auto',
    size: 'md',
  },
)

const model = defineModel<string>({ default: '' })
// class and style style the box; everything else (name, id, aria-*, listeners…) goes to the <input>.
const attrs = useAttrs()
const inputAttrs = computed(() => {
  const { class: _class, style: _style, ...rest } = attrs
  return rest
})
const field = inject(fieldKey, null)
const el = ref<HTMLInputElement | null>(null)

const isInvalid = computed(() => props.invalid || Boolean(field?.invalid.value))

defineExpose({
  focus: () => el.value?.focus(),
  select: () => el.value?.select(),
  el,
})
</script>

<template>
  <div
    class="sg-input"
    :class="[attrs.class, `sg-input--${size}`, { 'is-invalid': isInvalid, 'is-disabled': disabled }]"
    :style="attrs.style as string | undefined"
  >
    <span v-if="$slots.prefix" class="sg-input__affix"><slot name="prefix" /></span>
    <input
      :id="field?.id"
      ref="el"
      v-model="model"
      v-bind="inputAttrs"
      class="sg-input__control"
      :type="type"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      :inputmode="inputmode"
      :dir="dir === 'auto' && !model ? undefined : dir"
        :disabled="disabled"
      :readonly="readonly"
      :required="field?.required.value || undefined"
      :aria-invalid="isInvalid || undefined"
      :aria-describedby="field?.describedBy.value"
    />
    <span v-if="$slots.suffix" class="sg-input__affix"><slot name="suffix" /></span>
  </div>
</template>

<style scoped>
.sg-input {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  height: var(--control-h);
  padding-block: 0;
  padding-inline: var(--s-3) var(--s-1);
  background: var(--surface);
  border: 1px solid var(--rule-input);
  border-radius: var(--radius-1);
  color: var(--fg-2);
  transition:
    border-color var(--dur-1) var(--ease),
    box-shadow var(--dur-1) var(--ease);
}

.sg-input--lg {
  height: var(--control-h-lg);
}

.sg-input:hover {
  border-color: var(--fg-2);
}

.sg-input:focus-within {
  border-color: var(--signal);
  box-shadow: 0 0 0 1px var(--signal);
}

.sg-input.is-invalid {
  border-color: var(--danger);
}

.sg-input.is-invalid:focus-within {
  box-shadow: 0 0 0 1px var(--danger);
}

.sg-input.is-disabled {
  background: var(--surface-2);
  border-color: var(--rule);
  cursor: not-allowed;
}

.sg-input__control {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 0;
  border: 0;
  background: none;
  color: var(--fg);
  outline: none;
}

.sg-input__control::placeholder {
  color: var(--fg-3);
}

.sg-input__control:disabled {
  cursor: not-allowed;
  color: var(--fg-3);
}

/* Text sits on the page's side in every field, placeholder included: left in French and
   English, right in Arabic, also in fields that are always left-to-right (email, recovery
   words). The text itself keeps its own reading direction (dir="auto" once something is typed).
   (match-parent would say this, but Chrome doesn't apply it inside form fields.) */
.sg-input__control {
  text-align: left;
}

[dir='rtl'] .sg-input__control {
  text-align: right;
}

.sg-input__affix {
  display: inline-flex;
  align-items: center;
  color: var(--fg-2);
}

.sg-input__affix:last-child {
  padding-inline-end: var(--s-1);
}
</style>
