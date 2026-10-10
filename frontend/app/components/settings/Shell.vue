<script setup lang="ts">
import type { IconName } from '~/utils/icons'

// The frame of every settings page: the list of settings pages (a side column on wide
// screens, a scrolling row of tabs on phones) and the page itself.
const props = defineProps<{
  title: string
  lead?: string
  /** A circled "i" explaining a hard word (glossary key, see SgInfo). */
  info?: string
}>()

const { t } = useI18n()
const route = useRoute()
const { account } = useAccount()

const pages = computed(() => {
  const list: { to: string; label: string; icon: IconName }[] = [
    { to: '/settings/profile', label: t('settings.nav.profile'), icon: 'user' },
    { to: '/settings/language', label: t('settings.nav.language'), icon: 'globe' },
    { to: '/settings/security', label: t('settings.nav.security'), icon: 'key' },
    { to: '/settings/notifications', label: t('settings.nav.notifications'), icon: 'bell' },
    // Organization members see who handles their plan (their administrators) there.
    { to: '/settings/plan', label: t('settings.nav.plan'), icon: 'sheet' },
  ]
  return list
})

useHead({ title: () => `${props.title} · ${t('settings.title')} · storageGo` })

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
  <div class="settings">
    <nav ref="nav" class="settings__nav" :aria-label="t('settings.title')">
      <p class="settings__heading">{{ t('settings.title') }}</p>
      <ul>
        <li v-for="page in pages" :key="page.to">
          <NuxtLink :to="page.to" class="settings__link" :aria-current="route.path === page.to ? 'page' : undefined">
            <SgIcon :name="page.icon" :size="16" />
            {{ page.label }}
          </NuxtLink>
        </li>
      </ul>
      <p v-if="account" class="settings__who" :title="account.email">
        <bdi>{{ account.email }}</bdi>
      </p>
    </nav>

    <div class="settings__page">
      <header class="settings__head">
        <h1>{{ title }}<SgInfo v-if="info" :term="info" /></h1>
        <p v-if="lead">{{ lead }}</p>
      </header>
      <slot />
    </div>
  </div>
</template>

<style scoped>
.settings {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: var(--s-8);
  max-width: 1040px;
}

.settings__nav {
  position: sticky;
  top: var(--s-5);
  align-self: start;
  min-width: 0;
}

.settings__heading {
  margin: 0 0 var(--s-3);
  padding-inline: var(--s-3);
  font-size: var(--fs-xs);
  color: var(--fg-2);
}

.settings__nav ul {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.settings__link {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  min-height: 36px;
  padding: 0 var(--s-3);
  border-radius: var(--radius-1);
  color: var(--fg-2);
  font-size: var(--fs-sm);
  text-decoration: none;
  white-space: nowrap;
  transition:
    background-color var(--dur-1) var(--ease),
    color var(--dur-1) var(--ease);
}

.settings__link:hover {
  background: var(--surface-2);
  color: var(--fg);
}

.settings__link:active {
  background: var(--surface-3);
}

.settings__link[aria-current='page'] {
  background: var(--surface-3);
  color: var(--fg);
  font-weight: var(--fw-medium);
}

.settings__who {
  margin: var(--s-4) 0 0;
  padding-inline: var(--s-3);
  overflow: hidden;
  font-size: var(--fs-xs);
  color: var(--fg-3);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings__page {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-content: start;
  gap: var(--s-6);
  min-width: 0;
}

.settings__head h1 {
  margin: 0;
  font-size: var(--fs-xl);
  font-weight: var(--fw-medium);
}

.settings__head p {
  margin: var(--s-2) 0 0;
  max-width: 62ch;
  color: var(--fg-2);
}

@media (max-width: 899px) {
  .settings {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--s-5);
  }

  .settings__nav {
    position: static;
    margin-inline: calc(-1 * var(--s-4));
    padding-inline: var(--s-4);
    overflow-x: auto;
    border-bottom: 1px solid var(--rule);
    scrollbar-width: none;
  }

  .settings__heading,
  .settings__who {
    display: none;
  }

  .settings__nav ul {
    display: flex;
    gap: var(--s-1);
    padding-bottom: var(--s-2);
  }
}
</style>
