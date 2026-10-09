// Where to go after signing in. `?next=` comes from the URL, so it is checked: only a path on
// this site is accepted ("/drive/f/x"), never another site ("//evil.dz", "https://…", "/\evil").
export function safeNext(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/')) return null
  if (value.startsWith('//') || value.startsWith('/\\') || /[\u0000-\u001f]/.test(value)) return null
  return value
}
