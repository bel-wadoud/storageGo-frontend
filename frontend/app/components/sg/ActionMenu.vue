<script setup lang="ts">
import type { IconName } from '~/utils/icons'
import type { ActionItem } from '~/utils/menu'

// A menu of actions ("⋯" on a file row, "New" in a toolbar). Rendered at the end of <body>
// with fixed positioning, so lists that scroll or clip never cut it off. Opens below the
// trigger, or above when there's no room. Keyboard: ↓/Enter/Space opens, ↑↓ Home End move,
// Esc closes and returns focus, Tab closes. Disabled items stay readable and say why.

// Two roots (trigger + teleported list): attributes like class go to the trigger.
defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    /** Accessible name of the trigger, e.g. "More actions for Bilan_2025.pdf". */
    label: string
    items: ActionItem[]
    icon?: IconName
    /** Visible text on the trigger; icon-only when absent. */
    text?: string
    variant?: 'ghost' | 'secondary' | 'primary'
    size?: 'sm' | 'md'
    disabled?: boolean
    disabledReason?: string
  }>(),
  { icon: 'more', text: undefined, variant: 'ghost', size: 'sm', disabledReason: undefined },
)

const emit = defineEmits<{ select: [key: string] }>()

const open = ref(false)
const trigger = ref<{ $el: HTMLElement } | null>(null)
const list = ref<HTMLElement | null>(null)
const buttons = ref<HTMLButtonElement[]>([])
const position = ref<{ top: number; left: number; minWidth: number; flipUp: boolean }>({ top: 0, left: 0, minWidth: 0, flipUp: false })
const menuId = useId()

const enabled = computed(() => props.items.map((item, i) => (item.disabled ? -1 : i)).filter((i) => i >= 0))

function place() {
  const rect = trigger.value?.$el.getBoundingClientRect()
  const menu = list.value
  if (!rect || !menu) return
  const rtl = document.documentElement.dir === 'rtl'
  const width = menu.offsetWidth
  const height = menu.offsetHeight
  const below = window.innerHeight - rect.bottom
  const flipUp = below < height + 8 && rect.top > below
  // Aligned to the trigger's inline-end edge, then kept inside the screen.
  let left = rtl ? rect.left : rect.right - width
  left = Math.min(Math.max(8, left), window.innerWidth - width - 8)
  position.value = { top: flipUp ? rect.top - height - 4 : rect.bottom + 4, left, minWidth: rect.width, flipUp }
}

function focusItem(index: number) {
  const order = enabled.value
  if (!order.length) return
  const target = order[((index % order.length) + order.length) % order.length]!
  buttons.value[target]?.focus()
}

async function show(at: 'first' | 'last' = 'first') {
  if (props.disabled) return
  open.value = true
  await nextTick()
  place()
  focusItem(at === 'first' ? 0 : -1)
}

function close(returnFocus = true) {
  if (!open.value) return
  open.value = false
  if (returnFocus) trigger.value?.$el.focus()
}

function choose(item: ActionItem) {
  if (item.disabled) return
  close()
  emit('select', item.key)
}

function onTriggerKey(event: KeyboardEvent) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    show(event.key === 'ArrowDown' ? 'first' : 'last')
  }
}

function onMenuKey(event: KeyboardEvent) {
  const current = enabled.value.indexOf(buttons.value.indexOf(document.activeElement as HTMLButtonElement))
  const keys: Record<string, () => void> = {
    ArrowDown: () => focusItem(current + 1),
    ArrowUp: () => focusItem(current - 1),
    Home: () => focusItem(0),
    End: () => focusItem(-1),
    Escape: () => close(),
    Tab: () => close(false),
  }
  const action = keys[event.key]
  if (!action) return
  if (event.key !== 'Tab') event.preventDefault()
  event.stopPropagation()
  action()
}

function onPointerDown(event: PointerEvent) {
  const target = event.target as Node
  if (open.value && !list.value?.contains(target) && !trigger.value?.$el.contains(target)) close(false)
}

function onViewportChange() {
  if (open.value) close(false)
}

onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('resize', onViewportChange)
  window.addEventListener('scroll', onViewportChange, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown)
  window.removeEventListener('resize', onViewportChange)
  window.removeEventListener('scroll', onViewportChange, true)
})

defineExpose({ show })
</script>

<template>
  <SgButton
    v-bind="$attrs"
    ref="trigger"
    :variant="variant"
    :size="size"
    :icon="icon"
    :icon-only="!text"
    :label="label"
    :disabled="disabled"
    :disabled-reason="disabledReason"
    :icon-end="text ? 'chevron-down' : undefined"
    aria-haspopup="menu"
    :aria-expanded="open"
    :aria-controls="open ? menuId : undefined"
    @click.stop="open ? close() : show()"
    @keydown="onTriggerKey"
  >
    {{ text }}
  </SgButton>
  <Teleport to="body">
    <ul
      v-if="open"
      :id="menuId"
      ref="list"
      class="sg-actions"
      role="menu"
      :aria-label="label"
      :style="{ top: `${position.top}px`, left: `${position.left}px`, minWidth: `${Math.max(position.minWidth, 200)}px` }"
      @keydown="onMenuKey"
    >
      <li v-for="item in items" :key="item.key" role="none" :class="{ 'has-divider': item.divider }">
        <button
          ref="buttons"
          type="button"
          role="menuitem"
          class="sg-actions__item"
          :class="{ 'is-danger': item.danger }"
          :aria-disabled="item.disabled || undefined"
          tabindex="-1"
          @click="choose(item)"
        >
          <SgIcon v-if="item.icon" :name="item.icon" :size="16" />
          <span class="sg-actions__text">
            <span>{{ item.label }}</span>
            <span v-if="item.disabled && item.reason" class="sg-actions__reason">{{ item.reason }}</span>
          </span>
        </button>
      </li>
    </ul>
  </Teleport>
</template>

<style scoped>
.sg-actions {
  position: fixed;
  z-index: 60;
  max-width: min(320px, calc(100vw - 16px));
  margin: 0;
  padding: 4px;
  list-style: none;
  border: 1px solid var(--rule);
  border-radius: var(--radius-2);
  background: var(--surface);
  box-shadow: var(--shadow-pop);
  animation: sg-actions-in var(--dur-1) var(--ease);
}

.has-divider {
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px solid var(--rule);
}

.sg-actions__item {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  width: 100%;
  min-height: 34px;
  padding: 4px var(--s-2);
  border: 0;
  border-radius: var(--radius-1);
  background: none;
  color: var(--fg);
  font: inherit;
  font-size: var(--fs-sm);
  text-align: start;
  cursor: pointer;
  transition: background-color var(--dur-1) var(--ease);
}

.sg-actions__item:hover,
.sg-actions__item:focus-visible {
  background: var(--surface-2);
}

.sg-actions__item:focus-visible {
  outline-offset: -2px;
}

.sg-actions__item:active {
  background: var(--surface-3);
}

.sg-actions__item.is-danger {
  color: var(--danger);
}

.sg-actions__item[aria-disabled='true'] {
  color: var(--fg-3);
  cursor: not-allowed;
}

.sg-actions__item[aria-disabled='true']:hover {
  background: none;
}

.sg-actions__text {
  display: grid;
}

.sg-actions__reason {
  font-size: var(--fs-xs);
  color: var(--fg-3);
}

@keyframes sg-actions-in {
  from {
    opacity: 0;
  }
}
</style>
