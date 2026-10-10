import { authApi } from '~/services/api/auth'

// Proves the current passphrase before a sensitive change (new passphrase, new recovery kit),
// the same way sign-in does: Argon2id on this device, and only the derived auth key is sent.
export function useReauth() {
  const { account } = useAccount()

  return async function authKeyFor(passphrase: string): Promise<string> {
    const email = account.value?.email
    if (!email) throw new Error('not signed in')
    const prelogin = await authApi.prelogin(email)
    const engine = await useCrypto()
    const { auth_key } = await engine.loginRequest(email, passphrase, prelogin)
    return auth_key
  }
}
