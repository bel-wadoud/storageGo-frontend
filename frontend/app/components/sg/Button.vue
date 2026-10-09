<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import type { IconName } from '~/utils/icons'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
    size?: 'sm' | 'md' | 'lg'
    type?: 'button' | 'submit' | 'reset'
    to?: RouteLocationRaw
    /** Shows a spinner, blocks clicks and announces the button as busy. */
    loading?: boolean
    /** Text shown while loading, e.g. "Unlocking…". Defaults to the normal label. */
    loadingLabel?: string
    disabled?: boolean
    /** Why the button is disabled: shown on hover and focus, read by screen readers. */
    disabledReason?: string
    icon?: IconName
    iconEnd?: IconName
    /** Icon-only buttons must have a `label`; it is also shown as a tooltip. */
    iconOnly?: boolean
    label?: string
    block?: boolean
    /** For toggle buttons: true/false sets aria-pressed. */
    pressed?: boolean
  }>(),
  {
    variant: 'secondary',
    size: 'md',
    type: 'button',
    to: undefined,
    loadingLabel: undefined,
    disabledReason: undefined,
    icon: undefined,
    iconEnd: undefined,
    label: undefined,
    pressed: undefined,
  },
)

const emit = defineEmits<{ click: [event: MouseEvent] }>()
const attrs = useAttrs()
const NuxtLink = resolveComponent('NuxtLink')
const tipId = useId()

// aria-disabled instead of the `disabled` attribute: the button stays focusable and hoverable,
// so the user can still see *why* it is disabled, and focus is not lost while it is loading.
const blocked = computed(() => props.disabled || props.loading)
const tip = computed(() => {
  if (props.disabled && props.disabledReason) return props.disabledReason
  if (props.iconOnly) return props.label
  return undefined
})

const tipEl = ref<HTMLElement | null>(null)

// Measure the tooltip once it is laid out and nudge it back inside the viewport.
function placeTip() {
  requestAnimationFrame(() => {
    const el = tipEl.value
    if (!el) return
    el.style.setProperty('--tip-shift', '0px')
    el.classList.remove('is-below')
    const rect = el.getBoundingClientRect()
    if (!rect.width) return
    const edge = 8
    let shift = 0
    if (rect.left < edge) shift = edge - rect.left
    else if (rect.right > window.innerWidth - edge) shift = window.innerWidth - edge - rect.right
    el.style.setProperty('--tip-shift', `${shift}px`)
    if (rect.top < edge) el.classList.add('is-below')
  })
}

function onClick(event: MouseEvent) {
  if (blocked.value) {
    event.preventDefault()
    event.stopImmediatePropagation()
    return
  }
  emit('click', event)
}
</script>

<template>
  <component
    :is="to ? NuxtLink : 'button'"
    v-bind="attrs"
    :to="to"
    :type="to ? undefined : type"
    class="sg-btn"
    :class="[
      `sg-btn--${variant}`,
      `sg-btn--${size}`,
      { 'sg-btn--icon': iconOnly, 'sg-btn--block': block, 'is-loading': loading, 'is-disabled': disabled },
    ]"
    :aria-disabled="blocked || undefined"
    :aria-busy="loading || undefined"
    :aria-pressed="pressed"
    :aria-label="iconOnly ? label : undefined"
    :aria-describedby="tip && !iconOnly ? tipId : undefined"
    @click="onClick"
    @pointerenter="tip && placeTip()"
    @focus="tip && placeTip()"
  >
    <SgSpinner v-if="loading" decorative size="sm" />
    <SgIcon v-else-if="icon" :name="icon" />
    <span v-if="!iconOnly" class="sg-btn__label">
      <template v-if="loading && loadingLabel">{{ loadingLabel }}</template>
      <slot v-else />
    </span>
    <SgIcon v-if="iconEnd && !loading" :name="iconEnd" />
    <span v-if="tip" :id="tipId" ref="tipEl" class="sg-btn__tip" role="tooltip" :aria-hidden="iconOnly || undefined">{{ tip }}</span>
  </component>
