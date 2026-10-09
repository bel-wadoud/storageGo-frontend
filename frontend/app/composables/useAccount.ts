import type { AccountSummary } from '~/services/api/auth'

// Who is signed in, for this tab. Public facts only (name, email, organization); the keys
// themselves live in the crypto worker and never in Vue state.
export function useAccount() {
  const account = useState<AccountSummary | null>('sg-account', () => null)
  return {
    account,
    setAccount: (value: AccountSummary | null) => (account.value = value),
  }
}
