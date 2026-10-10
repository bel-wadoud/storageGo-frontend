<script setup lang="ts">
import { ApiError } from '~/services/api/client'
import { adminApi, type OrgBilling, type OrgInvoice } from '~/services/api/admin'

// The organization's billing (sitemap §5): plan, seats, storage pool, invoices in dinars, and
// how it pays: CIB or Edahabia card (entered on the bank's page, never here) or bank transfer
// (virement) with the details to use. Every change of price is confirmed with the new total.
definePageMeta({ layout: 'app', middleware: ['auth', 'admin'] })
const { t, locale } = useI18n()
const route = useRoute()
const toast = useToast()
const online = useOnline()
const errorMessage = useErrorMessage()
const { refresh: refreshOverview } = useAdminOverview()

const billing = ref<OrgBilling | null>(null)
const invoices = ref<OrgInvoice[] | null>(null)
const failure = shallowRef<unknown>(null)

async function load() {
  failure.value = null
  try {
    const [b, i] = await Promise.all([adminApi.billing(), adminApi.invoices()])
    billing.value = b
    invoices.value = i
    seats.value = b.seats.total
    plan.value = b.plan.name
  } catch (error) {
    failure.value = error
  }
}
onMounted(load)

// Back from the bank's page.
watch(
  () => route.query.card,
  (card) => {
    if (card !== 'updated') return
    toast.success(t('settings.plan.cardUpdated'))
    navigateTo({ path: route.path, hash: route.hash }, { replace: true })
    if (billing.value) load()
  },
  { immediate: true },
)

const money = (n: number) => formatMoney(n, locale.value)
const monthly = computed(() => (billing.value ? billing.value.seats.total * billing.value.plan.seat_price : 0))

// ---- Seats ----
const seats = ref(0)
const minimum = computed(() => (billing.value ? billing.value.seats.used + billing.value.seats.pending : 1))
const seatsError = computed(() => {
  if (!billing.value) return ''
  if (!Number.isInteger(seats.value) || seats.value < 1) return t('admin.billing.seats.invalid')
  if (seats.value < minimum.value) return t('admin.billing.seats.belowUsed', { n: minimum.value }, minimum.value)
  if (seats.value > 10000) return t('admin.billing.seats.tooMany')
  return ''
})
const seatsChanged = computed(() => billing.value !== null && seats.value !== billing.value.seats.total)

type Change = { kind: 'seats' | 'plan'; title: string; body: string; run: () => Promise<{ billing: OrgBilling; checkout_url: string | null }> }
const change = ref<Change | null>(null)
const changeOpen = computed({ get: () => change.value !== null, set: (v) => !v && (change.value = null) })
const changing = ref(false)

function askSeats() {
  if (!billing.value || seatsError.value || !seatsChanged.value) return
  const total = seats.value
  const from = billing.value.seats.total
  change.value = {
    kind: 'seats',
    title: t('admin.billing.seats.confirmTitle', { from, to: total }),
    body: t('admin.billing.seats.confirmBody', { total: money(total * billing.value.plan.seat_price) }),
    run: () => adminApi.setSeats(total),
  }
}

// ---- Plan ----
const plan = ref('')
const planOptions = computed(() =>
  (billing.value?.plans ?? []).map((p) => ({
    value: p.name,
    title: `⁨${p.name}⁩`,
    description: t('admin.billing.plan.perSeat', { price: money(p.seat_price), storage: formatBytes(p.storage_per_seat, locale.value) }),
  })),
)
function askPlan() {
  const chosen = billing.value?.plans.find((p) => p.name === plan.value)
  if (!billing.value || !chosen || chosen.name === billing.value.plan.name) return
  change.value = {
    kind: 'plan',
    title: t('admin.billing.plan.confirmTitle', { name: `⁨${chosen.name}⁩` }),
    body: t('admin.billing.plan.confirmBody', {
      total: money(billing.value.seats.total * chosen.seat_price),
      storage: formatBytes(billing.value.seats.total * chosen.storage_per_seat, locale.value),
    }),
    run: () => adminApi.setPlan(chosen.name),
  }
}

async function applyChange() {
  if (!change.value) return
  changing.value = true
  try {
    const result = await change.value.run()
    if (result.checkout_url) {
      window.location.assign(result.checkout_url)
      return
    }
    billing.value = result.billing
    seats.value = result.billing.seats.total
    plan.value = result.billing.plan.name
    toast.success(change.value.kind === 'seats' ? t('admin.billing.seats.done', { n: result.billing.seats.total }) : t('admin.billing.plan.done', { name: `⁨${result.billing.plan.name}⁩` }))
    change.value = null
    refreshOverview()
  } catch (error) {
    toast.error(error instanceof ApiError && error.fields?.total === 'below_used' ? t('admin.billing.seats.belowUsed', { n: minimum.value }, minimum.value) : errorMessage(error))
  } finally {
    changing.value = false
  }
}

