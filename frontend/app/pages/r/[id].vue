<script setup lang="ts">
import { ApiError } from '~/services/api/client'
import { publicApi, UPLOAD_CHUNK, type PublicRequest, type RequestUploadInit } from '~/services/api/public'
import { CryptoError } from '~/services/crypto/types'

// A file request opened by someone without an account (sitemap §4, /r/{id}#k=…). They send
// files into the requester's folder: each file is encrypted on this device, sealed to the
// request's public key from the fragment, so only the requester can open it. Not even the
// sender can read it back. Uploads resume after a dropped connection.
definePageMeta({ layout: 'auth' })

const { t, locale } = useI18n()
const route = useRoute()
const toast = useToast()
const online = useOnline()
const errorMessage = useErrorMessage()

useHead({
  meta: [
    { name: 'robots', content: 'noindex, nofollow' },
    { name: 'referrer', content: 'no-referrer' },
  ],
})

type Screen = 'loading' | 'unsupported' | 'error' | 'notFound' | 'ended' | 'incomplete' | 'ready'
const screen = ref<Screen>('loading')
const requestId = computed(() => String(route.params.id))
const request = ref<PublicRequest | null>(null)
const failure = shallowRef<unknown>(null)
const keyProblem = ref<'missing' | 'damaged'>('missing')
let fragment = ''

const requester = computed(() => request.value?.requester.name ?? '')

