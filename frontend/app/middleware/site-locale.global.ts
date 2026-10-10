// /ar/…, /fr/… and /en/… show the public site in that language, on the server too (so search
// engines and shared links get the right language). Opening one is a choice of language: it is
// remembered like the picker in the app.
const PREFIX = /^\/(ar|fr|en)(?=\/|$)/

export default defineNuxtRouteMiddleware(async (to) => {
  const match = PREFIX.exec(to.path)
  if (!match) return
  const i18n = useNuxtApp().$i18n
  const code = match[1] as 'ar' | 'fr' | 'en'
  if (i18n.locale.value === code) return
  // Plain statement (no await inside an expression): Nuxt rewrites awaits in middleware.
  await i18n.setLocale(code)
})
