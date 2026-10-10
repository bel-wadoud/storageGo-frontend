<script setup lang="ts">
import { ApiError } from '~/services/api/client'
import { adminApi, type Residency } from '~/services/api/admin'

// Compliance (user-flows.md F11; personas.md, Samia): where the data is, the residency
// certificate (previewed first, then downloaded as a signed PDF), the documents an inspection
// asks for, and the export pack for a date range (12 months by default), in two clicks.
definePageMeta({ layout: 'app', middleware: ['auth', 'admin'] })
const { t, locale } = useI18n()
const toast = useToast()
const online = useOnline()
const errorMessage = useErrorMessage()
const { account } = useAccount()
const exporter = useExportJob()

const residency = ref<Residency | null>(null)
const failure = shallowRef<unknown>(null)
const org = computed(() => account.value?.org_name ?? '')

async function load() {
  failure.value = null
  try {
    residency.value = await adminApi.residency()
  } catch (error) {
    failure.value = error
  }
}
onMounted(load)

// ---- Documents ----
type Doc = 'certificate' | 'location' | 'dpa' | 'whitepaper'
const fetching = ref<Doc | null>(null)
async function download(kind: Doc) {
  fetching.value = kind
  try {
    const { url, file_name } = await adminApi.document(kind)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = file_name
    anchor.rel = 'noopener'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    toast.success(t('admin.compliance.downloaded', { name: file_name }))
  } catch (error) {
    toast.error(error instanceof ApiError && error.data?.reason === 'unsigned' ? t('admin.compliance.dpa.signFirst') : errorMessage(error))
  } finally {
    fetching.value = null
  }
}

// ---- DPA ----
const signOpen = ref(false)
const signer = ref('')
const authorized = ref(false)
const signing = ref(false)
const signError = ref('')
watch(signOpen, (value) => {
  if (!value) return
  signer.value = account.value?.name ?? ''
  authorized.value = false
  signError.value = ''
})
async function sign() {
  if (!signer.value.trim() || !authorized.value) return
  signing.value = true
  signError.value = ''
  try {
    residency.value = await adminApi.signDpa(signer.value.trim())
    signOpen.value = false
    toast.success(t('admin.compliance.dpa.signed'))
  } catch (error) {
    signError.value = errorMessage(error)
  } finally {
    signing.value = false
  }
}

// ---- Export pack ----
const day = (date: Date) => date.toISOString().slice(0, 10)
const from = ref(day(new Date(Date.now() - 365 * 86_400_000)))
const to = ref(day(new Date()))
const rangeError = computed(() => (from.value > to.value ? t('admin.audit.rangeError') : ''))
async function exportPack() {
  if (rangeError.value) return
  const result = await exporter.start(() => adminApi.exportPack({ from: from.value, to: to.value }))
  if (result?.status === 'ready') toast.success(t('admin.audit.exported', { name: result.file_name }))
  else if (result?.status === 'failed' || exporter.failure.value) toast.error(exporter.failure.value ? errorMessage(exporter.failure.value) : t('admin.audit.exportFailed'))
}

const places = computed(() => (residency.value?.datacenters ?? []).map((dc) => t('storage.wilaya', { name: t(`wilayas.${dc.wilaya}`), code: dc.wilaya })))
const listFormat = computed(() => new Intl.ListFormat(intlLocale(locale.value), { type: 'conjunction' }))
</script>

