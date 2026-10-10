// Helpers for the public website.
//  - Links keep the language prefix the visitor came in with (/fr/pricing → /fr/security).
//  - Each page states its title and description once; this adds the canonical address and
//    the same page in the other languages (hreflang), so search engines show the right one.
const PREFIX = /^\/(ar|fr|en)(?=\/|$)/

export function useSite() {
  const route = useRoute()
  const prefix = computed(() => PREFIX.exec(route.path)?.[0] ?? '')
  /** The page's path without its language prefix ("/pricing"). */
  const base = computed(() => route.path.replace(PREFIX, '') || '/')
  /** A site path in the visitor's language address space. */
  const path = (to: string) => (prefix.value ? (to === '/' ? prefix.value : `${prefix.value}${to}`) : to)
  /** The same page in another language. */
  const inLanguage = (code: string) => (base.value === '/' ? `/${code}` : `/${code}${base.value}`)
  return { prefix, base, path, inLanguage }
}

export function useSiteMeta(meta: { title: () => string; description: () => string }) {
  const { base } = useSite()
  const { locale } = useI18n()
  const origin = String(useRuntimeConfig().public.i18n?.baseUrl ?? '').replace(/\/$/, '')
  const url = (path: string) => `${origin}${path}`

  useHead(() => ({
    title: `${meta.title()} · storageGo`,
    link: [
      { rel: 'canonical' as const, href: url(`/${locale.value}${base.value === '/' ? '' : base.value}`) },
      ...['ar', 'fr', 'en'].map((code) => ({ rel: 'alternate' as const, hreflang: code, href: url(`/${code}${base.value === '/' ? '' : base.value}`), type: 'text/html' })),
      { rel: 'alternate' as const, hreflang: 'x-default', href: url(base.value), type: 'text/html' },
    ],
  }))
  useSeoMeta({
    description: meta.description,
    ogTitle: () => `${meta.title()} · storageGo`,
    ogDescription: meta.description,
    ogType: 'website',
    ogLocale: () => ({ ar: 'ar_DZ', fr: 'fr_DZ', en: 'en' })[locale.value] ?? 'en',
  })
}
