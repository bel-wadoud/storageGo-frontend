<script setup lang="ts">
// Phones: Files · Shared · Upload · Search · Me (sitemap.md, navigation model).
const { t } = useI18n()
const route = useRoute()
const upload = useUploadTarget()
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
      @click="upload.blocked.value ? useToast().info(upload.blocked.value) : upload.pickFiles()"
    >
      <SgIcon name="upload" :size="20" />
      <span>{{ t('drive.upload.button') }}</span>
    </button>
    <NuxtLink to="/drive/search" class="bottom__item" :aria-current="route.path === '/drive/search' ? 'page' : undefined">
      <SgIcon name="search" :size="20" />
      <span>{{ t('app.nav.search') }}</span>
    </NuxtLink>
    <button type="button" class="bottom__item" aria-haspopup="dialog" :aria-expanded="me" @click="me = true">
      <SgIcon name="user" :size="20" />
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
