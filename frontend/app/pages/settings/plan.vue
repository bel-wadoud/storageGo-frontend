<script setup lang="ts">
import { accountApi, type Billing, type Invoice, type Plan } from '~/services/api/account'

// Individuals: plan, storage, payment card and invoices, in dinars. Organization members:
// the organization's plan is handled by its administrators (Administration › Billing).
definePageMeta({ layout: 'app', middleware: 'auth' })
const { t, locale } = useI18n()
const route = useRoute()
const toast = useToast()
const online = useOnline()
const errorMessage = useErrorMessage()
const drive = useDrive()
const { account } = useAccount()
const details = useAccountDetails()

const isOrg = computed(() => account.value?.kind === 'org')
// Plan names are Latin ("Personnel 200"): isolated so they keep their order in Arabic text.
const isolate = (text: string) => `\u2068${text}\u2069`
const billing = ref<Billing | null>(null)
const invoices = ref<Invoice[] | null>(null)
const loadError = shallowRef<unknown>(null)

async function load() {
  loadError.value = null
  try {
    const [b, i] = await Promise.all([accountApi.billing(), accountApi.invoices()])
    billing.value = b
    invoices.value = i
  } catch (error) {
    loadError.value = error
  }
}

onMounted(() => {
  details.load()
  if (!isOrg.value) load()
})

// Back from the bank's page (?card=updated): say so, reload the card, and clean the address.
watch(
  () => route.query.card,
  (card) => {
    if (card !== 'updated') return
    toast.success(t('settings.plan.cardUpdated'))
    navigateTo({ path: route.path }, { replace: true })
    if (billing.value) load()
  },
  { immediate: true },
)

// ---- Changing plan ----
const choice = ref<string | null>(null)
watch(billing, (b) => b && (choice.value = b.plan.id), { immediate: true })
const options = computed(() =>
  (billing.value?.plans ?? []).map((plan) => ({
    value: plan.id,
    title: `${isolate(plan.name)} · ${formatBytes(plan.storage, locale.value)}`,
    description: t('settings.plan.perMonth', { price: formatMoney(plan.price, locale.value) }),
  })),
)
const chosen = computed<Plan | null>(() => billing.value?.plans.find((p) => p.id === choice.value) ?? null)
const changeOpen = ref(false)
const changing = ref(false)
// A smaller plan than what's stored can't work: say so before the user tries.
const tooSmall = computed(() => Boolean(chosen.value && drive.quota.value && chosen.value.storage < drive.quota.value.used))

async function changePlan() {
  if (!chosen.value) return
  changing.value = true
  try {
    const result = await accountApi.changePlan(chosen.value.id)
    if (result.checkout_url) {
      window.location.assign(result.checkout_url)
      return
    }
    billing.value = result.billing
    drive.refreshQuota()
    toast.success(t('settings.plan.changed', { name: isolate(result.billing.plan.name) }))
    changeOpen.value = false
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    changing.value = false
  }
}

const updatingCard = ref(false)
async function updateCard() {
  updatingCard.value = true
  try {
    const { checkout_url } = await accountApi.updateCard()
    if (checkout_url.startsWith('/')) await navigateTo(checkout_url)
    else window.location.assign(checkout_url)
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    updatingCard.value = false
  }
}

const quota = computed(() => drive.quota.value)
</script>

