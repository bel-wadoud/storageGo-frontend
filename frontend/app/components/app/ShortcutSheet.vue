<script setup lang="ts">
// The keyboard shortcuts, and the switch to turn single-letter shortcuts off (WCAG 2.1.4).
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const enabled = ref(true)

// Runs at once: the sheet is mounted already open.
watch(
  open,
  (value) => {
    if (value) enabled.value = shortcutsEnabled()
  },
  { immediate: true },
)
watch(enabled, (value) => setShortcutsEnabled(value))

const rows = computed(() => [
  ['/', t('app.shortcuts.search')],
  ['u', t('app.shortcuts.upload')],
  ['n', t('app.shortcuts.newFolder')],
  ['↑ ↓', t('app.shortcuts.move')],
  ['Shift + ↑ ↓', t('app.shortcuts.extend')],
  ['Enter', t('app.shortcuts.open')],
  ['Space', t('app.shortcuts.select')],
  ['s', t('app.shortcuts.share')],
  ['i', t('app.shortcuts.details')],
  ['Del', t('app.shortcuts.trash')],
  ['?', t('app.shortcuts.help')],
])
</script>

<template>
  <SgDialog v-model:open="open" :title="t('app.shortcuts.title')" :description="t('app.shortcuts.lead')">
    <table class="keys">
      <tbody>
        <tr v-for="[key, what] in rows" :key="key">
          <th scope="row"><kbd dir="ltr">{{ key }}</kbd></th>
          <td>{{ what }}</td>
        </tr>
      </tbody>
    </table>
    <template #footer>
      <SgCheckbox v-model="enabled" class="keys__toggle" :label="t('app.shortcuts.enabled')" :description="t('app.shortcuts.enabledHint')" />
    </template>
  </SgDialog>
</template>

<style scoped>
.keys {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--fs-sm);
}

.keys tr + tr {
  border-top: 1px solid var(--rule-soft);
}

.keys th {
  width: 40%;
  padding: var(--s-2) 0;
  font-weight: var(--fw-regular);
  text-align: start;
}

.keys td {
  padding: var(--s-2) 0;
  color: var(--fg-2);
}

kbd {
  display: inline-block;
  min-width: 24px;
  padding: 1px 6px;
  border: 1px solid var(--rule-input);
  border-bottom-width: 2px;
  border-radius: var(--radius-1);
  background: var(--surface-2);
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
  text-align: center;
}

.keys__toggle {
  margin-inline-end: auto;
}
</style>
