<script setup lang="ts">
// Storage almost full (95%, dismissible for this session) or full (100%, uploads blocked,
// naming who can add space). states.md, "Quota 80% / 95% / 100%".
const { t, locale } = useI18n()
const drive = useDrive()
const dismissed = useState('drive:quota-dismissed', () => false)

const quota = computed(() => drive.quota.value)
const ratio = computed(() => (quota.value && quota.value.limit ? quota.value.used / quota.value.limit : 0))
const full = computed(() => ratio.value >= 1)
const who = computed(() => quota.value?.contact?.name ?? '')
</script>

<template>
  <SgAlert v-if="quota && full" tone="danger" :title="t('drive.quota.fullTitle')">
    {{ who ? t('drive.quota.fullOrg', { who }) : t('drive.quota.fullPersonal') }}
    <template v-if="!who" #actions>
      <SgButton size="sm" to="/settings/plan">{{ t('drive.quota.plan') }}</SgButton>
    </template>
  </SgAlert>
  <SgAlert
    v-else-if="quota && ratio >= 0.95 && !dismissed"
    tone="warning"
    dismissible
    :title="t('drive.quota.almostTitle', { percent: new Intl.NumberFormat(intlLocale(locale), { style: 'percent' }).format(Math.floor(ratio * 100) / 100) })"
    @dismiss="dismissed = true"
  >
    {{ t('drive.quota.almost', { left: formatBytes(Math.max(0, quota.limit - quota.used), locale) }) }}
    {{ who ? t('drive.quota.askOrg', { who }) : '' }}
  </SgAlert>
</template>
