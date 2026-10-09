// DEV ONLY. An in-memory imitation of the Go API's signup endpoints, so the flow can be
// clicked through before the backend exists. Only imported behind `import.meta.dev && devMocks`.
//
// Verification codes: any 6 digits work, except 000000 (wrong code) and 999999 (expired).
// Invites: addresses containing "taken" come back as already members.
import { ApiError } from '../api/client'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const signups = new Map<string, { email: string }>()
let announced = false

export async function mockApi<T>(path: string, method: string, body: unknown): Promise<T> {
  if (!announced) {
    announced = true
    console.info('[dev mocks] API is mocked. Any 6-digit code works; 000000 = wrong, 999999 = expired.')
  }
  await wait(350 + Math.random() * 400)
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new ApiError('NETWORK')

  const data = (body ?? {}) as Record<string, unknown>
  const route = `${method} ${path.replace(/\/signup\/[^/]+\/(code|verify)$/, '/signup/:id/$1')}`

  switch (route) {
    case 'POST /signup': {
      const id = crypto.randomUUID()
      signups.set(id, { email: String(data.email) })
      return { signup_id: id, resend_after: 30 } as T
    }
    case 'POST /signup/:id/code':
      return { resend_after: 30 } as T
    case 'POST /signup/:id/verify':
      if (data.code === '000000') throw new ApiError('CODE_INVALID', 400)
      if (data.code === '999999') throw new ApiError('CODE_EXPIRED', 400)
      return { signup_token: crypto.randomUUID() } as T
    case 'POST /signup/complete':
      await wait(400)
      return { user_id: 'dev-user', org_id: 'dev-org' } as T
    case 'PUT /account/recovery-kit':
    case 'POST /account/recovery-kit/verified':
    case 'POST /org/recovery':
      return undefined as T
    case 'POST /org/invites': {
      const invites = (data.invites ?? []) as { email: string }[]
      return {
        sent: invites.filter((i) => !i.email.includes('taken')).map((i) => i.email),
        skipped: invites.filter((i) => i.email.includes('taken')).map((i) => ({ email: i.email, reason: 'already_member' })),
      } as T
    }
    default:
      throw new ApiError('NOT_FOUND', 404)
  }
}
