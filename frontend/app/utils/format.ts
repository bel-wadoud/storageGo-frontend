// Locale-aware formatting. Western digits in every language (i18n-rtl.md, rule 4);
// Algerian regional variants so Arabic gets the Maghreb month names (جانفي، فيفري…).
const REGION: Record<string, string> = { ar: 'ar-DZ', fr: 'fr-DZ', en: 'en' }

export function intlLocale(locale: string): string {
  return `${REGION[locale] ?? locale}-u-nu-latn`
}

export function formatDate(date: Date, locale: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }): string {
  return new Intl.DateTimeFormat(intlLocale(locale), options).format(date)
}

export function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(intlLocale(locale)).format(value)
}

const UNITS = ['byte', 'kilobyte', 'megabyte', 'gigabyte', 'terabyte'] as const

/** "1.2 MB" / "1,2 Mo" / "1.2 ميغابايت", base 1000 like the operating systems people compare with. */
export function formatBytes(bytes: number, locale: string): string {
  let value = Math.max(0, bytes)
  let unit = 0
  while (value >= 1000 && unit < UNITS.length - 1) {
    value /= 1000
    unit += 1
  }
  // English short form says "43 byte" and narrow "43B": write "43 B" like the other units.
  if (unit === 0 && locale === 'en') return `${new Intl.NumberFormat(intlLocale(locale)).format(value)} B`
  return new Intl.NumberFormat(intlLocale(locale), {
    style: 'unit',
    unit: UNITS[unit],
    // Short form everywhere: "1.2 MB", "43 o" / "1,2 Mo", "43 بايت".
    unitDisplay: 'short',
    maximumFractionDigits: unit === 0 || value >= 100 ? 0 : 1,
  }).format(value)
}

/** "2 min ago" under 24 hours, then a short date ("12 Oct 2026") — i18n-rtl.md, rule 5. */
export function formatWhen(iso: string, locale: string, now = Date.now()): string {
  const then = new Date(iso).getTime()
  const seconds = Math.round((then - now) / 1000)
  if (Math.abs(seconds) < 86_400) {
    const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: 'auto', style: 'short' })
    if (Math.abs(seconds) < 60) return rtf.format(0, 'second')
    if (Math.abs(seconds) < 3600) return rtf.format(Math.round(seconds / 60), 'minute')
    return rtf.format(Math.round(seconds / 3600), 'hour')
  }
  return formatDate(new Date(then), locale, { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Full date and time, for tooltips and details. */
export function formatDateTime(iso: string, locale: string): string {
  return formatDate(new Date(iso), locale, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** Algerian dinars: "12 000 DA" (FR), "DZD 12,000" (EN), "12000 د.ج." (AR) — i18n-rtl.md, rule 6. */
export function formatMoney(amount: number, locale: string): string {
  return new Intl.NumberFormat(intlLocale(locale), { style: 'currency', currency: 'DZD', maximumFractionDigits: 0 }).format(amount)
}

/** Keeps a Latin name or address in one piece inside a sentence of another direction (FSI…PDI). */
export function isolate(text: string): string {
  return `\u2068${text}\u2069`
}
