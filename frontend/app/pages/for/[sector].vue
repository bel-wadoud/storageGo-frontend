<script setup lang="ts">
// One page per sector (sitemap §1: health, legal, finance, public sector, education): what
// that kind of organization handles, what it needs, and an everyday example. Same template,
// the sector's own words.
definePageMeta({ layout: 'site' })
const SECTORS = ['health', 'legal', 'finance', 'public', 'education'] as const
type Sector = (typeof SECTORS)[number]

const { t } = useI18n()
const route = useRoute()
const { path } = useSite()
const sector = computed(() => String(route.params.sector) as Sector)
if (!SECTORS.includes(sector.value)) {
  throw createError({ statusCode: 404, statusMessage: 'Not found', fatal: true })
}
useSiteMeta({ title: () => t(`site.sectors.${sector.value}.title`), description: () => t(`site.sectors.${sector.value}.lead`) })
const others = computed(() => SECTORS.filter((s) => s !== sector.value))
</script>

<template>
  <div>
    <section class="hero">
      <div class="wrap">
        <p class="hero__eyebrow">{{ t(`site.sectors.${sector}.name`) }}</p>
        <h1>{{ t(`site.sectors.${sector}.title`) }}</h1>
        <p class="hero__lead">{{ t(`site.sectors.${sector}.lead`) }}</p>
        <div class="hero__actions">
          <SgButton variant="primary" size="lg" to="/signup?kind=org">{{ t('site.home.ctaOrg') }}</SgButton>
          <SgButton size="lg" :to="path('/contact')">{{ t('site.home.closing.demo') }}</SgButton>
        </div>
      </div>
    </section>

    <section class="band">
      <div class="wrap">
        <div class="band__head"><h2>{{ t('site.sectorPage.needs') }}</h2></div>
        <ul class="cards">
          <li v-for="n in 3" :key="n" class="card">
            <h3>{{ t(`site.sectors.${sector}.n${n}.title`) }}</h3>
            <p>{{ t(`site.sectors.${sector}.n${n}.text`) }}</p>
          </li>
        </ul>
      </div>
    </section>

    <section class="band band--soft">
      <div class="wrap prose">
        <h2>{{ t('site.sectorPage.example') }}</h2>
        <p>{{ t(`site.sectors.${sector}.example`) }}</p>
        <div class="callout"><p>{{ t(`site.sectors.${sector}.compliance`) }}</p></div>
      </div>
    </section>

    <section class="band">
      <div class="wrap">
        <div class="band__head"><h2>{{ t('site.sectorPage.others') }}</h2></div>
        <ul class="cards">
          <li v-for="other in others" :key="other">
            <NuxtLink :to="path(`/for/${other}`)" class="card">
              <h3>{{ t(`site.sectors.${other}.name`) }}</h3>
              <p>{{ t(`site.sectors.${other}.short`) }}</p>
            </NuxtLink>
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>
