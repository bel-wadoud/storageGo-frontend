<script setup lang="ts">
import { ApiError } from '~/services/api/client'
import { adminApi, type AdminMember, type Organization } from '~/services/api/admin'

// The organization itself (sitemap §5): its name and sector, its domain (proved with a DNS
// record), its logo, and its administrators, including who holds a share of the recovery key
// (key-model-ux.md §4: removing the last holder is blocked; two holders are recommended).
definePageMeta({ layout: 'app', middleware: ['auth', 'admin'] })
const { t, locale } = useI18n()
const toast = useToast()
const online = useOnline()
const errorMessage = useErrorMessage()
const authKeyFor = useReauth()
const { account, setAccount } = useAccount()
const { refresh: refreshOverview } = useAdminOverview()

const org = ref<Organization | null>(null)
const failure = shallowRef<unknown>(null)

async function load() {
  failure.value = null
  try {
    org.value = await adminApi.organization()
    name.value = org.value.name
    sector.value = org.value.sector
    domain.value = org.value.domain ?? ''
  } catch (error) {
    failure.value = error
  }
}
onMounted(load)

// ---- Name and sector ----
const name = ref('')
const sector = ref('')
const savingProfile = ref(false)
const sectors = computed(() => ['health', 'legal', 'finance', 'public', 'education', 'other'].map((value) => ({ value, label: t(`signup.org.sectors.${value}`) })))
const nameError = computed(() => (!name.value.trim() ? t('admin.org.nameEmpty') : [...name.value.trim()].length > 120 ? t('settings.profile.errors.long') : ''))
const profileDirty = computed(() => org.value !== null && (name.value.trim() !== org.value.name || sector.value !== org.value.sector))
async function saveProfile() {
  if (!profileDirty.value || nameError.value) return
  savingProfile.value = true
  try {
    org.value = await adminApi.updateOrganization({ name: name.value.trim(), sector: sector.value })
    // The new name shows everywhere at once: account menu and workspace switcher.
    if (account.value) setAccount({ ...account.value, org_name: org.value.name })
    const drive = useDrive()
    drive.workspaces.value = drive.workspaces.value.map((w) => (w.kind === 'org' ? { ...w, name: org.value!.name } : w))
    toast.success(t('admin.org.saved'))
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    savingProfile.value = false
  }
}

// ---- Domain ----
const domain = ref('')
const savingDomain = ref(false)
const checking = ref(false)
const DOMAIN = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/
const domainError = computed(() => (domain.value.trim() && !DOMAIN.test(domain.value.trim().toLowerCase()) ? t('admin.org.domain.invalid') : ''))
const domainDirty = computed(() => org.value !== null && domain.value.trim().toLowerCase() !== (org.value.domain ?? ''))
async function saveDomain() {
  if (!domainDirty.value || domainError.value) return
  savingDomain.value = true
  try {
    org.value = await adminApi.updateOrganization({ domain: domain.value.trim().toLowerCase() || null })
    domain.value = org.value.domain ?? ''
    toast.success(org.value.domain ? t('admin.org.domain.added') : t('admin.org.domain.removed'))
    refreshOverview()
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    savingDomain.value = false
  }
}
async function checkDomain() {
  checking.value = true
  try {
    org.value = await adminApi.checkDomain()
    if (org.value.domain_status === 'verified') {
      toast.success(t('admin.org.domain.verifiedNow', { domain: org.value.domain }))
      refreshOverview()
    } else toast.warning(t('admin.org.domain.notYet'))
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    checking.value = false
  }
}

// ---- Logo ----
const logoInput = ref<HTMLInputElement | null>(null)
const savingLogo = ref(false)
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml']
async function pickLogo(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!LOGO_TYPES.includes(file.type)) {
    toast.error(t('admin.org.logo.type'))
    return
  }
  if (file.size > 1_000_000) {
    toast.error(t('admin.org.logo.size'))
    return
  }
  savingLogo.value = true
  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })
    org.value = await adminApi.setLogo(dataUrl)
    toast.success(t('admin.org.logo.saved'))
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    savingLogo.value = false
  }
}
async function removeLogo() {
  savingLogo.value = true
  try {
    org.value = await adminApi.setLogo(null)
    toast.success(t('admin.org.logo.removed'))
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    savingLogo.value = false
  }
}

