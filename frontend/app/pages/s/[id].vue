<script setup lang="ts">
import { ApiError } from '~/services/api/client'
import { publicApi, type PublicFolder, type PublicItem, type PublicLink } from '~/services/api/public'
import type { LinkRecord } from '~/services/api/drive'
import { CryptoError } from '~/services/crypto/types'
import type { LinkFile } from '~/composables/useLinkFiles'

// A share link opened by someone without an account (user-flows.md F7, states.md "Share link
// (recipient)"). The key is in the URL fragment and never leaves this device:
//   who sent it, what it is, until when → (password) → save or preview, decrypted and
//   checked here. Dead ends are honest and say who to ask: expired, turned off, used up,
//   incomplete (a messenger cut the link), unknown.
definePageMeta({ layout: 'auth', wide: true })

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const online = useOnline()
const errorMessage = useErrorMessage()
const pause = useCountdown()

useHead({
  meta: [
    { name: 'robots', content: 'noindex, nofollow' },
    { name: 'referrer', content: 'no-referrer' },
  ],
})

type Screen = 'loading' | 'unsupported' | 'error' | 'notFound' | 'ended' | 'incomplete' | 'password' | 'ready'
const screen = ref<Screen>('loading')
const linkId = computed(() => String(route.params.id))
const link = ref<PublicLink | null>(null)
const failure = shallowRef<unknown>(null)
/** Why the key in the address can't be used. */
const keyProblem = ref<'missing' | 'damaged' | 'wrong'>('missing')
let fragment = ''

const root = computed<PublicItem | null>(() => link.value?.item ?? null)
const sender = computed(() => link.value?.sender.name ?? '')
/** Names opened on this device: null when one can't be read (altered). */
const names = ref<Record<string, string | null>>({})

const files = useLinkFiles(() => linkId.value, {
  onGone: () => {
    toast.warning(t('receive.endedWhileOpen'))
    load()
  },
})

// ---- Opening ----
async function load() {
  failure.value = null
  if (!cryptoSupported()) {
    screen.value = 'unsupported'
    return
  }
  if (screen.value !== 'ready') screen.value = 'loading'
  try {
    const [meta] = await Promise.all([publicApi.link(linkId.value), useCrypto().then((engine) => engine.ready())])
    link.value = meta
  } catch (error) {
    if (error instanceof ApiError && error.code === 'NOT_FOUND') screen.value = 'notFound'
    else {
      failure.value = error
      screen.value = 'error'
    }
    return
  }
  const meta = link.value
  if (meta.status !== 'active' || !meta.item) {
    screen.value = 'ended'
    return
  }
  if (screen.value === 'ready') return
  const key = readKeyFragment(window.location.hash)
  if (key.state !== 'ok') {
    keyProblem.value = key.state
    screen.value = 'incomplete'
    return
  }
  fragment = key.fragment
  if (meta.has_password) {
    screen.value = 'password'
    return
  }
  try {
    await openWith(meta.record!, null)
  } catch (error) {
    if (error instanceof CryptoError && (error.code === 'SG_ERR_AUTH' || error.code === 'SG_ERR_FORMAT')) {
      // Without a password, a key that doesn't open means the fragment was changed on the way.
      keyProblem.value = error.code === 'SG_ERR_AUTH' ? 'wrong' : 'damaged'
      screen.value = 'incomplete'
    } else {
      failure.value = error
      screen.value = 'error'
    }
  }
}

async function openWith(record: LinkRecord, password: string | null) {
  const engine = await useCrypto()
  const opened = await engine.openLink(record, fragment, password, root.value!)
  names.value = { ...names.value, [opened.id]: 'name' in opened ? opened.name : null }
  screen.value = 'ready'
  if (root.value?.kind === 'folder') loadFolder()
}

// Someone fixing a damaged link by hand changes only the fragment: no page load happens, so
// start over with the new key. Moving in a shared folder keeps the same key and is ignored.
function onHashChange() {
  const key = readKeyFragment(window.location.hash)
  if (key.state === 'ok' && key.fragment === fragment) return
  fragment = ''
  names.value = {}
  folder.value = null
  password.value = ''
  passwordError.value = ''
  screen.value = 'loading'
  load()
}

