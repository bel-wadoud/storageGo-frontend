<script setup lang="ts">
// Shown when what this step needs is no longer in memory (the page was reloaded or the tab
// restored): the recovery words ("kit") or the unlocked keys ("keys"). Neither is ever
// stored, so the way forward is to sign in, which brings the user back to this step.
const props = withDefaults(defineProps<{ variant?: 'kit' | 'keys' }>(), { variant: 'kit' })
const { t } = useI18n()
const prefix = computed(() => (props.variant === 'kit' ? 'signup.kitLost' : 'signup.keysLocked'))
const next = useRoute().fullPath
</script>

<template>
  <SgAlert tone="warning" :title="t(`${prefix}.title`)">
    <p>{{ t(`${prefix}.body`) }}</p>
    <template #actions>
      <SgButton variant="primary" size="sm" icon-end="arrow-end" :to="{ path: '/signin', query: { next } }">
        {{ t('signup.kitLost.action') }}
      </SgButton>
    </template>
  </SgAlert>
</template>
