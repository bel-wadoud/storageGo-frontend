<script setup lang="ts">
// Compliance (sitemap §1): what Algerian law expects of organizations holding personal data,
// in general terms, and how storageGo helps meet it, with the evidence an inspection asks for.
// [LEGAL] Every legal statement here must be confirmed by a lawyer before launch (product-brief.md).
definePageMeta({ layout: 'site' })
const { t } = useI18n()
const { path } = useSite()
useSiteMeta({ title: () => t('site.compliance.metaTitle'), description: () => t('site.compliance.metaDescription') })

const asks = ['protect', 'inform', 'declare', 'transfer', 'security'] as const
const mapping = ['residency', 'access', 'encryption', 'trace', 'contract', 'deletion'] as const
const evidence = [
  { key: 'certificate', icon: 'check-circle', info: 'residencyCertificate' },
  { key: 'audit', icon: 'history', info: 'auditLog' },
  { key: 'dpa', icon: 'file', info: 'dpa' },
  { key: 'pack', icon: 'archive', info: 'exportPack' },
] as const
</script>

<template>
  <div>
    <section class="hero">
      <div class="wrap">
        <p class="hero__eyebrow">{{ t('site.nav.compliance') }}</p>
        <h1>{{ t('site.compliance.title') }}</h1>
        <p class="hero__lead">{{ t('site.compliance.lead') }}</p>
      </div>
    </section>

    <section class="band">
      <div class="wrap">
        <div class="band__head">
          <h2>{{ t('site.compliance.asks.title') }}<SgInfo term="personalData" /></h2>
          <p>{{ t('site.compliance.asks.lead') }}</p>
        </div>
        <ul class="cards">
          <li v-for="item in asks" :key="item" class="card">
            <h3>{{ t(`site.compliance.asks.${item}.title`) }}</h3>
            <p>{{ t(`site.compliance.asks.${item}.text`) }}</p>
          </li>
        </ul>
        <div class="callout cmpl__note"><p>{{ t('site.compliance.notAdvice') }}</p></div>
      </div>
    </section>

    <section class="band band--soft">
      <div class="wrap">
        <div class="band__head">
          <h2>{{ t('site.compliance.mapping.title') }}</h2>
          <p>{{ t('site.compliance.mapping.lead') }}</p>
        </div>
        <div class="compare-wrap">
          <table class="compare">
            <thead>
              <tr>
                <th scope="col">{{ t('site.compliance.mapping.need') }}</th>
                <th scope="col">{{ t('site.compliance.mapping.how') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in mapping" :key="row">
                <th scope="row">{{ t(`site.compliance.mapping.${row}.need`) }}</th>
                <td>{{ t(`site.compliance.mapping.${row}.how`) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <section class="band">
      <div class="wrap">
        <div class="band__head">
          <h2>{{ t('site.compliance.evidence.title') }}</h2>
          <p>{{ t('site.compliance.evidence.lead') }}</p>
        </div>
        <ul class="cards">
          <li v-for="item in evidence" :key="item.key" class="card">
            <h3><SgIcon :name="item.icon" :size="16" />{{ t(`site.compliance.evidence.${item.key}.title`) }}<SgInfo :term="item.info" /></h3>
            <p>{{ t(`site.compliance.evidence.${item.key}.text`) }}</p>
          </li>
        </ul>
        <div class="hero__actions">
          <SgButton variant="primary" :to="path('/compliance/certificate')">{{ t('site.compliance.seeCertificate') }}</SgButton>
          <SgButton :to="path('/legal/dpa')">{{ t('legal.dpa.title') }}</SgButton>
        </div>
      </div>
    </section>

    <section class="closing">
      <div class="wrap">
        <h2>{{ t('site.compliance.closing.title') }}</h2>
        <p>{{ t('site.compliance.closing.text') }}</p>
        <div class="hero__actions">
          <SgButton variant="primary" size="lg" :to="path('/contact')">{{ t('site.home.closing.demo') }}</SgButton>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.cmpl__note {
  margin-top: var(--s-6);
}
</style>
