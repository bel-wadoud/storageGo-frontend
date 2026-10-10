<script setup lang="ts">
// How it works (sitemap §1: "the encryption + residency mechanism, drawn for real"): the path
// of a file from the device to Algeria, the keys, sharing, and plainly what storageGo can and
// can't see. Algorithm names stay in the "Details" part (principles.md §2).
definePageMeta({ layout: 'site' })
const { t } = useI18n()
const { path } = useSite()
useSiteMeta({ title: () => t('site.how.metaTitle'), description: () => t('site.how.metaDescription') })

const flow = [
  { key: 'device', icon: 'monitor' },
  { key: 'transit', icon: 'arrow-end' },
  { key: 'algeria', icon: 'building' },
] as const
const keys = ['passphrase', 'account', 'identity', 'folder', 'file'] as const
const sharing = [
  { key: 'members', icon: 'users' },
  { key: 'links', icon: 'link' },
  { key: 'requests', icon: 'inbox' },
] as const
const sees = ['email', 'sizes', 'dates', 'shares', 'signins'] as const
const blind = ['contents', 'names', 'passphrase', 'kit', 'links'] as const
const nets = [
  { key: 'kit', icon: 'key' },
  { key: 'org', icon: 'building' },
  { key: 'devices', icon: 'monitor' },
] as const
const details = ['files', 'passphrase', 'identity', 'sharing', 'recovery', 'engine'] as const
</script>

<template>
  <div>
    <section class="hero">
      <div class="wrap">
        <p class="hero__eyebrow">{{ t('site.nav.how') }}</p>
        <h1>{{ t('site.how.title') }}</h1>
        <p class="hero__lead">{{ t('site.how.lead') }}</p>
      </div>
    </section>

    <section class="band">
      <div class="wrap">
        <div class="band__head"><h2>{{ t('site.how.flow.title') }}</h2></div>
        <ol class="how__flow">
          <li v-for="(stage, i) in flow" :key="stage.key" class="how__stage">
            <div class="card">
              <h3><SgIcon :name="stage.icon" :size="16" />{{ t(`site.how.flow.${stage.key}.title`) }}</h3>
              <p>{{ t(`site.how.flow.${stage.key}.text`) }}</p>
            </div>
            <!-- Positioned by its wrapper: the icon keeps its own mirroring in Arabic. -->
            <span v-if="i < flow.length - 1" class="how__arrow" aria-hidden="true"><SgIcon name="arrow-end" :size="20" /></span>
          </li>
        </ol>
      </div>
    </section>

    <section class="band band--soft">
      <div class="wrap how__split">
        <div class="band__head">
          <h2>{{ t('site.how.keys.title') }}</h2>
          <p>{{ t('site.how.keys.lead') }}</p>
        </div>
        <ol class="how__ladder">
          <li v-for="key in keys" :key="key">
            <span class="how__key">{{ t(`site.how.keys.${key}.name`) }}</span>
            <span class="how__key-text">{{ t(`site.how.keys.${key}.text`) }}</span>
          </li>
        </ol>
      </div>
    </section>

    <section class="band">
      <div class="wrap">
        <div class="band__head">
          <h2>{{ t('site.how.sharing.title') }}</h2>
          <p>{{ t('site.how.sharing.lead') }}</p>
        </div>
        <ul class="cards">
          <li v-for="item in sharing" :key="item.key" class="card">
            <h3><SgIcon :name="item.icon" :size="16" />{{ t(`site.how.sharing.${item.key}.title`) }}</h3>
            <p>{{ t(`site.how.sharing.${item.key}.text`) }}</p>
          </li>
        </ul>
      </div>
    </section>

    <section class="band band--soft">
      <div class="wrap">
        <div class="band__head">
          <h2>{{ t('site.how.sees.title') }}</h2>
          <p>{{ t('site.how.sees.lead') }}</p>
        </div>
        <div class="how__sees">
          <div>
            <h3>{{ t('site.how.sees.canTitle') }}</h3>
            <ul>
              <li v-for="item in sees" :key="item"><SgIcon name="eye" :size="15" />{{ t(`site.how.sees.can.${item}`) }}</li>
            </ul>
          </div>
          <div>
            <h3>{{ t('site.how.sees.cantTitle') }}</h3>
            <ul>
              <li v-for="item in blind" :key="item"><SgIcon name="eye-off" :size="15" />{{ t(`site.how.sees.cant.${item}`) }}</li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <section class="band">
      <div class="wrap">
        <div class="band__head">
          <h2>{{ t('site.how.nets.title') }}</h2>
          <p>{{ t('site.how.nets.lead') }}</p>
        </div>
        <ul class="cards">
          <li v-for="item in nets" :key="item.key" class="card">
            <h3><SgIcon :name="item.icon" :size="16" />{{ t(`site.how.nets.${item.key}.title`) }}</h3>
            <p>{{ t(`site.how.nets.${item.key}.text`) }}</p>
          </li>
        </ul>
        <div class="callout how__callout"><p>{{ t('site.how.nets.honest') }}</p></div>
      </div>
    </section>

    <section class="band band--soft">
      <div class="wrap">
        <details class="how__details">
          <summary>{{ t('site.how.details.title') }}</summary>
          <dl>
            <div v-for="item in details" :key="item">
              <dt>{{ t(`site.how.details.${item}.term`) }}</dt>
              <dd>{{ t(`site.how.details.${item}.text`) }}</dd>
            </div>
          </dl>
          <p class="how__more"><NuxtLink :to="path('/security')">{{ t('site.how.details.more') }}</NuxtLink></p>
        </details>
      </div>
    </section>

    <section class="closing">
      <div class="wrap">
        <h2>{{ t('site.how.closing') }}</h2>
        <div class="hero__actions">
          <SgButton variant="primary" size="lg" to="/signup">{{ t('site.nav.start') }}</SgButton>
          <SgButton size="lg" :to="path('/security')">{{ t('site.nav.security') }}</SgButton>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.how__flow {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--s-5);
  margin: 0;
  padding: 0;
  list-style: none;
}

