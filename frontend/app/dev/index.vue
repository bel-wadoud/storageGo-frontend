<script setup lang="ts">
// DEVELOPMENT ONLY: /dev. Opens any signup step directly, with the state that step needs
// already in place. The route is added by a development-only hook in nuxt.config.ts, so it
// doesn't exist in production builds.
import type { AccountKind } from '~/services/api/signup'
import { api } from '~/services/api/client'
import { authApi } from '~/services/api/auth'
import { PUBLIC_SAMPLES } from '~/services/dev/mockDrive'
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

// Public pages open in a full page load, as a recipient would open them from a message.
// A fixed sample key (43 base64url characters): the same on the server and in the browser.
const sampleKey = 'Qm9uam91ciBNbWUgQmVuYWxpLCB2b2ljaSBsZSBmaWNo'.slice(0, 43)
const kitSample = 'anchor basket cactus dolphin eagle fabric garden harbor island jacket kettle ladder magnet napkin orbit pepper quarry ribbon saddle tablet umbrella velvet walnut yogurt'
const publicPages = [
  { label: 'File (personal, no password)', href: `/s/${PUBLIC_SAMPLES.file}#k=${sampleKey}` },
  { label: 'File with password (atlas2026)', href: `/s/${PUBLIC_SAMPLES.password}#k=${sampleKey}` },
  { label: 'Folder with a subfolder', href: `/s/${PUBLIC_SAMPLES.folder}#k=${sampleKey}` },
  { label: 'Altered file', href: `/s/${PUBLIC_SAMPLES.altered}#k=${sampleKey}` },
  { label: 'Expired link', href: `/s/${PUBLIC_SAMPLES.expired}#k=${sampleKey}` },
  { label: 'Turned-off link', href: `/s/${PUBLIC_SAMPLES.revoked}#k=${sampleKey}` },
  { label: 'Download limit reached', href: `/s/${PUBLIC_SAMPLES.exhausted}#k=${sampleKey}` },
  { label: 'Link cut by a messenger (no key)', href: `/s/${PUBLIC_SAMPLES.file}` },
  { label: 'Damaged key', href: `/s/${PUBLIC_SAMPLES.file}#k=${sampleKey.slice(0, 20)}` },
  { label: 'Key with a trailing period (still works)', href: `/s/${PUBLIC_SAMPLES.file}#k=${sampleKey}.` },
  { label: 'Unknown link', href: `/s/doesNotExist#k=${sampleKey}` },
  { label: 'File request (open)', href: `/r/${PUBLIC_SAMPLES.request}#k=${sampleKey}` },
  { label: 'File request (closed)', href: `/r/${PUBLIC_SAMPLES.requestClosed}#k=${sampleKey}` },
  { label: 'File request (expired)', href: `/r/${PUBLIC_SAMPLES.requestExpired}#k=${sampleKey}` },
  { label: 'File request without its key', href: `/r/${PUBLIC_SAMPLES.request}` },
]

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

// ---- Sign-in shortcuts ----
const signin = useSignin()
const prelogin = { kdf: { m_kib: 65536, t: 3, p: 1 }, salt: 'dev-salt' }

async function openSignin(key: string, run: () => Promise<unknown>) {
  busy.value = key
  try {
    await run()
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    busy.value = null
  }
}