// ---- Administrators ----
const myEmail = computed(() => account.value?.email)
const iHoldKey = computed(() => org.value?.admins.some((a) => a.person.email === myEmail.value && a.holds_recovery_key) ?? false)
const holders = computed(() => org.value?.admins.filter((a) => a.holds_recovery_key).length ?? 0)

const granting = ref<Organization['admins'][number] | null>(null)
const grantOpen = computed({ get: () => granting.value !== null, set: (v) => !v && (granting.value = null) })
const grantPassphrase = ref('')
const grantError = ref('')
const grantBusy = ref(false)
watch(granting, () => {
  grantPassphrase.value = ''
  grantError.value = ''
})
async function grant() {
  const admin = granting.value
  if (!admin) return
  if (!grantPassphrase.value) {
    grantError.value = t('signin.passphrase.errors.empty')
    return
  }
  grantBusy.value = true
  grantError.value = ''
  try {
    const authKey = await authKeyFor(grantPassphrase.value)
    const material = await adminApi.grantMaterial(admin.person.user_id)
    const result = await (await useCrypto()).grantRecoveryKey(material)
    org.value = await adminApi.grantRecoveryKey(admin.person.user_id, authKey, result)
    granting.value = null
    toast.success(result.kind === 'final' ? t('admin.org.admins.granted', { name: admin.person.name }) : t('admin.org.admins.grantWaiting', { name: admin.person.name }))
    refreshOverview()
  } catch (error) {
    if (error instanceof ApiError && error.code === 'INVALID_CREDENTIALS') grantError.value = t('settings.passphrase.errors.current')
    else if (error instanceof ApiError && error.data?.reason === 'no_key') grantError.value = t('admin.recovery.noKey')
    else grantError.value = errorMessage(error)
  } finally {
    grantBusy.value = false
  }
}

// Removing someone's admin role (the same rules as on Members).
const demoting = ref<Organization['admins'][number] | null>(null)
const demoteOpen = computed({ get: () => demoting.value !== null, set: (v) => !v && (demoting.value = null) })
async function demote() {
  const admin = demoting.value!
  await adminApi.setRole(admin.person.user_id, 'member')
  await load()
  toast.success(t('admin.members.done.demoted', { name: admin.person.name }))
  refreshOverview()
}
function explain(error: unknown) {
  if (error instanceof ApiError && error.data?.reason === 'last_admin') return t('admin.members.errors.lastAdmin')
  if (error instanceof ApiError && error.data?.reason === 'last_key_holder') return t('admin.members.errors.lastKeyHolder')
  return errorMessage(error)
}

// Adding an administrator: pick an active member.
const addOpen = ref(false)
const candidates = ref<AdminMember[]>([])
const candidate = ref('')
const adding = ref(false)
async function openAdd() {
  candidate.value = ''
  addOpen.value = true
  try {
    const all: AdminMember[] = []
    let next: string | undefined
    do {
      const page = await adminApi.members({ status: 'active', role: 'member', cursor: next })
      all.push(...page.items)
      next = page.next_cursor ?? undefined
    } while (next && all.length < 5000)
    candidates.value = all
  } catch (error) {
    toast.error(errorMessage(error))
  }
}
async function addAdmin() {
  if (!candidate.value) return
  adding.value = true
  try {
    const member = await adminApi.setRole(candidate.value, 'admin')
    await load()
    addOpen.value = false
    toast.success(t('admin.members.done.promoted', { name: member.name || member.email }))
  } catch (error) {
    toast.error(explain(error))
  } finally {
    adding.value = false
  }
}
</script>

