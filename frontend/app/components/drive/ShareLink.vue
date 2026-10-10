<script setup lang="ts">
import { driveApi, type Access, type LinkInfo } from '~/services/api/drive'
import type { DriveItem } from '~/composables/useDrive'

// Share by link with someone outside (user-flows.md F6). The link key is made on this device
// and goes in the part after "#", which browsers never send to a server: storageGo can't open
// the file, and can't show the link again either. So the link is copied right after creation.
const props = defineProps<{ item: DriveItem; access: Access }>()
const emit = defineEmits<{ change: [access: Access] }>()

const { t, locale } = useI18n()
const toast = useToast()
const online = useOnline()
const errorMessage = useErrorMessage()
const drive = useDrive()

const canManage = computed(() => props.item.role !== 'viewer')
const policy = computed(() => props.access.policy)
const now = Date.now()
const activeLinks = computed(() =>
  props.access.links.filter((l) => !l.revoked_at && (!l.expires_at || Date.parse(l.expires_at) > now) && (l.max_downloads === null || l.downloads < l.max_downloads)),
)

// ---- New link ----
const expiryChoices = computed(() => {
  const max = policy.value.max_link_days
  const days = [1, 7, 30].filter((d) => max === null || d <= max)
  const options = days.map((d) => ({ value: String(d), label: t('drive.link.days', { n: d }, d) }))
  if (max === null) options.push({ value: 'never', label: t('drive.link.never') })
  return options
})
const expiry = ref('7')
watch(expiryChoices, (choices) => {
  if (!choices.some((c) => c.value === expiry.value)) expiry.value = choices[choices.length - 1]?.value ?? '1'
}, { immediate: true })

const limitDownloads = ref(false)
const maxDownloads = ref('10')
const usePassword = ref(false)
const password = ref('')
const creating = ref(false)
const createError = ref('')
const created = ref<{ url: string; base: string; fragment: string; password: boolean } | null>(null)

const errors = computed(() => ({
  downloads: limitDownloads.value && !(Number(maxDownloads.value) >= 1 && Number(maxDownloads.value) <= 1000) ? t('drive.link.errors.downloads') : '',
  password: usePassword.value && [...password.value].length < 8 ? t('drive.link.errors.password') : '',
}))

function randomId(): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from(crypto.getRandomValues(new Uint8Array(10)), (n) => alphabet[n % alphabet.length]).join('')
}

async function create() {
  if (errors.value.downloads || errors.value.password) return
  creating.value = true
  createError.value = ''
  try {
    const engine = await useCrypto()
    const linkId = randomId()
    const { fragment, record } = await engine.createLink(props.item.id, linkId, usePassword.value ? password.value : null)
    const expires = expiry.value === 'never' ? null : new Date(Date.now() + Number(expiry.value) * 86_400_000).toISOString()
    const link = await driveApi.createLink(props.item.id, record, {
      expires_at: expires,
      max_downloads: limitDownloads.value ? Number(maxDownloads.value) : null,
    })
    const base = `${window.location.origin}/s/${encodeURIComponent(link.id)}`
    created.value = { url: `${base}#${fragment}`, base, fragment, password: usePassword.value }
    password.value = ''
    emit('change', { ...props.access, links: [link, ...props.access.links] })
    drive.patch(props.item.id, { shared: true })
  } catch (error) {
    createError.value = errorMessage(error)
  } finally {
    creating.value = false
  }
}

// ---- Revoking ----
const confirmRevoke = ref<string | null>(null)
const revoking = ref<string | null>(null)

async function revoke(link: LinkInfo) {
  revoking.value = link.id
  try {
    await driveApi.revokeLink(link.id)
    const links = props.access.links.map((l) => (l.id === link.id ? { ...l, revoked_at: new Date().toISOString() } : l))
    emit('change', { ...props.access, links })
    toast.success(t('drive.link.revoked'))
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    revoking.value = null
    confirmRevoke.value = null
  }
}
</script>

