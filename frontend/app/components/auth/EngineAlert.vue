<script setup lang="ts">
// The two ways a page can't do crypto: the browser lacks what it needs, or the engine
// didn't start (with a retry). Shown above forms that create or open keys.
defineProps<{ supported: boolean; state: 'loading' | 'ready' | 'failed'; error: string }>()
const emit = defineEmits<{ retry: [] }>()
const { t } = useI18n()
</script>

<template>
  <SgAlert v-if="!supported" tone="danger" :title="t('signup.passphrase.unsupportedTitle')">
    {{ t('signup.passphrase.unsupported') }}
  </SgAlert>
  <SgAlert v-else-if="state === 'failed'" tone="danger" :title="t('signup.passphrase.engineFailed')">
    {{ error }}
    <template #actions>
      <SgButton size="sm" icon="refresh" @click="emit('retry')">{{ t('common.retry') }}</SgButton>
    </template>
  </SgAlert>
</template>
