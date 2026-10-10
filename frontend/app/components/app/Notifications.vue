<script setup lang="ts">
import { driveApi, type Notification } from '~/services/api/drive'

// Notifications in the top bar: who shared what, uploads into file requests, new devices.
// Refreshed every minute while the tab is visible. New ones stay highlighted while the panel
// is open, and are marked read when it closes.
const { t, locale } = useI18n()
const errorMessage = useErrorMessage()
const drive = useDrive()
const NuxtLink = resolveComponent('NuxtLink')

const items = ref<Notification[]>([])
const loading = ref(true)
const failure = ref('')
const unread = computed(() => items.value.filter((n) => !n.read).length)
let timer: ReturnType<typeof setInterval> | undefined

async function load() {
  try {
    const list = await driveApi.notifications()
    await drive.absorb(list.flatMap((n) => (n.item ? [n.item] : [])))
    items.value = list
    failure.value = ''
  } catch (error) {
    failure.value = errorMessage(error)
  } finally {
    loading.value = false
  }
}

async function markRead() {
  if (!unread.value) return
  const before = items.value
  items.value = items.value.map((n) => ({ ...n, read: true }))
  try {
    await driveApi.markNotificationsRead()
  } catch {
    items.value = before
  }
}

function text(n: Notification): string {
  const who = n.actor?.name ?? ''
  const what = n.item ? (drive.item(n.item.id)?.name ?? t('drive.item.unnamed')) : ''
  return t(`app.notifications.${n.kind}`, { who, what })
}

function target(n: Notification): string | null {
  if (n.kind === 'shared') return '/drive/shared'
  if (n.kind === 'request_upload') return '/drive/requests'
  if (n.kind === 'device') return '/settings/security'
  if (n.kind === 'recovery') return '/admin/recovery'
  return null
}

onMounted(() => {
  load()
  timer = setInterval(() => !document.hidden && load(), 60_000)
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <SgPopover :label="t('app.notifications.label')" icon="bell" :badge="unread" :width="360" @close="markRead">
    <div class="notes">
      <p class="notes__title">{{ t('app.notifications.label') }}</p>
      <div v-if="loading" class="notes__state"><SgSkeleton :lines="3" /></div>
      <p v-else-if="failure" class="notes__state">{{ failure }}</p>
      <p v-else-if="!items.length" class="notes__state">{{ t('app.notifications.empty') }}</p>
      <ul v-else class="notes__list">
        <li v-for="n in items" :key="n.id">
          <component :is="target(n) ? NuxtLink : 'div'" :to="target(n) ?? undefined" class="notes__item" :class="{ 'is-unread': !n.read }">
            <SgAvatar v-if="n.actor" :name="n.actor.name" :size="28" />
            <SgIcon v-else name="info" :size="18" />
            <span class="notes__text">
              <span>{{ text(n) }}</span>
              <time :datetime="n.at">{{ formatWhen(n.at, locale) }}</time>
            </span>
          </component>
        </li>
      </ul>
    </div>
  </SgPopover>
</template>

<style scoped>
.notes__title {
  margin: 0;
  padding: var(--s-3) var(--s-4);
  border-bottom: 1px solid var(--rule);
  font-weight: var(--fw-medium);
}

.notes__state {
  margin: 0;
  padding: var(--s-4);
  font-size: var(--fs-sm);
  color: var(--fg-2);
}

.notes__list {
  max-height: min(420px, calc(100dvh - 160px));
  margin: 0;
  padding: var(--s-1);
  overflow-y: auto;
  list-style: none;
}

.notes__item {
  display: flex;
  align-items: flex-start;
  gap: var(--s-3);
  padding: var(--s-2) var(--s-3);
  border-radius: var(--radius-1);
  color: var(--fg);
  font-size: var(--fs-sm);
  text-decoration: none;
}

a.notes__item:hover {
  background: var(--surface-2);
}

.notes__item.is-unread {
  background: var(--signal-soft);
}

.notes__text {
  display: grid;
  gap: 2px;
}

.notes__text time {
  font-size: var(--fs-xs);
  color: var(--fg-2);
}
</style>
