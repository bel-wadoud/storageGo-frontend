<script setup lang="ts">
import type { NuxtError } from '#app'

// Every unknown address and unexpected failure lands here, in the calm auth layout: what
// happened in plain words, and the ways out (back, your files or sign in, try again).
// Never a stack trace or a bare status code on its own.
const props = defineProps<{ error: NuxtError }>()

const { t } = useI18n()
// app.vue isn't rendered for errors: set <html lang> and <html dir> here too (rtl in Arabic).
const localeHead = useLocaleHead({ dir: true, lang: true, seo: false })
useHead(() => ({ htmlAttrs: localeHead.value.htmlAttrs }))
const { account } = useAccount()
const notFound = computed(() => props.error.statusCode === 404)

useHead({
  title: () => `${notFound.value ? t('errorPage.notFoundTitle') : t('errorPage.title')} · storageGo`,
  meta: [{ name: 'robots', content: 'noindex' }],
})

const canGoBack = ref(false)
onMounted(() => (canGoBack.value = window.history.length > 1))

function back() {
  clearError()
  window.history.back()
}

const home = computed(() => (account.value ? '/drive' : '/signin'))
function goHome() {
  clearError({ redirect: home.value })
}

function retry() {
  window.location.reload()
}
</script>

<template>
  <div>
  <NuxtLayout name="auth">
    <AuthShell :title="notFound ? t('errorPage.notFoundTitle') : t('errorPage.title')" :lead="notFound ? t('errorPage.notFound') : t('errorPage.lead')">
      <div class="form__actions">
        <SgButton v-if="!notFound" variant="primary" icon="refresh" @click="retry">{{ t('common.retry') }}</SgButton>
        <SgButton :variant="notFound ? 'primary' : 'secondary'" :icon="account ? 'folder' : 'key'" @click="goHome">
          {{ account ? t('errorPage.toFiles') : t('errorPage.toSignin') }}
        </SgButton>
        <SgButton v-if="canGoBack" variant="ghost" icon="arrow-start" @click="back">{{ t('common.back') }}</SgButton>
      </div>
      <p class="err-code">{{ t('errorPage.code', { code: error.statusCode ?? 500 }) }}</p>
    </AuthShell>
  </NuxtLayout>
  <SgToastHost class="no-print" />
  </div>
</template>

<style scoped>
.err-code {
  margin: var(--s-7) 0 0;
  font-size: var(--fs-xs);
  color: var(--fg-3);
}
</style>
