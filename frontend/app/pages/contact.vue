<script setup lang="ts">
import { contactApi, type ContactMessage, type ContactTopic } from '~/services/api/contact'

// Contact (sitemap §1: "sales / demo request"): a short form, an answer by email, and the
// addresses to write to directly. Security problems go to security@ (see /security).
definePageMeta({ layout: 'site' })
const { t, locale } = useI18n()
const route = useRoute()
const { path } = useSite()
const online = useOnline()
const errorMessage = useErrorMessage()
useSiteMeta({ title: () => t('site.contact.metaTitle'), description: () => t('site.contact.metaDescription') })

const TOPICS: ContactTopic[] = ['demo', 'sales', 'support', 'press']
const form = reactive<Omit<ContactMessage, 'locale'>>({
  name: '',
  email: '',
  organization: '',
  size: '',
  sector: '',
  topic: TOPICS.includes(route.query.topic as ContactTopic) ? (route.query.topic as ContactTopic) : 'demo',
  message: '',
  website: '',
})
const submitted = ref(false)
const sending = ref(false)
const failure = ref('')
const sent = ref<string | null>(null)

const errors = computed(() => ({
  name: submitted.value && !form.name.trim() ? t('signup.errors.name') : '',
  email: submitted.value ? (!form.email.trim() ? t('signup.errors.email') : !isEmail(form.email) ? t('signup.errors.emailInvalid') : '') : '',
  message: submitted.value && [...form.message.trim()].length < 10 ? t('site.contact.errors.message') : '',
}))

const topics = computed(() => TOPICS.map((value) => ({ value, label: t(`site.contact.topics.${value}`) })))
const sizes = computed(() => [{ value: '', label: t('site.contact.sizeNone') }, ...['1-10', '11-50', '51-250', '251+'].map((value) => ({ value, label: t('site.contact.people', { n: value }) }))])
const sectors = computed(() => [
  { value: '', label: t('site.contact.sectorNone') },
  ...['health', 'legal', 'finance', 'public', 'education'].map((value) => ({ value, label: t(`site.sectors.${value}.name`) })),
  { value: 'other', label: t('signup.org.sectors.other') },
])