<template>
  <AdminShell :title="t('admin.compliance.title')" :lead="t('admin.compliance.lead')">
    <SgAlert v-if="failure" tone="danger">
      {{ errorMessage(failure) }}
      <template #actions><SgButton size="sm" icon="refresh" @click="load">{{ t('common.retry') }}</SgButton></template>
    </SgAlert>
    <div v-else-if="!residency" aria-busy="true"><SgSkeleton :lines="10" /></div>

    <template v-else>
      <SettingsSection id="location" :title="t('admin.compliance.location.title')" :description="t('admin.compliance.location.hint')">
        <p class="cmp__where"><SgIcon name="lock" :size="16" />{{ t('admin.compliance.location.where', { places: listFormat.format(places) }) }}</p>
        <ul class="item-list">
          <li v-for="dc in residency.datacenters" :key="dc.wilaya">
            <SgIcon class="item-list__icon" name="building" :size="18" />
            <div class="item-list__main">
              <p class="item-list__title">{{ t('storage.wilaya', { name: t(`wilayas.${dc.wilaya}`), code: dc.wilaya }) }}</p>
              <p class="item-list__meta">{{ t(`admin.compliance.location.${dc.role}`) }} · {{ dc.operator }}</p>
            </div>
          </li>
        </ul>
        <div><SgButton size="sm" icon="download" :loading="fetching === 'location'" :loading-label="t('common.loading')" :disabled="!online" :disabled-reason="t('auth.offlineReason')" @click="download('location')">{{ t('admin.compliance.location.download') }}</SgButton></div>
      </SettingsSection>

      <SettingsSection id="certificate" :title="t('admin.compliance.certificate.title')" :description="t('admin.compliance.certificate.hint')">
        <!-- A preview of the certificate's first page, before downloading the signed PDF -->
        <article class="cert" :aria-label="t('admin.compliance.certificate.preview')">
          <header class="cert__head">
            <SgLogo />
            <p class="cert__number" dir="ltr">{{ residency.certificate.number }}</p>
          </header>
          <h3 class="cert__title">{{ t('admin.compliance.certificate.heading') }}</h3>
          <p class="cert__body">{{ t('admin.compliance.certificate.body', { org, places: listFormat.format(places) }) }}</p>
          <dl class="facts-grid cert__facts">
            <div><dt>{{ t('admin.compliance.certificate.issued') }}</dt><dd>{{ formatDate(new Date(residency.certificate.issued_at), locale) }}</dd></div>
            <div><dt>{{ t('admin.compliance.certificate.valid') }}</dt><dd>{{ formatDate(new Date(residency.certificate.valid_until), locale) }}</dd></div>
            <div><dt>{{ t('admin.compliance.certificate.issuer') }}</dt><dd>{{ residency.certificate.issuer }}</dd></div>
          </dl>
          <p class="cert__seal"><SgIcon name="check-circle" :size="14" />{{ t('admin.compliance.certificate.signedNote') }}</p>
        </article>
        <div>
          <SgButton variant="primary" icon="download" :loading="fetching === 'certificate'" :loading-label="t('common.loading')" :disabled="!online" :disabled-reason="t('auth.offlineReason')" @click="download('certificate')">
            {{ t('admin.compliance.certificate.download') }}
          </SgButton>
        </div>
      </SettingsSection>

      <SettingsSection id="documents" :title="t('admin.compliance.documents.title')" :description="t('admin.compliance.documents.hint')">
        <ul class="item-list">
          <li>
            <SgIcon class="item-list__icon" name="file" :size="18" />
            <div class="item-list__main">
              <p class="item-list__title">{{ t('admin.compliance.dpa.title') }}</p>
              <p class="item-list__meta">
                <template v-if="residency.dpa.signed_at">{{ t('admin.compliance.dpa.signedBy', { name: residency.dpa.signed_by?.name ?? '', date: formatDate(new Date(residency.dpa.signed_at), locale) }) }}</template>
                <template v-else>{{ t('admin.compliance.dpa.unsigned') }}</template>
              </p>
            </div>
            <div class="item-list__actions">
              <SgButton v-if="residency.dpa.signed_at" size="sm" icon="download" :loading="fetching === 'dpa'" :loading-label="t('common.loading')" @click="download('dpa')">{{ t('admin.compliance.download') }}</SgButton>
              <SgButton v-else size="sm" variant="primary" icon="pencil" :disabled="!online" :disabled-reason="t('auth.offlineReason')" @click="signOpen = true">{{ t('admin.compliance.dpa.sign') }}</SgButton>
            </div>
          </li>
          <li>
            <SgIcon class="item-list__icon" name="file" :size="18" />
            <div class="item-list__main">
              <p class="item-list__title">{{ t('admin.compliance.whitepaper.title') }}</p>
              <p class="item-list__meta">{{ t('admin.compliance.whitepaper.hint') }}</p>
            </div>
            <div class="item-list__actions">
              <SgButton size="sm" icon="download" :loading="fetching === 'whitepaper'" :loading-label="t('common.loading')" :disabled="!online" :disabled-reason="t('auth.offlineReason')" @click="download('whitepaper')">{{ t('admin.compliance.download') }}</SgButton>
            </div>
          </li>
        </ul>
      </SettingsSection>

      <SettingsSection id="pack" :title="t('admin.compliance.pack.title')" :description="t('admin.compliance.pack.hint')">
        <ul class="cmp__contents">
          <li v-for="item in ['certificate', 'location', 'audit', 'whitepaper', 'dpa']" :key="item">
            <SgIcon name="check" :size="14" />{{ t(`admin.compliance.pack.items.${item}`) }}
            <span v-if="item === 'dpa' && !residency.dpa.signed_at" class="table__muted"> · {{ t('admin.compliance.pack.dpaMissing') }}</span>
          </li>
        </ul>
        <div class="cmp__range">
          <SgField :label="t('admin.audit.from')" :error="rangeError">
            <SgInput v-model="from" type="date" :disabled="exporter.running.value" />
          </SgField>
          <SgField :label="t('admin.audit.to')">
            <SgInput v-model="to" type="date" :disabled="exporter.running.value" />
          </SgField>
        </div>
        <div v-if="exporter.running.value && exporter.job.value" aria-live="polite">
          <SgProgress :value="Math.round(exporter.job.value.progress * 100)" :label="t('admin.audit.preparingFile', { name: exporter.job.value.file_name })" show-value />
        </div>
        <div>
          <SgButton
            variant="primary"
            icon="archive"
            :loading="exporter.running.value"
            :loading-label="t('admin.audit.preparing')"
            :disabled="!online || Boolean(rangeError)"
            :disabled-reason="!online ? t('auth.offlineReason') : rangeError"
            @click="exportPack"
          >
            {{ t('admin.compliance.pack.submit') }}
          </SgButton>
        </div>
      </SettingsSection>
    </template>

    <SgDialog v-model:open="signOpen" :title="t('admin.compliance.dpa.signTitle')" size="sm" :busy="signing">
      <form id="admin-sign-dpa" class="cmp__sign" novalidate @submit.prevent="sign">
        <p>{{ t('admin.compliance.dpa.signBody', { org }) }}</p>
        <SgField :label="t('admin.compliance.dpa.signer')" required>
          <SgInput v-model="signer" dir="auto" autocomplete="name" :placeholder="t('placeholders.name')" :disabled="signing" />
        </SgField>
        <SgCheckbox v-model="authorized" :label="t('admin.compliance.dpa.authorized', { org })" :disabled="signing" />
        <SgAlert v-if="signError" tone="danger">{{ signError }}</SgAlert>
      </form>
      <template #footer>
        <SgButton :disabled="signing" :disabled-reason="t('common.pleaseWait')" @click="signOpen = false">{{ t('common.cancel') }}</SgButton>
        <SgButton
          type="submit"
          form="admin-sign-dpa"
          variant="primary"
          :loading="signing"
          :loading-label="t('settings.saving')"
          :disabled="!signer.trim() || !authorized || !online"
          :disabled-reason="!online ? t('auth.offlineReason') : t('admin.compliance.dpa.fillFirst')"
        >
          {{ t('admin.compliance.dpa.sign') }}
        </SgButton>
      </template>
    </SgDialog>
  </AdminShell>