async function load() {
  failure.value = null
  if (!cryptoSupported()) {
    screen.value = 'unsupported'
    return
  }
  if (screen.value !== 'ready') screen.value = 'loading'
  try {
    const [meta] = await Promise.all([publicApi.request(requestId.value), useCrypto().then((engine) => engine.ready())])
    request.value = meta
  } catch (error) {
    if (error instanceof ApiError && error.code === 'NOT_FOUND') screen.value = 'notFound'
    else {
      failure.value = error
      screen.value = 'error'
    }
    return
  }
  if (request.value.status !== 'active') {
    // Closed while files were being sent: the list stays, with what reached the requester.
    if (screen.value === 'ready' && outgoing.value.length) closedMeanwhile.value = true
    else screen.value = 'ended'
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
  screen.value = 'ready'
}

// A link fixed by hand changes only the fragment (no page load): start over with the new key,
// unless files are on their way with the current one.
function onHashChange() {
  const key = readKeyFragment(window.location.hash)
  if ((key.state === 'ok' && key.fragment === fragment) || sending.value) return
  fragment = ''
  screen.value = 'loading'
  load()
}

onMounted(() => {
  load()
  window.addEventListener('hashchange', onHashChange)
})
onBeforeUnmount(() => window.removeEventListener('hashchange', onHashChange))

// ---- Files to send ----
type OutState = 'ready' | 'queued' | 'encrypting' | 'sending' | 'checking' | 'sent' | 'paused' | 'failed' | 'rejected' | 'cancelled'
interface Outgoing {
  key: string
  name: string
  size: number
  state: OutState
  done: number
  total: number
  problem: 'too_large' | 'closed' | 'error' | null
  error: unknown
}

const outgoing = ref<Outgoing[]>([])
const note = ref('')
const closedMeanwhile = ref(false)
const PARALLEL = 2
const ACTIVE: OutState[] = ['queued', 'encrypting', 'sending', 'checking']
// Not reactive: the files themselves, their ciphertext, upload addresses, abort controllers.
const payloads = new Map<string, { file: File; init?: RequestUploadInit; cipher?: Blob; url?: string; controller?: AbortController }>()

const sending = computed(() => outgoing.value.some((o) => ACTIVE.includes(o.state)))
const waiting = computed(() => outgoing.value.filter((o) => o.state === 'ready'))
const sent = computed(() => outgoing.value.filter((o) => o.state === 'sent'))
const finished = computed(() => outgoing.value.length > 0 && !sending.value && !waiting.value.length && outgoing.value.every((o) => o.state === 'sent'))
const noteTooLong = computed(() => [...note.value].length > 300)

function update(key: string, change: Partial<Outgoing>) {
  outgoing.value = outgoing.value.map((o) => (o.key === key ? { ...o, ...change } : o))
}

function add(list: File[]) {
  if (!request.value || closedMeanwhile.value) return
  const limit = request.value.max_file_size
  const known = new Set(outgoing.value.filter((o) => o.state !== 'cancelled').map((o) => o.key))
  let skipped = 0
  const added: Outgoing[] = []
  for (const file of list) {
    const key = `${file.name}:${file.size}:${file.lastModified}`
    if (known.has(key)) {
      skipped += 1
      continue
    }
    known.add(key)
    outgoing.value = outgoing.value.filter((o) => o.key !== key)
    payloads.set(key, { file })
    added.push({
      key,
      name: file.name,
      size: file.size,
      state: file.size > limit ? 'rejected' : 'ready',
      done: 0,
      total: file.size,
      problem: file.size > limit ? 'too_large' : null,
      error: null,
    })
  }
  outgoing.value = [...outgoing.value, ...added]
  if (skipped) toast.info(t('send.files.duplicate', { n: skipped }, skipped))
}

function remove(key: string) {
  payloads.delete(key)
  outgoing.value = outgoing.value.filter((o) => o.key !== key)
}

function start() {
  if (noteTooLong.value || !waiting.value.length) return
  for (const o of waiting.value) update(o.key, { state: 'queued', problem: null, error: null })
  pump()
}

function pump() {
  const running = outgoing.value.filter((o) => ['encrypting', 'sending', 'checking'].includes(o.state)).length
  for (const o of outgoing.value.filter((x) => x.state === 'queued').slice(0, Math.max(0, PARALLEL - running))) run(o.key)
}

async function run(key: string) {
  const payload = payloads.get(key)
  const item = outgoing.value.find((o) => o.key === key)
  if (!payload || !item || !request.value) return
  const controller = new AbortController()
  payload.controller = controller
  update(key, { state: 'encrypting', done: 0, total: item.size })
  try {
    const engine = await useCrypto()
    payload.init ??= await engine.prepareRequestUpload(request.value.id, fragment, item.name, item.size, note.value.trim() || null)
    payload.cipher ??= await engine.encryptFile(payload.init.id, payload.file, (done, total) => update(key, { done, total }))
    if (controller.signal.aborted) throw new DOMException('cancelled', 'AbortError')

    // Sending: resumable, from what the server already has.
    payload.url ??= await publicApi.startUpload(request.value.id, payload.init)
    const cipher = payload.cipher
    let offset = await publicApi.offset(payload.url)
    update(key, { state: 'sending', done: offset, total: cipher.size })
    let resyncs = 0
    while (offset < cipher.size) {
      try {
        offset = await publicApi.patch(payload.url, offset, cipher.slice(offset, Math.min(offset + UPLOAD_CHUNK, cipher.size)), controller.signal)
      } catch (error) {
        // The server has a different offset (a chunk landed but its answer was lost): ask again.
        if (!(error instanceof ApiError && error.code === 'CONFLICT') || ++resyncs > 3) throw error
        offset = await publicApi.offset(payload.url)
      }
      update(key, { done: offset })
    }
    update(key, { state: 'checking', done: 0, total: 1 })
    await publicApi.finishUpload(request.value.id, payload.init.id)
    payloads.delete(key)
    update(key, { state: 'sent', done: 1, total: 1 })
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') {
      if (payload.url) publicApi.cancelUpload(payload.url)
      payloads.delete(key)
      update(key, { state: 'cancelled' })
    } else if (error instanceof ApiError && (error.code === 'NETWORK' || error.code === 'TIMEOUT')) {
      // Kept: the next attempt continues from the server's offset.
      update(key, { state: navigator.onLine ? 'failed' : 'paused', problem: 'error', error })
    } else if (error instanceof ApiError && error.code === 'GONE') {
      for (const o of outgoing.value.filter((x) => x.state === 'queued' || x.key === key)) update(o.key, { state: 'rejected', problem: 'closed' })
      load()
    } else if (error instanceof ApiError && error.fields?.size === 'too_large') {
      update(key, { state: 'rejected', problem: 'too_large' })
    } else if (error instanceof CryptoError && error.code === 'SG_ERR_FORMAT') {
      keyProblem.value = 'damaged'
      screen.value = 'incomplete'
    } else {
      update(key, { state: 'failed', problem: 'error', error })
    }
  } finally {
    pump()
  }
}