onMounted(() => {
  load()
  window.addEventListener('hashchange', onHashChange)
})
onBeforeUnmount(() => window.removeEventListener('hashchange', onHashChange))

// ---- Password ----
const password = ref('')
const passwordError = ref('')
const unlocking = ref(false)
const paused = computed(() => pause.seconds.value > 0)
watch(password, () => {
  if (!paused.value) passwordError.value = ''
})

async function unlock() {
  if (paused.value) return
  if (!password.value) {
    passwordError.value = t('receive.password.empty')
    return
  }
  unlocking.value = true
  passwordError.value = ''
  try {
    const { record, attempts_left } = await publicApi.unlock(linkId.value)
    try {
      await openWith(record, password.value)
      password.value = ''
    } catch (error) {
      if (!(error instanceof CryptoError && error.code === 'SG_ERR_AUTH')) throw error
      passwordError.value =
        attempts_left > 0 && attempts_left <= 3
          ? `${t('receive.password.wrong')} ${t('receive.password.left', { n: attempts_left }, attempts_left)}`
          : attempts_left === 0
            ? `${t('receive.password.wrong')} ${t('receive.password.lastTry')}`
            : t('receive.password.wrong')
    }
  } catch (error) {
    if (error instanceof ApiError && error.code === 'RATE_LIMITED') {
      pause.until(Date.now() + (error.retryAfter ?? 60) * 1000)
      passwordError.value = ''
    } else if (error instanceof ApiError && error.code === 'GONE') {
      await load()
    } else if (error instanceof CryptoError && error.code === 'SG_ERR_FORMAT') {
      keyProblem.value = 'damaged'
      screen.value = 'incomplete'
    } else {
      passwordError.value = errorMessage(error)
    }
  } finally {
    unlocking.value = false
  }
}

// ---- Folder ----
const folder = ref<PublicFolder | null>(null)
const folderLoading = ref(false)
const folderError = shallowRef<unknown>(null)
let folderToken = 0

const currentFolderId = computed(() => (typeof route.query.f === 'string' && route.query.f ? route.query.f : (root.value?.id ?? '')))

async function loadFolder() {
  if (root.value?.kind !== 'folder') return
  const token = ++folderToken
  const target = currentFolderId.value
  folderLoading.value = true
  folderError.value = null
  try {
    const page = await publicApi.folder(linkId.value, target)
    // Keys open from the top down: the folders above, this folder, then what's inside.
    const unknown = [...page.path, page.folder, ...page.items].filter((item) => !(item.id in names.value))
    if (unknown.length) {
      const opened = await (await useCrypto()).openLinkItems(unknown)
      const next = { ...names.value }
      for (const entry of opened) next[entry.id] = 'name' in entry ? entry.name : null
      names.value = next
    }
    if (token !== folderToken) return
    folder.value = page
  } catch (error) {
    if (token !== folderToken) return
    if (error instanceof ApiError && error.code === 'GONE') {
      await load()
    } else if (error instanceof ApiError && error.code === 'NOT_FOUND' && target !== root.value?.id) {
      toast.warning(t('receive.folder.gone'))
      openFolder(null, true)
    } else {
      folderError.value = error
    }
  } finally {
    if (token === folderToken) folderLoading.value = false
  }
}

watch(currentFolderId, () => screen.value === 'ready' && loadFolder())

/** Moves in the shared folder. The fragment (the key) stays in the address. */
function openFolder(id: string | null, replace = false) {
  const query = id && id !== root.value?.id ? { f: id } : {}
  const to = { query, hash: route.hash }
  if (replace) router.replace(to)
  else router.push(to)
}

const collator = computed(() => new Intl.Collator(intlLocale(locale.value), { numeric: true, sensitivity: 'base' }))
const rows = computed(() =>
  [...(folder.value?.items ?? [])].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1
    return collator.value.compare(names.value[a.id] ?? '', names.value[b.id] ?? '')
  }),
)
const crumbs = computed(() => (folder.value ? [...folder.value.path, folder.value.folder] : []))

