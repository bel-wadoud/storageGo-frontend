<script setup lang="ts">
import type { Transfer } from '~/composables/useTransfers'
import type { IconName } from '~/utils/icons'

// Uploads and downloads (states.md, "Upload tray"): persists across pages, collapses, shows
// the total in its header. Each upload goes Queued → Preparing → Encrypting on this device →
// Sending (n%, speed) → Verifying → Stored · Algiers (DZ-16). Problems say what to do next.
// Completions are announced politely, failures assertively (accessibility.md, "Focus").
const { t, locale } = useI18n()
const errorMessage = useErrorMessage()
const transfers = useTransfers()
const drive = useDrive()

const list = computed(() => transfers.transfers.value)
const open = transfers.trayOpen
const running = computed(() => transfers.active.value)
const finished = computed(() => list.value.filter((x) => ['done', 'cancelled', 'rejected'].includes(x.state)))
const failed = computed(() => list.value.filter((x) => x.state === 'failed'))

/** Overall progress, weighting each transfer by its size. */
const overall = computed(() => {
  const items = list.value.filter((x) => x.state !== 'cancelled' && x.state !== 'rejected')
  const total = items.reduce((sum, x) => sum + Math.max(x.size, 1), 0)
  if (!total) return 0
  const done = items.reduce((sum, x) => sum + Math.max(x.size, 1) * fraction(x), 0)
  return done / total
})

function fraction(x: Transfer): number {
  const phase = x.total ? Math.min(x.done / x.total, 1) : 0
  switch (x.state) {
    case 'done':
      return 1
    case 'encrypting':
      return phase * 0.1
    case 'sending':
      return 0.1 + phase * 0.85
    case 'verifying':
      return 0.97
    case 'downloading':
      return phase * 0.8
    case 'decrypting':
      return 0.8 + phase * 0.2
    default:
      return 0
  }
}

const where = computed(() =>
  (drive.quota.value?.wilayas ?? []).slice(0, 1).map((code) => t('storage.wilaya', { name: t(`wilayas.${code}`), code }))[0] ?? '',
)

function status(x: Transfer): string {
  const size = (n: number) => formatBytes(n, locale.value)
  switch (x.state) {
    case 'queued':
      return t('drive.tray.queued')
    case 'preparing':
      return t('drive.tray.preparing')
    case 'encrypting':
      return t('drive.tray.encrypting', { percent: percent(x) })
    case 'sending': {
      const left = x.speed > 0 ? Math.ceil((x.total - x.done) / x.speed) : 0
      return t('drive.tray.sending', {
        percent: percent(x),
        speed: `${size(x.speed)}/s`,
        left: left ? t('drive.tray.left', { time: duration(left) }) : '',
      })
    }
    case 'verifying':
      return t('drive.tray.verifying')
    case 'downloading':
      return t('drive.tray.downloading', { done: size(x.done), total: size(x.total) })
    case 'decrypting':
      return t('drive.tray.decrypting')
    case 'done':
      return x.kind === 'upload' ? (where.value ? t('drive.tray.stored', { where: where.value }) : t('drive.tray.storedPlain')) : t('drive.tray.saved')
    case 'paused':
      return t('drive.tray.paused')
    case 'cancelled':
      return t('drive.tray.cancelled')
    case 'rejected':
    case 'failed':
      return problem(x)
  }
}

function problem(x: Transfer): string {
  const p = x.problem
  if (!p) return t('drive.tray.failed')
  if (p.code === 'too_large') return t('drive.tray.tooLarge', { size: formatBytes(x.size, locale.value), limit: formatBytes(p.limit, locale.value) })
  if (p.code === 'quota') return p.contact ? t('drive.tray.quotaOrg', { who: p.contact }) : t('drive.tray.quota')
  if (p.code === 'altered') return t('drive.tray.altered')
  if (p.code === 'access') return t('drive.tray.access')
  return errorMessage(p.error)
}

