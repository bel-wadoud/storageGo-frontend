<script setup lang="ts">
// One part of a settings page: its title, one sentence saying what it's for, then its content.
// Parts are separated by rules, not cards (anti-patterns.md).
defineProps<{ title: string; description?: string; id?: string }>()
</script>

<template>
  <section :id="id" class="section" :aria-labelledby="id ? `${id}-title` : undefined">
    <div class="section__head">
      <h2 :id="id ? `${id}-title` : undefined">{{ title }}</h2>
      <p v-if="description">{{ description }}</p>
    </div>
    <div class="section__body"><slot /></div>
  </section>
</template>

<style scoped>
.section {
  display: grid;
  gap: var(--s-4);
  padding-top: var(--s-5);
  border-top: 1px solid var(--rule);
  scroll-margin-top: var(--s-5);
}

.section__head h2 {
  margin: 0;
  font-size: var(--fs-md);
  font-weight: var(--fw-medium);
}

.section__head p {
  margin: var(--s-1) 0 0;
  max-width: 62ch;
  font-size: var(--fs-sm);
  color: var(--fg-2);
}

.section__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--s-4);
  min-width: 0;
}
</style>
