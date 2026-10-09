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
        :text="current.name"
        :icon="current.kind === 'org' ? 'building' : 'user'"
        :items="items"
        variant="ghost"
        size="md"
        @select="choose"
      />
      <p v-else class="ws__name">
        <SgIcon :name="current.kind === 'org' ? 'building' : 'user'" :size="16" />
        <bdi>{{ current.name }}</bdi>
      </p>
    </template>
    <SgSkeleton v-else :lines="2" />
  </div>
</template>

<style scoped>
.ws {
  display: grid;
  gap: 2px;
}

.ws__kind {
  padding-inline: var(--s-3);
  font-size: var(--fs-xs);
  color: var(--fg-2);
}

.ws__menu {
  justify-content: flex-start;
  width: 100%;
  font-weight: var(--fw-medium);
}

.ws__menu :deep(.sg-btn__label) {
  flex: 1;
  overflow: hidden;
  text-align: start;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ws__name {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  min-height: var(--control-h);
  margin: 0;
  padding-inline: var(--s-3);
  font-weight: var(--fw-medium);
}
</style>