// ---- Files ----
function asFile(item: PublicItem): LinkFile {
  return { id: item.id, name: names.value[item.id] ?? '', size: item.size }
}

async function save(item: PublicItem) {
  const first = files.stateOf(item.id).phase !== 'done'
  const ok = await files.save(asFile(item))
  if (ok && first && link.value) link.value = { ...link.value, downloads: link.value.downloads + 1 }
}

const previewing = ref<LinkFile | null>(null)
const previewOpen = computed({
  get: () => previewing.value !== null,
  set: (value) => {
    if (!value) previewing.value = null
  },
})
async function openPreview(item: PublicItem) {
  const first = files.stateOf(item.id).phase !== 'done'
  previewing.value = asFile(item)
  try {
    await files.open(asFile(item))
    if (first && link.value) link.value = { ...link.value, downloads: link.value.downloads + 1 }
  } catch {
    // The preview shows what went wrong.
  }
}

// ---- Words ----
const when = (iso: string | null) => (iso ? formatDate(new Date(iso), locale.value) : '')
const downloadsLeft = computed(() => (link.value?.max_downloads == null ? null : Math.max(0, link.value.max_downloads - link.value.downloads)))

const title = computed(() => {
  switch (screen.value) {
    case 'loading':
      return t('receive.loading')
    case 'unsupported':
      return t('receive.unsupportedTitle')
    case 'error':
      return t('receive.errorTitle')
    case 'notFound':
      return t('receive.notFoundTitle')
    case 'ended':
      return t(`receive.ended.${link.value?.status ?? 'revoked'}Title`)
    case 'incomplete':
      return t('receive.incompleteTitle')
    case 'password':
      return t('receive.password.title')
    default:
      return root.value?.kind === 'folder' ? t('receive.titleFolder') : t('receive.titleFile')
  }
})

const endedText = computed(() => {
  const meta = link.value
  if (!meta) return ''
  if (meta.status === 'exhausted') return t('receive.ended.exhausted', { name: sender.value, n: meta.max_downloads ?? 0 }, meta.max_downloads ?? 0)
  if (meta.status === 'expired') return meta.ended_at ? t('receive.ended.expired', { name: sender.value, date: when(meta.ended_at) }) : t('receive.ended.expiredNoDate', { name: sender.value })
  return meta.ended_at ? t('receive.ended.revoked', { name: sender.value, date: when(meta.ended_at) }) : t('receive.ended.revokedNoDate', { name: sender.value })
})
</script>

