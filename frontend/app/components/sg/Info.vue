<script setup lang="ts">
// A circled "i" next to a word that may be hard to understand (a passphrase, a recovery kit,
// a seat…). Tapping it, hovering it or reaching it with the keyboard opens a short explanation
// in plain words, from one glossary (i18n "help.<term>"), so the same word is always explained
// the same way. Esc or a tap elsewhere closes it; only one explanation is open at a time.
// It never activates what it sits in (a label, a checkbox, a choice).
const props = defineProps<{ term: string }>()

const { t } = useI18n()
const id = useId()
// The one explanation open on the page.
const openId = useState<string | null>('sg-info:open', () => null)
const open = computed(() => openId.value === id)
const pinned = ref(false)
const button = ref<HTMLButtonElement | null>(null)
const bubble = ref<HTMLElement | null>(null)
const position = ref({ top: 0, left: 0, below: true, arrow: 0 })
let hoverTimer: ReturnType<typeof setTimeout> | undefined

const title = computed(() => t(`help.${props.term}.title`))
const text = computed(() => t(`help.${props.term}.text`))

function place() {
  const anchor = button.value?.getBoundingClientRect()
  const box = bubble.value
  if (!anchor || !box) return
  const margin = 8
  const width = box.offsetWidth
  const height = box.offsetHeight
  const center = anchor.left + anchor.width / 2
  const left = Math.min(Math.max(margin, center - width / 2), window.innerWidth - width - margin)
  const below = anchor.bottom + height + margin < window.innerHeight || anchor.top < height + margin
  position.value = {
    top: below ? anchor.bottom + 6 : anchor.top - height - 6,
    left,
    below,
    arrow: Math.min(Math.max(12, center - left), width - 12),
  }
}

async function show(pin: boolean) {
  pinned.value = pin || pinned.value
  openId.value = id
  await nextTick()
  place()
}

function hide() {
  clearTimeout(hoverTimer)
  pinned.value = false
  if (open.value) openId.value = null
}

function onClick(event: MouseEvent) {
  // Inside a <label> (a checkbox, a choice): don't tick it.
  event.preventDefault()
  event.stopPropagation()
  if (open.value && pinned.value) hide()
  else show(true)
}

function onEnter(event: PointerEvent) {
  if (event.pointerType !== 'mouse') return
  clearTimeout(hoverTimer)
  hoverTimer = setTimeout(() => show(false), 250)
}

function onLeave(event: PointerEvent) {
  if (event.pointerType !== 'mouse') return
  clearTimeout(hoverTimer)
  if (!pinned.value) hoverTimer = setTimeout(() => !pinned.value && hide(), 150)
}

function keep() {
  clearTimeout(hoverTimer)
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) {
    event.stopPropagation()
    hide()
    button.value?.focus()
  }
}

function onOutside(event: PointerEvent) {
  const target = event.target as Node
  if (open.value && !button.value?.contains(target) && !bubble.value?.contains(target)) hide()
}

function onMove() {
  if (open.value) place()
}

watch(open, (value) => {
  if (!value) pinned.value = false
})

onMounted(() => {
  document.addEventListener('pointerdown', onOutside)
  window.addEventListener('scroll', onMove, true)
  window.addEventListener('resize', onMove)
})
onBeforeUnmount(() => {
  clearTimeout(hoverTimer)
  if (open.value) openId.value = null
  document.removeEventListener('pointerdown', onOutside)
  window.removeEventListener('scroll', onMove, true)
  window.removeEventListener('resize', onMove)
})
</script>

<template>
  <span class="sg-info no-print" @pointerenter="onEnter" @pointerleave="onLeave">
    <button
      ref="button"
      type="button"
      class="sg-info__btn"
      :class="{ 'is-open': open }"
      :aria-label="t('help.what', { term: title })"
      :aria-expanded="open"
      :aria-describedby="open ? `${id}-bubble` : undefined"
      @click="onClick"
      @focus="show(false)"
      @blur="!pinned && hide()"
      @keydown="onKey"
    >
      <SgIcon name="info" :size="16" />
    </button>
    <Teleport to="body">
      <div
        v-if="open"
        :id="`${id}-bubble`"
        ref="bubble"
        class="sg-info__bubble"
        :class="{ 'is-above': !position.below }"
        role="tooltip"
        :style="{ top: `${position.top}px`, left: `${position.left}px`, '--arrow': `${position.arrow}px` }"
        @pointerenter="keep"
        @pointerleave="onLeave"
      >
        <p class="sg-info__title">{{ title }}</p>
        <p class="sg-info__text">{{ text }}</p>
      </div>
    </Teleport>
  </span>
</template>

<style scoped>
.sg-info {
  /* Above the invisible radio or checkbox that covers a choice card, so the "i" opens help
     instead of selecting the option. */
  position: relative;
  z-index: 2;
  display: inline-flex;
  vertical-align: middle;
  /* A 28 px target that doesn't push the text around. */
  margin-block: -6px;
  margin-inline: 2px -4px;
}

.sg-info__btn {
  display: inline-grid;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: var(--radius-full);
  background: none;
  color: var(--fg-2);
  cursor: help;
  transition:
    background-color var(--dur-1) var(--ease),
    color var(--dur-1) var(--ease);
}

.sg-info__btn:hover,
.sg-info__btn:focus-visible {
  background: var(--surface-3);
  color: var(--fg);
}

.sg-info__btn:active {
  transform: scale(0.94);
}

.sg-info__btn.is-open {
  background: var(--signal-soft);
  color: var(--fg);
}

.sg-info__bubble {
  position: fixed;
  z-index: 200;
  width: max-content;
  max-width: min(320px, calc(100vw - 16px));
  padding: var(--s-3) var(--s-4);
  border: 1px solid var(--rule);
  border-radius: var(--radius-2);
  background: var(--surface);
  color: var(--fg);
  box-shadow: var(--shadow-pop);
  font-size: var(--fs-sm);
  font-weight: var(--fw-regular);
  line-height: 1.55;
  text-align: start;
  white-space: normal;
  animation: sg-info-in var(--dur-1) var(--ease);
}

/* The little arrow pointing at the "i". */
.sg-info__bubble::before {
  content: '';
  position: absolute;
  top: -6px;
  left: calc(var(--arrow) - 6px);
  width: 10px;
  height: 10px;
  border-top: 1px solid var(--rule);
  border-left: 1px solid var(--rule);
  background: var(--surface);
  transform: rotate(45deg);
}

.sg-info__bubble.is-above::before {
  top: auto;
  bottom: -6px;
  transform: rotate(225deg);
}

.sg-info__title {
  margin: 0 0 var(--s-1);
  font-weight: var(--fw-medium);
}

.sg-info__text {
  margin: 0;
  color: var(--fg-2);
}

@keyframes sg-info-in {
  from {
    opacity: 0;
    transform: translateY(2px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .sg-info__bubble {
    animation: none;
  }
}
</style>
