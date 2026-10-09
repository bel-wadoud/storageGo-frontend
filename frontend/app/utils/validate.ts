// Small, predictable checks. The server validates again; these exist to give instant feedback.

const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

export function isEmail(value: string): boolean {
  const email = normalizeEmail(value)
  return email.length <= 254 && EMAIL.test(email)
}

/** Splits a pasted list ("a@x.dz, b@y.dz\nc@z.dz" or a CSV export) into unique addresses. */
export function parseEmailList(text: string): { valid: string[]; invalid: string[] } {
  const seen = new Set<string>()
  const valid: string[] = []
  const invalid: string[] = []
  for (const raw of text.split(/[\s,;]+/)) {
    // CSV cells may be quoted, and "Name <email>" is common when copying from a mail client.
    const token = raw.replace(/^["'<(]+|[>"')]+$/g, '')
    if (!token) continue
    const email = normalizeEmail(token)
    if (seen.has(email)) continue
    seen.add(email)
    if (isEmail(email)) valid.push(email)
    else if (token.includes('@')) invalid.push(token)
  }
  return { valid, invalid }
}
