import { accountApi, type AccountDetails } from '~/services/api/account'

// The signed-in account's full details for Settings (role, language, kit date…), loaded once
// and kept in step with the summary used everywhere else (useAccount).
export function useAccountDetails() {
  const details = useState<AccountDetails | null>('sg-account-details', () => null)
  const loading = useState('sg-account-details-loading', () => false)
  const error = shallowRef<unknown>(null)
  const { account, setAccount } = useAccount()

  async function load(force = false) {
    if (details.value && !force) return
    loading.value = true
    error.value = null
    try {
      set(await accountApi.get())
    } catch (cause) {
      error.value = cause
    } finally {
      loading.value = false
    }
  }

  /** Stores new details and updates the account summary (name in the menus, email…). */
  function set(next: AccountDetails) {
    details.value = next
    if (account.value) setAccount({ ...account.value, ...next })
  }

  function patch(change: Partial<AccountDetails>) {
    if (details.value) set({ ...details.value, ...change })
    else if (account.value) setAccount({ ...account.value, ...change })
  }

  return { details, loading, error, load, set, patch }
}
