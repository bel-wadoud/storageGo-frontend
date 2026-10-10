<script setup lang="ts">
import type { IconName } from '~/utils/icons'

// A small non-modal panel attached to a button (account, notifications). Rendered at the end
// of <body> with fixed positioning. Esc or a click outside closes it and focus returns to the
// button. Unlike a menu, it can hold any content (links, a list, preferences).
// Two roots (trigger + teleported panel): attributes like class go to the trigger's wrapper.
defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    label: string
    icon: IconName
    /** Visible trigger text; icon-only when absent. */
    text?: string
    /** Small count on the trigger (e.g. unread notifications). */
    badge?: number
    /** Accessible name while the badge shows, e.g. "Account: 1 reminder". Defaults to "label (n)". */
    badgeLabel?: string
    width?: number
  }>(),
  { text: undefined, badge: 0, badgeLabel: undefined, width: 320 },
)

const emit = defineEmits<{ open: []; close: [] }>()

const open = ref(false)
const trigger = ref<{ $el: HTMLElement } | null>(null)
const panel = ref<HTMLElement | null>(null)
const position = ref({ top: 0, left: 0 })
const panelId = useId()

function place() {
  const rect = trigger.value?.$el.getBoundingClientRect()
  if (!rect) return
  const rtl = document.documentElement.dir === 'rtl'
  const width = Math.min(props.width, window.innerWidth - 16)
  let left = rtl ? rect.left : rect.right - width
  left = Math.min(Math.max(8, left), window.innerWidth - width - 8)
  position.value = { top: rect.bottom + 6, left }
}

async function show() {
  open.value = true
  emit('open')
  await nextTick()
  place()
  panel.value?.querySelector<HTMLElement>('a[href], button:not([aria-disabled="true"]), input, [tabindex="0"]')?.focus()
}

function close(returnFocus = true) {
  if (!open.value) return
  open.value = false
  emit('close')
  if (returnFocus) trigger.value?.$el.focus()
}

function onPointerDown(event: PointerEvent) {
  const target = event.target as Node
  if (!open.value || panel.value?.contains(target) || trigger.value?.$el.contains(target)) return
  // Menus opened from inside the panel are teleported too; clicks in them don't close it.
  if ((target as HTMLElement).closest?.('[role="menu"]')) return
  close(false)
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) {
    event.stopPropagation()
    close()
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('resize', place)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown)
  window.removeEventListener('resize', place)
})

// Navigating from a link inside closes the panel.
const route = useRoute()
watch(() => route.fullPath, () => close(false))

defineExpose({ close })
</script>

<template>
  <span class="sg-pop" v-bind="$attrs">
    <SgButton
      ref="trigger"
      variant="ghost"
      :size="text ? 'sm' : 'md'"
      :icon="icon"
      :icon-only="!text"
      :label="badge ? (badgeLabel ?? `${label} (${badge})`) : label"
      aria-haspopup="dialog"
      :aria-expanded="open"
      :aria-controls="open ? panelId : undefined"
      @click="open ? close() : show()"
    >
      {{ text }}
    </SgButton>
    <span v-if="badge" class="sg-pop__badge" aria-hidden="true">{{ badge > 9 ? '9+' : badge }}</span>
  </span>
  <Teleport to="body">
    <div
      v-if="open"
      :id="panelId"
      ref="panel"
      class="sg-pop__panel"
      role="dialog"
      :aria-label="label"
      :style="{ top: `${position.top}px`, left: `${position.left}px`, width: `${Math.min(width, 9999)}px` }"
      @keydown="onKey"
    >
      <slot :close="close" />
    </div>
  </Teleport>
</template>

<style scoped>
.sg-pop {
  position: relative;
  display: inline-flex;
}

.sg-pop__badge {
  position: absolute;
  top: 2px;
  inset-inline-end: 2px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: var(--radius-full);
  background: var(--signal);
  color: var(--signal-ink);
  font-size: 10px;
  font-weight: var(--fw-medium);
  line-height: 16px;
  text-align: center;
  pointer-events: none;
}

.sg-pop__panel {
  position: fixed;
  z-index: 55;
  max-width: calc(100vw - 16px);
  /* No scrolling here (it would clip dropdowns inside); long content scrolls itself. */
  border: 1px solid var(--rule);
  border-radius: var(--radius-2);
  background: var(--surface);
  box-shadow: var(--shadow-pop);
  animation: sg-pop-in var(--dur-1) var(--ease);
}

@keyframes sg-pop-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
}
</style>