const signinShortcuts: { key: string; path: string; note: string; run: () => Promise<unknown> }[] = [
  {
    key: 'signin',
    path: '/signin',
    note: 'Email step',
    run: async () => {
      signin.reset()
      await navigateTo('/signin')
    },
  },
  {
    key: 'signin-expired',
    path: '/signin?reason=expired',
    note: 'After a session expired, with ?next=',
    run: async () => {
      signin.reset()
      await navigateTo({ path: '/signin', query: { reason: 'expired', next: '/drive/shared' } })
    },
  },
  {
    key: 'passphrase',
    path: '/signin/passphrase',
    note: 'Karim (org). Type "wrong passphrase" to test errors and the pause',
    run: async () => {
      signin.reset()
      signin.update({ email: 'karim@clinique-atlas.dz', prelogin })
      await navigateTo('/signin/passphrase')
    },
  },
  {
    key: 'approve',
    path: '/signin/approve-device',
    note: 'New device, approved after ~8 s',
    run: () => startApproval('device.karim@clinique-atlas.dz'),
  },
  {
    key: 'approve-deny',
    path: '/signin/approve-device',
    note: 'Declined on the other device',
    run: () => startApproval('deny.karim@clinique-atlas.dz'),
  },
  {
    key: 'approve-expire',
    path: '/signin/approve-device',
    note: 'Expires after 6 s, then "Send a new request"',
    run: () => startApproval('expire.karim@clinique-atlas.dz'),
  },
  {
    key: 'newkit',
    path: '/signin/passphrase',
    note: 'Kit never confirmed: sign-in resumes signup at the kit step',
    run: async () => {
      signin.reset()
      signin.update({ email: 'newkit.amine@mail.dz', prelogin })
      await navigateTo('/signin/passphrase')
    },
  },
  {
    key: 'unlock',
    path: '/signin/unlock',
    note: 'Session alive, keys locked (Karim)',
    run: async () => {
      await api('/dev/session', { method: 'POST' })
      await lockCrypto()
      await navigateTo({ path: '/signin/unlock', query: { reason: 'idle' } })
    },
  },
  {
    key: 'signout',
    path: '/signout',
    note: 'Wipes keys, ends the session',
    run: async () => {
      await navigateTo('/signout')
    },
  },
]

/** Runs the real first half of a sign-in (as the passphrase page does) for an email that needs approval. */
async function startApproval(email: string) {
  signin.reset()
  const vault = await useCrypto()
  const request = await vault.loginRequest(email, 'dev passphrase for testing', prelogin)
  const device = await vault.deviceIdentity()
  const result = await authApi.login(request, { public_key: device.public_key, name: deviceName() })
  if (result.status !== 'device_approval') throw new Error('expected a device approval')
  signin.update({
    email,
    prelogin,
    deviceId: result.device_id,
    deviceExpiresAt: Date.now() + result.expires_in * 1000,
    safetyCode: device.safety_code,
    accountKind: result.account_kind,
  })
  await navigateTo('/signin/approve-device')
}

// ---- Drive shortcuts ----
const driveScenario = reactive<{ empty: boolean; quota: '' | '95' | '100'; failList: boolean; slow: boolean; many: boolean }>({
  empty: false,
  quota: '',
  failList: false,
  slow: false,
  many: false,
})
onMounted(() => {
  try {
    Object.assign(driveScenario, JSON.parse(sessionStorage.getItem('sg_dev_drive') ?? '{}'))
  } catch {
    // Defaults.
  }
})

const adminScenario = reactive({ seatsFull: false, domainVerified: false, oneHolder: false, emptyQueue: false })
onMounted(() => {
  try {
    Object.assign(adminScenario, JSON.parse(sessionStorage.getItem('sg_dev_admin') ?? '{}'))
  } catch {
    // Defaults.
  }
})
async function applyAdminScenario() {
  sessionStorage.setItem('sg_dev_admin', JSON.stringify(adminScenario))
  const { resetMockAdmin } = await import('~/services/dev/mockAdmin')
  resetMockAdmin()
  useAdminOverview().overview.value = null
  toast.success('Administration sample data reset with this scenario')
}

async function applyScenario() {
  sessionStorage.setItem('sg_dev_drive', JSON.stringify(driveScenario))
  const { resetMockDrive } = await import('~/services/dev/mockDrive')
  resetMockDrive()
  useDrive().clear()
  toast.success('Drive sample data reset with this scenario')
}

