<script setup lang="ts">
// The admin overview (sitemap §5): what's waiting for an administrator, seats and storage,
// whether the organization's safety nets are in place, and the latest activity.
definePageMeta({ layout: 'app', middleware: ['auth', 'admin'] })
const { t, locale } = useI18n()
const online = useOnline()
const errorMessage = useErrorMessage()
const { overview, error, refresh } = useAdminOverview()
const words = useAuditText()
onMounted(refresh)

const waiting = computed(() => {
  const pending = overview.value?.pending
  if (!pending) return []
  return [
    { key: 'recovery', n: pending.recovery, to: '/admin/recovery', icon: 'key' as const, urgent: true },
    { key: 'devices', n: pending.devices, to: '/admin/devices?status=pending', icon: 'monitor' as const, urgent: true },
    { key: 'invites', n: pending.invites, to: '/admin/members?status=invited', icon: 'mail' as const, urgent: false },
  ].filter((item) => item.n > 0)
})

type Check = { key: string; ok: boolean; text: string; to: string; action: string }
const checks = computed<Check[]>(() => {
  const health = overview.value?.health
  if (!health) return []
  const list: Check[] = [
    {
      key: 'domain',
      ok: health.domain_verified,
      text: health.domain_verified ? t('admin.overview.health.domainOk') : t('admin.overview.health.domain'),
      to: '/admin/organization#domain',
      action: t('admin.overview.health.verifyDomain'),
    },
  ]
  if (health.org_recovery) {
    list.push({
      key: 'holders',
      ok: health.key_holders >= 2,
      text: health.key_holders >= 2 ? t('admin.overview.health.holdersOk', { n: health.key_holders }) : t('admin.overview.health.holders'),
      to: '/admin/organization#admins',
      action: t('admin.overview.health.addHolder'),
    })
  } else {
    list.push({ key: 'recovery', ok: false, text: t('admin.overview.health.recoveryOff'), to: '/admin/policies#recovery', action: t('admin.overview.health.openPolicies') })
  }
  list.push({
    key: 'devices',
    ok: health.device_approval !== 'none',
    text: health.device_approval !== 'none' ? t('admin.overview.health.devicesOk') : t('admin.overview.health.devices'),
    to: '/admin/policies#devices',
    action: t('admin.overview.health.openPolicies'),
  })
  list.push({
    key: 'kits',
    ok: health.kits_missing === 0,
    text: health.kits_missing === 0 ? t('admin.overview.health.kitsOk') : t('admin.overview.health.kits', { n: health.kits_missing }, health.kits_missing),
    to: '/admin/members',
    action: t('admin.overview.health.seeMembers'),
  })
  return list
})

const seatRatio = computed(() => (overview.value ? (overview.value.seats.used + overview.value.seats.pending) / Math.max(overview.value.seats.total, 1) : 0))
const storageRatio = computed(() => (overview.value ? overview.value.storage.used / Math.max(overview.value.storage.limit, 1) : 0))
const tone = (ratio: number) => (ratio >= 0.95 ? 'danger' : ratio >= 0.8 ? 'signal' : 'neutral')
</script>

