// A quick, local estimate of passphrase strength for the strength meter.
// 0 = too weak … 4 = strong. It is a guide for the user, not a security guarantee:
// the real protection is Argon2id plus the "at least 4 words or 16 characters" rule.

export type StrengthScore = 0 | 1 | 2 | 3 | 4

const COMMON_FRAGMENTS = ['password', 'motdepasse', 'azerty', 'qwerty', '123456', 'abcdef', 'storagego', 'algerie', 'algeria']

export function passphraseStrength(value: string): StrengthScore {
  const text = value.normalize('NFC')
  const length = [...text].length
  if (length < 8) return 0
  if (new Set(text).size <= 2) return 0

  // Size of the character "alphabet" the passphrase seems to be drawn from.
  let pool = 0
  if (/[a-z]/.test(text)) pool += 26
  if (/[A-Z]/.test(text)) pool += 26
  if (/[0-9]/.test(text)) pool += 10
  if (/[^\w\s]/u.test(text)) pool += 33
  if (/[^\u0000-\u007f]/.test(text)) pool += 100 // Arabic, accents…
  let bits = length * Math.log2(Math.max(pool, 10))

  // Passphrases made of words: count roughly 11 bits per word (a 2,048-word vocabulary).
  const words = text.trim().split(/[\s\-_.]+/).filter((w) => w.length >= 2)
  if (words.length >= 3) bits = Math.max(bits, words.length * 11 + 6)

  const lower = text.toLowerCase()
  if (COMMON_FRAGMENTS.some((f) => lower.includes(f))) bits = Math.min(bits, 30)

  if (bits < 32) return 0
  if (bits < 44) return 1
  if (bits < 56) return 2
  if (bits < 72) return 3
  return 4
}
