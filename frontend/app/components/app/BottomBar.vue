<script setup lang="ts">
// Phones: Files · Shared · Upload · Search · Me (sitemap.md, navigation model).
const { t } = useI18n()
const kitDue = computed(() => Boolean(useAccount().account.value?.kit_reminder_due))
const route = useRoute()
const upload = useUploadTarget()
const ui = useDriveUi()
const toast = useToast()
const me = ref(false)

const files = computed(() => route.path === '/drive' || route.path.startsWith('/drive/f/'))
</script>

<template>
  <nav class="bottom" :aria-label="t('app.nav.label')">
    <NuxtLink to="/drive" class="bottom__item" :aria-current="files ? 'page' : undefined">
      <SgIcon name="folder" :size="20" />
      <span>{{ t('app.nav.files') }}</span>
    </NuxtLink>
    <NuxtLink to="/drive/shared" class="bottom__item" :aria-current="route.path === '/drive/shared' ? 'page' : undefined">
      <SgIcon name="users" :size="20" />
      <span>{{ t('app.nav.sharedShort') }}</span>
    </NuxtLink>
    <button
      type="button"
      class="bottom__item bottom__upload"
      :aria-disabled="Boolean(upload.blocked.value) || undefined"
      :title="upload.blocked.value || undefined"
      @click="upload.blocked.value ? toast.info(upload.blocked.value) : upload.pickFiles()"
    >
      <SgIcon name="upload" :size="20" />
      <span>{{ t('drive.upload.button') }}</span>
    </button>
    <button
      type="button"
      class="bottom__item"
      :aria-current="route.path === '/drive/search' ? 'page' : undefined"
      :aria-expanded="ui.searchOpen.value"
      aria-controls="app-search"
      @click="ui.searchOpen.value = true"
    >
      <SgIcon name="search" :size="20" />
      <span>{{ t('app.nav.search') }}</span>
    </button>
    <button
      type="button"
      class="bottom__item"
      aria-haspopup="dialog"
      :aria-expanded="me"
      :aria-label="kitDue ? t('app.account.labelReminder') : undefined"
      @click="me = true"
    >
      <span class="bottom__icon">
        <SgIcon name="user" :size="20" />
        <i v-if="kitDue" class="bottom__dot" aria-hidden="true" />
      </span>
      <span>{{ t('app.nav.me') }}</span>
    </button>

    <SgDialog v-if="me" v-model:open="me" :title="t('app.account.label')" size="sm">
      <AppAccountPanel @done="me = false" />
    </SgDialog>
  </nav>
</template>

<style scoped>
.bottom {
  display: none;
}

@media (max-width: 899px) {
  .bottom {
    position: fixed;
    inset-inline: 0;
    bottom: 0;
    z-index: 30;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    padding-bottom: env(safe-area-inset-bottom);
    border-top: 1px solid var(--rule);
    background: var(--surface);
  }
}

.bottom__icon {
  position: relative;
  display: inline-flex;
}

.bottom__dot {
  position: absolute;
  inset-block-start: -2px;
  inset-inline-end: -3px;
  width: 8px;
  height: 8px;
  border: 2px solid var(--surface);
  border-radius: 50%;
  background: var(--signal);
}

.bottom__item {
  display: grid;
  justify-items: center;
  gap: 2px;
  min-height: 56px;
  padding: 6px 2px;
  border: 0;
  background: none;
  color: var(--fg-2);
  font: inherit;
  font-size: 11px;
  text-decoration: none;
  cursor: pointer;
  transition: color var(--dur-1) var(--ease);
}

.bottom__item:active {
  background: var(--surface-2);
}

.bottom__item[aria-current='page'] {
  color: var(--fg);
  font-weight: var(--fw-medium);
}

.bottom__upload {
  color: var(--signal-text);
}

.bottom__upload[aria-disabled='true'] {
  color: var(--fg-3);
}
</style>
