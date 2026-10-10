<script setup lang="ts">
// Security (sitemap §1): the model in plain words, how accounts and devices are protected,
// the infrastructure, the whitepaper, and how to report a problem (responsible disclosure,
// also announced in /.well-known/security.txt).
definePageMeta({ layout: 'site' })
const { t } = useI18n()
const { path } = useSite()
useSiteMeta({ title: () => t('site.security.metaTitle'), description: () => t('site.security.metaDescription') })

const model = [
  { key: 'zeroKnowledge', icon: 'lock' },
  { key: 'zeroTrust', icon: 'key' },
  { key: 'algeria', icon: 'building' },
] as const
const accounts = ['passphrase', 'devices', 'sessions', 'audit'] as const
const infra = ['location', 'transport', 'backups', 'format', 'tracking'] as const
const rules = ['do1', 'do2', 'do3', 'dont1', 'dont2', 'dont3'] as const
</script>

<template>
  <div>
    <section class="hero">
      <div class="wrap">
        <p class="hero__eyebrow">{{ t('site.nav.security') }}</p>
        <h1>{{ t('site.security.title') }}</h1>
        <p class="hero__lead">{{ t('site.security.lead') }}</p>
        <div class="hero__actions">
          <SgButton variant="primary" icon="download" to="/samples/storagego-security-summary.pdf" external download target="_blank">{{ t('site.security.whitepaper') }}</SgButton>
          <SgButton :to="path('/how-it-works')">{{ t('site.home.ctaHow') }}</SgButton>
        </div>
      </div>
    </section>

    <section class="band">
      <div class="wrap">
        <div class="band__head"><h2>{{ t('site.security.model.title') }}</h2></div>
        <ul class="cards">
          <li v-for="item in model" :key="item.key" class="card">
            <h3><SgIcon :name="item.icon" :size="16" />{{ t(`site.security.model.${item.key}.title`) }}</h3>
            <p>{{ t(`site.security.model.${item.key}.text`) }}</p>
          </li>
        </ul>
      </div>
    </section>

    <section class="band band--soft">
      <div class="wrap">
        <div class="band__head"><h2>{{ t('site.security.accounts.title') }}</h2></div>
        <dl class="sec__list">
          <div v-for="item in accounts" :key="item">
            <dt>{{ t(`site.security.accounts.${item}.title`) }}</dt>
            <dd>{{ t(`site.security.accounts.${item}.text`) }}</dd>
          </div>
        </dl>
      </div>
    </section>

    <section class="band">
      <div class="wrap">
        <div class="band__head"><h2>{{ t('site.security.infra.title') }}</h2></div>
        <dl class="sec__list">
          <div v-for="item in infra" :key="item">
            <dt>{{ t(`site.security.infra.${item}.title`) }}</dt>
            <dd>{{ t(`site.security.infra.${item}.text`) }}</dd>
          </div>
        </dl>
      </div>
    </section>

    <section id="disclosure" class="band band--soft">
      <div class="wrap prose">
        <div class="band__head">
          <h2>{{ t('site.security.disclosure.title') }}</h2>
          <p>{{ t('site.security.disclosure.lead') }}</p>
        </div>
        <p class="sec__mail">
          <SgIcon name="mail" :size="16" />
          <a href="mailto:security@storagego.dz" dir="ltr">security@storagego.dz</a>
        </p>
        <h3>{{ t('site.security.disclosure.includeTitle') }}</h3>
        <p>{{ t('site.security.disclosure.include') }}</p>
        <h3>{{ t('site.security.disclosure.promiseTitle') }}</h3>
        <p>{{ t('site.security.disclosure.promise') }}</p>
        <h3>{{ t('site.security.disclosure.rulesTitle') }}</h3>
        <ul>
          <li v-for="rule in rules" :key="rule">{{ t(`site.security.disclosure.${rule}`) }}</li>
        </ul>
        <p>{{ t('site.security.disclosure.harbor') }}</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.sec__list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
  gap: var(--s-5) var(--s-7);
  margin: 0;
}

.sec__list dt {
  font-weight: var(--fw-medium);
}

.sec__list dd {
  margin: var(--s-1) 0 0;
  color: var(--fg-2);
}

.sec__mail {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  font-size: var(--fs-lg);
}

.sec__mail a {
  color: var(--fg);
  font-weight: var(--fw-medium);
  text-underline-offset: 3px;
}
</style>
