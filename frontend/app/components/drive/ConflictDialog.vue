<script setup lang="ts">
import type { ConflictChoice } from '~/composables/useTransfers'

// A file with this name is already in the folder: keep both (default), replace (it becomes a
// new version, the old one stays in the version history) or skip; optionally for all the
// remaining clashes of this upload (user-flows.md F4).
const { t } = useI18n()
const transfers = useTransfers()

const choice = ref<ConflictChoice>('keep-both')
const all = ref(false)
const question = computed(() => transfers.conflict.value)
const open = computed({
  get: () => Boolean(question.value),
  set: (value) => {
    // Closing the dialog (Esc, ×) means "skip this one".
    if (!value && question.value) transfers.answerConflict('skip', false)
  },
})

watch(question, (value) => {
  if (value) {
    choice.value = 'keep-both'
    all.value = false
  }
})

const options = computed(() => [
  { value: 'keep-both' as const, title: t('drive.conflict.keepBoth'), description: t('drive.conflict.keepBothHint') },
  { value: 'replace' as const, title: t('drive.conflict.replace'), description: t('drive.conflict.replaceHint') },
  { value: 'skip' as const, title: t('drive.conflict.skip'), description: t('drive.conflict.skipHint') },
])
</script>

<template>
  <SgDialog v-model:open="open" :title="t('drive.conflict.title')" size="sm">
    <template v-if="question">
      <p class="conflict__lead">
        <i18n-t keypath="drive.conflict.lead" scope="global">
          <template #name><bdi class="strong">{{ question.name }}</bdi></template>
        </i18n-t>
      </p>
      <SgChoice v-model="choice" :legend="t('drive.conflict.legend')" :options="options" />
    </template>
    <template #footer>
      <SgCheckbox
        v-if="question && question.remaining > 0"
        v-model="all"
        class="conflict__all"
        :label="t('drive.conflict.all', { n: question.remaining }, question.remaining)"
      />
      <SgButton variant="primary" @click="transfers.answerConflict(choice ?? 'keep-both', all)">{{ t('common.continue') }}</SgButton>
    </template>
  </SgDialog>
</template>

<style scoped>
.conflict__lead {
  margin: 0 0 var(--s-4);
  color: var(--fg-2);
}

.conflict__all {
  margin-inline-end: auto;
}
</style>
