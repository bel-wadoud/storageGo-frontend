<script setup lang="ts" generic="T extends string">
import type { IconName } from '~/utils/icons'

// Tabs with the keyboard behaviour people expect: ← → move between tabs (mirrored in Arabic),
// Home/End jump, only the active tab is in the Tab order. Each panel is the slot named after
// its tab key.
const props = defineProps<{
  label: string
  tabs: { key: T; label: string; icon?: IconName; count?: number }[]
}>()

const active = defineModel<T>({ required: true })
const id = useId()
const buttons = ref<HTMLButtonElement[]>([])

function move(event: KeyboardEvent) {
  const index = props.tabs.findIndex((tab) => tab.key === active.value)
  const rtl = document.documentElement.dir === 'rtl'
  const forward = rtl ? 'ArrowLeft' : 'ArrowRight'
  const back = rtl ? 'ArrowRight' : 'ArrowLeft'
  let next = index
  if (event.key === forward) next = (index + 1) % props.tabs.length
  else if (event.key === back) next = (index - 1 + props.tabs.length) % props.tabs.length
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = props.tabs.length - 1
  else return
  event.preventDefault()
  active.value = props.tabs[next]!.key
  nextTick(() => buttons.value[next]?.focus())
}
</script>

<template>
  <div class="sg-tabs">
    <div class="sg-tabs__list" role="tablist" :aria-label="label" @keydown="move">
      <button
        v-for="tab in tabs"
        :id="`${id}-tab-${tab.key}`"
        :key="tab.key"
        ref="buttons"
        type="button"
        role="tab"
        class="sg-tabs__tab"
        :aria-selected="tab.key === active"
        :aria-controls="`${id}-panel-${tab.key}`"
        :tabindex="tab.key === active ? 0 : -1"
        @click="active = tab.key"
      >
        <SgIcon v-if="tab.icon" :name="tab.icon" :size="15" />
        {{ tab.label }}
        <span v-if="tab.count" class="sg-tabs__count">{{ tab.count }}</span>
      </button>
    </div>
    <div
      :id="`${id}-panel-${active}`"
      class="sg-tabs__panel"
      role="tabpanel"
      :aria-labelledby="`${id}-tab-${active}`"
      tabindex="0"
    >
      <slot :name="active" />
    </div>
  </div>
</template>

<style scoped>
.sg-tabs__list {
  display: flex;
  gap: var(--s-1);
  overflow-x: auto;
  border-bottom: 1px solid var(--rule);
  scrollbar-width: none;
}

.sg-tabs__tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: none;
  min-height: 36px;
  padding: 0 var(--s-3);
  border: 0;
  background: none;
  color: var(--fg-2);
  font: inherit;
  font-size: var(--fs-sm);
  cursor: pointer;
  transition: color var(--dur-1) var(--ease);
}

.sg-tabs__tab:hover {
  color: var(--fg);
}

.sg-tabs__tab:focus-visible {
  outline-offset: -2px;
}

.sg-tabs__tab[aria-selected='true'] {
  color: var(--fg);
  font-weight: var(--fw-medium);
}

.sg-tabs__tab[aria-selected='true']::after {
  content: '';
  position: absolute;
  inset-inline: var(--s-2);
  bottom: -1px;
  height: 2px;
  background: var(--signal);
}

.sg-tabs__count {
  min-width: 18px;
  padding: 0 5px;
  border-radius: var(--radius-full);
  background: var(--surface-3);
  font-size: 11px;
  text-align: center;
}

.sg-tabs__panel {
  padding-top: var(--s-4);
}

.sg-tabs__panel:focus-visible {
  outline-offset: 2px;
}
</style>