async function send() {
  submitted.value = true
  failure.value = ''
  if (Object.values(errors.value).some(Boolean)) {
    nextTick(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
    return
  }
  sending.value = true
  try {
    const { reference } = await contactApi.send({ ...form, name: form.name.trim(), email: normalizeEmail(form.email), message: form.message.trim(), locale: locale.value })
    sent.value = reference
  } catch (error) {
    failure.value = errorMessage(error)
  } finally {
    sending.value = false
  }
}

function again() {
  sent.value = null
  submitted.value = false
  form.message = ''
}
</script>

<template>
  <div>
    <section class="hero">
      <div class="wrap">
        <p class="hero__eyebrow">{{ t('site.nav.contact') }}</p>
        <h1>{{ t('site.contact.title') }}</h1>
        <p class="hero__lead">{{ t('site.contact.lead') }}</p>
      </div>
    </section>

    <section class="band">
      <div class="wrap ct__split">
        <div>
          <div v-if="sent" class="ct__sent" role="status">
            <SgIcon name="check-circle" :size="22" />
            <div>
              <h2>{{ t('site.contact.sent.title') }}</h2>
              <p>{{ t('site.contact.sent.text', { email: isolate(normalizeEmail(form.email)) }) }}</p>
              <p class="form__note">{{ t('site.contact.sent.reference', { ref: sent }) }}</p>
              <SgButton @click="again">{{ t('site.contact.sent.again') }}</SgButton>
            </div>
          </div>

          <form v-else class="form ct__form" novalidate @submit.prevent="send">
            <div class="ct__pair">
              <SgField :label="t('signup.fields.name')" :error="errors.name" required>
                <SgInput v-model="form.name" dir="auto" autocomplete="name" :placeholder="t('placeholders.name')" :disabled="sending" />
              </SgField>
              <SgField :label="t('site.contact.email')" :error="errors.email" required>
                <SgInput v-model="form.email" type="email" dir="ltr" autocomplete="email" inputmode="email" :placeholder="t('placeholders.email')" :disabled="sending" />
              </SgField>
            </div>
            <SgField :label="t('signup.org.orgName')" optional>
              <SgInput v-model="form.organization" dir="auto" autocomplete="organization" :disabled="sending" />
            </SgField>
            <div class="ct__pair">
              <SgField :label="t('site.contact.size')" optional>
                <SgSelect v-model="form.size" :options="sizes" :disabled="sending" />
              </SgField>
              <SgField :label="t('signup.org.sector')" optional>
                <SgSelect v-model="form.sector" :options="sectors" :disabled="sending" />
              </SgField>
            </div>
            <SgField :label="t('site.contact.topic')">
              <SgSelect v-model="form.topic" :options="topics" :disabled="sending" />
            </SgField>
            <SgField :label="t('site.contact.message')" :hint="t('site.contact.messageHint')" :error="errors.message" required>
              <SgTextarea v-model="form.message" :rows="5" :disabled="sending" />
            </SgField>
            <!-- People don't see this field; bots fill it in. -->
            <div class="ct__trap" aria-hidden="true">
              <label>Website <input v-model="form.website" type="text" tabindex="-1" autocomplete="off" /></label>
            </div>
            <SgAlert v-if="failure" tone="danger">{{ failure }}</SgAlert>
            <div class="form__actions">
              <SgButton type="submit" variant="primary" size="lg" icon="mail" :loading="sending" :loading-label="t('site.contact.sending')" :disabled="!online" :disabled-reason="t('auth.offlineReason')">
                {{ t('site.contact.submit') }}
              </SgButton>
            </div>
            <p class="form__note">{{ t('site.contact.privacy') }} <NuxtLink :to="path('/legal/privacy')">{{ t('legal.privacy.title') }}</NuxtLink></p>
          </form>
        </div>

        <aside class="ct__direct">
          <h2>{{ t('site.contact.direct.title') }}</h2>
          <dl>
            <div><dt>{{ t('site.contact.direct.sales') }}</dt><dd><a href="mailto:contact@storagego.dz" dir="ltr">contact@storagego.dz</a></dd></div>
            <div><dt>{{ t('site.contact.direct.support') }}</dt><dd><a href="mailto:support@storagego.dz" dir="ltr">support@storagego.dz</a></dd></div>
            <div><dt>{{ t('site.contact.direct.security') }}</dt><dd><a href="mailto:security@storagego.dz" dir="ltr">security@storagego.dz</a> · <NuxtLink :to="path('/security') + '#disclosure'">{{ t('site.contact.direct.policy') }}</NuxtLink></dd></div>
          </dl>
          <div class="callout"><p>{{ t('site.contact.direct.noRecovery') }}</p></div>
        </aside>
      </div>
    </section>
  </div>
</template>

<style scoped>
.ct__split {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
  gap: var(--s-8);
  align-items: start;
}

.ct__form {
  max-width: 40rem;
}

.ct__pair {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: var(--s-4);
}

.ct__trap {
  position: absolute;
  inset-inline-start: -10000px;
  width: 1px;
  height: 1px;
  overflow: hidden;
}

.ct__sent {
  display: flex;
  align-items: flex-start;
  gap: var(--s-4);
  padding: var(--s-6);
  border: 1px solid var(--rule);
  border-radius: var(--radius-2);
  background: var(--surface);
}

.ct__sent > :deep(svg) {
  flex: none;
  color: var(--success);
}

.ct__sent h2 {
  margin: 0;
  font-size: var(--fs-xl);
  font-weight: var(--fw-medium);
}

.ct__sent p {
  margin: var(--s-2) 0 var(--s-4);
  color: var(--fg-2);
}

.ct__direct h2 {
  margin: 0 0 var(--s-4);
  font-size: var(--fs-lg);
  font-weight: var(--fw-medium);
}

.ct__direct dl {
  display: grid;
  gap: var(--s-4);
  margin: 0 0 var(--s-5);
}

.ct__direct dt {
  font-size: var(--fs-sm);
  color: var(--fg-2);
}

.ct__direct dd {
  margin: var(--s-1) 0 0;
}

.ct__direct a {
  color: var(--fg);
  text-underline-offset: 3px;
}

@media (max-width: 899px) {
  .ct__split {
    grid-template-columns: 1fr;
  }
}
</style>
