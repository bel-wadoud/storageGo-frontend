<script setup lang="ts">
// The home page (sitemap §1): the problem in one line, the proof (where the data is, who can
// read it), how it works, how it compares, and who it's for. Real facts, no testimonials we
// don't have, no fear (principles.md §1, §6).
definePageMeta({ layout: 'site' })
const { t } = useI18n()
const { path } = useSite()
useSiteMeta({ title: () => t('site.home.metaTitle'), description: () => t('site.home.metaDescription') })

const facts = ['residency', 'encryption', 'languages', 'billing'] as const
const rows = ['algeria', 'reads', 'sharing', 'languages', 'dzd', 'evidence'] as const
const columns = ['global', 'private', 'local', 'us'] as const
const sectors = ['health', 'legal', 'finance', 'public', 'education'] as const
const icons = { residency: 'building', encryption: 'lock', languages: 'globe', billing: 'sheet' } as const
const honestIcons = ['key', 'users', 'alert'] as const
// The circled "i" explaining the harder words (glossary keys).
const factInfo = { residency: 'residency', encryption: 'encryptedOnDevice', languages: null, billing: 'paymentMethods' } as const
const honestInfo = ['passphrase', 'recoveryKit', null] as const
const rowInfo: Partial<Record<(typeof rows)[number], string>> = { reads: 'zeroKnowledge', evidence: 'residencyCertificate' }
</script>

<template>
  <div>
    <section class="hero">
      <div class="wrap">
        <p class="hero__eyebrow">{{ t('site.home.eyebrow') }}</p>
        <h1>{{ t('site.home.title') }}</h1>
        <p class="hero__lead">{{ t('site.home.lead') }}</p>
        <div class="hero__actions">
          <SgButton variant="primary" size="lg" to="/signup">{{ t('site.home.ctaOrg') }}</SgButton>
          <SgButton size="lg" :to="path('/how-it-works')">{{ t('site.home.ctaHow') }}</SgButton>
        </div>
        <ul class="home__facts">
          <li v-for="fact in facts" :key="fact"><SgIcon :name="icons[fact]" :size="16" />{{ t(`site.home.facts.${fact}`) }}<SgInfo v-if="factInfo[fact]" :term="factInfo[fact]!" /></li>
        </ul>
      </div>
    </section>

    <section class="band">
      <div class="wrap">
        <div class="band__head">
          <h2>{{ t('site.home.how.title') }}</h2>
          <p>{{ t('site.home.how.lead') }}</p>
        </div>
        <ol class="steps">
          <li v-for="n in 3" :key="n">
            <h3>{{ t(`site.home.how.s${n}.title`) }}</h3>
            <p>{{ t(`site.home.how.s${n}.text`) }}</p>
          </li>
        </ol>
        <p class="home__more"><NuxtLink :to="path('/how-it-works')">{{ t('site.home.how.more') }}</NuxtLink></p>
      </div>
    </section>

    <section class="band band--soft">
      <div class="wrap">
        <div class="band__head">
          <h2>{{ t('site.home.compare.title') }}</h2>
          <p>{{ t('site.home.compare.lead') }}</p>
        </div>
        <div class="compare-wrap">
          <table class="compare">
            <thead>
              <tr>
                <th scope="col"><span class="sr-only">{{ t('site.home.compare.criterion') }}</span></th>
                <th v-for="col in columns" :key="col" scope="col" :class="{ 'is-us': col === 'us' }">{{ t(`site.home.compare.cols.${col}`) }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row">
                <th scope="row">{{ t(`site.home.compare.rows.${row}.label`) }}<SgInfo v-if="rowInfo[row]" :term="rowInfo[row]!" /></th>
                <td v-for="col in columns" :key="col" :class="{ 'is-us': col === 'us' }">{{ t(`site.home.compare.rows.${row}.${col}`) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <section class="band">
      <div class="wrap">
        <div class="band__head">
          <h2>{{ t('site.home.honest.title') }}</h2>
          <p>{{ t('site.home.honest.lead') }}</p>
        </div>
        <ul class="cards">
          <li v-for="n in 3" :key="n" class="card">
            <h3><SgIcon :name="honestIcons[n - 1]!" :size="16" />{{ t(`site.home.honest.c${n}.title`) }}<SgInfo v-if="honestInfo[n - 1]" :term="honestInfo[n - 1]!" /></h3>
            <p>{{ t(`site.home.honest.c${n}.text`) }}</p>
          </li>
        </ul>
      </div>
    </section>

    <section class="band band--soft">
      <div class="wrap">
        <div class="band__head">
          <h2>{{ t('site.home.sectors.title') }}</h2>
          <p>{{ t('site.home.sectors.lead') }}</p>
        </div>
        <ul class="cards">
          <li v-for="sector in sectors" :key="sector">
            <NuxtLink :to="path(`/for/${sector}`)" class="card">
              <h3>{{ t(`site.sectors.${sector}.name`) }}</h3>
              <p>{{ t(`site.sectors.${sector}.short`) }}</p>
            </NuxtLink>
          </li>
        </ul>
      </div>
    </section>

    <section class="closing">
      <div class="wrap">
        <h2>{{ t('site.home.closing.title') }}</h2>
        <p>{{ t('site.home.closing.text') }}</p>
        <div class="hero__actions">
          <SgButton variant="primary" size="lg" to="/signup">{{ t('site.nav.start') }}</SgButton>
          <SgButton size="lg" :to="path('/contact')">{{ t('site.home.closing.demo') }}</SgButton>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.home__facts {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-3) var(--s-6);
  margin: var(--s-8) 0 0;
  padding: var(--s-5) 0 0;
  border-top: 1px solid var(--rule);
  list-style: none;
  font-size: var(--fs-sm);
  color: var(--fg-2);
}

.home__facts li {
  display: flex;
  align-items: center;
  gap: var(--s-2);
}

.home__more {
  margin: var(--s-6) 0 0;
}

.home__more a {
  color: var(--fg);
  font-weight: var(--fw-medium);
  text-underline-offset: 3px;
}
</style>
