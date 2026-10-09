<script setup lang="ts">
// The frame of every auth screen (signup, sign-in, recovery): an optional way back, the
// heading and a one-paragraph lead. Anything above the heading (signup's progress) goes in
// the "top" slot.
const props = defineProps<{
  title: string
  lead?: string
  /** Path of the previous step, when going back is possible. */
  back?: string
}>()

const { t } = useI18n()

useHead({ title: () => `${props.title} · storageGo` })
</script>

<template>
  <div class="shell">
    <div v-if="$slots.top" class="shell__top no-print"><slot name="top" /></div>
    <NuxtLink v-if="back" :to="back" class="shell__back no-print">
      <SgIcon name="arrow-start" :size="16" />
      {{ t('common.back') }}
    </NuxtLink>
    <h1 class="shell__title">{{ title }}</h1>
    <p v-if="lead || $slots.lead" class="shell__lead"><slot name="lead">{{ lead }}</slot></p>
    <div class="shell__body">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.shell__top {
  margin-bottom: var(--s-8);
}

.shell__back {
  display: inline-flex;
  align-items: center;
  gap: var(--s-1);
  min-height: 24px;
  margin-bottom: var(--s-4);
  border-radius: var(--radius-1);
  font-size: var(--fs-sm);
  color: var(--fg-2);
  text-decoration: none;
  transition: color var(--dur-1) var(--ease);
}

.shell__back:hover {
  color: var(--fg);
}

.shell__back:active {
  color: var(--fg-3);
}

.shell__title {
  margin: 0;
  font-size: var(--fs-2xl);
  font-weight: var(--fw-medium);
  line-height: var(--lh-tight);
  letter-spacing: var(--tracking-display);
}

.shell__lead {
  margin: var(--s-3) 0 0;
  color: var(--fg-2);
  line-height: var(--lh-read);
}

.shell__body {
  margin-top: var(--s-7);
}
</style>
