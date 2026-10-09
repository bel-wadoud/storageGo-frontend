// Name matching for client-side search (names are only readable on this device). Case,
// accents and Arabic letter variants don't matter: "facture" finds "Facture_Mars.pdf",
// "bilan" finds "Bilân", and "احمد" finds "أحمد".
export function normalizeForSearch(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // Latin accents
    .replace(/[ً-ٰٟـ]/g, '') // Arabic diacritics and tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase()
    .replace(/[_\-.]+/g, ' ')
    .trim()
}

/** Every word of the query appears in the name. */
export function matchesQuery(name: string, query: string): boolean {
  const haystack = normalizeForSearch(name)
  return normalizeForSearch(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word))
}