function cancel(key: string) {
  const payload = payloads.get(key)
  const item = outgoing.value.find((o) => o.key === key)
  if (item?.state === 'queued' || item?.state === 'paused' || item?.state === 'failed') {
    if (payload?.url) publicApi.cancelUpload(payload.url)
    payloads.delete(key)
    update(key, { state: 'cancelled' })
    return
  }
  payload?.controller?.abort()
}

function retry(key: string) {
  update(key, { state: 'queued', problem: null, error: null })
  pump()
}

function sendMore() {
  outgoing.value = outgoing.value.filter((o) => o.state !== 'sent' && o.state !== 'cancelled')
}

// Back online: paused uploads continue by themselves.
function resume() {
  for (const o of outgoing.value.filter((x) => x.state === 'paused')) update(o.key, { state: 'queued' })
  pump()
}
onMounted(() => window.addEventListener('online', resume))
onBeforeUnmount(() => {
  window.removeEventListener('online', resume)
  for (const payload of payloads.values()) payload.controller?.abort()
})

// Leaving while files are on their way loses them: ask first.
const guard = useLeaveGuard(sending, () => false)

// ---- Picking and dropping ----
const picker = ref<HTMLInputElement | null>(null)
const over = ref(false)
let depth = 0

function pick() {
  picker.value?.click()
}
function onPicked(event: Event) {
  const input = event.target as HTMLInputElement
  add([...(input.files ?? [])])
  input.value = ''
}

const hasFiles = (event: DragEvent) => [...(event.dataTransfer?.types ?? [])].includes('Files')
function onEnter(event: DragEvent) {
  if (!hasFiles(event)) return
  event.preventDefault()
  depth += 1
  over.value = true
}
function onLeave() {
  depth = Math.max(0, depth - 1)
  if (!depth) over.value = false
}
function onDrop(event: DragEvent) {
  if (!hasFiles(event)) return
  event.preventDefault()
  depth = 0
  over.value = false
  if (!droppable.value) return
  const list: File[] = []
  let folders = 0
  for (const entry of [...(event.dataTransfer?.items ?? [])]) {
    if (entry.kind !== 'file') continue
    if (entry.webkitGetAsEntry?.()?.isDirectory) {
      folders += 1
      continue
    }
    const file = entry.getAsFile()
    if (file) list.push(file)
  }
  if (folders) toast.warning(t('send.files.noFolders'))
  add(list)
}

const droppable = computed(() => screen.value === 'ready' && !closedMeanwhile.value)

// ---- Words ----
const when = (iso: string | null) => (iso ? formatDate(new Date(iso), locale.value) : '')

function stateText(o: Outgoing): string {
  const sizes = { done: formatBytes(o.done, locale.value), total: formatBytes(o.total, locale.value) }
  switch (o.state) {
    case 'ready':
      return t('send.state.ready')
    case 'queued':
      return t('send.state.queued')
    case 'encrypting':
      return t('send.state.encrypting', sizes)
    case 'sending':
      return t('send.state.sending', sizes)
    case 'checking':
      return t('send.state.checking')
    case 'sent':
      return t('send.state.sent')
    case 'paused':
      return t('send.state.paused')
    case 'cancelled':
      return t('send.state.cancelled')
    case 'rejected':
      return o.problem === 'too_large'
        ? t('send.state.tooLarge', { limit: formatBytes(request.value?.max_file_size ?? 0, locale.value) })
        : t('send.state.closed')
    default:
      return errorMessage(o.error)
  }
}

