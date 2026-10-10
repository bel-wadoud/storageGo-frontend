// https://nuxt.com/docs/api/configuration/nuxt-config
import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: ['@nuxtjs/color-mode', '@nuxtjs/i18n'],

  // Development only: /dev opens any signup step with its state prepared. The route is
  // never registered in production builds.
  $development: {
    // The Go API and the crypto core don't exist yet, so development uses stand-ins for both
    // by default. Set NUXT_PUBLIC_DEV_MOCKS=false to talk to the real ones.
    runtimeConfig: { public: { devMocks: true } },
    hooks: {
      'pages:extend'(pages) {
        pages.push({ name: 'dev', path: '/dev', file: fileURLToPath(new URL('./app/dev/index.vue', import.meta.url)) })
      },
    },
  },

  css: ['~/assets/css/fonts.css', '~/assets/css/tokens.css', '~/assets/css/base.css', '~/assets/css/forms.css', '~/assets/css/app.css'],

  // Each value can be set per environment: NUXT_PUBLIC_API_BASE, NUXT_PUBLIC_CRYPTO_WORKER_URL…
  runtimeConfig: {
    public: {
      apiBase: '/api/v1',
      // Built from the crypto core by the Rust container and served as static files.
      cryptoWorkerUrl: '/sgcrypt/crypto-worker.js',
      // Stand-ins for the API and the crypto worker (on by default in development, see
      // $development). Production builds never contain them: the code is behind import.meta.dev.
      devMocks: false,
    },
  },

  // Signup and sign-in progress live in the browser tab (sessionStorage), next to the keys in
  // the crypto worker, so these pages render there.
  routeRules: {
    // Temporary, until the public home page exists.
    '/': { redirect: { to: '/signup', statusCode: 302 } },
    '/signup': { ssr: false },
    '/signup/**': { ssr: false },
    '/signin': { ssr: false },
    '/signin/**': { ssr: false },
    '/signout': { ssr: false },
    // Recovery and invitations make keys on the device: they render in the browser too.
    '/recover': { ssr: false },
    '/recover/**': { ssr: false },
    '/invite/**': { ssr: false },
    // The app works on keys that only exist in this tab: it renders in the browser.
    '/drive': { ssr: false },
    '/drive/**': { ssr: false },
    '/settings': { ssr: false },
    '/settings/**': { ssr: false },
    '/admin': { ssr: false },
    '/admin/**': { ssr: false },
    // Public share pages: the key is in the URL fragment, which only the browser can read.
    '/s/**': { ssr: false },
    '/r/**': { ssr: false },
  },

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
