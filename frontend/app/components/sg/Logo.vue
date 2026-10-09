<script setup lang="ts">
// The wordmark. The name is a brand: never translated, always left to right.
withDefaults(defineProps<{ to?: string | null; size?: 'md' | 'lg' }>(), { to: '/', size: 'md' })
const { t } = useI18n()
</script>

<template>
  <NuxtLink v-if="to" :to="to" class="sg-logo" :class="`sg-logo--${size}`" :aria-label="t('brand.home')">
    <span dir="ltr" translate="no" aria-hidden="true">storage<b>Go</b></span>
  </NuxtLink>
  <span v-else class="sg-logo" :class="`sg-logo--${size}`" dir="ltr" translate="no">storage<b>Go</b></span>
</template>

<style scoped>
.sg-logo {
  display: inline-flex;
  align-items: center;
  min-height: var(--control-h-sm);
  border-radius: var(--radius-1);
  font-size: var(--fs-lg);
  font-weight: var(--fw-medium);
  letter-spacing: var(--tracking-display);
  color: var(--fg);
  text-decoration: none;
  transition: opacity var(--dur-1) var(--ease);
}

.sg-logo--lg {
  font-size: var(--fs-2xl);
}

.sg-logo b {
  font-weight: inherit;
  color: var(--signal-text);
}

a.sg-logo:hover {
  opacity: 0.8;
}

a.sg-logo:active {
  opacity: 0.65;
}
</style>
