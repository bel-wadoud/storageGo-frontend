<script setup lang="ts">
// Workspace › Folder › Sub-folder. The last crumb is the current page. On phones the middle
// collapses to "…" so the path never wraps onto many lines.
const props = defineProps<{ crumbs: { id: string; name: string; to: string }[] }>()
const { t } = useI18n()

const collapsed = computed(() => props.crumbs.length > 3)
</script>

<template>
  <nav class="crumbs" :aria-label="t('drive.breadcrumbs')">
    <ol>
      <li
        v-for="(crumb, index) in crumbs"
        :key="crumb.id"
        :class="{ 'is-middle': collapsed && index > 0 && index < crumbs.length - 2 }"
      >
        <NuxtLink v-if="index < crumbs.length - 1" :to="crumb.to" class="crumbs__link" dir="auto">{{ crumb.name }}</NuxtLink>
        <h1 v-else class="crumbs__current" dir="auto">{{ crumb.name }}</h1>
        <SgIcon v-if="index < crumbs.length - 1" class="crumbs__sep" name="chevron-end" :size="14" />
      </li>
      <li v-if="collapsed" class="crumbs__ellipsis" aria-hidden="true">…<SgIcon class="crumbs__sep" name="chevron-end" :size="14" /></li>
    </ol>
  </nav>
</template>

<style scoped>
.crumbs ol {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
  min-width: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

.crumbs li {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
}

.crumbs__link {
  max-width: 220px;
  padding: 2px 6px;
  overflow: hidden;
  border-radius: var(--radius-1);
  color: var(--fg-2);
  font-size: var(--fs-lg);
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition:
    background-color var(--dur-1) var(--ease),
    color var(--dur-1) var(--ease);
}

.crumbs__link:hover {
  background: var(--surface-2);
  color: var(--fg);
}

.crumbs__current {
  margin: 0;
  padding: 2px 6px;
  overflow: hidden;
  font-size: var(--fs-lg);
  font-weight: var(--fw-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.crumbs__sep {
  flex: none;
  color: var(--fg-3);
}

.crumbs__ellipsis {
  display: none !important;
  color: var(--fg-3);
}

@media (max-width: 899px) {
  .crumbs li.is-middle {
    display: none;
  }

  .crumbs__ellipsis {
    display: inline-flex !important;
    order: 1;
  }

  .crumbs li:first-child {
    order: 0;
  }

  .crumbs li:not(:first-child):not(.crumbs__ellipsis) {
    order: 2;
  }
}
</style>