<template>
  <div class="links">
    <SgAlert v-if="!policy.links_allowed" tone="info" :title="t('drive.link.blockedTitle')">
      {{ policy.policy_contact ? t('drive.link.blockedAsk', { who: policy.policy_contact.name }) : t('drive.link.blocked') }}
    </SgAlert>

    <!-- Just created: copy it now. -->
    <div v-else-if="created" class="made" role="status">
      <p class="made__title"><SgIcon name="check-circle" :size="16" />{{ t('drive.link.created') }}</p>
      <p class="made__url" dir="ltr" translate="no">
        <span>{{ created.base }}</span><mark>#{{ created.fragment }}</mark>
      </p>
      <div class="form__actions">
        <SgCopyButton :value="created.url" variant="primary" :label="t('drive.link.copy')" />
        <SgButton variant="ghost" @click="created = null">{{ t('drive.link.another') }}</SgButton>
      </div>
      <ul class="made__notes">
        <li>{{ t('drive.link.keyNote') }}</li>
        <li>{{ t('drive.link.onceNote') }}</li>
        <li v-if="created.password">{{ t('drive.link.passwordNote') }}</li>
      </ul>
    </div>

    <form v-else-if="canManage" class="form" novalidate @submit.prevent="create">
      <SgField :label="t('drive.link.expiry')" info="linkExpiry">
        <SgSelect v-model="expiry" :options="expiryChoices" :disabled="creating" />
      </SgField>
      <div>
        <SgCheckbox v-model="limitDownloads" :label="t('drive.link.limit')" :disabled="creating" info="downloadLimit" />
        <SgField v-if="limitDownloads" class="links__sub" :label="t('drive.link.limitLabel')" :error="errors.downloads">
          <SgInput v-model="maxDownloads" inputmode="numeric" dir="ltr" placeholder="10" :disabled="creating" />
        </SgField>
      </div>
      <div>
        <SgCheckbox v-model="usePassword" :label="t('drive.link.password')" :description="t('drive.link.passwordHint')" :disabled="creating" info="linkPassword" />
        <SgField v-if="usePassword" class="links__sub" :label="t('drive.link.passwordLabel')" :error="errors.password">
          <SgPassphraseInput v-model="password" autocomplete="new-password" :meter="false" :placeholder="t('placeholders.linkPassword')" :disabled="creating" />
        </SgField>
      </div>
      <SgAlert v-if="createError" tone="danger">{{ createError }}</SgAlert>
      <div class="form__actions">
        <SgButton
          type="submit"
          variant="primary"
          icon="link"
          :loading="creating"
          :loading-label="t('drive.link.creating')"
          :disabled="!online"
          :disabled-reason="t('auth.offlineReason')"
        >
          {{ t('drive.link.create') }}
        </SgButton>
      </div>
    </form>

    <div class="active">
      <p class="active__title">{{ t('drive.link.active', { n: activeLinks.length }, activeLinks.length) }}</p>
      <p v-if="!activeLinks.length" class="active__none">{{ t('drive.link.none') }}</p>
      <ul v-else>
        <li v-for="link in activeLinks" :key="link.id" class="active__link">
          <SgIcon name="link" :size="16" />
          <div class="active__text">
            <p>
              {{ link.expires_at ? t('drive.link.expiresOn', { date: formatDate(new Date(link.expires_at), locale) }) : t('drive.link.noExpiry') }}
              <template v-if="link.has_password"> · {{ t('drive.link.withPassword') }}</template>
            </p>
            <p class="active__meta">
              {{ t('drive.link.createdOn', { date: formatDate(new Date(link.created_at), locale) }) }} ·
              {{ link.max_downloads ? t('drive.link.downloadsOf', { n: link.downloads, max: link.max_downloads }) : t('drive.link.downloads', { n: link.downloads }, link.downloads) }}
            </p>
          </div>
          <template v-if="canManage">
            <template v-if="confirmRevoke === link.id">
              <SgButton size="sm" variant="danger" :loading="revoking === link.id" :loading-label="t('drive.link.revoking')" @click="revoke(link)">
                {{ t('drive.link.revoke') }}
              </SgButton>
              <SgButton size="sm" variant="ghost" @click="confirmRevoke = null">{{ t('common.cancel') }}</SgButton>
            </template>
            <SgButton v-else size="sm" :disabled="!online" :disabled-reason="t('auth.offlineReason')" @click="confirmRevoke = link.id">
              {{ t('drive.link.revoke') }}
            </SgButton>
          </template>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.links {
  display: grid;
  gap: var(--s-5);
}

.links__sub {
  margin-top: var(--s-3);
  padding-inline-start: 28px;
}

.made {
  display: grid;
  gap: var(--s-3);
  padding: var(--s-4);
  border: 1px solid var(--rule);
  border-inline-start: 3px solid var(--success);
  border-radius: var(--radius-2);
  background: var(--surface-2);
}

.made__title {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  margin: 0;
  font-weight: var(--fw-medium);
  color: var(--success);
}

.made__url {
  margin: 0;
  padding: var(--s-2) var(--s-3);
  overflow-wrap: anywhere;
  border: 1px solid var(--rule-input);
  border-radius: var(--radius-1);
  background: var(--surface);
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
  user-select: all;
}

.made__url mark {
  border-radius: 2px;
  background: var(--signal-soft);
  color: var(--signal-text);
}

.made__notes {
  display: grid;
  gap: var(--s-1);
  margin: 0;
  padding-inline-start: var(--s-5);
  font-size: var(--fs-sm);
  color: var(--fg-2);
}

.active__title {
  margin: 0 0 var(--s-2);
  font-size: var(--fs-sm);
  font-weight: var(--fw-medium);
}

.active__none {
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--fg-2);
}

.active ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.active__link {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s-2) var(--s-3);
  padding: var(--s-2) 0;
  border-bottom: 1px solid var(--rule-soft);
}

.active__text {
  flex: 1;
  min-width: 160px;
}

.active__text p {
  margin: 0;
  font-size: var(--fs-sm);
}

.active__meta {
  font-size: var(--fs-xs) !important;
  color: var(--fg-2);
}
</style>
