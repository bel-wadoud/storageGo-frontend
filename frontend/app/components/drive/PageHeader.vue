<script setup lang="ts">
// Top of every drive page: the title (or breadcrumbs), an optional line under it, and the
// page's actions on the inline-end side.
defineProps<{
  title?: string
  note?: string
  /** A circled "i" explaining a hard word (glossary key, see SgInfo). */
  info?: string
}>()
</script>

<template>
  <div class="head">
    <div class="head__title">
      <slot name="title">
        <h1>{{ title }}<SgInfo v-if="info" :term="info" /></h1>
      </slot>
      <p v-if="note || $slots.note" class="head__note"><slot name="note">{{ note }}</slot></p>
    </div>
    <div v-if="$slots.actions" class="head__actions"><slot name="actions" /></div>
  </div>
</template>

<style scoped>
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--s-3) var(--s-5);
}

.head__title {
  display: grid;
  gap: var(--s-1);
  min-width: 0;
}

.head__title h1 {
  margin: 0;
  font-size: var(--fs-xl);
  font-weight: var(--fw-medium);
  line-height: var(--lh-tight);
}

.head__note {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--fg-2);
}

.head__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s-2);
}
</style>
