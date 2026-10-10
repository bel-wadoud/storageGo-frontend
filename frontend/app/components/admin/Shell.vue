<script setup lang="ts">
import type { IconName } from '~/utils/icons'

// The frame of every admin page: the console's pages (a side column on wide screens, a
// scrolling row of tabs on phones, where urgent actions like approving a recovery still work)
// and the page, with its title, one sentence of context and its main actions.
const props = defineProps<{
  title: string
  lead?: string
  /** A circled "i" explaining a hard word (glossary key, see SgInfo). */
  info?: string
}>()

const { t, locale } = useI18n()
const route = useRoute()
const { overview, ensure } = useAdminOverview()
onMounted(ensure)

const pages = computed(() => {
  const pending = overview.value?.pending
  const list: { to: string; label: string; icon: IconName; count?: number }[] = [
    { to: '/admin', label: t('admin.nav.overview'), icon: 'activity' },
    { to: '/admin/members', label: t('admin.nav.members'), icon: 'users', count: pending?.invites || undefined },
    { to: '/admin/groups', label: t('admin.nav.groups'), icon: 'building' },
    { to: '/admin/recovery', label: t('admin.nav.recovery'), icon: 'key', count: pending?.recovery || undefined },
    { to: '/admin/devices', label: t('admin.nav.devices'), icon: 'monitor', count: pending?.devices || undefined },
    { to: '/admin/policies', label: t('admin.nav.policies'), icon: 'settings' },
    { to: '/admin/audit', label: t('admin.nav.audit'), icon: 'history' },
    { to: '/admin/compliance', label: t('admin.nav.compliance'), icon: 'check-circle' },
    { to: '/admin/billing', label: t('admin.nav.billing'), icon: 'sheet' },
    { to: '/admin/organization', label: t('admin.nav.organization'), icon: 'building' },
  ]
  return list
})
// Members waiting are invitations: informative, not urgent. Recovery and devices are urgent.
const urgent = (to: string) => to === '/admin/recovery' || to === '/admin/devices'

useHead({ title: () => `${props.title} · ${t('app.nav.admin')} · storageGo` })

// On phones the pages are a scrolling row of tabs: bring the current one into view.
const nav = ref<HTMLElement | null>(null)
onMounted(() => {
  const row = nav.value
  const current = row?.querySelector<HTMLElement>('[aria-current="page"]')
  if (!row || !current || row.scrollWidth <= row.clientWidth) return
  const box = row.getBoundingClientRect()
  const tab = current.getBoundingClientRect()
  // A relative shift works the same in both directions (scrollLeft is negative in RTL).
  row.scrollLeft += tab.left + tab.width / 2 - (box.left + box.width / 2)
})
</script>

<template>
  <div class="admin">
    <nav ref="nav" class="admin__nav" :aria-label="t('app.nav.admin')">
      <p class="admin__heading">{{ t('app.nav.admin') }}</p>
      <ul>
        <li v-for="page in pages" :key="page.to">
          <NuxtLink :to="page.to" class="admin__link" :aria-current="route.path === page.to ? 'page' : undefined">
            <SgIcon :name="page.icon" :size="16" />
            <span class="admin__label">{{ page.label }}</span>
            <span v-if="page.count" class="admin__count" :class="{ 'is-urgent': urgent(page.to) }">
              {{ formatNumber(page.count, locale) }}<span class="sr-only"> {{ t('admin.nav.waiting') }}</span>
            </span>
          </NuxtLink>
        </li>
      </ul>
    </nav>

    <div class="admin__page">
      <header class="admin__head">
        <div class="admin__titles">
          <h1>{{ title }}<SgInfo v-if="info" :term="info" /></h1>
          <p v-if="lead">{{ lead }}</p>
        </div>
        <div v-if="$slots.actions" class="admin__actions"><slot name="actions" /></div>
      </header>
      <slot />
    </div>
  </div>
</template>

<style scoped>
.admin {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: var(--s-7);
  max-width: 1320px;
}

.admin__nav {
  position: sticky;
  top: var(--s-5);
  align-self: start;
  min-width: 0;
}

.admin__heading {
  margin: 0 0 var(--s-3);
  padding-inline: var(--s-3);
  font-size: var(--fs-xs);
  color: var(--fg-2);
}

.admin__nav ul {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.admin__link {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  min-height: 36px;
  padding: 0 var(--s-3);
  border-radius: var(--radius-1);
  color: var(--fg-2);
  padding-block: 6px;
  font-size: var(--fs-sm);
  line-height: 1.3;
  text-decoration: none;
  transition:
    background-color var(--dur-1) var(--ease),
    color var(--dur-1) var(--ease);
}

.admin__link:hover {
  background: var(--surface-2);
  color: var(--fg);
}

.admin__link:active {
  background: var(--surface-3);
}

.admin__link[aria-current='page'] {
  background: var(--surface-3);
  color: var(--fg);
  font-weight: var(--fw-medium);
}

.admin__label {
  flex: 1;
  min-width: 0;
}

.admin__link > :deep(svg) {
  flex: none;
}

.admin__count {
  /* Holds its screen-reader text, which would otherwise widen the page from the tab row. */
  position: relative;
  min-width: 20px;
  padding: 0 6px;
  border-radius: var(--radius-full);
  background: var(--surface-3);
  color: var(--fg-2);
  font-size: var(--fs-xs);
  font-variant-numeric: tabular-nums;
  line-height: 18px;
  text-align: center;
}

.admin__count.is-urgent {
  background: var(--signal);
  color: var(--signal-ink);
  font-weight: var(--fw-medium);
}

.admin__page {
  display: grid;
  /* One column that can shrink: a wide table scrolls in its box instead of widening the page. */
  grid-template-columns: minmax(0, 1fr);
  align-content: start;
  gap: var(--s-6);
  min-width: 0;
}

.admin__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--s-3) var(--s-5);
}

.admin__titles {
  min-width: 0;
}

.admin__head h1 {
  margin: 0;
  font-size: var(--fs-xl);
  font-weight: var(--fw-medium);
}

.admin__head p {
  margin: var(--s-2) 0 0;
  max-width: 70ch;
  color: var(--fg-2);
}

.admin__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2);
}

@media (max-width: 999px) {
  .admin {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--s-5);
  }

  .admin__nav {
    position: static;
    margin-inline: calc(-1 * var(--s-4));
    padding-inline: var(--s-4);
    overflow-x: auto;
    border-bottom: 1px solid var(--rule);
    scrollbar-width: none;
  }

  .admin__heading {
    display: none;
  }

  .admin__nav ul {
    display: flex;
    gap: var(--s-1);
    padding-bottom: var(--s-2);
  }

  /* Tabs on one line each. */
  .admin__link {
    white-space: nowrap;
  }
}
</style>