<template>
  <AdminShell :title="t('admin.org.title')" :lead="t('admin.org.lead')">
    <SgAlert v-if="failure" tone="danger">
      {{ errorMessage(failure) }}
      <template #actions><SgButton size="sm" icon="refresh" @click="load">{{ t('common.retry') }}</SgButton></template>
    </SgAlert>
    <div v-else-if="!org" aria-busy="true"><SgSkeleton :lines="10" /></div>

    <template v-else>
      <SettingsSection id="profile" :title="t('admin.org.profile')" :description="t('admin.org.profileHint')">
        <form class="org__form" novalidate @submit.prevent="saveProfile">
          <SgField :label="t('signup.org.orgName')" :error="nameError" required>
            <SgInput v-model="name" dir="auto" autocomplete="organization" :disabled="savingProfile" />
          </SgField>
          <SgField :label="t('signup.org.sector')">
            <SgSelect v-model="sector" :options="sectors" :disabled="savingProfile" />
          </SgField>
          <div>
            <SgButton
              type="submit"
              variant="primary"
              :loading="savingProfile"
              :loading-label="t('settings.saving')"
              :disabled="!profileDirty || Boolean(nameError) || !online"
              :disabled-reason="!online ? t('auth.offlineReason') : nameError || t('settings.noChanges')"
            >
              {{ t('settings.save') }}
            </SgButton>
          </div>
        </form>
        <p class="form__note">{{ t('admin.org.since', { date: formatDate(new Date(org.created_at), locale) }) }}</p>
      </SettingsSection>

      <SettingsSection id="domain" :title="t('admin.org.domain.title')" :description="t('admin.org.domain.hint')">
        <form class="row-form" novalidate @submit.prevent="saveDomain">
          <SgField :label="t('admin.org.domain.label')" :error="domainError">
            <SgInput v-model="domain" dir="ltr" inputmode="url" autocomplete="off" :placeholder="t('admin.org.domain.placeholder')" :disabled="savingDomain" />
          </SgField>
          <SgButton type="submit" :loading="savingDomain" :loading-label="t('settings.saving')" :disabled="!domainDirty || Boolean(domainError) || !online" :disabled-reason="!online ? t('auth.offlineReason') : domainError || t('settings.noChanges')">
            {{ t('settings.save') }}
          </SgButton>
        </form>

        <p v-if="org.domain_status === 'verified'" class="org__verified"><SgIcon name="check-circle" :size="16" />{{ t('admin.org.domain.verified', { domain: org.domain }) }}</p>
        <div v-else-if="org.domain_status === 'pending' && org.domain_record" class="org__dns">
          <p class="org__dns-lead"><span class="tag is-signal">{{ t('admin.org.domain.pending') }}</span> {{ t('admin.org.domain.howTo') }}</p>
          <dl class="org__record">
            <div><dt>{{ t('admin.org.domain.type') }}</dt><dd><span dir="ltr" class="org__mono">TXT</span></dd></div>
            <div>
              <dt>{{ t('admin.org.domain.name') }}</dt>
              <dd><span dir="ltr" class="org__mono">{{ org.domain_record.name }}</span><SgCopyButton :value="org.domain_record.name" size="sm" variant="ghost" icon-only :label="t('admin.org.domain.copyName')" /></dd>
            </div>
            <div>
              <dt>{{ t('admin.org.domain.value') }}</dt>
              <dd><span dir="ltr" class="org__mono">{{ org.domain_record.value }}</span><SgCopyButton :value="org.domain_record.value" size="sm" variant="ghost" icon-only :label="t('admin.org.domain.copyValue')" /></dd>
            </div>
          </dl>
          <p class="form__note">{{ t('admin.org.domain.delay') }}</p>
          <div><SgButton icon="refresh" :loading="checking" :loading-label="t('admin.org.domain.checking')" :disabled="!online" :disabled-reason="t('auth.offlineReason')" @click="checkDomain">{{ t('admin.org.domain.check') }}</SgButton></div>
        </div>
      </SettingsSection>

      <SettingsSection id="logo" :title="t('admin.org.logo.title')" :description="t('admin.org.logo.hint')">
        <div class="org__logo">
          <div class="org__logo-box">
            <img v-if="org.logo_url" :src="org.logo_url" :alt="t('admin.org.logo.alt', { name: org.name })" />
            <span v-else class="org__logo-empty">{{ t('admin.org.logo.none') }}</span>
          </div>
          <div class="org__logo-actions">
            <SgButton icon="upload" :loading="savingLogo" :loading-label="t('settings.saving')" :disabled="!online" :disabled-reason="t('auth.offlineReason')" @click="logoInput?.click()">
              {{ org.logo_url ? t('admin.org.logo.change') : t('admin.org.logo.add') }}
            </SgButton>
            <SgButton v-if="org.logo_url" variant="ghost" :disabled="savingLogo || !online" :disabled-reason="!online ? t('auth.offlineReason') : t('common.pleaseWait')" @click="removeLogo">{{ t('admin.org.logo.remove') }}</SgButton>
            <p class="form__note">{{ t('admin.org.logo.rules') }}</p>
          </div>
          <input ref="logoInput" class="sr-only" type="file" accept="image/png,image/jpeg,image/svg+xml" tabindex="-1" aria-hidden="true" @change="pickLogo" />
        </div>
      </SettingsSection>

      <SettingsSection id="admins" :title="t('admin.org.admins.title')" :description="t('admin.org.admins.hint', { n: org.recovery_threshold }, org.recovery_threshold)">
        <SgAlert v-if="holders < 2" tone="warning">{{ t('admin.overview.health.holders') }}</SgAlert>
        <ul class="item-list">
          <li v-for="admin in org.admins" :key="admin.person.user_id">
            <SgAvatar :name="admin.person.name" :size="32" />
            <div class="item-list__main">
              <p class="item-list__title">
                <bdi>{{ admin.person.name }}</bdi>
                <span v-if="admin.person.email === myEmail" class="tag is-signal">{{ t('admin.members.you') }}</span>
              </p>
              <p class="item-list__meta">
                <bdi dir="ltr">{{ admin.person.email }}</bdi> ·
                <template v-if="admin.holds_recovery_key"><SgIcon name="key" :size="12" /> {{ t('admin.members.keyHolder') }}</template>
                <template v-else-if="admin.pending_key">{{ t('admin.org.admins.pendingKey') }}</template>
                <template v-else>{{ t('admin.org.admins.noKey') }}</template>
              </p>
            </div>
            <div class="item-list__actions">
              <SgButton
                v-if="!admin.holds_recovery_key && !admin.pending_key"
                size="sm"
                icon="key"
                :disabled="!iHoldKey || !online"
                :disabled-reason="!online ? t('auth.offlineReason') : t('admin.recovery.noKeyShort')"
                @click="granting = admin"
              >
                {{ t('admin.org.admins.grant') }}
              </SgButton>
              <SgButton
                v-if="admin.person.email !== myEmail"
                size="sm"
                variant="ghost"
                :disabled="!online"
                :disabled-reason="t('auth.offlineReason')"
                @click="demoting = admin"
              >
                {{ t('admin.members.actions.demote') }}
              </SgButton>
            </div>
          </li>
        </ul>
        <div><SgButton icon="user-plus" :disabled="!online" :disabled-reason="t('auth.offlineReason')" @click="openAdd">{{ t('admin.org.admins.add') }}</SgButton></div>
      </SettingsSection>
    </template>

    <SgDialog v-if="granting" v-model:open="grantOpen" :title="t('admin.org.admins.grantTitle', { name: granting.person.name })" size="sm" :busy="grantBusy">
      <form id="admin-grant-key" class="org__grant" novalidate @submit.prevent="grant">
        <p>{{ t('admin.org.admins.grantBody', { name: granting.person.name }) }}</p>
        <SgField :label="t('admin.recovery.approve.passphrase')" :hint="t('admin.recovery.approve.passphraseHint')" :error="grantError" required>
          <SgPassphraseInput v-model="grantPassphrase" autocomplete="current-password" :placeholder="t('placeholders.passphrase')" :disabled="grantBusy" />
        </SgField>
        <p v-if="org && org.recovery_threshold > 1" class="form__note">{{ t('admin.org.admins.grantQuorum') }}</p>
      </form>
      <template #footer>
        <SgButton :disabled="grantBusy" :disabled-reason="t('common.pleaseWait')" @click="granting = null">{{ t('common.cancel') }}</SgButton>
        <SgButton type="submit" form="admin-grant-key" variant="primary" icon="key" :loading="grantBusy" :loading-label="t('admin.recovery.approve.working')" :disabled="!online" :disabled-reason="t('auth.offlineReason')">
          {{ t('admin.org.admins.grant') }}
        </SgButton>
      </template>
    </SgDialog>

    <AdminConfirmDialog
      v-if="demoting"
      v-model:open="demoteOpen"
      :title="t('admin.members.confirm.demoteTitle', { name: demoting.person.name })"
      :body="demoting.holds_recovery_key ? t('admin.members.confirm.demoteHolderBody') : t('admin.members.confirm.demoteBody')"
      :confirm-label="t('admin.members.actions.demote')"
      :busy-label="t('settings.saving')"
      :danger="demoting.holds_recovery_key"
      :run="demote"
      :explain="explain"
    />

    <SgDialog v-model:open="addOpen" :title="t('admin.org.admins.addTitle')" size="sm" :busy="adding">
      <form id="admin-add-admin" class="org__grant" novalidate @submit.prevent="addAdmin">
        <p>{{ t('admin.members.confirm.promoteBody') }}</p>
        <SgField :label="t('admin.org.admins.who')">
          <SgSelect
            v-model="candidate"
            :options="candidates.map((m) => ({ value: m.id, label: `${m.name} · ${m.email}` }))"
            :placeholder="candidates.length ? t('admin.remove.heirPlaceholder') : t('common.loading')"
            :disabled="adding || !candidates.length"
          />
        </SgField>
        <p class="form__note">{{ t('admin.members.confirm.promoteNote') }}</p>
      </form>
      <template #footer>
        <SgButton :disabled="adding" :disabled-reason="t('common.pleaseWait')" @click="addOpen = false">{{ t('common.cancel') }}</SgButton>
        <SgButton type="submit" form="admin-add-admin" variant="primary" :loading="adding" :loading-label="t('settings.saving')" :disabled="!candidate || !online" :disabled-reason="!online ? t('auth.offlineReason') : t('admin.remove.pickFirst')">
          {{ t('admin.members.actions.promote') }}
        </SgButton>
      </template>
    </SgDialog>
  </AdminShell>
