<script setup lang="ts">
import type { IconName } from '~/utils/icons'

// The app's navigation, on the inline-start side (left in FR/EN, right in AR): workspace,
// drive sections, the admin console for admins, and the storage meter with where data lives.
const { t } = useI18n()
const route = useRoute()
const drive = useDrive()

const sections = computed<{ to: string; label: string; icon: IconName; match: (path: string) => boolean }[]>(() => [
  { to: '/drive', label: t('app.nav.files'), icon: 'folder', match: (p) => p === '/drive' || p.startsWith('/drive/f/') },
  { to: '/drive/shared', label: t('app.nav.shared'), icon: 'users', match: (p) => p === '/drive/shared' },
  { to: '/drive/recent', label: t('app.nav.recent'), icon: 'clock', match: (p) => p === '/drive/recent' },
  { to: '/drive/starred', label: t('app.nav.starred'), icon: 'star', match: (p) => p === '/drive/starred' },
  { to: '/drive/links', label: t('app.nav.links'), icon: 'link', match: (p) => p === '/drive/links' },
  { to: '/drive/requests', label: t('app.nav.requests'), icon: 'inbox', match: (p) => p === '/drive/requests' },
  { to: '/drive/trash', label: t('app.nav.trash'), icon: 'trash', match: (p) => p === '/drive/trash' },
])

const isAdmin = computed(() => drive.workspace.value?.kind === 'org' && drive.workspace.value.admin)
</script>

<template>
  <nav class="side" :aria-label="t('app.nav.label')">
    <AppWorkspaceSwitcher />
    <ul class="side__list">
      <li v-for="section in sections" :key="section.to">
        <NuxtLink :to="section.to" class="side__link" :aria-current="section.match(route.path) ? 'page' : undefined">
          <SgIcon :name="section.icon" :size="17" />
          {{ section.label }}
        </NuxtLink>
      </li>
    </ul>
    <ul v-if="isAdmin" class="side__list side__list--admin">
      <li>
        <NuxtLink to="/admin" class="side__link" :aria-current="route.path.startsWith('/admin') ? 'page' : undefined">
          <SgIcon name="settings" :size="17" />
          {{ t('app.nav.admin') }}
        </NuxtLink>
      </li>
    </ul>
    <div class="side__foot">
      <AppStorageMeter />
    </div>
  </nav>
</template>

<style scoped>
.side {
  display: flex;
  flex-direction: column;
  gap: var(--s-5);
  height: 100%;
  padding: var(--s-4) var(--s-3);
}

.side__list {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.side__list--admin {
  padding-top: var(--s-4);
  border-top: 1px solid var(--rule);
}

.side__link {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  min-height: 36px;
  padding: 0 var(--s-3);
  border-radius: var(--radius-1);
  color: var(--fg-2);
  font-size: var(--fs-sm);
  text-decoration: none;
  transition:
    background-color var(--dur-1) var(--ease),
    color var(--dur-1) var(--ease);
}

.side__link:hover {
  background: var(--surface-2);
  color: var(--fg);
}

.side__link:active {
  background: var(--surface-3);
}

.side__link[aria-current='page'] {
  background: var(--surface-3);
  color: var(--fg);
  font-weight: var(--fw-medium);
}

.side__foot {
  margin-top: auto;
  padding: var(--s-4) var(--s-3) 0;
  border-top: 1px solid var(--rule);
}
</style>
