<script setup lang="ts">
import type { IconName } from '~/utils/icons'
import type { Toast } from '~/composables/useToast'

const props = defineProps<{ toast: Toast }>()
const emit = defineEmits<{ dismiss: [] }>()
const { t } = useI18n()

const icon: Record<Toast['tone'], IconName> = { success: 'check-circle', error: 'alert', warning: 'alert', info: 'info' }

// Auto-dismiss, paused while the pointer or keyboard focus is on the toast.
let timer: ReturnType<typeof setTimeout> | undefined
let remaining = props.toast.duration
let startedAt = 0

function start() {
  if (timer || !props.toast.duration || remaining <= 0) return
  startedAt = Date.now()
  timer = setTimeout(() => emit('dismiss'), remaining)
}

function pause() {
  if (!timer) return
  clearTimeout(timer)
  timer = undefined
  remaining -= Date.now() - startedAt
}

const acting = ref(false)
async function runAction() {
  if (!props.toast.action || acting.value) return
  acting.value = true
  try {
    await props.toast.action.onClick()
    emit('dismiss')
  } finally {
    acting.value = false
  }
}

onMounted(start)
onBeforeUnmount(pause)
</script>

<template>
  <div
    class="sg-toast"
    :class="`sg-toast--${toast.tone}`"
    :role="toast.tone === 'error' ? 'alert' : 'status'"
    @mouseenter="pause"
    @mouseleave="start"
    @focusin="pause"
    @focusout="start"
  >
    <SgIcon class="sg-toast__icon" :name="icon[toast.tone]" />
    <p class="sg-toast__message">{{ toast.message }}</p>
    <SgButton v-if="toast.action" class="sg-toast__action" variant="ghost" size="sm" :loading="acting" @click="runAction">
      {{ toast.action.label }}
    </SgButton>
    <SgButton variant="ghost" size="sm" icon-only icon="x" :label="t('common.dismiss')" @click="emit('dismiss')" />
  </div>
</template>

<style scoped>
.sg-toast {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  width: 100%;
  padding: var(--s-2) var(--s-2) var(--s-2) var(--s-4);
  padding-inline: var(--s-4) var(--s-2);
  border: 1px solid var(--rule);
  border-inline-start: 3px solid var(--fg-2);
  border-radius: var(--radius-2);
  background: var(--surface);
  box-shadow: var(--shadow-pop);
  font-size: var(--fs-sm);
  pointer-events: auto;
}

.sg-toast--success {
  border-inline-start-color: var(--success);
}

.sg-toast--success .sg-toast__icon {
  color: var(--success);
}

.sg-toast--error {
  border-inline-start-color: var(--danger);
}

.sg-toast--error .sg-toast__icon {
  color: var(--danger);
}

.sg-toast--warning {
  border-inline-start-color: var(--signal);
}

.sg-toast--warning .sg-toast__icon {
  color: var(--signal-text);
}

.sg-toast--info {
  border-inline-start-color: var(--info);
}

.sg-toast--info .sg-toast__icon {
  color: var(--info);
}

.sg-toast__message {
  flex: 1;
  margin: 0;
  color: var(--fg);
}

.sg-toast__action {
  color: var(--signal-text);
  font-weight: var(--fw-medium);
}
</style>
