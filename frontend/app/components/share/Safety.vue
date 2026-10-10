<script setup lang="ts">
// One plain sentence on why this is safe, without jargon (personas.md: "decrypted on your
// phone"). Algorithm names stay out of it (key-model-ux.md §3).
defineProps<{ text: string }>()
</script>

<template>
  <p class="safety">
    <SgIcon name="lock" :size="16" />
    <span>{{ text }}</span>
  </p>
</template>

<style scoped>
.safety {
  display: flex;
  align-items: flex-start;
  gap: var(--s-2);
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--fg-2);
}

.safety :deep(svg) {
  flex: none;
  margin-top: 2px;
}
</style>
