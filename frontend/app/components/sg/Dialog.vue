<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    title: string
    description?: string
    /** While true (an action is running), the dialog can't be closed: Esc, backdrop and × are blocked. */
    busy?: boolean
    size?: 'sm' | 'md' | 'lg'
  }>(),
  { description: undefined, size: 'md' },
)

const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const el = ref<HTMLDialogElement | null>(null)
const titleId = useId()
const descId = useId()

function sync(value: boolean) {
  const dialog = el.value
  if (!dialog) return
  if (value && !dialog.open) dialog.showModal()
  if (!value && dialog.open) dialog.close()
  // Stop the page behind from scrolling while the dialog is open.
  document.documentElement.style.overflow = value ? 'hidden' : ''
}

function requestClose() {
  if (!props.busy) open.value = false
}

function onCancel(event: Event) {
  // Esc key: the browser would close the dialog itself; we decide instead.
  event.preventDefault()
  requestClose()
}

function onBackdropClick(event: MouseEvent) {
  if (event.target === el.value) requestClose()
}

watch(open, sync, { flush: 'post' })
onMounted(() => sync(open.value))
onBeforeUnmount(() => {
  document.documentElement.style.overflow = ''
})
</script>

<template>
  <dialog
    ref="el"
    class="sg-dialog"
    :class="`sg-dialog--${size}`"
    :aria-labelledby="titleId"
    :aria-describedby="description ? descId : undefined"
    :aria-busy="busy || undefined"
    @cancel="onCancel"
    @close="open = false"
    @click="onBackdropClick"
  >
    <div class="sg-dialog__panel">
      <header class="sg-dialog__header">
        <div>
          <h2 :id="titleId" class="sg-dialog__title">{{ title }}</h2>
          <p v-if="description" :id="descId" class="sg-dialog__desc">{{ description }}</p>
        </div>
        <SgButton
          variant="ghost"
          size="sm"
          icon-only
          icon="x"
          :label="t('common.close')"
          :disabled="busy"
          :disabled-reason="t('common.pleaseWait')"
          @click="requestClose"
        />
      </header>
      <div class="sg-dialog__body"><slot /></div>
      <footer v-if="$slots.footer" class="sg-dialog__footer"><slot name="footer" /></footer>
    </div>
  </dialog>
</template>

<style scoped>
.sg-dialog {
  width: min(520px, calc(100vw - 2 * var(--s-4)));
  max-height: calc(100dvh - 2 * var(--s-6));
  padding: 0;
  border: 1px solid var(--rule);
  border-radius: var(--radius-2);
  background: var(--surface);
  color: var(--fg);
  box-shadow: var(--shadow-pop);
  overflow: auto;
}

.sg-dialog--sm {
  width: min(400px, calc(100vw - 2 * var(--s-4)));
}

.sg-dialog--lg {
  width: min(720px, calc(100vw - 2 * var(--s-4)));
}

.sg-dialog::backdrop {
  background: var(--scrim);
}

.sg-dialog[open] {
  animation: sg-dialog-in var(--dur-2) var(--ease);
}

.sg-dialog__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--s-4);
  padding: var(--s-5) var(--s-6) var(--s-3);
}

.sg-dialog__title {
  margin: 0;
  font-size: var(--fs-lg);
  font-weight: var(--fw-medium);
  line-height: var(--lh-tight);
}

.sg-dialog__desc {
  margin: var(--s-2) 0 0;
  font-size: var(--fs-sm);
  color: var(--fg-2);
}

.sg-dialog__body {
  padding: var(--s-3) var(--s-6) var(--s-6);
}

.sg-dialog__footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--s-3);
  padding: var(--s-4) var(--s-6) var(--s-5);
  border-top: 1px solid var(--rule);
}

@keyframes sg-dialog-in {
  from {
    opacity: 0;
    transform: translateY(6px) scale(0.98);
  }
}
</style>
