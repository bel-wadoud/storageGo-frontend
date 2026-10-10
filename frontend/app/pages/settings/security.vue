<script setup lang="ts">
import { accountApi, type Device, type Session } from '~/services/api/account'

// Passphrase · Recovery kit · Devices · Sessions (sitemap.md). Each part states the consequence
// of its actions before they happen (principles.md §3).
definePageMeta({ layout: 'app', middleware: 'auth' })
const { t, locale } = useI18n()
const route = useRoute()
const toast = useToast()
const online = useOnline()
const errorMessage = useErrorMessage()
const account = useAccountDetails()
const { account: summary, setAccount } = useAccount()

const details = computed(() => account.details.value)
const passphraseOpen = ref(false)
const kitOpen = ref(false)

// ---- Recovery kit ----
const confirmingKit = ref(false)
async function stillHaveKit() {
  confirmingKit.value = true
  try {
    const { kit_confirmed_at } = await accountApi.confirmKit()
    kitConfirmed(kit_confirmed_at)
    toast.success(t('settings.kit.thanks'))
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    confirmingKit.value = false
  }
}

function kitConfirmed(at: string) {
  account.patch({ kit_confirmed_at: at })
  if (summary.value) setAccount({ ...summary.value, kit_confirmed_at: at, kit_reminder_due: false })
}

// ---- Devices ----
const devices = ref<Device[]>([])
const devicesLoading = ref(true)
const devicesError = shallowRef<unknown>(null)
const codes = ref<Record<string, [string, string]>>({})
const busyDevice = ref<string | null>(null)
const revoking = ref<Device | null>(null)

async function loadDevices() {
  devicesLoading.value = true
  devicesError.value = null
  try {
    devices.value = await accountApi.devices()
    const engine = await useCrypto()
    for (const device of devices.value.filter((d) => d.status === 'pending')) {
      codes.value = { ...codes.value, [device.id]: await engine.safetyCode(device.public_key) }
    }
  } catch (error) {
    devicesError.value = error
  } finally {
    devicesLoading.value = false
  }
}

const pending = computed(() => devices.value.filter((d) => d.status === 'pending'))
const trusted = computed(() => devices.value.filter((d) => d.status === 'trusted').sort((a, b) => Number(b.current) - Number(a.current)))

async function approve(device: Device) {
  busyDevice.value = device.id
  try {
    const signature = await (await useCrypto()).approveDevice(device.public_key)
    await accountApi.approveDevice(device.id, signature)
    devices.value = devices.value.map((d) => (d.id === device.id ? { ...d, status: 'trusted' } : d))
    toast.success(t('settings.devices.approved', { name: device.name }))
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    busyDevice.value = null
  }
}

async function deny(device: Device) {
  busyDevice.value = device.id
  try {
    await accountApi.denyDevice(device.id)
    devices.value = devices.value.filter((d) => d.id !== device.id)
    toast.success(t('settings.devices.denied', { name: device.name }))
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    busyDevice.value = null
  }
}

const revokeOpen = computed({ get: () => Boolean(revoking.value), set: (v) => !v && (revoking.value = null) })
const revokeBusy = ref(false)
async function revoke() {
  const device = revoking.value
  if (!device) return
  revokeBusy.value = true
  try {
    await accountApi.revokeDevice(device.id)
    devices.value = devices.value.filter((d) => d.id !== device.id)
    toast.success(t('settings.devices.revoked', { name: device.name }))
    revoking.value = null
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    revokeBusy.value = false
  }
}

// ---- Sessions ----
const sessions = ref<Session[]>([])
const sessionsLoading = ref(true)
const sessionsError = shallowRef<unknown>(null)
const endingSession = ref<string | null>(null)
const endingOthers = ref(false)

async function loadSessions() {
  sessionsLoading.value = true
  sessionsError.value = null
  try {
    sessions.value = await accountApi.sessions()
  } catch (error) {
    sessionsError.value = error
  } finally {
    sessionsLoading.value = false
  }
}

const others = computed(() => sessions.value.filter((s) => !s.current))

async function endSession(session: Session) {
  endingSession.value = session.id
  try {
    await accountApi.endSession(session.id)
    sessions.value = sessions.value.filter((s) => s.id !== session.id)
    toast.success(t('settings.sessions.ended', { name: session.name }))
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    endingSession.value = null
  }
}

async function endOthers() {
  endingOthers.value = true
  try {
    const { ended } = await accountApi.endOtherSessions()
    sessions.value = sessions.value.filter((s) => s.current)
    toast.success(t('settings.sessions.endedOthers', { n: ended }, ended))
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    endingOthers.value = false
  }
}