</template>

<style scoped>
.org__form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  align-items: end;
  gap: var(--s-3) var(--s-4);
  max-width: 760px;
}

.org__verified {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  margin: 0;
  color: var(--success);
}

.org__dns {
  display: grid;
  gap: var(--s-3);
  padding: var(--s-4);
  border: 1px solid var(--rule);
  border-radius: var(--radius-2);
  background: var(--surface);
}

.org__dns-lead {
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--fg-2);
}

.org__record {
  display: grid;
  gap: var(--s-2);
  margin: 0;
}

.org__record div {
  display: grid;
  grid-template-columns: minmax(6rem, 9rem) minmax(0, 1fr);
  align-items: center;
  gap: var(--s-3);
}

.org__record dt {
  font-size: var(--fs-sm);
  color: var(--fg-2);
}

.org__record dd {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s-2);
  min-width: 0;
  margin: 0;
}

.org__mono {
  font-family: var(--font-mono);
  font-size: var(--fs-sm);
  overflow-wrap: anywhere;
}

.org__logo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s-5);
}

.org__logo-box {
  display: grid;
  place-items: center;
  width: 160px;
  height: 80px;
  padding: var(--s-2);
  border: 1px dashed var(--rule);
  border-radius: var(--radius-2);
  background: var(--surface);
}

.org__logo-box img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.org__logo-empty {
  font-size: var(--fs-xs);
  color: var(--fg-3);
}

.org__logo-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s-2);
}

.org__logo-actions .form__note {
  flex-basis: 100%;
  margin: 0;
}

.org__grant {
  display: grid;
  gap: var(--s-4);
}

.org__grant p {
  margin: 0;
}

.org__grant > p:first-child {
  color: var(--fg-2);
}

@media (max-width: 599px) {
  .org__record div {
    grid-template-columns: 1fr;
    gap: 2px;
  }
}
</style>