const title = computed(() => {
  switch (screen.value) {
    case 'loading':
      return t('send.loading')
    case 'unsupported':
      return t('receive.unsupportedTitle')
    case 'error':
      return t('send.errorTitle')
    case 'notFound':
      return t('send.notFoundTitle')
    case 'ended':
      return request.value?.status === 'expired' ? t('send.ended.expiredTitle') : t('send.ended.closedTitle')
    case 'incomplete':
      return t('receive.incompleteTitle')
    default:
      return t('send.title', { name: isolate(requester.value) })
  }
})
</script>

<template>
  <AuthShell :title="title" :info="screen === 'ready' ? 'fileRequest' : screen === 'incomplete' ? 'linkKey' : undefined">
    <div v-if="screen === 'loading'" class="send" aria-busy="true">
      <SgSkeleton :lines="4" />
      <p class="form__note" role="status"><SgSpinner decorative size="sm" /> {{ t('send.opening') }}</p>
    </div>

    <div v-else-if="screen === 'unsupported'" class="send">
      <SgAlert tone="danger">{{ t('send.unsupported') }}</SgAlert>
    </div>

    <div v-else-if="screen === 'error'" class="send">
      <SgAlert tone="danger">
        {{ errorMessage(failure) }}
        <template #actions>
          <SgButton size="sm" icon="refresh" :disabled="!online" :disabled-reason="t('auth.offlineReason')" @click="load">{{ t('common.retry') }}</SgButton>
        </template>
      </SgAlert>
    </div>

    <div v-else-if="screen === 'notFound'" class="send">
      <p class="send__lead">{{ t('send.notFound') }}</p>
    </div>

    <div v-else-if="screen === 'ended' && request" class="send">
      <ShareSender :sender="request.requester" :note="t('send.askedOn', { date: when(request.created_at) })" />
      <p class="send__lead">
        {{
          request.status === 'expired'
            ? t('send.ended.expired', { name: requester, date: when(request.ended_at) })
            : request.ended_at
              ? t('send.ended.closed', { name: requester, date: when(request.ended_at) })
              : t('send.ended.closedNoDate', { name: requester })
        }}
      </p>
    </div>

    <div v-else-if="screen === 'incomplete'" class="send">
      <ShareSender v-if="request" :sender="request.requester" :note="t('send.askedOn', { date: when(request.created_at) })" />
      <p class="send__lead">{{ t('send.incomplete', { name: requester }) }}</p>
      <p class="form__note">{{ t('receive.incompleteHint') }}</p>
    </div>

    <div
      v-else-if="screen === 'ready' && request"
      class="send"
      @dragenter="onEnter"
      @dragover="(e) => hasFiles(e) && e.preventDefault()"
      @dragleave="onLeave"
      @drop="onDrop"
    >
      <ShareSender :sender="request.requester" :note="t('send.askedOn', { date: when(request.created_at) })" />

      <figure class="send__ask">
        <figcaption>{{ t('send.theirRequest') }}</figcaption>
        <blockquote dir="auto">{{ request.title }}</blockquote>
        <p class="send__until">{{ request.expires_at ? t('send.openUntil', { date: when(request.expires_at) }) : t('send.openNoEnd') }}</p>
      </figure>

      <SgAlert v-if="closedMeanwhile" tone="warning" :title="t('send.closedMeanwhileTitle')">
        {{ t('send.closedMeanwhile', { name: requester }) }}
      </SgAlert>

      <!-- Done -->
      <div v-if="finished" class="send__done" role="status">
        <SgIcon name="check-circle" :size="22" />
        <div>
          <p class="send__done-title">{{ t('send.done.title', { n: sent.length, name: isolate(requester) }, sent.length) }}</p>
          <p class="send__done-text">{{ t('send.done.text', { name: requester }) }}</p>
        </div>
        <SgButton icon="plus" :disabled="closedMeanwhile" :disabled-reason="t('send.state.closed')" @click="sendMore">{{ t('send.done.more') }}</SgButton>
      </div>

      <template v-else>
        <!-- Drop zone -->
        <div class="send__zone" :class="{ 'is-over': over && droppable, 'is-off': !droppable }">
          <SgIcon name="upload" :size="24" />
          <p class="send__zone-title">{{ over && droppable ? t('send.zone.release') : t('send.zone.title') }}</p>
          <p class="send__zone-hint">{{ t('send.zone.hint', { limit: formatBytes(request.max_file_size, locale) }) }}</p>
          <SgButton icon="plus" :disabled="!droppable" :disabled-reason="t('send.state.closed')" @click="pick">{{ t('send.zone.choose') }}</SgButton>
          <input ref="picker" class="sr-only" type="file" multiple tabindex="-1" aria-hidden="true" @change="onPicked" />
        </div>

        <!-- The list -->
        <ul v-if="outgoing.length" class="send__list" :aria-label="t('send.files.label')">
          <li v-for="o in outgoing" :key="o.key" class="send__row" :class="`is-${o.state}`">
            <SgIcon class="send__icon" :name="fileIcon(fileType(o.name))" :size="18" />
            <div class="send__main">
              <p class="send__name"><SgFileName :name="o.name" /></p>
              <p class="send__meta" :aria-live="ACTIVE.includes(o.state) ? 'polite' : undefined">
                <SgIcon v-if="o.state === 'sent'" name="check-circle" :size="14" />
                <SgIcon v-else-if="o.state === 'paused'" name="cloud-off" :size="14" />
                <SgIcon v-else-if="o.state === 'failed' || o.state === 'rejected'" name="alert" :size="14" />
                <span>{{ formatBytes(o.size, locale) }} · {{ stateText(o) }}</span>
              </p>
              <SgProgress
                v-if="o.state === 'encrypting' || o.state === 'sending'"
                :value="o.done"
                :max="Math.max(o.total, 1)"
                :tone="o.state === 'encrypting' ? 'neutral' : 'signal'"
              />
              <SgProgress v-else-if="o.state === 'checking' || o.state === 'queued'" :value="null" tone="neutral" />
            </div>
            <div class="send__actions">
              <SgButton
                v-if="o.state === 'failed'"
                size="sm"
                variant="ghost"
                icon="refresh"
                icon-only
                :label="t('common.retry')"
                :disabled="!online"
                :disabled-reason="t('auth.offlineReason')"
                @click="retry(o.key)"
              />
              <SgButton
                v-if="ACTIVE.includes(o.state) || o.state === 'paused' || o.state === 'failed'"
                size="sm"
                variant="ghost"
                icon="x"
                icon-only
                :label="t('send.files.cancel', { name: o.name })"
                @click="cancel(o.key)"
              />
              <SgButton
                v-else-if="o.state !== 'sent'"
                size="sm"
                variant="ghost"
                icon="x"
                icon-only
                :label="t('send.files.remove', { name: o.name })"
                @click="remove(o.key)"
              />
            </div>
          </li>
        </ul>

        <SgField :label="t('send.note.label')" :hint="t('send.note.hint', { name: requester })" :error="noteTooLong ? t('send.note.long') : ''" optional>
          <SgTextarea v-model="note" :rows="2" :placeholder="t('send.note.placeholder')" :disabled="sending" />
        </SgField>

        <div class="form__actions">
          <SgButton
            variant="primary"
            icon="upload"
            :loading="sending"
            :loading-label="t('send.sending')"
            :disabled="!waiting.length || noteTooLong || !online || closedMeanwhile"
            :disabled-reason="
              closedMeanwhile ? t('send.state.closed') : !online ? t('auth.offlineReason') : noteTooLong ? t('send.note.long') : t('send.chooseFirst')
            "
            @click="start"
          >
            {{ waiting.length ? t('send.submit', { n: waiting.length }, waiting.length) : t('send.submitNone') }}
          </SgButton>
        </div>
      </template>

      <ShareSafety :text="t('send.safety', { name: requester })" />
    </div>

    <SgDialog v-model:open="guard.asking.value" :title="t('send.leave.title')" size="sm">
      <p class="send__lead">{{ t('send.leave.body') }}</p>
      <template #footer>
        <SgButton @click="guard.leave()">{{ t('send.leave.leave') }}</SgButton>
        <SgButton variant="primary" @click="guard.stay()">{{ t('send.leave.stay') }}</SgButton>
      </template>
    </SgDialog>
  </AuthShell>
