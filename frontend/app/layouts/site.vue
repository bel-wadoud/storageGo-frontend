<script setup lang="ts">
// The public website (storagego.dz): calm and institutional (principles.md §5, §6). A header
// with the few pages that matter, a footer with every page, the residency fact, and the
// language addresses (names in their own script, never flags; i18n-rtl.md). Theme follows the device.
const { t, locales, locale } = useI18n()
const route = useRoute()
const config = useRuntimeConfig()
const { path, inLanguage } = useSite()
const menuOpen = ref(false)
watch(() => route.fullPath, () => (menuOpen.value = false))

const nav = computed(() => [
  { to: path('/how-it-works'), label: t('site.nav.how') },
  { to: path('/security'), label: t('site.nav.security') },
  { to: path('/compliance'), label: t('site.nav.compliance') },
  { to: path('/pricing'), label: t('site.nav.pricing') },
  { to: path('/contact'), label: t('site.nav.contact') },
])
const sectors = ['health', 'legal', 'finance', 'public', 'education'] as const
const legal = ['terms', 'privacy', 'dpa', 'sla'] as const
const year = new Date().getFullYear()
const isCurrent = (to: string) => route.path === to
</script>

<template>
  <div class="site">
    <a class="site__skip" href="#main">{{ t('site.skip') }}</a>
    <header class="site__header">
      <div class="site__bar">
        <SgLogo :to="path('/')" />
        <nav class="site__nav" :aria-label="t('site.nav.label')">
          <NuxtLink v-for="item in nav" :key="item.to" :to="item.to" class="site__link" :aria-current="isCurrent(item.to) ? 'page' : undefined">{{ item.label }}</NuxtLink>
        </nav>
        <div class="site__actions">
          <NuxtLink to="/signin" class="site__link">{{ t('site.nav.signin') }}</NuxtLink>
          <SgButton variant="primary" size="sm" to="/signup">{{ t('site.nav.start') }}</SgButton>
        </div>
        <SgButton
          class="site__menu"
          variant="ghost"
          :icon="menuOpen ? 'x' : 'menu'"
          icon-only
          :label="menuOpen ? t('app.nav.close') : t('site.nav.menu')"
          :aria-expanded="menuOpen"
          aria-controls="site-menu"
          @click="menuOpen = !menuOpen"
        />
      </div>
      <nav v-if="menuOpen" id="site-menu" class="site__drawer" :aria-label="t('site.nav.label')">
        <NuxtLink v-for="item in nav" :key="item.to" :to="item.to" class="site__drawer-link" :aria-current="isCurrent(item.to) ? 'page' : undefined">{{ item.label }}</NuxtLink>
        <NuxtLink to="/signin" class="site__drawer-link">{{ t('site.nav.signin') }}</NuxtLink>
        <SgButton variant="primary" block to="/signup">{{ t('site.nav.start') }}</SgButton>
      </nav>
    </header>

    <main id="main" class="site__main">
      <slot />
    </main>

    <footer class="site__footer">
      <div class="site__cols">
        <div>
          <SgLogo :to="path('/')" />
          <p class="site__fact"><SgIcon name="lock" :size="14" />{{ t('site.footer.fact') }}</p>
        </div>
        <nav :aria-label="t('site.footer.product')">
          <p class="site__col-title">{{ t('site.footer.product') }}</p>
          <ul>
            <li v-for="item in nav.slice(0, 4)" :key="item.to"><NuxtLink :to="item.to">{{ item.label }}</NuxtLink></li>
            <li><NuxtLink :to="path('/compliance/certificate')">{{ t('site.footer.certificate') }}</NuxtLink></li>
          </ul>
        </nav>
        <nav :aria-label="t('site.footer.sectors')">
          <p class="site__col-title">{{ t('site.footer.sectors') }}</p>
          <ul>
            <li v-for="sector in sectors" :key="sector"><NuxtLink :to="path(`/for/${sector}`)">{{ t(`site.sectors.${sector}.name`) }}</NuxtLink></li>
          </ul>
        </nav>
        <nav :aria-label="t('site.footer.company')">
          <p class="site__col-title">{{ t('site.footer.company') }}</p>
          <ul>
            <li><NuxtLink :to="path('/contact')">{{ t('site.nav.contact') }}</NuxtLink></li>
            <li><a :href="config.public.statusUrl" rel="noopener">{{ t('site.footer.status') }}</a></li>
            <li><NuxtLink to="/signin">{{ t('site.nav.signin') }}</NuxtLink></li>
            <li><NuxtLink to="/signup">{{ t('site.nav.start') }}</NuxtLink></li>
          </ul>
        </nav>
        <nav :aria-label="t('site.footer.legal')">
          <p class="site__col-title">{{ t('site.footer.legal') }}</p>
          <ul>
            <li v-for="doc in legal" :key="doc"><NuxtLink :to="path(`/legal/${doc}`)">{{ t(`legal.${doc}.title`) }}</NuxtLink></li>
          </ul>
        </nav>
      </div>
      <div class="site__bottom">
        <p>© {{ year }} storageGo</p>
        <nav class="site__langs" :aria-label="t('language.label')">
          <a
            v-for="item in locales"
            :key="item.code"
            :href="inLanguage(item.code)"
            :lang="item.language"
            :hreflang="item.language"
            :dir="item.dir"
            :aria-current="item.code === locale ? 'true' : undefined"
          >{{ item.name }}</a>
        </nav>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.site {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
}