<template>
  <AdminShell :title="t('admin.overview.title')" :lead="t('admin.overview.lead')">
    <SgAlert v-if="error && !overview" tone="danger">
      {{ errorMessage(error) }}
      <template #actions><SgButton size="sm" icon="refresh" :disabled="!online" :disabled-reason="t('auth.offlineReason')" @click="refresh">{{ t('common.retry') }}</SgButton></template>
    </SgAlert>
    <div v-else-if="!overview" class="settings-loading" aria-busy="true"><SgSkeleton :lines="8" /></div>

    <template v-else>
      <SettingsSection id="waiting" :title="t('admin.overview.waiting')">
        <p v-if="!waiting.length" class="ov__calm"><SgIcon name="check-circle" :size="16" />{{ t('admin.overview.nothingWaiting') }}</p>
        <ul v-else class="ov__waiting">
          <li v-for="item in waiting" :key="item.key">
            <NuxtLink :to="item.to" class="ov__wait" :class="{ 'is-urgent': item.urgent }">
              <SgIcon :name="item.icon" :size="18" />
              <span class="ov__wait-text">{{ t(`admin.overview.pending.${item.key}`, { n: item.n }, item.n) }}</span>
              <SgIcon name="chevron-end" :size="16" />
            </NuxtLink>
          </li>
        </ul>
      </SettingsSection>

      <SettingsSection id="usage" :title="t('admin.overview.usage')" info="seats">
        <div class="ov__meters">
          <div>
            <SgProgress
              :value="overview.seats.used + overview.seats.pending"
              :max="Math.max(overview.seats.total, 1)"
              :tone="tone(seatRatio)"
              :label="t('admin.overview.seats', { used: formatNumber(overview.seats.used, locale), total: formatNumber(overview.seats.total, locale) })"
            />
            <p class="form__note">
              <template v-if="overview.seats.pending">{{ t('admin.overview.seatsPending', { n: overview.seats.pending }, overview.seats.pending) }} · </template>
              <NuxtLink to="/admin/billing#seats">{{ t('admin.overview.addSeats') }}</NuxtLink>
            </p>
          </div>
          <div>
            <SgProgress
              :value="overview.storage.used"
              :max="Math.max(overview.storage.limit, 1)"
              :tone="tone(storageRatio)"
              :label="t('storage.used', { used: formatBytes(overview.storage.used, locale), total: formatBytes(overview.storage.limit, locale) })"
            />
            <p class="form__note"><NuxtLink to="/admin/compliance">{{ t('admin.overview.whereStored') }}</NuxtLink></p>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection id="health" :title="t('admin.overview.healthTitle')" :description="t('admin.overview.healthHint')" info="safetyNets">
        <ul class="item-list">
          <li v-for="check in checks" :key="check.key">
            <SgIcon class="item-list__icon" :class="check.ok ? 'is-ok' : 'is-warn'" :name="check.ok ? 'check-circle' : 'alert'" :size="18" />
            <div class="item-list__main">
              <p class="item-list__title">{{ check.text }}</p>
            </div>
            <div class="item-list__actions">
              <SgButton v-if="!check.ok" size="sm" :to="check.to">{{ check.action }}</SgButton>
            </div>
          </li>
        </ul>
      </SettingsSection>

      <SettingsSection id="recent" :title="t('admin.overview.recent')">
        <p v-if="!overview.recent.length" class="form__note">{{ t('admin.audit.empty') }}</p>
        <ul v-else class="item-list">
          <li v-for="event in overview.recent" :key="event.id">
            <div class="item-list__main">
              <p class="item-list__title">
                <span><bdi>{{ words.actor(event) }}</bdi> · {{ words.action(event) }}<template v-if="words.target(event)"> · <bdi>{{ words.target(event) }}</bdi></template></span>
              </p>
              <p class="item-list__meta">{{ formatWhen(event.at, locale) }}<template v-if="event.location"> · <bdi>{{ event.location }}</bdi></template></p>
            </div>
          </li>
        </ul>
        <div><SgButton size="sm" icon="history" to="/admin/audit">{{ t('admin.overview.allActivity') }}</SgButton></div>
      </SettingsSection>
    </template>
  </AdminShell>
</template>

<style scoped>
.ov__calm {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  margin: 0;
  color: var(--success);
}

.ov__waiting {
  display: grid;
  gap: var(--s-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.ov__wait {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  min-height: 48px;
  padding: 0 var(--s-4);
  border: 1px solid var(--rule);
  border-radius: var(--radius-2);
  background: var(--surface);
  color: var(--fg);
  text-decoration: none;
  transition:
    background-color var(--dur-1) var(--ease),
    border-color var(--dur-1) var(--ease);
}

.ov__wait:hover {
  border-color: var(--fg-3);
  background: var(--surface-2);
}

.ov__wait:active {
  background: var(--surface-3);
}

.ov__wait.is-urgent {
  border-inline-start: 3px solid var(--signal);
}

.ov__wait-text {
  flex: 1;
  font-weight: var(--fw-medium);
}

.ov__meters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  gap: var(--s-6);
}

.ov__meters .form__note {
  margin: var(--s-2) 0 0;
}

.is-ok {
  color: var(--success);
}

.is-warn {
  color: var(--signal);
}
</style>
