// TEMPORARY. One fixed account to sign up and sign in with while the Go API and the crypto core
// are not deployed yet. When `testAccount` is on (NUXT_PUBLIC_TEST_ACCOUNT, on by default), the
// app runs on the stand-ins of services/dev, in production builds too, and only this account
// gets in. Remove this file, the `testAccount` setting and the checks that use it once the real
// backend is live.
//
//   Email:             test@storagego.dz
//   Passphrase:        blue cedar harbor lantern
//   Verification code: 123456
//
// Signing up: "Personal" or "Organization", this email, the code, then this passphrase.
// Signing in: this email and this passphrase.
export const TEST_ACCOUNT = {
  email: 'test@storagego.dz',
  name: 'Test User',
  passphrase: 'blue cedar harbor lantern',
  code: '123456',
} as const

type PublicConfig = { devMocks?: unknown; testAccount?: unknown }

/** Whether the app talks to the stand-ins (development mocks, or the test account). */
export function standInsEnabled(config: PublicConfig): boolean {
  return (import.meta.dev && Boolean(config.devMocks)) || Boolean(config.testAccount)
}

/**
 * Only the test account gets in. In development with the mocks on, everything stays open as
 * before (any email, any code), so every screen can still be tried.
 */
export function testAccountOnly(config: PublicConfig): boolean {
  return Boolean(config.testAccount) && !(import.meta.dev && config.devMocks)
}