.site__skip {
  position: absolute;
  inset-inline-start: var(--s-4);
  top: -100px;
  z-index: 50;
  padding: var(--s-2) var(--s-3);
  border-radius: var(--radius-1);
  background: var(--fg);
  color: var(--bg);
}

.site__skip:focus {
  top: var(--s-3);
}

.site__header {
  position: sticky;
  top: 0;
  z-index: 20;
  border-bottom: 1px solid var(--rule);
  background: var(--bg);
}

.site__bar {
  display: flex;
  align-items: center;
  gap: var(--s-6);
  max-width: 1200px;
  margin-inline: auto;
  padding: var(--s-3) var(--s-5);
}

.site__nav {
  display: flex;
  flex: 1;
  gap: var(--s-1);
}

.site__actions {
  display: flex;
  align-items: center;
  gap: var(--s-3);
}

.site__link {
  padding: var(--s-2) var(--s-3);
  border-radius: var(--radius-1);
  color: var(--fg-2);
  font-size: var(--fs-sm);
  text-decoration: none;
  transition:
    background-color var(--dur-1) var(--ease),
    color var(--dur-1) var(--ease);
}

.site__link:hover {
  background: var(--surface-2);
  color: var(--fg);
}

.site__link[aria-current='page'] {
  color: var(--fg);
  font-weight: var(--fw-medium);
}

.site__menu {
  display: none;
}

.site__drawer {
  display: grid;
  gap: var(--s-1);
  padding: var(--s-3) var(--s-5) var(--s-5);
  border-top: 1px solid var(--rule);
}

.site__drawer-link {
  padding: var(--s-3) 0;
  border-bottom: 1px solid var(--rule-soft);
  color: var(--fg);
  text-decoration: none;
}

.site__drawer-link[aria-current='page'] {
  font-weight: var(--fw-medium);
}

.site__drawer .sg-btn {
  margin-top: var(--s-3);
}

.site__main {
  flex: 1 0 auto;
  width: 100%;
}

.site__footer {
  border-top: 1px solid var(--rule);
  background: var(--surface);
  font-size: var(--fs-sm);
}

.site__cols {
  display: grid;
  grid-template-columns: 1.4fr repeat(4, 1fr);
  gap: var(--s-6);
  max-width: 1200px;
  margin-inline: auto;
  padding: var(--s-8) var(--s-5) var(--s-6);
}

.site__fact {
  display: flex;
  align-items: flex-start;
  gap: var(--s-2);
  max-width: 32ch;
  margin: var(--s-3) 0 0;
  color: var(--fg-2);
}

.site__fact :deep(svg) {
  flex: none;
  margin-top: 3px;
}

.site__col-title {
  margin: 0 0 var(--s-3);
  font-weight: var(--fw-medium);
}

.site__cols ul {
  display: grid;
  gap: var(--s-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.site__cols a,
.site__langs a {
  color: var(--fg-2);
  text-decoration: none;
}

.site__cols a:hover,
.site__langs a:hover {
  color: var(--fg);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.site__bottom {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--s-3);
  max-width: 1200px;
  margin-inline: auto;
  padding: var(--s-4) var(--s-5) var(--s-6);
  border-top: 1px solid var(--rule);
  color: var(--fg-3);
}

.site__bottom p {
  margin: 0;
}

.site__langs {
  display: flex;
  gap: var(--s-4);
}

.site__langs a[aria-current='true'] {
  color: var(--fg);
  font-weight: var(--fw-medium);
}

@media (max-width: 899px) {
  .site__nav,
  .site__actions {
    display: none;
  }

  .site__menu {
    display: inline-flex;
    margin-inline-start: auto;
  }

  .site__cols {
    grid-template-columns: 1fr 1fr;
  }

  .site__cols > :first-child {
    grid-column: 1 / -1;
  }
}

@media (min-width: 900px) {
  .site__drawer {
    display: none;
  }
}
</style>
