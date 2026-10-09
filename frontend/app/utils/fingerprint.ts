// "7F3A 91C0 2B8E …": the first 8 groups of the SHA-256 of a wrapped key, shown in a file's
// Encryption details (key-model-ux.md §5). Computed here; it reveals nothing about the key.
export async function keyFingerprint(wrappedKey: string, groups = 8): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(wrappedKey)))
  const hex = Array.from(digest, (byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
  return (hex.match(/.{4}/g) ?? []).slice(0, groups).join(' ')
}
