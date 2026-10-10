<script setup lang="ts">
// Pricing (sitemap §1; personas.md, Amine: "simple pricing in DZD"): organization plans per
// seat and individual plans, from the same catalog the app bills with (utils/catalog.ts).
// Monthly prices in dinars, paid by CIB or Edahabia card, or by bank transfer for organizations.
definePageMeta({ layout: 'site' })
const { t, locale } = useI18n()
const { path } = useSite()
useSiteMeta({ title: () => t('site.pricing.metaTitle'), description: () => t('site.pricing.metaDescription') })

const money = (n: number) => formatMoney(n, locale.value)
const bytes = (n: number) => formatBytes(n, locale.value)
const orgFeatures = ['admin', 'recovery', 'audit', 'groups'] as const
const plusFeatures = ['storage', 'everything'] as const
const included = ['encryption', 'algeria', 'sharing', 'languages', 'devices', 'versions'] as const
const faq = ['passphrase', 'trial', 'transfer', 'change', 'leave'] as const
</script>

<template>
  <div>
    <section class="hero">
      <div class="wrap">
        <p class="hero__eyebrow">{{ t('site.nav.pricing') }}</p>
        <h1>{{ t('site.pricing.title') }}</h1>
        <p class="hero__lead">{{ t('site.pricing.lead') }}</p>
      </div>
    </section>

    <section class="band">
      <div class="wrap">
        <div class="band__head">
          <h2>{{ t('site.pricing.orgs.title') }}</h2>
          <p>{{ t('site.pricing.orgs.lead', { n: ORG_PLANS[0]!.min_seats }) }}</p>
        </div>
        <ul class="cards price__cards">
          <li v-for="(plan, i) in ORG_PLANS" :key="plan.name" class="card price">
            <h3><bdi>{{ plan.name }}</bdi></h3>
            <p class="price__amount">{{ money(plan.seat_price) }}</p>
            <p class="price__unit">{{ t('site.pricing.perSeat') }}<SgInfo term="seats" /></p>
            <p class="price__storage">{{ t('site.pricing.storagePerSeat', { size: bytes(plan.storage_per_seat) }) }}<SgInfo term="pooledStorage" /></p>
            <ul class="price__list">
              <template v-if="i === 0">
                <li v-for="item in orgFeatures" :key="item"><SgIcon name="check" :size="14" />{{ t(`site.pricing.orgs.features.${item}`) }}</li>
              </template>
              <template v-else>
                <li v-for="item in plusFeatures" :key="item"><SgIcon name="check" :size="14" />{{ t(`site.pricing.orgs.plus.${item}`) }}</li>
              </template>
            </ul>
            <SgButton :variant="i === 0 ? 'primary' : 'secondary'" block to="/signup?kind=org">{{ t('site.pricing.orgs.cta') }}</SgButton>
          </li>
        </ul>
        <p class="price__example">{{ t('site.pricing.orgs.example', { n: 25, total: money(25 * ORG_PLANS[0]!.seat_price), size: bytes(25 * ORG_PLANS[0]!.storage_per_seat) }) }}</p>
      </div>
    </section>

    <section class="band band--soft">
      <div class="wrap">
        <div class="band__head">
          <h2>{{ t('site.pricing.individuals.title') }}</h2>
          <p>{{ t('site.pricing.individuals.lead') }}</p>
        </div>
        <ul class="cards price__cards">
          <li v-for="plan in INDIVIDUAL_PLANS" :key="plan.id" class="card price">
            <h3><bdi>{{ plan.name }}</bdi></h3>
            <p class="price__amount">{{ money(plan.price) }}</p>
            <p class="price__unit">{{ t('site.pricing.perMonth') }}</p>
            <p class="price__storage">{{ t('site.pricing.storage', { size: bytes(plan.storage) }) }}</p>
            <SgButton block to="/signup?kind=individual">{{ t('site.pricing.individuals.cta') }}</SgButton>
          </li>
        </ul>
      </div>
    </section>

    <section class="band">
      <div class="wrap">
        <div class="band__head"><h2>{{ t('site.pricing.included.title') }}</h2></div>
        <ul class="price__included">
          <li v-for="item in included" :key="item"><SgIcon name="check-circle" :size="16" />{{ t(`site.pricing.included.${item}`) }}</li>
        </ul>
        <div class="callout price__pay">
          <p><strong>{{ t('site.pricing.payment.title') }}</strong> {{ t('site.pricing.payment.text') }}<SgInfo term="paymentMethods" /></p>
        </div>
      </div>
    </section>

    <section class="band band--soft">
      <div class="wrap prose">
        <h2>{{ t('site.pricing.faq.title') }}</h2>
        <details v-for="item in faq" :key="item" class="price__faq">
          <summary>{{ t(`site.pricing.faq.${item}.q`) }}</summary>
          <p>{{ t(`site.pricing.faq.${item}.a`) }}</p>
        </details>
      </div>
    </section>

    <section class="closing">
      <div class="wrap">
        <h2>{{ t('site.pricing.closing.title') }}</h2>
        <p>{{ t('site.pricing.closing.text') }}</p>
        <div class="hero__actions">
          <SgButton variant="primary" size="lg" :to="path('/contact')">{{ t('site.home.closing.demo') }}</SgButton>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.price__cards {
  grid-template-columns: repeat(auto-fit, minmax(16rem, 22rem));
}

.price {
  gap: var(--s-3);
}

.price__amount {
  margin-top: var(--s-2) !important;
  color: var(--fg) !important;
  font-size: var(--fs-2xl) !important;
  font-weight: var(--fw-medium);
  font-variant-numeric: tabular-nums;
}

.price__unit {
  margin-top: calc(-1 * var(--s-2)) !important;
}

.price__storage {
  color: var(--fg) !important;
  font-weight: var(--fw-medium);
}

.price__list {
  display: grid;
  gap: var(--s-2);
  margin: var(--s-2) 0 var(--s-3);
  padding: 0;
  list-style: none;
  font-size: var(--fs-sm);
  color: var(--fg-2);
}

.price__list li,
.price__included li {
  display: flex;
  align-items: flex-start;
  gap: var(--s-2);
}

.price__list li :deep(svg),
.price__included li :deep(svg) {
  flex: none;
  margin-top: 3px;
  color: var(--success);
}

.price__example {
  margin: var(--s-5) 0 0;
  font-size: var(--fs-sm);
  color: var(--fg-2);
}

.price__included {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  gap: var(--s-3) var(--s-6);
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--fg-2);
}

.price__pay {
  margin-top: var(--s-6);
}

.price__faq {
  padding-block: var(--s-4);
  border-bottom: 1px solid var(--rule);
}

.price__faq summary {
  font-weight: var(--fw-medium);
  cursor: pointer;
}

.price__faq p {
  margin: var(--s-3) 0 0;
}
</style>
