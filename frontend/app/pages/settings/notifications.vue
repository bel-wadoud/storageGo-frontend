<script setup lang="ts">
import { accountApi, type NotificationPrefs } from '~/services/api/account'

// Which emails storageGo sends. Each switch saves on its own and says so; security alerts
// (new device, passphrase changed) can't be turned off, and the page says why.
definePageMeta({ layout: 'app', middleware: 'auth' })
const { t } = useI18n()
const toast = useToast()
const online = useOnline()
const errorMessage = useErrorMessage()
const { account } = useAccount()

type Key = keyof NotificationPrefs
const prefs = ref<NotificationPrefs | null>(null)
const loadError = shallowRef<unknown>(null)
const saving = ref<Key | null>(null)
const savedKey = ref<Key | null>(null)
let savedTimer: ReturnType<typeof setTimeout> | undefined

async function load() {
  loadError.value = null
  try {
    prefs.value = await accountApi.notificationPrefs()
  } catch (error) {
    loadError.value = error
  }
}
onMounted(load)
onBeforeUnmount(() => clearTimeout(savedTimer))

const rows = computed(() => {
  const list: { key: Key; locked?: boolean }[] = [{ key: 'shares' }, { key: 'requests' }, { key: 'storage' }]
  // Recovery requests only reach organization administrators.
  if (account.value?.kind === 'org') list.push({ key: 'recovery' })
  list.push({ key: 'security', locked: true })
  return list
})

async function toggle(key: Key, on: boolean) {
  if (!prefs.value) return
  const before = prefs.value[key]
  prefs.value = { ...prefs.value, [key]: on }
  saving.value = key
  try {
    prefs.value = await accountApi.setNotificationPref(key, on)
    savedKey.value = key
    clearTimeout(savedTimer)
    savedTimer = setTimeout(() => (savedKey.value = null), 2000)
  } catch (error) {
    prefs.value = { ...prefs.value, [key]: before }
    toast.error(errorMessage(error))
  } finally {
    saving.value = null
  }
}
</script>

<template>
  <SettingsShell :title="t('settings.notifications.title')" :lead="t('settings.notifications.lead')">
    <SettingsSection :title="t('settings.notifications.email')" :description="t('settings.notifications.emailHint', { email: account?.email ?? '' })" info="emailNotifications">
      <SgAlert v-if="loadError" tone="danger">
        {{ errorMessage(loadError) }}
        <template #actions><SgButton size="sm" icon="refresh" @click="load">{{ t('common.retry') }}</SgButton></template>
      </SgAlert>
      <SgSkeleton v-else-if="!prefs" :lines="4" />
      <ul v-else class="item-list">
        <li v-for="row in rows" :key="row.key">
          <div class="item-list__main">
            <SgCheckbox
              :model-value="prefs[row.key]"
              :label="t(`settings.notifications.${row.key}`)"
              :description="row.locked ? t('settings.notifications.securityLocked') : t(`settings.notifications.${row.key}Hint`)"
              :disabled="row.locked || saving === row.key || !online"
              @update:model-value="(on) => toggle(row.key, on)"
            />
          </div>
          <span class="pref-state" aria-live="polite">
            <template v-if="saving === row.key"><SgSpinner decorative size="sm" />{{ t('settings.saving') }}</template>
            <template v-else-if="savedKey === row.key"><SgIcon name="check" :size="14" />{{ t('settings.saved') }}</template>
            <template v-else-if="row.locked"><SgIcon name="lock" :size="14" />{{ t('settings.notifications.alwaysOn') }}</template>
          </span>
        </li>
      </ul>
    </SettingsSection>

    <SettingsSection :title="t('settings.notifications.inApp')" :description="t('settings.notifications.inAppHint')" />
  </SettingsShell>
</template>

<style scoped>
.pref-state {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 90px;
  font-size: var(--fs-sm);
  color: var(--fg-2);
}
</style>
