// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: ['@nuxtjs/color-mode', '@nuxtjs/i18n'],

  css: ['~/assets/css/fonts.css', '~/assets/css/tokens.css', '~/assets/css/base.css'],

  // Follows the OS light/dark setting until the user picks one. The module injects a tiny
  // inline script in <head>, so the right theme is applied before the first paint.
  colorMode: {
    preference: 'system',
    fallback: 'light',
    dataValue: 'theme',
    classSuffix: '',
    storage: 'cookie',
    storageKey: 'sg_theme',
  },

  // Language comes from Accept-Language (server) / navigator.languages (client):
  // ar, fr or en, anything else falls back to English. A manual choice is kept in a cookie.
  i18n: {
    // Public URL of the site. Overridden per environment with NUXT_PUBLIC_I18N_BASE_URL.
    baseUrl: 'http://localhost:3000',
    defaultLocale: 'en',
    strategy: 'no_prefix',
    locales: [
      { code: 'en', language: 'en', name: 'English', dir: 'ltr', file: 'en.json' },
      { code: 'fr', language: 'fr', name: 'Français', dir: 'ltr', file: 'fr.json' },
      { code: 'ar', language: 'ar', name: 'العربية', dir: 'rtl', file: 'ar.json' },
    ],
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'sg_lang',
      fallbackLocale: 'en',
    },
  },
})