.how__stage {
  position: relative;
}

.how__stage .card {
  height: 100%;
}

.how__arrow {
  position: absolute;
  display: inline-flex;
  top: 50%;
  inset-inline-end: calc(-1 * var(--s-5) + 2px);
  color: var(--fg-3);
  transform: translateY(-50%);
}

.how__split {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
  gap: var(--s-8);
}

.how__ladder {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

.how__ladder li {
  display: grid;
  gap: 2px;
  padding: var(--s-3) var(--s-4);
  border-inline-start: 2px solid var(--rule);
}

.how__ladder li + li {
  margin-inline-start: var(--s-4);
}

.how__ladder li:nth-child(3) {
  margin-inline-start: var(--s-6);
}

.how__ladder li:nth-child(4) {
  margin-inline-start: var(--s-8);
}

.how__ladder li:nth-child(5) {
  margin-inline-start: var(--s-10);
  border-inline-start-color: var(--signal);
}

.how__key {
  font-weight: var(--fw-medium);
}

.how__key-text {
  font-size: var(--fs-sm);
  color: var(--fg-2);
}

.how__sees {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  gap: var(--s-6);
}

.how__sees h3 {
  margin: 0 0 var(--s-3);
  font-size: var(--fs-md);
  font-weight: var(--fw-medium);
}

.how__sees ul {
  display: grid;
  gap: var(--s-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.how__sees li {
  display: flex;
  align-items: flex-start;
  gap: var(--s-2);
  color: var(--fg-2);
}

.how__sees li :deep(svg) {
  flex: none;
  margin-top: 3px;
}

.how__callout {
  margin-top: var(--s-6);
}

.how__details summary {
  font-size: var(--fs-lg);
  font-weight: var(--fw-medium);
  cursor: pointer;
}

.how__details dl {
  display: grid;
  gap: var(--s-4);
  margin: var(--s-5) 0 0;
}

.how__details dt {
  font-weight: var(--fw-medium);
}

.how__details dd {
  margin: var(--s-1) 0 0;
  max-width: 75ch;
  color: var(--fg-2);
}

.how__more {
  margin: var(--s-5) 0 0;
}

@media (max-width: 899px) {
  .how__flow,
  .how__split {
    grid-template-columns: 1fr;
  }

  .how__arrow {
    top: auto;
    bottom: calc(-1 * var(--s-5) + 2px);
    inset-inline-end: 50%;
    transform: rotate(90deg);
  }

  .how__ladder li + li,
  .how__ladder li:nth-child(n) {
    margin-inline-start: 0;
  }
}
</style>
