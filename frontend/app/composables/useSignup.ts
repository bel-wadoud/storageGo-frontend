import { signupApi, type AccountKind, type OrgSector } from '~/services/api/signup'

// Where a signup stands. Only non-secret progress lives here; it is kept in sessionStorage so
// a reload or an accidental back doesn't lose what was typed. The passphrase is never stored,
// and the recovery words only ever live in memory (see `kitPhrase` below).
export interface SignupDraft {
  kind: AccountKind | null
  name: string
  email: string
  orgName: string
  sector: OrgSector | ''
  signupId: string | null
  /** Epoch ms after which a new code can be requested. */
  resendAt: number
  signupToken: string | null
  accountCreated: boolean
  orgId: string | null
  /** The kit was downloaded or printed at least once. */
  kitSaved: boolean
  /** Word positions (1-based) asked on the verify step; fixed so a reload doesn't change them. */
  kitChallenge: [number, number] | null
  kitVerified: boolean
  orgRecovery: 'pending' | 'done' | 'skipped'
}

export type SignupStep =
  | 'start'
  | 'org'
  | 'verify-email'
  | 'passphrase'
  | 'recovery-kit'
  | 'verify-kit'
  | 'org-recovery'
  | 'invite'

export const SIGNUP_PATHS: Record<SignupStep | 'done', string> = {
  start: '/signup',
  org: '/signup/org',
  'verify-email': '/signup/verify-email',
  passphrase: '/signup/passphrase',
  'recovery-kit': '/signup/recovery-kit',
  'verify-kit': '/signup/verify-kit',
  'org-recovery': '/signup/org-recovery',
  invite: '/signup/invite',
  done: '/drive',
}

/** Named stages shown in the progress bar ("Organization · Passphrase · Recovery · Team"). */
export const SIGNUP_STAGES: Record<AccountKind, { key: string; steps: SignupStep[] }[]> = {
  org: [
    { key: 'organization', steps: ['start', 'org', 'verify-email'] },
    { key: 'passphrase', steps: ['passphrase'] },
    { key: 'recovery', steps: ['recovery-kit', 'verify-kit', 'org-recovery'] },
    { key: 'team', steps: ['invite'] },
  ],
  individual: [
    { key: 'account', steps: ['start', 'verify-email'] },
    { key: 'passphrase', steps: ['passphrase'] },
    { key: 'recovery', steps: ['recovery-kit', 'verify-kit'] },
  ],
}

const STORAGE_KEY = 'sg_signup'

const emptyDraft = (): SignupDraft => ({
  kind: null,
  name: '',
  email: '',
  orgName: '',
  sector: '',
  signupId: null,
  resendAt: 0,
  signupToken: null,
  accountCreated: false,
  orgId: null,
  kitSaved: false,
  kitChallenge: null,
  kitVerified: false,
  orgRecovery: 'pending',
})

/** The step a user should be on, given what they have done so far. */
export function resumeStep(d: SignupDraft): SignupStep | 'done' {
  if (d.accountCreated) {
    if (!d.kitVerified) return d.kitSaved ? 'verify-kit' : 'recovery-kit'
    if (d.kind === 'org') return d.orgRecovery === 'pending' ? 'org-recovery' : 'invite'
    return 'done'
  }
  if (d.signupToken) return 'passphrase'
  if (d.signupId) return 'verify-email'
  return d.kind === 'org' ? 'org' : 'start'
}

/** Whether a step can be shown now. Steps can't be skipped, and nothing before the account exists can be redone. */
export function stepAllowed(step: SignupStep, d: SignupDraft): boolean {
  switch (step) {
    case 'start':
    case 'org':
      return !d.accountCreated
    case 'verify-email':
      return Boolean(d.signupId) && !d.signupToken && !d.accountCreated
    case 'passphrase':
      return Boolean(d.signupToken) && !d.accountCreated
    case 'recovery-kit':
      return d.accountCreated && !d.kitVerified
    case 'verify-kit':
      return d.accountCreated && d.kitSaved && !d.kitVerified
    case 'org-recovery':
      return d.kind === 'org' && d.kitVerified && d.orgRecovery === 'pending'
    case 'invite':
      return d.kind === 'org' && d.kitVerified && d.orgRecovery !== 'pending'
  }
}

// The recovery words, in memory only: never in Vue state (no payload, no devtools), never stored.
const kitPhrase = shallowRef<string | null>(null)
let restored = false

export function useSignup() {
  const draft = useState<SignupDraft>('sg-signup', emptyDraft)

  if (import.meta.client && !restored) {
    restored = true
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY)
      if (saved) draft.value = { ...emptyDraft(), ...(JSON.parse(saved) as Partial<SignupDraft>) }
    } catch {
      // Storage blocked (private mode, policy): the flow still works, it just won't survive a reload.
    }
    // Detached scope: the watcher must outlive the page that first called useSignup().
    effectScope(true).run(() =>
      watch(
        draft,
        (value) => {
          try {
            const text = JSON.stringify(value)
            // Nothing in progress (never started, or finished and reset): leave nothing behind.
            if (text === JSON.stringify(emptyDraft())) sessionStorage.removeItem(STORAGE_KEY)
            else sessionStorage.setItem(STORAGE_KEY, text)
          } catch {
            // See above.
          }
        },
        { deep: true },
      ),
    )
  }

  function update(patch: Partial<SignupDraft>) {
    draft.value = { ...draft.value, ...patch }
  }

  /** Forget everything (finished, or "start over"). */
  function reset() {
    kitPhrase.value = null
    draft.value = emptyDraft()
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      // See above.
    }
  }

  /** Sends the verification code; used by both the individual and the organization form. */
  async function startSignup() {
    const { locale } = useNuxtApp().$i18n
    const d = draft.value
    const response = await signupApi.start({
      kind: d.kind ?? 'individual',
      name: d.name.trim(),
      email: d.email,
      locale: locale.value,
      org: d.kind === 'org' && d.sector ? { name: d.orgName.trim(), sector: d.sector } : undefined,
    })
    update({ signupId: response.signup_id, signupToken: null, resendAt: Date.now() + response.resend_after * 1000 })
  }

  return {
    draft,
    update,
    reset,
    startSignup,
    kitPhrase: readonly(kitPhrase),
    setKitPhrase: (phrase: string) => (kitPhrase.value = phrase),
    wipeKitPhrase: () => (kitPhrase.value = null),
    resumePath: () => SIGNUP_PATHS[resumeStep(draft.value)],
  }
}
