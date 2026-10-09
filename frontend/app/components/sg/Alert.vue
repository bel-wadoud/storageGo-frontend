<script setup lang="ts">
import type { IconName } from '~/utils/icons'

// Inline message in the page (offline banner, "file altered" error, quota warning…).
const props = withDefaults(
  defineProps<{
    tone?: 'info' | 'success' | 'warning' | 'danger'
    title?: string
    dismissible?: boolean
  }>(),
  { tone: 'info', title: undefined },
)

const emit = defineEmits<{ dismiss: [] }>()
const { t } = useI18n()

const icons: Record<NonNullable<typeof props.tone>, IconName> = { info: 'info', success: 'check-circle', warning: 'alert', danger: 'alert' }
// Problems interrupt the screen reader; good news waits its turn.
const role = computed(() => (props.tone === 'danger' || props.tone === 'warning' ? 'alert' : 'status'))
</script>

<template>
  <div class="sg-alert" :class="`sg-alert--${tone}`" :role="role">
    <SgIcon class="sg-alert__icon" :name="icons[tone]" />
    <div class="sg-alert__body">
      <p v-if="title" class="sg-alert__title">{{ title }}</p>
      <div class="sg-alert__text"><slot /></div>
      <div v-if="$slots.actions" class="sg-alert__actions"><slot name="actions" /></div>
    </div>
    <SgButton v-if="dismissible" variant="ghost" size="sm" icon-only icon="x" :label="t('common.dismiss')" @click="emit('dismiss')" />
  </div>
</template>

<style scoped>
.sg-alert {
  display: flex;
  align-items: flex-start;
  gap: var(--s-3);
  padding: var(--s-3) var(--s-4);
  border: 1px solid var(--rule);
  border-radius: var(--radius-2);
  background: var(--surface-2);
  font-size: var(--fs-sm);
}

.sg-alert__icon {
  margin-top: 2px;
}

.sg-alert--info {
  background: var(--info-soft);
  border-color: transparent;
}

.sg-alert--info .sg-alert__icon {
  color: var(--info);
}

.sg-alert--success {
  background: var(--success-soft);
  border-color: transparent;
}

.sg-alert--success .sg-alert__icon {
  color: var(--success);
}

.sg-alert--warning {
  background: var(--signal-soft);
  border-color: transparent;
}

.sg-alert--warning .sg-alert__icon {
  color: var(--signal-text);
}

.sg-alert--danger {
  background: var(--danger-soft);
  border-color: transparent;
}

.sg-alert--danger .sg-alert__icon,
.sg-alert--danger .sg-alert__title {
  color: var(--danger);
}

.sg-alert__body {
  flex: 1;
  display: grid;
  gap: var(--s-1);
}

.sg-alert__title {
  margin: 0;
  font-weight: var(--fw-medium);
}

.sg-alert__text {
  color: var(--fg);
}

.sg-alert__text :deep(p) {
  margin: 0;
}

.sg-alert__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2);
  margin-top: var(--s-2);
}
</style>
