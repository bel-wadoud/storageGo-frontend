<script setup lang="ts">
import type { IconName } from '~/utils/icons'

// What will appear here, and the one action that makes it appear. No illustrations.
defineProps<{ title: string; description?: string; icon?: IconName }>()
</script>

<template>
  <div class="sg-empty">
    <SgIcon v-if="icon" class="sg-empty__icon" :name="icon" :size="22" />
    <h3 class="sg-empty__title">{{ title }}</h3>
    <p v-if="description" class="sg-empty__desc">{{ description }}</p>
    <div v-if="$slots.default" class="sg-empty__actions"><slot /></div>
  </div>
</template>

<style scoped>
.sg-empty {
  display: grid;
  justify-items: start;
  gap: var(--s-3);
  padding: var(--s-9) var(--s-7);
  border: 1px dashed var(--rule);
  border-radius: var(--radius-2);
}

.sg-empty__icon {
  color: var(--fg-2);
}

.sg-empty__title {
  margin: 0;
  font-size: var(--fs-lg);
  font-weight: var(--fw-regular);
}

.sg-empty__desc {
  max-width: 52ch;
  margin: 0;
  color: var(--fg-2);
}

.sg-empty__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-3);
  margin-top: var(--s-2);
}
</style>
