<script setup lang="ts">
// The 24 recovery-kit words, numbered. Words are English and always laid out left to
// right so the numbering reads the same on screen, on paper and in every language.
defineProps<{ words: string[] }>()
const { t } = useI18n()
</script>

<template>
  <ol class="sg-words" dir="ltr" translate="no" :aria-label="t('words.label')">
    <li v-for="(word, i) in words" :key="i" class="sg-words__item">
      <span class="sg-words__n" aria-hidden="true">{{ String(i + 1).padStart(2, '0') }}</span>
      <span class="sg-words__word">{{ word }}</span>
    </li>
  </ol>
</template>

<style scoped>
.sg-words {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 1px;
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--rule);
  border-radius: var(--radius-2);
  background: var(--rule);
  overflow: hidden;
}

.sg-words__item {
  display: flex;
  align-items: baseline;
  gap: var(--s-3);
  padding: var(--s-3) var(--s-4);
  background: var(--surface);
  font-family: var(--font-mono);
}

.sg-words__n {
  font-size: var(--fs-xs);
  color: var(--fg-3);
}

.sg-words__word {
  font-size: var(--fs-md);
  color: var(--fg);
}

@media print {
  .sg-words {
    grid-template-columns: repeat(4, 1fr);
    border-color: #000;
    background: #000;
  }

  .sg-words__item {
    background: #fff;
    color: #000;
    break-inside: avoid;
  }

  .sg-words__n,
  .sg-words__word {
    color: #000;
  }
}
</style>
