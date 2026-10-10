<script setup lang="ts">
// "Forgot your passphrase?" (key-model-ux.md §4, warning 5): a clear fork with the honest
// outcome of each path: the recovery kit, the organization's administrators, or neither.
definePageMeta({ layout: 'auth' })
const { t } = useI18n()
const neither = ref(false)
</script>

<template>
  <AuthShell :title="t('recover.title')" :lead="t('recover.lead')" back="/signin">
    <ul class="paths">
      <li>
        <NuxtLink to="/recover/kit" class="path">
          <SgIcon name="key" :size="20" />
          <span class="path__text">
            <span class="path__title">{{ t('recover.kit.title') }}</span>
            <span class="path__desc">{{ t('recover.kit.desc') }}</span>
          </span>
          <SgIcon name="chevron-end" :size="18" />
        </NuxtLink>
      </li>
      <li>
        <NuxtLink to="/recover/admin-request" class="path">
          <SgIcon name="building" :size="20" />
          <span class="path__text">
            <span class="path__title">{{ t('recover.admin.title') }}</span>
            <span class="path__desc">{{ t('recover.admin.desc') }}</span>
          </span>
          <SgIcon name="chevron-end" :size="18" />
        </NuxtLink>
      </li>
      <li>
        <button type="button" class="path" :aria-expanded="neither" aria-controls="recover-neither" @click="neither = !neither">
          <SgIcon name="alert" :size="20" />
          <span class="path__text">
            <span class="path__title">{{ t('recover.neither.title') }}</span>
            <span class="path__desc">{{ t('recover.neither.desc') }}</span>
          </span>
          <SgIcon name="chevron-down" :size="18" class="path__chevron" :class="{ 'is-open': neither }" />
        </button>
      </li>
    </ul>

    <div v-if="neither" id="recover-neither" class="notice">
      <p class="notice__title">{{ t('recover.neither.outcomeTitle') }}</p>
      <p>{{ t('recover.neither.outcome') }}</p>
      <p>{{ t('recover.neither.org') }}</p>
      <div class="form__actions">
        <SgButton icon="building" to="/recover/admin-request">{{ t('recover.neither.askAnyway') }}</SgButton>
        <SgButton variant="ghost" to="/signin">{{ t('recover.backToSignin') }}</SgButton>
      </div>
    </div>
  </AuthShell>
</template>

<style scoped>
.paths {
  display: grid;
  gap: var(--s-3);
  margin: 0 0 var(--s-5);
  padding: 0;
  list-style: none;
}

.path {
  display: flex;
  align-items: center;
  gap: var(--s-4);
  width: 100%;
  padding: var(--s-4);
  border: 1px solid var(--rule);
  border-radius: var(--radius-2);
  background: var(--surface);
  color: var(--fg);
  font: inherit;
  text-align: start;
  text-decoration: none;
  cursor: pointer;
  transition:
    border-color var(--dur-1) var(--ease),
    background-color var(--dur-1) var(--ease);
}

.path:hover {
  border-color: var(--fg-3);
  background: var(--surface-2);
}

.path:active {
  background: var(--surface-3);
}

.path > :deep(svg) {
  flex: none;
  color: var(--fg-2);
}

.path__text {
  display: grid;
  flex: 1;
  gap: 2px;
}

.path__title {
  font-weight: var(--fw-medium);
}

.path__desc {
  font-size: var(--fs-sm);
  color: var(--fg-2);
}

.path__chevron {
  transition: transform var(--dur-1) var(--ease);
}

.path__chevron.is-open {
  transform: rotate(180deg);
}
</style>
