<script setup lang="ts">
// Copies `value` to the clipboard and says so: the label turns into "Copied" (or
// "Couldn't copy") for two seconds, and the result is announced to screen readers.
const props = withDefaults(
  defineProps<{
    value: string
    label?: string
    iconOnly?: boolean
    variant?: 'primary' | 'secondary' | 'ghost'
    size?: 'sm' | 'md' | 'lg'
  }>(),
  { label: undefined, variant: 'secondary', size: 'md' },
)

const emit = defineEmits<{ copied: []; failed: [] }>()
const { t } = useI18n()
const state = ref<'idle' | 'copied' | 'failed'>('idle')
let reset: ReturnType<typeof setTimeout> | undefined

const text = computed(() => {
  if (state.value === 'copied') return t('common.copied')
  if (state.value === 'failed') return t('common.copyFailed')
  return props.label ?? t('common.copy')
})
const icon = computed(() => (state.value === 'copied' ? 'check' : state.value === 'failed' ? 'alert' : 'copy'))

async function write(value: string) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(value)
    return
  }
  // Old browsers and plain-http dev hosts: fall back to a hidden textarea.
  const area = document.createElement('textarea')
  area.value = value
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  const ok = document.execCommand('copy')
  area.remove()
  if (!ok) throw new Error('copy failed')
}

async function copy() {
  clearTimeout(reset)
  try {
    await write(props.value)
    state.value = 'copied'
    emit('copied')
  } catch {
    state.value = 'failed'
    emit('failed')
  }
  reset = setTimeout(() => (state.value = 'idle'), 2000)
}

onBeforeUnmount(() => clearTimeout(reset))
</script>

<template>
  <span class="sg-copy-wrap">
    <SgButton
      class="sg-copy"
      :class="`is-${state}`"
      :variant="variant"
      :size="size"
      :icon="icon"
      :icon-only="iconOnly"
      :label="text"
      @click="copy"
    >
      {{ text }}
    </SgButton>
    <span class="sr-only" aria-live="polite">{{ state === 'idle' ? '' : text }}</span>
  </span>
</template>

<style scoped>
.sg-copy-wrap {
  display: inline-flex;
}

.sg-copy.is-copied :deep(.sg-icon) {
  color: var(--success);
}

.sg-copy.is-failed :deep(.sg-icon) {
  color: var(--danger);
}
</style>