</template>

<style scoped>
.cmp__where {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  margin: 0;
  font-weight: var(--fw-medium);
}

.cert {
  display: grid;
  gap: var(--s-4);
  max-width: 560px;
  padding: var(--s-6);
  border: 1px solid var(--rule);
  border-top: 4px solid var(--signal);
  border-radius: var(--radius-1);
  background: var(--surface);
  box-shadow: var(--shadow-1, none);
}

.cert__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-3);
  padding-bottom: var(--s-3);
  border-bottom: 1px solid var(--rule);
}

.cert__number {
  margin: 0;
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
  color: var(--fg-2);
}

.cert__title {
  margin: 0;
  font-size: var(--fs-lg);
  font-weight: var(--fw-medium);
}

.cert__body {
  margin: 0;
  color: var(--fg-2);
}

.cert__facts {
  margin: 0;
}

.cert__seal {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  margin: 0;
  font-size: var(--fs-xs);
  color: var(--success);
}

.cmp__contents {
  display: grid;
  gap: var(--s-2);
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: var(--fs-sm);
}

.cmp__contents li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s-2);
}

.cmp__range {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 12rem));
  gap: var(--s-3);
}

.cmp__sign {
  display: grid;
  gap: var(--s-4);
}

.cmp__sign p {
  margin: 0;
  color: var(--fg-2);
}
</style>
