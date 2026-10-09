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
