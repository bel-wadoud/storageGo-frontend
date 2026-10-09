<script setup lang="ts">
// Mounted once in app.vue. Pages call useToast().success(...) / .error(...) etc.
const { toasts, dismiss } = useToast()
const { t } = useI18n()
</script>

<template>
  <section class="sg-toasts" :aria-label="t('common.notifications')">
    <TransitionGroup name="sg-toast" tag="div" class="sg-toasts__list">
      <SgToastItem v-for="toast in toasts" :key="toast.id" :toast="toast" @dismiss="dismiss(toast.id)" />
    </TransitionGroup>
  </section>
</template>

<style scoped>
.sg-toasts {
  position: fixed;
  inset-block-end: var(--s-6);
  inset-inline-end: var(--s-6);
  z-index: 100;
  width: min(400px, calc(100vw - 2 * var(--s-4)));
  pointer-events: none;
}

.sg-toasts__list {
  display: grid;
  gap: var(--s-2);
}

.sg-toast-enter-active,
.sg-toast-leave-active {
  transition:
    opacity var(--dur-2) var(--ease),
    transform var(--dur-2) var(--ease);
}

.sg-toast-enter-from,
.sg-toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

.sg-toast-leave-active {
  position: absolute;
  width: 100%;
}

.sg-toast-move {
  transition: transform var(--dur-2) var(--ease);
}

@media (max-width: 600px) {
  .sg-toasts {
    inset-inline: var(--s-4);
    inset-block-end: var(--s-4);
    width: auto;
  }
}
</style>