<template>
  <SettingsShell :title="t('settings.plan.title')" :lead="isOrg ? t('settings.plan.leadOrg') : t('settings.plan.lead')">
    <!-- Organization members -->
    <SettingsSection v-if="isOrg" :title="t('settings.plan.orgTitle', { org: account?.org_name ?? '' })" :description="t('settings.plan.orgHint')">
      <div class="form__actions">
        <SgButton v-if="details.details.value?.role === 'admin'" icon="settings" to="/admin/billing">{{ t('settings.plan.toAdmin') }}</SgButton>
      </div>
    </SettingsSection>

    <template v-else>
      <SgAlert v-if="loadError" tone="danger">
        {{ errorMessage(loadError) }}
        <template #actions><SgButton size="sm" icon="refresh" @click="load">{{ t('common.retry') }}</SgButton></template>
      </SgAlert>
      <div v-else-if="!billing" class="settings-loading" aria-busy="true"><SgSkeleton :lines="6" /></div>

      <template v-else>
        <SettingsSection :title="t('settings.plan.current')">
          <dl class="facts-grid">
            <div><dt>{{ t('settings.plan.plan') }}</dt><dd><bdi>{{ billing.plan.name }}</bdi> · {{ formatBytes(billing.plan.storage, locale) }}</dd></div>
            <div><dt>{{ t('settings.plan.price') }}</dt><dd>{{ t('settings.plan.perMonth', { price: formatMoney(billing.plan.price, locale) }) }}</dd></div>
            <div v-if="billing.renews_at"><dt>{{ t('settings.plan.renews') }}</dt><dd>{{ formatDate(new Date(billing.renews_at), locale) }}</dd></div>
          </dl>
          <SgProgress
            v-if="quota"
            :value="quota.used"
            :max="quota.limit"
            :tone="quota.used / quota.limit >= 0.95 ? 'danger' : quota.used / quota.limit >= 0.8 ? 'signal' : 'neutral'"
            :label="t('storage.used', { used: formatBytes(quota.used, locale), total: formatBytes(quota.limit, locale) })"
            show-value
          />
        </SettingsSection>

        <SettingsSection :title="t('settings.plan.change')" :description="t('settings.plan.changeHint')">
          <SgChoice v-model="choice" :legend="t('settings.plan.choose')" :options="options" />
          <SgAlert v-if="tooSmall" tone="warning">{{ t('settings.plan.tooSmall', { used: formatBytes(quota!.used, locale) }) }}</SgAlert>
          <div>
            <SgButton
              variant="primary"
              :disabled="!chosen || chosen.id === billing.plan.id || tooSmall || !online"
              :disabled-reason="!online ? t('auth.offlineReason') : tooSmall ? t('settings.plan.tooSmallShort') : t('settings.plan.samePlan')"
              @click="changeOpen = true"
            >
              {{ t('settings.plan.switch') }}
            </SgButton>
          </div>
        </SettingsSection>

        <SettingsSection :title="t('settings.plan.card')" :description="t('settings.plan.cardHint')">
          <div class="value-row">
            <span class="value-row__value">
              <template v-if="billing.payment_method">
                {{ t(`settings.plan.cards.${billing.payment_method.kind}`) }} <span dir="ltr">•••• {{ billing.payment_method.last4 }}</span>
              </template>
              <template v-else>{{ t('settings.plan.noCard') }}</template>
            </span>
            <SgButton
              icon="external"
              :loading="updatingCard"
              :loading-label="t('settings.plan.opening')"
              :disabled="!online"
              :disabled-reason="t('auth.offlineReason')"
              @click="updateCard"
            >
              {{ billing.payment_method ? t('settings.plan.updateCard') : t('settings.plan.addCard') }}
            </SgButton>
          </div>
        </SettingsSection>

        <SettingsSection :title="t('settings.plan.invoices')">
          <p v-if="!invoices?.length" class="form__note">{{ t('settings.plan.noInvoices') }}</p>
          <ul v-else class="item-list">
            <li v-for="invoice in invoices" :key="invoice.id">
              <SgIcon class="item-list__icon" name="file" :size="18" />
              <div class="item-list__main">
                <p class="item-list__title">
                  {{ formatDate(new Date(invoice.date), locale) }}
                  <span class="tag" :class="{ 'is-signal': invoice.status === 'due' }">{{ t(`settings.plan.status.${invoice.status}`) }}</span>
                </p>
                <p class="item-list__meta">{{ formatMoney(invoice.amount, locale) }} · <span dir="ltr">{{ invoice.id }}</span></p>
              </div>
              <SgButton size="sm" variant="ghost" icon="download" :to="invoice.url" target="_blank" rel="noopener">{{ t('settings.plan.download') }}</SgButton>
            </li>
          </ul>
        </SettingsSection>
      </template>
    </template>

    <SgDialog v-if="changeOpen && chosen && billing" v-model:open="changeOpen" :title="t('settings.plan.confirmTitle', { name: isolate(chosen.name) })" size="sm" :busy="changing">
      <p class="plan__confirm">
        {{ t('settings.plan.confirmBody', { storage: formatBytes(chosen.storage, locale), price: formatMoney(chosen.price, locale) }) }}
      </p>
      <template #footer>
        <SgButton :disabled="changing" :disabled-reason="t('common.pleaseWait')" @click="changeOpen = false">{{ t('common.cancel') }}</SgButton>
        <SgButton variant="primary" :loading="changing" :loading-label="t('settings.saving')" @click="changePlan">{{ t('settings.plan.switch') }}</SgButton>
      </template>
    </SgDialog>
  </SettingsShell>
</template>

<style scoped>
.plan__confirm {
  margin: 0;
  color: var(--fg-2);
}
</style>
