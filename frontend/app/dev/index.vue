<script setup lang="ts">
// DEVELOPMENT ONLY: /dev. Opens any signup step directly, with the state that step needs
// already in place. The route is added by a development-only hook in nuxt.config.ts, so it
// doesn't exist in production builds.
import type { AccountKind } from '~/services/api/signup'
import type { SignupDraft, SignupStep } from '~/composables/useSignup'

definePageMeta({ layout: 'auth' })
useHead({ title: 'Dev shortcuts · storageGo', meta: [{ name: 'robots', content: 'noindex' }] })

const config = useRuntimeConfig()
const toast = useToast()
const errorMessage = useErrorMessage()
const { update, reset, setKitPhrase } = useSignup()

const ORDER: SignupStep[] = ['start', 'org', 'verify-email', 'passphrase', 'recovery-kit', 'verify-kit', 'org-recovery', 'invite']
const steps: { step: SignupStep; kinds: AccountKind[]; note: string }[] = [
  { step: 'start', kinds: ['org', 'individual'], note: 'Account type (individual form pre-filled)' },
  { step: 'org', kinds: ['org'], note: 'Organization details' },
  { step: 'verify-email', kinds: ['org', 'individual'], note: '6-digit code · 000000 wrong, 999999 expired' },
  { step: 'passphrase', kinds: ['org', 'individual'], note: 'Passphrase + key creation' },
  { step: 'recovery-kit', kinds: ['org', 'individual'], note: 'Account created, kit in memory' },
  { step: 'verify-kit', kinds: ['org', 'individual'], note: 'Kit saved, asks 2 words' },
  { step: 'org-recovery', kinds: ['org'], note: 'Kit verified, keys unlocked' },
  { step: 'invite', kinds: ['org'], note: 'Recovery done · "taken" addresses are skipped' },
]

const busy = ref<string | null>(null)

const people: Record<AccountKind, Pick<SignupDraft, 'name' | 'email' | 'orgName' | 'sector'>> = {
  org: { name: 'Karim Haddad', email: 'karim@clinique-atlas.dz', orgName: 'Clinique Atlas', sector: 'health' },
  individual: { name: 'Amine Saidi', email: 'amine.saidi@mail.dz', orgName: '', sector: '' },
}

/** Prepares the draft (and the mock keys) a step needs, then opens it. */
async function open(step: SignupStep, kind: AccountKind, special?: 'kit-lost' | 'locked') {
  busy.value = `${step}-${kind}-${special ?? ''}`
  try {
    reset()
    const reached = (s: SignupStep) => ORDER.indexOf(step) >= ORDER.indexOf(s)
    const patch: Partial<SignupDraft> = { kind, ...people[kind] }
    if (reached('verify-email')) Object.assign(patch, { signupId: 'dev-signup', resendAt: Date.now() + 30_000 })
    if (reached('passphrase')) patch.signupToken = 'dev-token'
    if (reached('recovery-kit')) {
      const engine = await useCrypto()
      const { recovery_phrase } = await engine.signup(people[kind].email, 'dev passphrase for testing')
      if (special !== 'kit-lost' && !reached('org-recovery')) setKitPhrase(recovery_phrase)
      // A real reload loses both the words and the unlocked keys.
      if (special) await engine.lock()
      Object.assign(patch, { signupToken: null, accountCreated: true, orgId: 'dev-org' })
    }
    if (reached('verify-kit')) patch.kitSaved = true
    if (reached('org-recovery')) patch.kitVerified = true
    if (reached('invite')) patch.orgRecovery = 'done'
    update(patch)
    await navigateTo(SIGNUP_PATHS[step])
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    busy.value = null
  }
}

function clear() {
  reset()
  toast.success('Signup progress cleared')
}
</script>

<template>
  <div class="dev">
    <p class="dev__tag">Development only</p>
    <h1>Dev shortcuts</h1>
    <p class="dev__lead">Open any signup step with its state prepared. This page and route don't exist in production builds.</p>

    <SgAlert v-if="!config.public.devMocks" tone="warning">
      Dev mocks are off (NUXT_PUBLIC_DEV_MOCKS). Steps after the passphrase need the crypto engine and the API.
    </SgAlert>

    <section>
      <h2>Signup steps</h2>
      <table class="dev__table">
        <tbody>
          <tr v-for="row in steps" :key="row.step">
            <th scope="row">
              <code dir="ltr">{{ SIGNUP_PATHS[row.step] }}</code>
              <span>{{ row.note }}</span>
            </th>
            <td>
              <div class="dev__cell">
                <SgButton
                  v-for="kind in row.kinds"
                  :key="kind"
                  size="sm"
                  :icon="kind === 'org' ? 'building' : 'user'"
                  :loading="busy === `${row.step}-${kind}-`"
                  :disabled="busy !== null && busy !== `${row.step}-${kind}-`"
                  @click="open(row.step, kind)"
                >
                  {{ kind === 'org' ? 'Organization' : 'Individual' }}
                </SgButton>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section>
      <h2>Edge states</h2>
      <div class="dev__actions">
        <SgButton size="sm" :loading="busy === 'recovery-kit-org-kit-lost'" @click="open('recovery-kit', 'org', 'kit-lost')">
          Kit page after a reload
        </SgButton>
        <SgButton size="sm" :loading="busy === 'verify-kit-individual-kit-lost'" @click="open('verify-kit', 'individual', 'kit-lost')">
          Verify kit after a reload
        </SgButton>
        <SgButton size="sm" :loading="busy === 'org-recovery-org-locked'" @click="open('org-recovery', 'org', 'locked')">
          Org recovery with locked keys
        </SgButton>
        <SgButton size="sm" variant="ghost" icon="refresh" @click="clear">Clear signup progress</SgButton>
      </div>
    </section>

    <section>
      <h2>Preferences (app menus)</h2>
      <div class="dev__actions">
        <SgLanguageSwitcher />
        <SgThemeToggle />
      </div>
    </section>
  </div>
</template>

<style scoped>
.dev {
  display: grid;
  gap: var(--s-6);
}

.dev h1 {
  margin: 0;
  font-size: var(--fs-2xl);
  font-weight: var(--fw-medium);
}

.dev h2 {
  margin: 0 0 var(--s-3);
  font-size: var(--fs-md);
  font-weight: var(--fw-medium);
}

.dev__tag {
  width: fit-content;
  margin: 0 0 calc(-1 * var(--s-4));
  padding: 2px var(--s-2);
  border: 1px dashed var(--signal);
  border-radius: var(--radius-1);
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
  color: var(--signal-text);
}

.dev__lead {
  margin: calc(-1 * var(--s-3)) 0 0;
  color: var(--fg-2);
}

.dev__table {
  width: 100%;
  border-collapse: collapse;
}

.dev__table tr {
  border-top: 1px solid var(--rule);
}

.dev__table th {
  display: grid;
  gap: 2px;
  padding: var(--s-3) 0;
  font-weight: var(--fw-regular);
  text-align: start;
}

.dev__table th span {
  font-size: var(--fs-xs);
  color: var(--fg-2);
}

.dev__table td {
  padding: var(--s-3) 0;
}

.dev__cell {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--s-2);
}

@media (max-width: 560px) {
  .dev__table tr,
  .dev__table th,
  .dev__table td {
    display: block;
  }

  .dev__table td {
    padding-top: 0;
  }

  .dev__cell {
    justify-content: flex-start;
  }
}

.dev__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2);
}
</style>
