<script setup lang="ts">
// Personal space and organization(s). Switching opens the chosen workspace's files.
const { t } = useI18n()
const drive = useDrive()

const current = computed(() => drive.workspace.value)
const items = computed(() =>
  drive.workspaces.value.map((w) => ({
    key: w.id,
    label: w.name,
    icon: w.id === drive.workspaceId.value ? ('check' as const) : w.kind === 'org' ? ('building' as const) : ('user' as const),
  })),
)

function choose(id: string) {
  if (id === drive.workspaceId.value) return
  drive.switchWorkspace(id)
  navigateTo('/drive')
}
</script>

<template>
  <div class="ws">
    <template v-if="current">
      <span class="ws__kind">{{ current.kind === 'org' ? t('app.workspace.org') : t('app.workspace.personal') }}</span>
      <SgActionMenu
        v-if="drive.workspaces.value.length > 1"
        class="ws__menu"
        :label="t('app.workspace.switch', { name: current.name })"
        :title="current.name"
        :text="current.name"
        :icon="current.kind === 'org' ? 'building' : 'user'"
        :items="items"
        variant="ghost"
        size="md"
        @select="choose"
      />
      <p v-else class="ws__name" :title="current.name">
        <SgIcon :name="current.kind === 'org' ? 'building' : 'user'" :size="16" />
        <span class="ws__text" dir="auto">{{ current.name }}</span>
      </p>
    </template>
    <SgSkeleton v-else :lines="2" />
  </div>
</template>

<style scoped>
.ws {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.ws__kind {
  padding-inline: var(--s-3);
  font-size: var(--fs-xs);
  color: var(--fg-2);
}

/* A long name (a person's full name, an organization's legal name) ends with "…" instead of
   widening the sidebar; the full name is in the tooltip and the accessible label.
   (:deep: SgActionMenu has two roots, so this component's scope marker isn't on its button.) */
.ws :deep(.ws__menu) {
  justify-content: flex-start;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  font-weight: var(--fw-medium);
}

.ws :deep(.ws__menu .sg-btn__label) {
  /* A block (not the button's usual inline-flex): ellipsis only works on a block of text. */
  display: block;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-align: start;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ws__text {
  min-width: 0;
  overflow: hidden;
  text-align: match-parent;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ws__name {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--s-2);
  min-height: var(--control-h);
  margin: 0;
  padding-inline: var(--s-3);
  font-weight: var(--fw-medium);
}
</style>