/** Signs in (mock) and opens the drive, as the real sign-in would. */
async function openDrive(email: string, path = '/drive') {
  const vault = await useCrypto()
  await vault.lock()
  const request = await vault.loginRequest(email, 'dev passphrase for testing', prelogin)
  const device = await vault.deviceIdentity()
  const result = await authApi.login(request, { public_key: device.public_key, name: deviceName() })
  if (result.status !== 'ok') throw new Error('expected a direct sign-in')
  await vault.unlock(result.bundle)
  useDrive().clear()
  useAccount().setAccount(result.account)
  useAccountDetails().details.value = null
  await navigateTo(path)
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
    <p class="dev__lead">Open any signup, sign-in, drive or settings screen with its state prepared. This page and route don't exist in production builds.</p>

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
      <h2>Sign-in</h2>
      <table class="dev__table">
        <tbody>
          <tr v-for="item in signinShortcuts" :key="item.key">
            <th scope="row">
              <code dir="ltr">{{ item.path }}</code>
              <span>{{ item.note }}</span>
            </th>
            <td>
              <div class="dev__cell">
                <SgButton
                  size="sm"
                  icon-end="arrow-end"
                  :loading="busy === item.key"
                  :disabled="busy !== null && busy !== item.key"
                  @click="openSignin(item.key, item.run)"
                >
                  Open
                </SgButton>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section>
      <h2>Drive</h2>
      <div class="dev__actions">
        <SgButton size="sm" icon="building" :loading="busy === 'drive-org'" :disabled="busy !== null" @click="openSignin('drive-org', () => openDrive('karim@clinique-atlas.dz'))">
          Open as Karim (organization admin)
        </SgButton>
        <SgButton size="sm" icon="user" :loading="busy === 'drive-me'" :disabled="busy !== null" @click="openSignin('drive-me', () => openDrive('amine.saidi@mail.dz'))">
          Open as Amine (individual)
        </SgButton>
      </div>
      <fieldset class="dev__scenario">
        <legend>Sample data scenario</legend>
        <SgCheckbox v-model="driveScenario.empty" label="Brand-new organization (empty)" />
        <SgCheckbox v-model="driveScenario.many" label="1,500 files in “Archives scannées”" />
        <SgCheckbox v-model="driveScenario.failList" label="Root folder listing fails" />
        <SgCheckbox v-model="driveScenario.slow" label="Slow network" />
        <label class="dev__select">
          Storage
          <select v-model="driveScenario.quota">
            <option value="">Normal (42%)</option>
            <option value="95">Almost full (96%)</option>
            <option value="100">Full (100%)</option>
          </select>
        </label>
        <SgButton size="sm" icon="refresh" @click="applyScenario">Apply and reset sample data</SgButton>
      </fieldset>
      <p class="dev__hint">
        Try: the altered file “Scan_ordonnance_0459.pdf” and the unreadable name in “Comptabilité 2025”, sharing with Nadia
        (her key changed), the read-only “Protocoles de soins” folder, dropping a folder onto the page, uploading a file twice (name conflict).
      </p>
    </section>

    <section>
      <h2>Administration</h2>
      <div class="dev__actions">
        <SgButton size="sm" icon="settings" :loading="busy === 'adm'" :disabled="busy !== null" @click="openSignin('adm', () => openDrive('karim@clinique-atlas.dz', '/admin'))">
          Overview (Karim, admin)
        </SgButton>
        <SgButton size="sm" icon="key" :loading="busy === 'adm-rec'" :disabled="busy !== null" @click="openSignin('adm-rec', () => openDrive('karim@clinique-atlas.dz', '/admin/recovery'))">
          Recovery queue (Karim)
        </SgButton>
        <SgButton size="sm" icon="users" :loading="busy === 'adm-mem'" :disabled="busy !== null" @click="openSignin('adm-mem', () => openDrive('karim@clinique-atlas.dz', '/admin/members'))">
          Members (Karim)
        </SgButton>
        <SgButton size="sm" icon="user" :loading="busy === 'adm-no'" :disabled="busy !== null" @click="openSignin('adm-no', () => openDrive('yacine@clinique-atlas.dz', '/admin'))">
          As Yacine (member, not admin)
        </SgButton>
      </div>
      <fieldset class="dev__scenario">
        <legend>Administration scenario</legend>
        <SgCheckbox v-model="adminScenario.seatsFull" label="No seats left (invites blocked)" />
        <SgCheckbox v-model="adminScenario.domainVerified" label="Domain already verified" />
        <SgCheckbox v-model="adminScenario.oneHolder" label="Only one recovery key holder (1 approval)" />
        <SgCheckbox v-model="adminScenario.emptyQueue" label="Empty recovery queue" />
        <SgButton size="sm" icon="refresh" @click="applyAdminScenario">Apply and reset sample data</SgButton>
      </fieldset>
      <p class="dev__hint">
        Passphrase for approvals: anything except “wrong passphrase”. Yacine's request needs two approvals (Samia's or yours first);
        Leila's already has Samia's. The domain check succeeds on the second try.
      </p>
    </section>

    <section>
      <h2>Recovery and invitations</h2>
      <ul class="dev__links">
        <li><a href="/recover">Forgot passphrase (the fork)</a></li>
        <li><a href="/recover/kit">Recover with the kit</a></li>
        <li><a href="/recover/admin-request">Ask my organization</a></li>
        <li><a href="/invite/inv-member">Invitation (member)</a></li>
        <li><a href="/invite/inv-admin">Invitation (administrator)</a></li>
        <li><a href="/invite/inv-expired">Invitation expired</a></li>
        <li><a href="/invite/inv-used">Invitation already used</a></li>
        <li><a href="/invite/inv-revoked">Invitation cancelled</a></li>
        <li><a href="/invite/nope">Unknown invitation</a></li>
        <li><a href="/this-page-does-not-exist">Page not found</a></li>
      </ul>
      <p class="dev__hint">
        Kit: any 24 words from “{{ kitSample }}”; one word repeated 24 times is another account's kit.
        Admin request: approved after a few checks; an email containing “deny” or “expire” is denied or expires; @mail.dz has no organization.
      </p>
    </section>

    <section>
      <h2>Public pages (no account)</h2>
      <ul class="dev__links">
        <li v-for="page in publicPages" :key="page.href"><a :href="page.href">{{ page.label }}</a></li>
      </ul>
    </section>

    <section>
      <h2>Settings</h2>
      <div class="dev__actions">
        <SgButton size="sm" icon="key" :loading="busy === 'set-security'" :disabled="busy !== null" @click="openSignin('set-security', () => openDrive('karim@clinique-atlas.dz', '/settings/security'))">
          Security (Karim, pending device in Sétif)
        </SgButton>
        <SgButton size="sm" icon="sheet" :loading="busy === 'set-plan'" :disabled="busy !== null" @click="openSignin('set-plan', () => openDrive('amine.saidi@mail.dz', '/settings/plan'))">
          Plan and billing (Amine)
        </SgButton>
        <SgButton size="sm" icon="building" :loading="busy === 'set-plan-org'" :disabled="busy !== null" @click="openSignin('set-plan-org', () => openDrive('karim@clinique-atlas.dz', '/settings/plan'))">
          Plan (Karim, organization)
        </SgButton>
        <SgButton size="sm" icon="user" :loading="busy === 'set-profile'" :disabled="busy !== null" @click="openSignin('set-profile', () => openDrive('amine.saidi@mail.dz', '/settings/profile'))">
          Profile (Amine)
        </SgButton>
      </div>
      <p class="dev__lead">Current passphrase “wrong passphrase” is rejected; email code 000000 is rejected.</p>
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

.dev__scenario {
  display: grid;
  gap: var(--s-2);
  margin: var(--s-4) 0 0;
  padding: var(--s-4);
  border: 1px solid var(--rule);
  border-radius: var(--radius-2);
}

.dev__scenario legend {
  padding: 0 var(--s-1);
  font-size: var(--fs-sm);
  font-weight: var(--fw-medium);
}

.dev__select {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  font-size: var(--fs-sm);
}

.dev__hint {
  margin: var(--s-3) 0 0;
  font-size: var(--fs-xs);
  color: var(--fg-2);
}

.dev__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2);
}

.dev__links {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
  gap: var(--s-2) var(--s-4);
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: var(--fs-sm);
}

.dev__links a {
  color: var(--fg);
  text-underline-offset: 3px;
}
</style>
