<script setup lang="ts">
// Legal documents (sitemap §1: terms, privacy, data processing agreement, service levels),
// at a reading measure of about 70 characters (principles.md §5), with numbered sections and a
// table of contents. [LEGAL] The texts live in i18n/locales/*.json under "legal" and must be
// reviewed by a lawyer before launch (product-brief.md); the version date is part of each text.
definePageMeta({ layout: 'site' })
const DOCS = ['terms', 'privacy', 'dpa', 'sla'] as const
type Doc = (typeof DOCS)[number]

const { t, tm, rt } = useI18n()
const route = useRoute()
const { path } = useSite()
const doc = computed(() => String(route.params.doc) as Doc)
if (!DOCS.includes(doc.value)) {
  throw createError({ statusCode: 404, statusMessage: 'Not found', fatal: true })
}
useSiteMeta({ title: () => t(`legal.${doc.value}.title`), description: () => t(`legal.${doc.value}.intro`) })

type Section = { h: string; p: string[] }
const sections = computed(() =>
  (tm(`legal.${doc.value}.sections`) as unknown as { h: unknown; p: unknown[] }[]).map(
    (section): Section => ({ h: rt(section.h as never), p: section.p.map((p) => rt(p as never)) }),
  ),
)
</script>

<template>
  <div>
    <section class="hero legal__hero">
      <div class="wrap">
        <p class="hero__eyebrow">{{ t('site.footer.legal') }}</p>
        <h1>{{ t(`legal.${doc}.title`) }}</h1>
        <p class="hero__lead">{{ t(`legal.${doc}.intro`) }}</p>
        <p class="legal__updated">{{ t('legal.updated', { date: t(`legal.${doc}.updated`) }) }}</p>
      </div>
    </section>

    <section class="band">
      <div class="wrap legal__layout">
        <nav class="legal__toc" :aria-label="t('legal.contents')">
          <p class="legal__toc-title">{{ t('legal.contents') }}</p>
          <ol>
            <li v-for="(section, i) in sections" :key="i"><a :href="`#s${i + 1}`">{{ section.h }}</a></li>
          </ol>
        </nav>
        <article class="prose">
          <section v-for="(section, i) in sections" :id="`s${i + 1}`" :key="i" class="legal__section">
            <h2>{{ i + 1 }}. {{ section.h }}</h2>
            <p v-for="(paragraph, j) in section.p" :key="j">{{ paragraph }}</p>
          </section>
          <div class="callout legal__questions">
            <p>{{ t('legal.questions') }} <NuxtLink :to="path('/contact')">{{ t('site.nav.contact') }}</NuxtLink></p>
          </div>
          <nav class="legal__others" :aria-label="t('site.footer.legal')">
            <NuxtLink v-for="other in DOCS.filter((d) => d !== doc)" :key="other" :to="path(`/legal/${other}`)">{{ t(`legal.${other}.title`) }}</NuxtLink>
          </nav>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.legal__hero h1 {
  max-width: 30ch;
}

.legal__updated {
  margin: var(--s-4) 0 0;
  font-size: var(--fs-sm);
  color: var(--fg-3);
}

.legal__layout {
  display: grid;
  grid-template-columns: 15rem minmax(0, 1fr);
  gap: var(--s-8);
  align-items: start;
}

.legal__toc {
  position: sticky;
  top: calc(var(--s-10) + var(--s-3));
  font-size: var(--fs-sm);
}

.legal__toc-title {
  margin: 0 0 var(--s-3);
  font-weight: var(--fw-medium);
}

.legal__toc ol {
  display: grid;
  gap: var(--s-2);
  margin: 0;
  padding-inline-start: var(--s-5);
  color: var(--fg-2);
}

.legal__toc a {
  color: var(--fg-2);
  text-decoration: none;
}

.legal__toc a:hover {
  color: var(--fg);
  text-decoration: underline;
}

.legal__section {
  scroll-margin-top: calc(var(--s-10) + var(--s-3));
}

.legal__section:first-child h2 {
  margin-top: 0;
}

.legal__questions {
  margin-top: var(--s-8);
}

.legal__others {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-4);
  margin-top: var(--s-6);
  font-size: var(--fs-sm);
}

.legal__others a {
  color: var(--fg-2);
}

@media (max-width: 899px) {
  .legal__layout {
    grid-template-columns: 1fr;
  }

  .legal__toc {
    position: static;
  }
}
</style>
