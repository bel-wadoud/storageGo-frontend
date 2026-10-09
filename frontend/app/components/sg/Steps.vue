<script setup lang="ts">
// Where the user is in a multi-step flow (signup: passphrase → recovery kit → check).
const props = defineProps<{
  steps: string[]
  /** Index of the current step, starting at 0. */
  current: number
}>()

const { t } = useI18n()
const status = (i: number) => (i < props.current ? 'done' : i === props.current ? 'current' : 'todo')
</script>

<template>
  <nav class="sg-steps" :aria-label="t('steps.label')">
    <p class="sg-steps__count">{{ t('steps.position', { n: Math.min(current + 1, steps.length), total: steps.length }) }}</p>
    <ol class="sg-steps__list">
      <li
        v-for="(step, i) in steps"
        :key="i"
        class="sg-steps__item"
        :class="`is-${status(i)}`"
        :aria-current="status(i) === 'current' ? 'step' : undefined"
      >
        <span class="sg-steps__mark" aria-hidden="true">
          <SgIcon v-if="status(i) === 'done'" name="check" :size="14" />
          <template v-else>{{ i + 1 }}</template>
        </span>
        <span class="sg-steps__name">{{ step }}</span>
        <span v-if="status(i) === 'done'" class="sr-only">({{ t('steps.done') }})</span>
      </li>
    </ol>
  </nav>
</template>

<style scoped>
.sg-steps__count {
  margin: 0 0 var(--s-2);
  font-size: var(--fs-xs);
  color: var(--fg-2);
}

.sg-steps__list {
  display: flex;
  gap: var(--s-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.sg-steps__item {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--s-2);
  min-width: 0;
  padding-top: var(--s-2);
  border-top: 2px solid var(--rule);
  font-size: var(--fs-sm);
  color: var(--fg-3);
  transition:
    border-color var(--dur-2) var(--ease),
    color var(--dur-2) var(--ease);
}

.sg-steps__item.is-done {
  border-color: var(--fg);
  color: var(--fg-2);
}

.sg-steps__item.is-current {
  border-color: var(--signal);
  color: var(--fg);
  font-weight: var(--fw-medium);
}

.sg-steps__mark {
  display: inline-grid;
  place-items: center;
  flex: none;
  width: 20px;
  height: 20px;
  border-radius: var(--radius-full);
  border: 1px solid currentColor;
  font-family: var(--font-mono);
  font-size: 11px;
}

.sg-steps__item.is-done .sg-steps__mark {
  border-color: var(--fg);
  background: var(--fg);
  color: var(--bg);
}

.sg-steps__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* On phones only the current step keeps its name; the bars still show the whole path. */
@media (max-width: 560px) {
  .sg-steps__item:not(.is-current) {
    flex: 0 1 auto;
    min-width: 44px;
  }

  .sg-steps__item:not(.is-current) .sg-steps__name {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
}
</style>
