import { adminApi, type Overview } from '~/services/api/admin'

// The admin overview (seats, storage, what's waiting, health), shared by the console's pages:
// the sub-navigation shows how many recovery requests and devices are waiting. Pages that
// change those counts call `refresh()`.
export function useAdminOverview() {
  const overview = useState<Overview | null>('admin:overview', () => null)
  const error = shallowRef<unknown>(null)
  const loading = useState('admin:overview-loading', () => false)

  async function refresh() {
    loading.value = true
    error.value = null
    try {
      overview.value = await adminApi.overview()
    } catch (cause) {
      error.value = cause
    } finally {
      loading.value = false
    }
  }

  async function ensure() {
    if (!overview.value && !loading.value) await refresh()
  }

  return { overview, error, loading, refresh, ensure }
}