</template>

<style scoped>
.send {
  display: grid;
  gap: var(--s-5);
}

.send__lead {
  margin: 0;
  color: var(--fg-2);
}

.send__ask {
  display: grid;
  gap: var(--s-1);
  margin: 0;
  padding-inline-start: var(--s-4);
  border-inline-start: 3px solid var(--signal);
}

.send__ask figcaption,
.send__until {
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--fg-2);
}

.send__ask blockquote {
  margin: 0;
  font-size: var(--fs-lg);
  font-weight: var(--fw-medium);
  overflow-wrap: anywhere;
}

/* Aligned with the page whatever the title's own direction. */
.send__ask blockquote {
  text-align: left;
}

[dir='rtl'] .send__ask blockquote {
  text-align: right;
}

.send__zone {
  display: grid;
  justify-items: center;
  gap: var(--s-2);
  padding: var(--s-7) var(--s-4);
  border: 2px dashed var(--rule);
  border-radius: var(--radius-2);
  background: var(--surface);
  color: var(--fg-2);
  text-align: center;
  transition:
    border-color var(--dur-1) var(--ease),
    background-color var(--dur-1) var(--ease);
}

.send__zone.is-over {
  border-color: var(--signal);
  background: var(--signal-soft);
  color: var(--fg);
}

