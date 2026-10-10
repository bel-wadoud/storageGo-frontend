// The key of a share link or file request travels in the URL fragment: "#k=" and 32 bytes in
// base64url (43 characters). Browsers never send the fragment to a server.
//
// Messengers sometimes damage it (user-flows.md F7): they cut it, or glue punctuation to
// the end when the link ends a sentence ("…#k=abc." or "(…#k=abc)"). Trailing characters that
// can't be part of a key are dropped; anything else wrong means the link is incomplete.
const KEY = /^[A-Za-z0-9_-]{43}$/

export type KeyFragment = { state: 'ok'; fragment: string } | { state: 'missing' } | { state: 'damaged' }

export function readKeyFragment(hash: string): KeyFragment {
  const raw = hash.replace(/^#/, '')
  if (!raw) return { state: 'missing' }
  const value = new URLSearchParams(raw).get('k')
  if (!value) return { state: 'missing' }
  const key = value.replace(/[^A-Za-z0-9_-]+$/, '')
  return KEY.test(key) ? { state: 'ok', fragment: `k=${key}` } : { state: 'damaged' }
}