</template>

<style scoped>
.sg-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--s-2);
  height: var(--control-h);
  padding: 0 var(--s-4);
  border: 1px solid var(--rule);
  border-radius: var(--radius-1);
  background: var(--surface);
  color: var(--fg);
  font-size: var(--fs-sm);
  font-weight: var(--fw-regular);
  line-height: 1;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
  transition:
    background var(--dur-1) var(--ease),
    border-color var(--dur-1) var(--ease),
    color var(--dur-1) var(--ease),
    transform var(--dur-1) var(--ease);
}

.sg-btn--sm {
  height: var(--control-h-sm);
  padding: 0 var(--s-3);
}

.sg-btn--lg {
  height: var(--control-h-lg);
  padding: 0 var(--s-6);
  font-size: var(--fs-md);
}

.sg-btn--icon {
  width: var(--control-h);
  padding: 0;
}

.sg-btn--icon.sg-btn--sm {
  width: var(--control-h-sm);
}

.sg-btn--block {
  display: flex;
  width: 100%;
}

/* Hover and press: every button reacts immediately. */
.sg-btn:hover {
  background: var(--surface-3);
  border-color: var(--rule-input);
}

.sg-btn:active:not([aria-disabled]) {
  transform: translateY(1px);
}

.sg-btn--primary {
  background: var(--signal);
  border-color: var(--signal);
  color: var(--signal-ink);
  font-weight: var(--fw-medium);
}

.sg-btn--primary:hover {
  background: var(--signal-hover);
  border-color: var(--signal-hover);
}

.sg-btn--ghost {
  background: transparent;
  border-color: transparent;
}

.sg-btn--ghost:hover {
  background: var(--surface-3);
  border-color: transparent;
}

.sg-btn--danger {
  background: transparent;
  border-color: var(--danger);
  color: var(--danger);
}

.sg-btn--danger:hover {
  background: var(--danger-soft);
  border-color: var(--danger-hover);
  color: var(--danger-hover);
}

.sg-btn[aria-pressed='true'] {
  background: var(--surface-3);
  border-color: var(--rule-input);
}

/* Busy: same colours (the spinner tells the story), progress cursor. */
.sg-btn.is-loading {
  cursor: progress;
}

/* Disabled: muted colours, not opacity (opacity would also fade the explanation tooltip). */
.sg-btn.is-disabled,
.sg-btn.is-disabled:hover {
  background: var(--surface-2);
  border-color: var(--rule);
  color: var(--fg-3);
  cursor: not-allowed;
}

.sg-btn--ghost.is-disabled,
.sg-btn--ghost.is-disabled:hover {
  background: transparent;
  border-color: transparent;
}

.sg-btn__label {
  display: inline-flex;
  align-items: center;
}

/* Tooltip for icon-only buttons and for disabled reasons. */
.sg-btn__tip {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  z-index: 40;
  /* Hidden tooltips take no space, so they never widen the page on small screens. */
  display: none;
  width: max-content;
  max-width: min(260px, calc(100vw - 16px));
  padding: var(--s-1) var(--s-2);
  border-radius: var(--radius-1);
  background: var(--fg);
  color: var(--bg);
  font-size: var(--fs-xs);
  font-weight: var(--fw-regular);
  line-height: var(--lh-ui);
  white-space: normal;
  text-align: center;
  pointer-events: none;
  /* --tip-shift keeps it inside the screen near an edge (set in placeTip). */
  transform: translateX(calc(-50% + var(--tip-shift, 0px)));
}

.sg-btn__tip.is-below {
  top: calc(100% + 8px);
  bottom: auto;
}

.sg-btn:hover .sg-btn__tip,
.sg-btn:focus-visible .sg-btn__tip {
  display: block;
  /* A short delay so tooltips don't flash while the pointer passes over. */
  animation: sg-tip-in var(--dur-1) var(--ease) 250ms both;
}

@keyframes sg-tip-in {
  from {
    opacity: 0;
    translate: 0 4px;
  }
}
</style>
