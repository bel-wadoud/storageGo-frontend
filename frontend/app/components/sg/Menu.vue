<script setup lang="ts" generic="T extends string">
import type { IconName } from '~/utils/icons'

// A small dropdown for picking one option (theme, language…). The trigger stays quiet;
// the list opens under it. Keyboard: Enter/Space/↓ opens, ↑↓ Home End move, Esc closes and
// returns focus, Tab closes. Clicking outside closes it.
const props = defineProps<{
  /** Accessible name of the menu, e.g. "Theme". Also the trigger's tooltip prefix. */
  label: string
  options: { value: T; label: string; icon?: IconName; lang?: string; dir?: 'ltr' | 'rtl' | 'auto' }[]
  modelValue: T
  /** Icon of the trigger button. */
  icon: IconName
  /** Short text next to the trigger icon (e.g. "EN"); icon-only when absent. */
  short?: string
  /** Option currently being applied (shows a spinner on it). */
  pending?: T | null
}>()

const emit = defineEmits<{ select: [value: T] }>()

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const trigger = ref<{ $el: HTMLElement } | null>(null)
const items = ref<HTMLElement[]>([])
const menuId = useId()
const list = ref<HTMLElement | null>(null)
// Opens toward the inline end by default; flips when that would leave the screen.
const flipped = ref(false)

const current = computed(() => props.options.find((o) => o.value === props.modelValue))

function focusItem(index: number) {
  const count = props.options.length
  items.value[((index % count) + count) % count]?.focus()
}

async function show(focus: 'selected' | 'first' | 'last' = 'selected') {
  flipped.value = false
  open.value = true
  await nextTick()
  const rect = list.value?.getBoundingClientRect()
  if (rect && (rect.left < 8 || rect.right > window.innerWidth - 8)) flipped.value = true
  const selected = props.options.findIndex((o) => o.value === props.modelValue)
  focusItem(focus === 'first' ? 0 : focus === 'last' ? props.options.length - 1 : Math.max(selected, 0))
}

function close(returnFocus = true) {
  if (!open.value) return
  open.value = false
  if (returnFocus) trigger.value?.$el.focus()
}

function choose(value: T) {
  emit('select', value)
  close()
}

function onTriggerKey(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    show('first')
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    show('last')
  }
}

function onMenuKey(event: KeyboardEvent) {
  const index = items.value.indexOf(document.activeElement as HTMLElement)
  const keys: Record<string, () => void> = {
    ArrowDown: () => focusItem(index + 1),
    ArrowUp: () => focusItem(index - 1),
    Home: () => focusItem(0),
    End: () => focusItem(props.options.length - 1),
    Escape: () => close(),
    Tab: () => close(false),
  }
  const action = keys[event.key]
  if (!action) return
  if (event.key !== 'Tab') event.preventDefault()
  action()
}

function onPointerDown(event: PointerEvent) {
  if (open.value && root.value && !root.value.contains(event.target as Node)) close(false)
}

onMounted(() => document.addEventListener('pointerdown', onPointerDown))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDown))
</script>

<template>
  <div ref="root" class="sg-menu">
    <SgButton
      ref="trigger"
      variant="ghost"
      size="sm"
      :icon="icon"
      :icon-only="!short"
      :label="`${label}: ${current?.label ?? ''}`"
      :loading="pending != null"
      aria-haspopup="menu"
      :aria-expanded="open"
      :aria-controls="open ? menuId : undefined"
      @click="open ? close() : show()"
      @keydown="onTriggerKey"
    >
      <span class="sr-only">{{ label }}: {{ current?.label }}</span>
      <span class="sg-menu__short" aria-hidden="true">{{ short }}</span>
      <SgIcon class="sg-menu__chevron" name="chevron-down" :size="14" />
    </SgButton>

    <Transition name="sg-menu">
      <ul v-if="open" :id="menuId" ref="list" class="sg-menu__list" :class="{ 'is-flipped': flipped }" role="menu" :aria-label="label" @keydown="onMenuKey">
        <li v-for="option in options" :key="option.value" role="none">
          <button
            ref="items"
            type="button"
            class="sg-menu__item"
            role="menuitemradio"
            :aria-checked="option.value === modelValue"
            :lang="option.lang"
            :dir="option.dir"
            tabindex="-1"
            @click="choose(option.value)"
          >
            <SgIcon v-if="option.icon" :name="option.icon" :size="16" />
            <span class="sg-menu__label">{{ option.label }}</span>
            <SgSpinner v-if="pending === option.value" decorative size="sm" />
            <SgIcon v-else-if="option.value === modelValue" class="sg-menu__check" name="check" :size="16" />
          </button>
        </li>
      </ul>
    </Transition>
  </div>
</template>

<style scoped>
.sg-menu {
  position: relative;
  display: inline-block;
}

.sg-menu__short {
  font-size: var(--fs-xs);
  font-weight: var(--fw-medium);
  letter-spacing: 0.04em;
}

.sg-menu__chevron {
  margin-inline-start: -2px;
  color: var(--fg-2);
}

.sg-menu__list {
  position: absolute;
  inset-inline-end: 0;
  top: calc(100% + 4px);
  z-index: 50;
  min-width: 168px;
  margin: 0;
  padding: 4px;
  list-style: none;
  border: 1px solid var(--rule);
  border-radius: var(--radius-2);
  background: var(--surface);
  box-shadow: var(--shadow-pop);
}

.sg-menu__list.is-flipped {
  inset-inline-start: 0;
  inset-inline-end: auto;
}

.sg-menu__item {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  width: 100%;
  min-height: 32px;
  padding: 0 var(--s-2);
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

.sg-menu__item:hover,
.sg-menu__item:focus-visible {
  background: var(--surface-2);
}

.sg-menu__item:focus-visible {
  outline-offset: -2px;
}

.sg-menu__item:active {
  background: var(--surface-3);
}

.sg-menu__item[aria-checked='true'] {
  font-weight: var(--fw-medium);
}

.sg-menu__label {
  flex: 1;
}

.sg-menu__check {
  color: var(--signal-text);
}

.sg-menu-enter-active,
.sg-menu-leave-active {
  transition:
    opacity var(--dur-1) var(--ease),
    transform var(--dur-1) var(--ease);
}

.sg-menu-enter-from,
.sg-menu-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