// ---- Payment method ----
const paying = ref<'card' | 'transfer' | null>(null)
async function setPayment(kind: 'card' | 'transfer') {
  paying.value = kind
  try {
    const result = await adminApi.setPaymentMethod(kind)
    if (result.checkout_url) {
      if (result.checkout_url.startsWith('/')) await navigateTo(result.checkout_url)
      else window.location.assign(result.checkout_url)
      return
    }
    billing.value = result.billing
    toast.success(t('admin.billing.payment.transferSet'))
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    paying.value = null
  }
}
</script>

<template>
  <AdminShell :title="t('admin.billing.title')" :lead="t('admin.billing.lead')">
    <SgAlert v-if="failure" tone="danger">
      {{ errorMessage(failure) }}
      <template #actions><SgButton size="sm" icon="refresh" @click="load">{{ t('common.retry') }}</SgButton></template>
    </SgAlert>
    <div v-else-if="!billing" aria-busy="true"><SgSkeleton :lines="10" /></div>

    <template v-else>
      <SettingsSection id="current" :title="t('admin.billing.current')">
        <dl class="facts-grid">
          <div><dt>{{ t('settings.plan.plan') }}</dt><dd><bdi>{{ billing.plan.name }}</bdi></dd></div>
          <div><dt>{{ t('admin.billing.monthly') }}</dt><dd>{{ t('settings.plan.perMonth', { price: money(monthly) }) }}</dd></div>
          <div><dt>{{ t('settings.plan.renews') }}</dt><dd>{{ formatDate(new Date(billing.renews_at), locale) }}</dd></div>
        </dl>
        <SgProgress
          :value="billing.storage.used"
          :max="Math.max(billing.storage.limit, 1)"
          :tone="billing.storage.used / billing.storage.limit >= 0.95 ? 'danger' : billing.storage.used / billing.storage.limit >= 0.8 ? 'signal' : 'neutral'"
          :label="t('storage.used', { used: formatBytes(billing.storage.used, locale), total: formatBytes(billing.storage.limit, locale) })"
          show-value
        />
      </SettingsSection>

      <SettingsSection id="seats" :title="t('admin.billing.seats.title')" :description="t('admin.billing.seats.hint')" info="seats">
        <p class="bil__seats">
          {{ t('admin.overview.seats', { used: formatNumber(billing.seats.used, locale), total: formatNumber(billing.seats.total, locale) }) }}
          <template v-if="billing.seats.pending"> · {{ t('admin.overview.seatsPending', { n: billing.seats.pending }, billing.seats.pending) }}</template>
        </p>
        <form class="row-form" novalidate @submit.prevent="askSeats">
          <SgField :label="t('admin.billing.seats.label')" :hint="t('admin.billing.seats.price', { price: money(billing.plan.seat_price) })" :error="seatsError">
            <SgInput
              :model-value="String(seats)"
              type="number"
              inputmode="numeric"
              dir="ltr"
              :disabled="changing"
              @update:model-value="(v: string) => (seats = Math.trunc(Number(v)))"
            />
          </SgField>
          <SgButton
            type="submit"
            :disabled="!seatsChanged || Boolean(seatsError) || !online"
            :disabled-reason="!online ? t('auth.offlineReason') : seatsError || t('settings.noChanges')"
          >
            {{ t('admin.billing.seats.update') }}
          </SgButton>
        </form>
        <p v-if="seatsChanged && !seatsError" class="form__note">{{ t('admin.billing.seats.newTotal', { total: money(seats * billing.plan.seat_price) }) }}</p>
      </SettingsSection>

      <SettingsSection id="plan" :title="t('admin.billing.plan.title')" :description="t('admin.billing.plan.hint')" info="pooledStorage">
        <SgChoice v-model="plan" :legend="t('settings.plan.choose')" legend-hidden :options="planOptions" :disabled="changing" />
        <div>
          <SgButton :disabled="plan === billing.plan.name || !online" :disabled-reason="!online ? t('auth.offlineReason') : t('settings.plan.samePlan')" @click="askPlan">
            {{ t('settings.plan.switch') }}
          </SgButton>
        </div>
      </SettingsSection>

      <SettingsSection id="payment" :title="t('admin.billing.payment.title')" :description="t('admin.billing.payment.hint')" info="paymentMethods">
        <div class="value-row">
          <span class="value-row__value">
            <template v-if="!billing.payment_method">{{ t('settings.plan.noCard') }}</template>
            <template v-else-if="billing.payment_method.kind === 'transfer'">{{ t('admin.billing.payment.transfer') }}</template>
            <template v-else>{{ t(`settings.plan.cards.${billing.payment_method.kind}`) }} <span dir="ltr">•••• {{ billing.payment_method.last4 }}</span></template>
          </span>
          <div class="bil__pay">
            <SgButton icon="external" :loading="paying === 'card'" :loading-label="t('settings.plan.opening')" :disabled="paying !== null || !online" :disabled-reason="!online ? t('auth.offlineReason') : t('common.pleaseWait')" @click="setPayment('card')">
              {{ billing.payment_method && billing.payment_method.kind !== 'transfer' ? t('settings.plan.updateCard') : t('admin.billing.payment.useCard') }}
            </SgButton>
            <SgButton
              v-if="billing.payment_method?.kind !== 'transfer'"
              :loading="paying === 'transfer'"
              :loading-label="t('settings.saving')"
              :disabled="paying !== null || !online"
              :disabled-reason="!online ? t('auth.offlineReason') : t('common.pleaseWait')"
              @click="setPayment('transfer')"
            >
              {{ t('admin.billing.payment.useTransfer') }}
            </SgButton>
          </div>
        </div>
        <div v-if="billing.payment_method?.kind === 'transfer'" class="bil__transfer">
          <p class="bil__transfer-lead">{{ t('admin.billing.payment.transferLead') }}</p>
          <dl class="bil__bank">
            <div><dt>{{ t('admin.billing.payment.bank') }}</dt><dd>{{ billing.transfer.bank }}</dd></div>
            <div><dt>{{ t('admin.billing.payment.holder') }}</dt><dd>{{ billing.transfer.account_name }}</dd></div>
            <div>
              <dt>{{ t('admin.billing.payment.rib') }}<SgInfo term="rib" /></dt>
              <dd><span dir="ltr" class="bil__mono">{{ billing.transfer.rib }}</span><SgCopyButton :value="billing.transfer.rib.replace(/\s/g, '')" size="sm" variant="ghost" icon-only :label="t('admin.billing.payment.copyRib')" /></dd>
            </div>
            <div>
              <dt>{{ t('admin.billing.payment.reference') }}</dt>
              <dd><span dir="ltr" class="bil__mono">{{ billing.transfer.reference }}</span><SgCopyButton :value="billing.transfer.reference" size="sm" variant="ghost" icon-only :label="t('admin.billing.payment.copyReference')" /></dd>
            </div>
          </dl>
        </div>
      </SettingsSection>

      <SettingsSection id="invoices" :title="t('settings.plan.invoices')">
        <p v-if="!invoices?.length" class="form__note">{{ t('settings.plan.noInvoices') }}</p>
        <ul v-else class="item-list">
          <li v-for="invoice in invoices" :key="invoice.id">
            <SgIcon class="item-list__icon" name="file" :size="18" />
            <div class="item-list__main">
              <p class="item-list__title">
                {{ formatDate(new Date(invoice.date), locale) }}
                <span class="tag" :class="{ 'is-signal': invoice.status !== 'paid' }">{{ t(`admin.billing.invoice.${invoice.status}`) }}</span>
              </p>
              <p class="item-list__meta">{{ money(invoice.amount) }} · <span dir="ltr">{{ invoice.id }}</span></p>
            </div>
            <SgButton size="sm" variant="ghost" icon="download" :to="invoice.url" target="_blank" rel="noopener">{{ t('settings.plan.download') }}</SgButton>
          </li>
        </ul>
      </SettingsSection>
    </template>

    <SgDialog v-if="change" v-model:open="changeOpen" :title="change.title" size="sm" :busy="changing">
      <p class="bil__confirm">{{ change.body }}</p>
      <template #footer>
        <SgButton :disabled="changing" :disabled-reason="t('common.pleaseWait')" @click="change = null">{{ t('common.cancel') }}</SgButton>
        <SgButton variant="primary" :loading="changing" :loading-label="t('settings.saving')" @click="applyChange">{{ t('admin.billing.confirm') }}</SgButton>
      </template>
    </SgDialog>
  </AdminShell>
</template>

<style scoped>
.bil__seats {
  margin: 0;
  font-weight: var(--fw-medium);
}

.bil__pay {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2);
}

.bil__transfer {
  display: grid;
  gap: var(--s-3);
  padding: var(--s-4);
  border: 1px solid var(--rule);
  border-radius: var(--radius-2);
  background: var(--surface);
}

.bil__transfer-lead {
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--fg-2);
}

.bil__bank {
  display: grid;
  gap: var(--s-2);
  margin: 0;
}

.bil__bank div {
  display: grid;
  grid-template-columns: minmax(8rem, 12rem) minmax(0, 1fr);
  align-items: center;
  gap: var(--s-3);
}

.bil__bank dt {
  font-size: var(--fs-sm);
  color: var(--fg-2);
}

.bil__bank dd {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s-2);
  margin: 0;
}

.bil__mono {
  font-family: var(--font-mono);
}

.bil__confirm {
  margin: 0;
  color: var(--fg-2);
}

@media (max-width: 599px) {
  .bil__bank div {
    grid-template-columns: 1fr;
    gap: 2px;
  }
}
</style>
