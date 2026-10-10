// The public website's pages for search engines, in every language (/ar, /fr, /en) with their
// alternates. The app, share links and recovery pages are deliberately left out (robots.txt).
const PAGES = [
  '',
  '/how-it-works',
  '/security',
  '/compliance',
  '/compliance/certificate',
  '/pricing',
  '/contact',
  '/for/health',
  '/for/legal',
  '/for/finance',
  '/for/public',
  '/for/education',
  '/legal/terms',
  '/legal/privacy',
  '/legal/dpa',
  '/legal/sla',
]
const LANGS = ['ar', 'fr', 'en']

export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)
  const origin = String((config.public.i18n as { baseUrl?: string } | undefined)?.baseUrl ?? '').replace(/\/$/, '')
  const urls = PAGES.flatMap((page) =>
    LANGS.map((lang) => {
      const alternates = LANGS.map((other) => `    <xhtml:link rel="alternate" hreflang="${other}" href="${origin}/${other}${page}"/>`).join('\n')
      return `  <url>\n    <loc>${origin}/${lang}${page}</loc>\n${alternates}\n    <xhtml:link rel="alternate" hreflang="x-default" href="${origin}${page || '/'}"/>\n  </url>`
    }),
  )
  setHeader(event, 'content-type', 'application/xml; charset=utf-8')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`
})
