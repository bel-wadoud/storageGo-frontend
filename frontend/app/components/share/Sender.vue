<script setup lang="ts">
import type { PublicSender } from '~/services/api/public'

// Who sent the link or asked for files. A recognisable person and organization is what
// tells the recipient this isn't phishing (personas.md, Mme Benali).
defineProps<{ sender: PublicSender; note: string }>()
</script>

<template>
  <div class="sender">
    <SgAvatar :name="sender.name" :size="40" />
    <div class="sender__text">
      <p class="sender__name">
        <bdi>{{ sender.name }}</bdi>
        <template v-if="sender.org_name"><span class="sender__org"> · <bdi>{{ sender.org_name }}</bdi></span></template>
      </p>
      <p class="sender__note">{{ note }}</p>
    </div>
  </div>
</template>

<style scoped>
.sender {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  padding: var(--s-4);
  border: 1px solid var(--rule);
  border-radius: var(--radius-2);
  background: var(--surface);
}

.sender__text {
  min-width: 0;
}

.sender__name,
.sender__note {
  margin: 0;
  overflow-wrap: anywhere;
}

.sender__name {
  font-weight: var(--fw-medium);
}

.sender__org {
  font-weight: var(--fw-regular);
  color: var(--fg-2);
}

.sender__note {
  font-size: var(--fs-sm);
  color: var(--fg-2);
}
</style>
