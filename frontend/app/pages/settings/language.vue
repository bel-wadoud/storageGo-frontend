<script setup lang="ts">
import { accountApi } from '~/services/api/account'

// Language, theme and keyboard shortcuts. The language is saved in the account (it follows the
// user to other devices); the theme and shortcuts are this device's preferences.
definePageMeta({ layout: 'app', middleware: 'auth' })
const { t, locale, locales, setLocale } = useI18n()
const toast = useToast()
const errorMessage = useErrorMessage()
const colorMode = useColorMode()
const ui = useDriveUi()
const account = useAccountDetails()

// ---- Language ----
const languages = computed(() =>
  locales.value.map((item) => ({ value: item.code, title: item.name ?? item.code, description: t(`settings.language.about.${item.code}`) })),
)
const language = ref<string>(locale.value)
const savingLanguage = ref(false)

watch(language, async (code, before) => {
  if (code === locale.value) return
  savingLanguage.value = true
  try {
    await setLocale(code as typeof locale.value)
  } catch (error) {
    // The language couldn't load: stay on the current one.
    savingLanguage.value = false
    language.value = before
    toast.error(errorMessage(error))
    return
  }
  try {
    await accountApi.update({ locale: code })
    account.patch({ locale: code as 'en' | 'fr' | 'ar' })
    toast.success(t('settings.language.saved'))
  } catch {
    // Applied on this device (and remembered here); only the account copy is missing.
    toast.warning(t('settings.language.notSaved'))
  } finally {
    savingLanguage.value = false
  }
})
// The account menu can change it too.
watch(locale, (code) => (language.value = code))

// ---- Theme ----
const themes = computed(() => [
  { value: 'system' as const, title: t('theme.system'), description: t('settings.theme.system'), icon: 'monitor' as const },
  { value: 'light' as const, title: t('theme.light'), description: t('settings.theme.light'), icon: 'sun' as const },
  { value: 'dark' as const, title: t('theme.dark'), description: t('settings.theme.dark'), icon: 'moon' as const },
])
const theme = computed({
  get: () => colorMode.preference as 'system' | 'light' | 'dark',
  set: (value) => (colorMode.preference = value),
})

// ---- Shortcuts ----
const shortcuts = ref(true)
onMounted(() => (shortcuts.value = shortcutsEnabled()))
watch(shortcuts, (on) => setShortcutsEnabled(on))

// ---- What formats look like in this language ----
const sample = computed(() => {
  const when = new Date(2026, 9, 12, 14, 30)
  return {
    date: formatDate(when, locale.value, { day: 'numeric', month: 'long', year: 'numeric' }),
    number: formatNumber(1234567.89, locale.value),
    size: formatBytes(1_240_000_000, locale.value),
    money: formatMoney(12000, locale.value),
  }
})
</script>

<template>
  <SettingsShell :title="t('settings.language.title')" :lead="t('settings.language.lead')">
    <SettingsSection id="language" :title="t('language.label')" :description="t('settings.language.hint')">
      <SgChoice v-model="language" :legend="t('language.label')" legend-hidden :options="languages" :disabled="savingLanguage" />
      <p v-if="savingLanguage" class="form__note" role="status"><SgSpinner decorative size="sm" /> {{ t('settings.saving') }}</p>
    </SettingsSection>

    <SettingsSection id="theme" :title="t('theme.label')" :description="t('settings.theme.hint')">
      <SgChoice v-model="theme" :legend="t('theme.label')" legend-hidden :options="themes" />
    </SettingsSection>

    <SettingsSection id="formats" :title="t('settings.formats.title')" :description="t('settings.formats.hint')">
      <dl class="facts-grid">
        <div><dt>{{ t('settings.formats.date') }}</dt><dd>{{ sample.date }}</dd></div>
        <div><dt>{{ t('settings.formats.number') }}</dt><dd>{{ sample.number }}</dd></div>
        <div><dt>{{ t('settings.formats.size') }}</dt><dd>{{ sample.size }}</dd></div>
        <div><dt>{{ t('settings.formats.money') }}</dt><dd>{{ sample.money }}</dd></div>
      </dl>
    </SettingsSection>

    <SettingsSection id="shortcuts" :title="t('app.shortcuts.title')" :description="t('app.shortcuts.lead')">
      <SgCheckbox v-model="shortcuts" :label="t('app.shortcuts.enabled')" :description="t('app.shortcuts.enabledHint')" />
      <div>
        <SgButton size="sm" icon="info" @click="ui.open({ kind: 'shortcuts' })">{{ t('settings.shortcuts.show') }}</SgButton>
      </div>
    </SettingsSection>
  </SettingsShell>
</template>