<template>
  <AuthShell :title="title" :info="screen === 'ready' ? 'shareLink' : screen === 'incomplete' ? 'linkKey' : undefined">
    <!-- Loading -->
    <div v-if="screen === 'loading'" class="recv" aria-busy="true">
      <SgSkeleton :lines="4" />
      <p class="form__note" role="status"><SgSpinner decorative size="sm" /> {{ t('receive.opening') }}</p>
    </div>

    <!-- This browser can't decrypt -->
    <div v-else-if="screen === 'unsupported'" class="recv">
      <SgAlert tone="danger">{{ t('receive.unsupported') }}</SgAlert>
    </div>

    <!-- Couldn't load (network, server, engine) -->
    <div v-else-if="screen === 'error'" class="recv">
      <SgAlert tone="danger">
        {{ errorMessage(failure) }}
        <template #actions>
          <SgButton size="sm" icon="refresh" :disabled="!online" :disabled-reason="t('auth.offlineReason')" @click="load">{{ t('common.retry') }}</SgButton>
        </template>
      </SgAlert>
    </div>

    <!-- Unknown link -->
    <div v-else-if="screen === 'notFound'" class="recv">
      <p class="recv__lead">{{ t('receive.notFound') }}</p>
    </div>

    <!-- Expired, turned off, used up: who to ask -->
    <div v-else-if="screen === 'ended' && link" class="recv">
      <ShareSender :sender="link.sender" :note="t('receive.sharedOn', { date: when(link.created_at) })" />
      <p class="recv__lead">{{ endedText }}</p>
    </div>

    <!-- The key part of the address is missing or damaged -->
    <div v-else-if="screen === 'incomplete' && link" class="recv">
      <ShareSender :sender="link.sender" :note="t('receive.sharedOn', { date: when(link.created_at) })" />
      <p class="recv__lead">{{ keyProblem === 'wrong' ? t('receive.incompleteWrong', { name: sender }) : t('receive.incomplete', { name: sender }) }}</p>
      <p class="form__note">{{ t('receive.incompleteHint') }}</p>
    </div>

    <!-- Password -->
    <div v-else-if="screen === 'password' && link" class="recv">
      <ShareSender :sender="link.sender" :note="t('receive.sharedOn', { date: when(link.created_at) })" />
      <p class="recv__lead">{{ t('receive.password.lead', { name: sender }) }}</p>
      <form class="form" novalidate @submit.prevent="unlock">
        <SgField :label="t('receive.password.label')" :error="passwordError" required info="linkPassword">
          <SgPassphraseInput
            v-model="password"
            autocomplete="off"
            :meter="false"
            :placeholder="t('receive.password.placeholder')"
            :disabled="unlocking"
          />
        </SgField>
        <SgAlert v-if="paused" tone="warning">{{ t('receive.password.paused', { time: pause.label.value }) }}</SgAlert>
        <div class="form__actions">
          <SgButton
            type="submit"
            variant="primary"
            icon="key"
            :loading="unlocking"
            :loading-label="t('receive.password.checking')"
            :disabled="paused || !online"
            :disabled-reason="!online ? t('auth.offlineReason') : t('receive.password.pausedShort', { time: pause.label.value })"
          >
            {{ t('receive.password.submit') }}
          </SgButton>
        </div>
      </form>
      <ShareSafety :text="t('receive.password.safety')" />
    </div>

    <!-- Ready -->
    <div v-else-if="screen === 'ready' && link && root" class="recv">
      <ShareSender
        :sender="link.sender"
        :note="root.kind === 'folder' ? t('receive.sharedFolder', { date: when(link.created_at) }) : t('receive.sharedFile', { date: when(link.created_at) })"
      />

      <!-- One file -->
      <ShareFileItem
        v-if="root.kind === 'file'"
        featured
        :file="asFile(root)"
        :state="files.stateOf(root.id)"
        :sender="sender"
        :broken="names[root.id] === null"
        @save="save(root)"
        @preview="openPreview(root)"
      />

      <!-- A folder -->
      <section v-else class="recv__folder" :aria-label="names[root.id] ?? t('receive.file.unreadable')">
        <nav v-if="crumbs.length" class="recv__crumbs" :aria-label="t('drive.breadcrumbs')">
          <ol>
            <li v-for="(crumb, index) in crumbs" :key="crumb.id">
              <button
                v-if="index < crumbs.length - 1"
                type="button"
                class="recv__crumb"
                @click="openFolder(crumb.id)"
              >
                <SgFileName :name="names[crumb.id] ?? t('receive.file.unreadable')" />
              </button>
              <span v-else class="recv__crumb is-current" aria-current="page"><SgFileName :name="names[crumb.id] ?? t('receive.file.unreadable')" /></span>
              <SgIcon v-if="index < crumbs.length - 1" class="recv__sep" name="chevron-end" :size="14" />
            </li>
          </ol>
        </nav>

        <div v-if="folderLoading && !folder" aria-busy="true"><SgSkeleton :lines="5" /></div>
        <SgAlert v-else-if="folderError" tone="danger">
          {{ errorMessage(folderError) }}
          <template #actions><SgButton size="sm" icon="refresh" @click="loadFolder">{{ t('common.retry') }}</SgButton></template>
        </SgAlert>
        <template v-else-if="folder">
          <SgEmptyState v-if="!rows.length" icon="folder" :title="t('receive.folder.empty')" />
          <ul v-else class="recv__list" :class="{ 'is-stale': folderLoading }" :aria-busy="folderLoading || undefined">
            <li v-for="item in rows" :key="item.id">
              <button v-if="item.kind === 'folder'" type="button" class="recv__dir" @click="openFolder(item.id)">
                <SgIcon name="folder" :size="18" />
                <span class="recv__dir-main">
                  <span class="recv__dir-name">
                    <SgFileName v-if="names[item.id] !== null" :name="names[item.id] ?? ''" />
                    <span v-else class="recv__broken">{{ t('receive.file.unreadable') }}</span>
                  </span>
                  <span class="recv__dir-meta">{{ t('drive.type.folder') }} · {{ formatBytes(item.size, locale) }}</span>
                </span>
                <SgIcon name="chevron-end" :size="16" />
              </button>
              <ShareFileItem
                v-else
                :file="asFile(item)"
                :state="files.stateOf(item.id)"
                :sender="sender"
                :broken="names[item.id] === null"
                @save="save(item)"
                @preview="openPreview(item)"
              />
            </li>
          </ul>
        </template>
      </section>

      <dl class="facts-grid recv__facts">
        <div>
          <dt>{{ t('receive.available') }}</dt>
          <dd>{{ link.expires_at ? t('receive.until', { date: when(link.expires_at) }) : t('receive.noEnd') }}</dd>
        </div>
        <div v-if="downloadsLeft !== null">
          <dt>{{ t('receive.downloads') }}</dt>
          <dd>{{ t('receive.downloadsLeft', { n: downloadsLeft }, downloadsLeft) }}</dd>
        </div>
      </dl>

      <ShareSafety :text="root.kind === 'folder' ? t('receive.safetyFolder') : t('receive.safety')" />

      <SharePreview
        v-if="previewing"
        v-model:visible="previewOpen"
        :file="previewing"
        :state="files.stateOf(previewing.id)"
        :sender="sender"
        :open="files.open"
        @save="previewing && files.save(previewing)"
      />
    </div>
  </AuthShell>