.send__zone.is-off {
  opacity: 0.6;
}

.send__zone-title {
  margin: 0;
  color: var(--fg);
  font-weight: var(--fw-medium);
}

.send__zone-hint {
  margin: 0 0 var(--s-2);
  font-size: var(--fs-sm);
}

.send__list {
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--rule);
}

.send__row {
  display: flex;
  align-items: flex-start;
  gap: var(--s-3);
  padding: var(--s-3) 0;
  border-bottom: 1px solid var(--rule);
}

.send__icon {
  flex: none;
  margin-top: 2px;
  color: var(--fg-2);
}

.send__main {
  display: grid;
  flex: 1;
  gap: var(--s-1);
  min-width: 0;
}

.send__name {
  margin: 0;
  overflow: hidden;
  font-weight: var(--fw-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.send__name :deep(.sg-fname) {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
}

.send__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--fg-2);
}

.send__meta :deep(svg) {
  flex: none;
}

.send__row.is-sent .send__meta {
  color: var(--success);
}

.send__row.is-failed .send__meta,
.send__row.is-rejected .send__meta {
  color: var(--danger);
}

.send__row.is-cancelled .send__name {
  color: var(--fg-3);
  text-decoration: line-through;
}

.send__actions {
  display: flex;
  flex: none;
  gap: var(--s-1);
}

.send__done {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s-3) var(--s-4);
  padding: var(--s-5);
  border: 1px solid var(--rule);
  border-radius: var(--radius-2);
  background: var(--surface);
}

.send__done > :deep(svg) {
  flex: none;
  color: var(--success);
}

.send__done > div {
  flex: 1;
  min-width: 14rem;
}

.send__done-title,
.send__done-text {
  margin: 0;
}

.send__done-title {
  font-weight: var(--fw-medium);
}

.send__done-text {
  font-size: var(--fs-sm);
  color: var(--fg-2);
}
</style>