function percent(x: Transfer) {
  return new Intl.NumberFormat(intlLocale(locale.value), { style: 'percent' }).format(x.total ? Math.min(x.done / x.total, 1) : 0)
}

function duration(seconds: number) {
  return seconds < 60 ? t('time.seconds', { n: seconds }, seconds) : t('time.minutes', { n: Math.ceil(seconds / 60) }, Math.ceil(seconds / 60))
}

const headline = computed(() => {
  if (running.value.length) {
    return t('drive.tray.running', {
      n: running.value.length,
      percent: new Intl.NumberFormat(intlLocale(locale.value), { style: 'percent' }).format(overall.value),
    }, running.value.length)
  }
  if (failed.value.length) return t('drive.tray.someFailed', { n: failed.value.length }, failed.value.length)
  return t('drive.tray.allDone', { n: finished.value.length }, finished.value.length)
})

// Announcements: one polite line per completion, an assertive one per failure.
const announcePolite = ref('')
const announceAlert = ref('')
watch(
  () => list.value.map((x) => `${x.id}:${x.state}`).join('|'),
  (now, before) => {
    const old = new Map((before ?? '').split('|').filter(Boolean).map((s) => s.split(':') as [string, string]))
    for (const x of list.value) {
      if (old.get(x.id) === x.state) continue
      if (x.state === 'done') announcePolite.value = `${x.name}: ${status(x)}`
      if (x.state === 'failed' || x.state === 'rejected') announceAlert.value = `${x.name}: ${status(x)}`
    }
  },
)

// Leaving the page during an upload: the browser asks first; the tray explains on return.
function onBeforeUnload(event: BeforeUnloadEvent) {
  if (!list.value.some((x) => x.kind === 'upload' && ['queued', 'preparing', 'encrypting', 'sending', 'verifying'].includes(x.state))) return
  event.preventDefault()
  event.returnValue = ''
}
onMounted(() => window.addEventListener('beforeunload', onBeforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload))

const stateIcon = (x: Transfer): IconName =>
  x.state === 'done' ? 'check-circle' : x.state === 'failed' || x.state === 'rejected' ? 'alert' : x.state === 'paused' ? 'cloud-off' : x.kind === 'upload' ? 'upload' : 'download'
</script>

<template>
  <section v-if="list.length" class="tray" :class="{ 'is-open': open }" :aria-label="t('drive.tray.label')">
    <header class="tray__head">
      <button type="button" class="tray__toggle" :aria-expanded="open" @click="open = !open">
        <SgSpinner v-if="running.length" decorative size="sm" />
        <SgIcon v-else :name="failed.length ? 'alert' : 'check-circle'" :size="16" :class="failed.length ? 'is-bad' : 'is-good'" />
        <span>{{ headline }}</span>
        <SgIcon class="tray__chev" name="chevron-down" :size="16" />
      </button>
      <SgButton
        v-if="!running.length"
        variant="ghost"
        size="sm"
        icon-only
        icon="x"
        :label="t('drive.tray.close')"
        @click="transfers.clearFinished(); failed.length || (open = false)"
      />
    </header>
    <SgProgress v-if="running.length" class="tray__total" :value="overall" :max="1" />

    <ul v-show="open" class="tray__list">
      <li v-for="x in list" :key="x.id" class="tray__item" :class="`is-${x.state}`">
        <SgIcon class="tray__icon" :name="stateIcon(x)" :size="16" />
        <div class="tray__text">
          <p class="tray__name" dir="auto"><SgFileName :name="x.name" /></p>
          <p class="tray__status">{{ status(x) }}</p>
          <SgProgress
            v-if="['encrypting', 'sending', 'downloading', 'decrypting'].includes(x.state)"
            :value="x.done"
            :max="Math.max(x.total, 1)"
            :tone="x.state === 'encrypting' || x.state === 'decrypting' ? 'neutral' : 'signal'"
          />
          <SgProgress v-else-if="x.state === 'preparing' || x.state === 'verifying'" />
        </div>
        <div class="tray__actions">
          <SgButton
            v-if="x.state === 'failed' || x.state === 'paused'"
            variant="ghost"
            size="sm"
            icon-only
            icon="refresh"
            :label="t('drive.tray.retry', { name: x.name })"
            @click="transfers.retry(x.id)"
          />
          <SgButton
            v-if="!['done', 'cancelled', 'rejected'].includes(x.state)"
            variant="ghost"
            size="sm"
            icon-only
            icon="x"
            :label="t('drive.tray.cancel', { name: x.name })"
            @click="transfers.cancel(x.id)"
          />
          <SgButton
            v-else
            variant="ghost"
            size="sm"
            icon-only
            icon="x"
            :label="t('drive.tray.remove', { name: x.name })"
            @click="transfers.remove(x.id)"
          />
        </div>
      </li>
    </ul>
    <p v-show="open && running.length" class="tray__note"><SgIcon name="lock" :size="13" />{{ t('drive.tray.note') }}</p>

    <span class="sr-only" aria-live="polite">{{ announcePolite }}</span>
    <span class="sr-only" aria-live="assertive">{{ announceAlert }}</span>
  </section>
