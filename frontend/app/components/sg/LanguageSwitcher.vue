<script setup lang="ts">
// Language, as a small dropdown. Each language is listed in its own script, so people can
// find theirs even on a page they can't read. The choice is remembered in the sg_lang cookie.
const { t, locale, locales, setLocale } = useI18n()
const pending = ref<string | null>(null)

const options = computed(() =>
  locales.value.map((item) => ({ value: item.code, label: item.name ?? item.code, lang: item.language, dir: item.dir })),
)

async function choose(code: string) {
  if (code === locale.value || pending.value) return
  pending.value = code
  try {
    await setLocale(code as typeof locale.value)
  } finally {
    pending.value = null
  }
}
</script>

<template>
  <SgMenu
    :label="t('language.label')"
    :options="options"
    :model-value="locale"
    icon="globe"
    :short="locale.toUpperCase()"
    :pending="pending"
    @select="choose"
  />
</template>
