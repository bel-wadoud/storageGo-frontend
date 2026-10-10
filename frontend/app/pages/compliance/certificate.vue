<script setup lang="ts">
// What the residency certificate contains (sitemap §1), with a sample. Organizations download
// their own, signed, from Administration › Compliance.
definePageMeta({ layout: 'site' })
const { t, locale } = useI18n()
const { path } = useSite()
useSiteMeta({ title: () => t('site.certificate.metaTitle'), description: () => t('site.certificate.metaDescription') })

const fields = ['org', 'locations', 'scope', 'period', 'number', 'signature'] as const
const issued = formatDate(new Date(2026, 0, 15), locale.value)
const valid = formatDate(new Date(2027, 0, 14), locale.value)
</script>

<template>
  <div>
    <section class="hero">
      <div class="wrap">
        <p class="hero__eyebrow"><NuxtLink :to="path('/compliance')" class="cert__crumb">{{ t('site.nav.compliance') }}</NuxtLink></p>
        <h1>{{ t('site.certificate.title') }}</h1>
        <p class="hero__lead">{{ t('site.certificate.lead') }}</p>
      </div>
    </section>

    <section class="band">
      <div class="wrap cert__split">
        <div>
          <div class="band__head"><h2>{{ t('site.certificate.contains') }}</h2></div>
          <dl class="cert__fields">
            <div v-for="field in fields" :key="field">
              <dt>{{ t(`site.certificate.fields.${field}.term`) }}</dt>
              <dd>{{ t(`site.certificate.fields.${field}.text`) }}</dd>
            </div>
          </dl>
        </div>

        <figure class="cert__sample">
          <article class="cert" :aria-label="t('site.certificate.sample')">
            <p class="cert__stamp">{{ t('site.certificate.sampleStamp') }}</p>
            <header class="cert__head">
              <SgLogo :to="null" />
              <p class="cert__number" dir="ltr">SG-RES-2026-00000</p>
            </header>
            <h3>{{ t('admin.compliance.certificate.heading') }}</h3>
            <p>{{ t('admin.compliance.certificate.body', { org: t('site.certificate.sampleOrg'), places: t('site.certificate.samplePlaces') }) }}</p>
            <dl class="facts-grid">
              <div><dt>{{ t('admin.compliance.certificate.issued') }}</dt><dd>{{ issued }}</dd></div>
              <div><dt>{{ t('admin.compliance.certificate.valid') }}</dt><dd>{{ valid }}</dd></div>
            </dl>
          </article>
          <figcaption>{{ t('site.certificate.caption') }}</figcaption>
        </figure>
      </div>
    </section>

    <section class="band band--soft">
      <div class="wrap">
        <div class="band__head">
          <h2>{{ t('site.certificate.verify.title') }}</h2>
          <p>{{ t('site.certificate.verify.text') }}</p>
        </div>
        <div class="hero__actions">
          <SgButton variant="primary" icon="download" to="/samples/storagego-residency-certificate-sample.pdf" external download target="_blank">{{ t('site.certificate.download') }}</SgButton>
          <SgButton :to="path('/contact')">{{ t('site.certificate.ask') }}</SgButton>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.cert__crumb {
  color: inherit;
  text-underline-offset: 3px;
}

.cert__split {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--s-8);
  align-items: start;
}

.cert__fields {
  display: grid;
  gap: var(--s-4);
  margin: 0;
}

.cert__fields dt {
  font-weight: var(--fw-medium);
}

.cert__fields dd {
  margin: var(--s-1) 0 0;
  color: var(--fg-2);
}

.cert__sample {
  display: grid;
  gap: var(--s-3);
  margin: 0;
}

.cert__sample figcaption {
  font-size: var(--fs-sm);
  color: var(--fg-2);
}

.cert {
  position: relative;
  display: grid;
  gap: var(--s-4);
  padding: var(--s-6);
  overflow: hidden;
  border: 1px solid var(--rule);
  border-top: 4px solid var(--signal);
  border-radius: var(--radius-1);
  background: var(--bg);
}

.cert h3 {
  margin: 0;
  font-size: var(--fs-lg);
  font-weight: var(--fw-medium);
}

.cert p {
  margin: 0;
  color: var(--fg-2);
}

.cert .facts-grid {
  margin: 0;
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
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
}

.cert__stamp {
  position: absolute;
  top: var(--s-3);
  inset-inline-end: var(--s-3);
  padding: 2px var(--s-2);
  border: 1px solid var(--danger);
  border-radius: var(--radius-1);
  color: var(--danger) !important;
  font-size: var(--fs-xs);
  font-weight: var(--fw-medium);
  letter-spacing: 0.06em;
}

@media (max-width: 899px) {
  .cert__split {
    grid-template-columns: 1fr;
  }
}
</style>