</template>

<style scoped>
.tray {
  position: fixed;
  inset-inline-end: var(--s-4);
  bottom: var(--s-4);
  z-index: 40;
  width: min(380px, calc(100vw - 2 * var(--s-4)));
  border: 1px solid var(--rule);
  border-radius: var(--radius-2);
  background: var(--surface);
  box-shadow: var(--shadow-pop);
}

.tray__head {
  display: flex;
  align-items: center;
  gap: var(--s-1);
  padding: var(--s-1) var(--s-2);
}

.tray__toggle {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--s-2);
  min-height: 40px;
  padding: 0 var(--s-2);
  border: 0;
  border-radius: var(--radius-1);
  background: none;
  color: var(--fg);
  font: inherit;
  font-size: var(--fs-sm);
  font-weight: var(--fw-medium);
  text-align: start;
  cursor: pointer;
}

.tray__toggle:hover {
  background: var(--surface-2);
}

.tray__chev {
  margin-inline-start: auto;
  color: var(--fg-2);
  transition: transform var(--dur-1) var(--ease);
}

.tray:not(.is-open) .tray__chev {
  transform: rotate(180deg);
}

.is-good {
  color: var(--success);
}

.is-bad {
  color: var(--danger);
}

.tray__total {
  padding: 0 var(--s-3) var(--s-2);
}

.tray__list {
  max-height: min(320px, 50dvh);
  margin: 0;
  padding: 0 var(--s-2) var(--s-2);
  overflow-y: auto;
  list-style: none;
  border-top: 1px solid var(--rule);
}

.tray__item {
  display: flex;
  align-items: flex-start;
  gap: var(--s-2);
  padding: var(--s-2);
  border-bottom: 1px solid var(--rule-soft);
}

.tray__icon {
  margin-top: 2px;
  color: var(--fg-2);
}

.tray__item.is-done .tray__icon {
  color: var(--success);
}

.tray__item.is-failed .tray__icon,
.tray__item.is-rejected .tray__icon {
  color: var(--danger);
}

.tray__text {
  display: grid;
  flex: 1;
  gap: 4px;
  min-width: 0;
}

.tray__name,
.tray__status {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tray__name {
  font-size: var(--fs-sm);
  text-align: match-parent;
  white-space: nowrap;
}

.tray__status {
  font-size: var(--fs-xs);
  color: var(--fg-2);
}

.tray__item.is-failed .tray__status,
.tray__item.is-rejected .tray__status {
  color: var(--danger);
}

.tray__actions {
  display: flex;
}

.tray__note {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding: var(--s-2) var(--s-4) var(--s-3);
  font-size: var(--fs-xs);
  color: var(--fg-2);
}

@media (max-width: 899px) {
  .tray {
    bottom: calc(64px + env(safe-area-inset-bottom));
  }
}
</style>
