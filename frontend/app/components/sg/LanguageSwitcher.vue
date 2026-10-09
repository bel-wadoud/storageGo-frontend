<script setup lang="ts">
// Each language is written in its own script, so people can find theirs even when the
// page is in a language they don't read. The choice is remembered in the sg_lang cookie.
const { t, locale, locales, setLocale } = useI18n()
const pending = ref<string | null>(null)

async function choose(code: typeof locale.value) {
  if (code === locale.value || pending.value) return
  pending.value = code
  try {
    await setLocale(code)
  } finally {
    pending.value = null
  }
}
</script>

<template>
  <div class="sg-seg" role="group" :aria-label="t('language.label')">
    <SgButton
      v-for="item in locales"
      :key="item.code"
      variant="ghost"
      size="sm"
      :lang="item.language"
      :dir="item.dir"
      :pressed="locale === item.code"
      :loading="pending === item.code"
      :disabled="pending !== null && pending !== item.code"
      @click="choose(item.code)"
    >
      {{ item.name }}
    </SgButton>
  </div>
</template>

<style scoped>
.sg-seg {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--rule);
  border-radius: var(--radius-2);
  background: var(--surface);
}

.sg-seg :deep(.sg-btn[aria-pressed='true']) {
  background: var(--surface-3);
  color: var(--fg);
}
</style>
