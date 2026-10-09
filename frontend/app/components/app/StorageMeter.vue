<script setup lang="ts">
// "4.2 GB of 100 GB · stored in Algiers (DZ-16)". The colour changes at 80% and 95%, and the
// place is the real datacenter location sent by the server (key-model-ux.md §5).
const { t, locale } = useI18n()
const drive = useDrive()

const quota = computed(() => drive.quota.value)
const ratio = computed(() => (quota.value && quota.value.limit ? quota.value.used / quota.value.limit : 0))
const tone = computed(() => (ratio.value >= 0.95 ? 'danger' : ratio.value >= 0.8 ? 'signal' : 'neutral'))
const places = computed(() => {
  const names = (quota.value?.wilayas ?? []).map((code) => t('storage.wilaya', { name: t(`wilayas.${code}`), code }))
  return names.length ? new Intl.ListFormat(intlLocale(locale.value), { type: 'conjunction' }).format(names) : ''
})
</script>

<template>
  <div class="meter" aria-live="off">
    <template v-if="quota">
      <SgProgress
        :value="quota.used"
        :max="quota.limit"
        :tone="tone"
        :label="t('storage.used', { used: formatBytes(quota.used, locale), total: formatBytes(quota.limit, locale) })"
      />
      <p v-if="places" class="meter__where">
        <SgIcon name="lock" :size="13" />
        <span>{{ t('storage.where', { places }) }}</span>
      </p>
    </template>
    <template v-else>
      <SgSkeleton :lines="2" />
    </template>
  </div>
</template>

<style scoped>
.meter {
  display: grid;
  gap: var(--s-2);
}

.meter__where {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 0;
  font-size: var(--fs-xs);
  color: var(--fg-2);
  line-height: var(--lh-ui);
}

.meter__where .sg-icon {
  margin-top: 2px;
}
</style>