onMounted(async () => {
  account.load()
  loadDevices()
  loadSessions()
  // Arriving from the account menu's "Still have your recovery kit?" → Regenerate.
  if (route.query.kit === 'regenerate') kitOpen.value = true
  if (route.hash) nextTick(() => document.querySelector(route.hash)?.scrollIntoView())
})
</script>

<template>
  <SettingsShell :title="t('settings.security.title')" :lead="t('settings.security.lead')">
    <!-- Passphrase -->
    <SettingsSection id="passphrase" :title="t('signup.passphrase.label')" :description="t('settings.security.passphraseHint')" info="passphrase">
      <div class="value-row">
        <p class="form__note">{{ t('settings.security.passphraseNote') }}</p>
        <SgButton icon="key" :disabled="!online" :disabled-reason="t('auth.offlineReason')" @click="passphraseOpen = true">
          {{ t('settings.passphrase.title') }}
        </SgButton>
      </div>
    </SettingsSection>

    <!-- Recovery kit -->
    <SettingsSection id="kit" :title="t('settings.kit.section')" :description="t('settings.kit.hint')" info="recoveryKit">
      <SgSkeleton v-if="!details" :lines="2" />
      <template v-else>
        <dl class="facts-grid">
          <div>
            <dt>{{ t('settings.kit.lastConfirmed') }}</dt>
            <dd>{{ details.kit_confirmed_at ? formatDate(new Date(details.kit_confirmed_at), locale) : t('settings.kit.never') }}</dd>
          </div>
          <div>
            <dt>{{ t('settings.kit.ifLost') }}</dt>
            <dd>{{ details.org_recovery ? t('settings.kit.ifLostOrg', { org: details.org_name ?? '' }) : t('settings.kit.ifLostNone') }}</dd>
          </div>
        </dl>
        <div class="form__actions">
          <SgButton
            icon="check"
            :loading="confirmingKit"
            :loading-label="t('settings.saving')"
            :disabled="!online"
            :disabled-reason="t('auth.offlineReason')"
            @click="stillHaveKit"
          >
            {{ t('settings.kit.stillHave') }}
          </SgButton>
          <SgButton icon="refresh" :disabled="!online" :disabled-reason="t('auth.offlineReason')" @click="kitOpen = true">
            {{ t('settings.kit.regenerate') }}
          </SgButton>
        </div>
      </template>
    </SettingsSection>

    <!-- Devices -->
    <SettingsSection id="devices" :title="t('settings.devices.title')" :description="t('settings.devices.hint')" info="trustedDevice">
      <SgSkeleton v-if="devicesLoading && !devices.length" :lines="3" />
      <SgAlert v-else-if="devicesError" tone="danger">
        {{ errorMessage(devicesError) }}
        <template #actions><SgButton size="sm" icon="refresh" @click="loadDevices">{{ t('common.retry') }}</SgButton></template>
      </SgAlert>
      <template v-else>
        <!-- Waiting for approval: compare the two words first. -->
        <div v-for="device in pending" :key="device.id" class="request" role="group" :aria-label="t('settings.devices.requestFrom', { name: device.name })">
          <p class="request__title">
            <SgIcon name="alert" :size="16" />
            {{ t('settings.devices.request', { name: device.name, place: device.location ?? '' }) }}
          </p>
          <p class="form__note">{{ t('settings.devices.compare') }}</p>
          <p class="request__code" dir="ltr" translate="no">
            <span v-for="word in codes[device.id] ?? []" :key="word">{{ word }}</span>
          </p>
          <p class="form__note">{{ t('settings.devices.requested', { when: formatWhen(device.created_at, locale) }) }}</p>
          <div class="form__actions">
            <SgButton
              variant="primary"
              icon="check"
              :loading="busyDevice === device.id"
              :loading-label="t('settings.devices.approving')"
              :disabled="(busyDevice !== null && busyDevice !== device.id) || !online"
              :disabled-reason="t('auth.offlineReason')"
              @click="approve(device)"
            >
              {{ t('settings.devices.approve') }}
            </SgButton>
            <SgButton :disabled="busyDevice !== null || !online" :disabled-reason="t('auth.offlineReason')" @click="deny(device)">
              {{ t('settings.devices.deny') }}
            </SgButton>
          </div>
        </div>

        <ul class="item-list">
          <li v-for="device in trusted" :key="device.id">
            <SgIcon class="item-list__icon" name="monitor" :size="20" />
            <div class="item-list__main">
              <p class="item-list__title">
                <bdi>{{ device.name }}</bdi>
                <span v-if="device.current" class="tag is-signal">{{ t('settings.devices.this') }}</span>
              </p>
              <p class="item-list__meta">
                <template v-if="device.location"><bdi>{{ device.location }}</bdi> · </template>
                {{ t('settings.devices.lastActive', { when: formatWhen(device.last_active_at, locale) }) }} ·
                {{ t('settings.devices.added', { date: formatDate(new Date(device.created_at), locale) }) }}
              </p>
            </div>
            <div class="item-list__actions">
              <SgButton
                v-if="!device.current"
                size="sm"
                variant="ghost"
                :disabled="!online"
                :disabled-reason="t('auth.offlineReason')"
                @click="revoking = device"
              >
                {{ t('settings.devices.revoke') }}
              </SgButton>
            </div>
          </li>
        </ul>
      </template>
    </SettingsSection>

    <!-- Sessions -->
    <SettingsSection id="sessions" :title="t('settings.sessions.title')" :description="t('settings.sessions.hint')" info="sessions">
      <SgSkeleton v-if="sessionsLoading && !sessions.length" :lines="3" />
      <SgAlert v-else-if="sessionsError" tone="danger">
        {{ errorMessage(sessionsError) }}
        <template #actions><SgButton size="sm" icon="refresh" @click="loadSessions">{{ t('common.retry') }}</SgButton></template>
      </SgAlert>
      <template v-else>
        <ul class="item-list">
          <li v-for="session in sessions" :key="session.id">
            <SgIcon class="item-list__icon" name="activity" :size="20" />
            <div class="item-list__main">
              <p class="item-list__title">
                <bdi>{{ session.name }}</bdi>
                <span v-if="session.current" class="tag is-signal">{{ t('settings.sessions.this') }}</span>
              </p>
              <p class="item-list__meta">
                <template v-if="session.location"><bdi>{{ session.location }}</bdi> · </template>
                {{ t('settings.sessions.started', { when: formatWhen(session.created_at, locale) }) }} ·
                {{ t('settings.devices.lastActive', { when: formatWhen(session.last_active_at, locale) }) }}
              </p>
            </div>
            <div class="item-list__actions">
              <SgButton v-if="session.current" size="sm" variant="ghost" icon="logout" to="/signout">{{ t('signin.unlock.signOut') }}</SgButton>
              <SgButton
                v-else
                size="sm"
                variant="ghost"
                :loading="endingSession === session.id"
                :loading-label="t('settings.sessions.ending')"
                :disabled="!online"
                :disabled-reason="t('auth.offlineReason')"
                @click="endSession(session)"
              >
                {{ t('settings.sessions.end') }}
              </SgButton>
            </div>
          </li>
        </ul>
        <div>
          <SgButton
            variant="danger"
            :loading="endingOthers"
            :loading-label="t('settings.sessions.ending')"
            :disabled="!others.length || !online"
            :disabled-reason="!online ? t('auth.offlineReason') : t('settings.sessions.noOthers')"
            @click="endOthers"
          >
            {{ t('settings.sessions.endOthers') }}
          </SgButton>
        </div>
      </template>
    </SettingsSection>

    <SettingsPassphraseDialog v-if="passphraseOpen" v-model:open="passphraseOpen" @changed="loadSessions" />
    <SettingsKitDialog v-if="kitOpen" v-model:open="kitOpen" @done="kitConfirmed" />

    <SgDialog
      v-if="revoking"
      v-model:open="revokeOpen"
      :title="t('settings.devices.revokeTitle', { name: revoking.name })"
      size="sm"
      :busy="revokeBusy"
    >
      <p class="revoke__text">{{ t('settings.devices.revokeBody') }}</p>
      <template #footer>
        <SgButton :disabled="revokeBusy" :disabled-reason="t('common.pleaseWait')" @click="revoking = null">{{ t('common.cancel') }}</SgButton>
        <SgButton variant="danger" :loading="revokeBusy" :loading-label="t('settings.devices.revoking')" @click="revoke">
          {{ t('settings.devices.revokeConfirm') }}
        </SgButton>
      </template>
    </SgDialog>
  </SettingsShell>
</template>

<style scoped>
.request {
  display: grid;
  gap: var(--s-2);
  padding: var(--s-4);
  border: 1px solid var(--rule);
  border-inline-start: 3px solid var(--signal);
  border-radius: var(--radius-2);
  background: var(--surface);
}

.request__title {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  margin: 0;
  font-weight: var(--fw-medium);
}

.request__title .sg-icon {
  color: var(--signal-text);
}

.request__code {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2) var(--s-5);
  margin: 0;
  font-family: var(--font-mono);
  font-size: var(--fs-xl);
  font-weight: var(--fw-medium);
}

[dir='rtl'] .request__code {
  justify-content: flex-end;
}

.revoke__text {
  margin: 0;
  color: var(--fg-2);
}
</style>
