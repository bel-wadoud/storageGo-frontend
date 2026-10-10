import type { AccountKind } from '~/services/api/signup'
import type { AccountSummary, PreloginResponse } from '~/services/api/auth'

// Where a sign-in stands: the email and its public KDF parameters, where to go afterwards,
// and the pending device approval. Nothing secret (see useSessionDraft).
export interface SigninDraft {
  email: string
  prelogin: PreloginResponse | null
  /** Checked path to open after signing in (from ?next=). */
  next: string | null
  deviceId: string | null
  /** Epoch ms when the approval request expires. */
  deviceExpiresAt: number
  safetyCode: [string, string] | null
  accountKind: AccountKind | null
}

export type SigninStep = 'email' | 'passphrase' | 'approve-device'

export const SIGNIN_PATHS: Record<SigninStep, string> = {
  email: '/signin',
  passphrase: '/signin/passphrase',
  'approve-device': '/signin/approve-device',
}

const emptyDraft = (): SigninDraft => ({
  email: '',
  prelogin: null,
  next: null,
  deviceId: null,
  deviceExpiresAt: 0,
  safetyCode: null,
  accountKind: null,
})

export function signinStepAllowed(step: SigninStep, d: SigninDraft): boolean {
  if (step === 'passphrase') return Boolean(d.email && d.prelogin)
  if (step === 'approve-device') return Boolean(d.deviceId && d.safetyCode)
  return true
}

export function useSignin() {
  const { draft, clear } = useSessionDraft<SigninDraft>('sg_signin', emptyDraft)
  const { setAccount } = useAccount()
  const i18n = useNuxtApp().$i18n

  function update(patch: Partial<SigninDraft>) {
    draft.value = { ...draft.value, ...patch }
  }

  /**
   * Signed in and unlocked: go where the user was heading. An account whose recovery kit was
   * never confirmed goes back to the kit step first (the drive stays closed until then).
   */
  async function complete(account: AccountSummary) {
    setAccount(account)
    // The language picked in Settings follows the account to this device.
    if (account.locale && account.locale !== i18n.locale.value && i18n.availableLocales.includes(account.locale)) {
      await i18n.setLocale(account.locale as typeof i18n.locale.value).catch(() => {})
    }
    const next = draft.value.next
    clear()
    if (!account.kit_verified) return useSignup().resumeKit(account)
    return navigateTo(next ?? SIGNUP_PATHS.done, { replace: true })
  }

  return {
    draft,
    update,
    reset: clear,
    complete,
    resumePath: () =>
      draft.value.deviceId ? SIGNIN_PATHS['approve-device'] : draft.value.prelogin ? SIGNIN_PATHS.passphrase : SIGNIN_PATHS.email,
  }
}