</template>

<style scoped>
.recv {
  display: grid;
  gap: var(--s-5);
}

.recv__lead {
  margin: 0;
  color: var(--fg-2);
}

.recv__folder {
  display: grid;
  gap: var(--s-3);
  min-width: 0;
}

.recv__crumbs ol {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s-1);
  margin: 0;
  padding: 0;
  list-style: none;
}

.recv__crumbs li {
  display: inline-flex;
  align-items: center;
  gap: var(--s-1);
  min-width: 0;
  max-width: 100%;
}

.recv__crumb {
  max-width: 22ch;
  padding: 2px var(--s-1);
  overflow: hidden;
  border: 0;
  border-radius: var(--radius-1);
  background: none;
  color: var(--fg-2);
  font: inherit;
  font-size: var(--fs-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color var(--dur-1) var(--ease), color var(--dur-1) var(--ease);
}

.recv__crumb:hover {
  background: var(--surface-2);
  color: var(--fg);
}

.recv__crumb.is-current {
  color: var(--fg);
  font-weight: var(--fw-medium);
  cursor: default;
}

.recv__crumb.is-current:hover {
  background: none;
}

.recv__sep {
  color: var(--fg-3);
}

.recv__list {
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--rule);
  transition: opacity var(--dur-1) var(--ease);
}

.recv__list.is-stale {
  opacity: 0.6;
}

.recv__list > li {
  padding: var(--s-3) 0;
  border-bottom: 1px solid var(--rule);
}

.recv__dir {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  width: 100%;
  min-height: 44px;
  padding: 0 var(--s-1);
  border: 0;
  border-radius: var(--radius-1);
  background: none;
  color: var(--fg);
  font: inherit;
  text-align: start;
  cursor: pointer;
  transition: background-color var(--dur-1) var(--ease);
}

.recv__dir:hover {
  background: var(--surface-2);
}

.recv__dir:active {
  background: var(--surface-3);
}

.recv__dir > :deep(svg) {
  flex: none;
  color: var(--fg-2);
}

.recv__dir-main {
  display: grid;
  flex: 1;
  min-width: 0;
}

.recv__dir-name {
  overflow: hidden;
  font-weight: var(--fw-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recv__dir-name :deep(.sg-fname) {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
}

.recv__dir-meta {
  font-size: var(--fs-sm);
  color: var(--fg-2);
}

.recv__broken {
  color: var(--fg-2);
  font-style: italic;
}

.recv__facts {
  margin: 0;
}
</style>
