<script setup lang="ts">
import { driveApi, type FileRequestInfo } from '~/services/api/drive'

// File requests: links through which people without an account can send me files.
definePageMeta({ layout: 'app', middleware: 'auth' })
const { t, locale } = useI18n()
const toast = useToast()
const online = useOnline()
const errorMessage = useErrorMessage()
const drive = useDrive()
const ui = useDriveUi()
useHead({ title: () => `${t('app.nav.requests')} · storageGo` })

const requests = ref<FileRequestInfo[]>([])
const loading = ref(true)
const failure = ref('')

async function load() {
  loading.value = true
  failure.value = ''
  try {
    const page = await driveApi.requests(drive.workspaceId.value!)
    await drive.absorb(page.items.map((r) => r.folder))
    requests.value = page.items
  } catch (error) {
    failure.value = errorMessage(error)
  } finally {
    loading.value = false
  }
}
watch(() => drive.workspaceId.value, load, { immediate: true })
// A request was just created in the dialog: show it.
watch(useState('drive:request-created', () => 0), load)

function open(request: FileRequestInfo) {
  return !request.closed_at && (!request.expires_at || Date.parse(request.expires_at) > Date.now())
}

function folderName(request: FileRequestInfo) {
  return drive.workspaces.value.find((w) => w.root.id === request.folder.id)?.name ?? drive.item(request.folder.id)?.name ?? t('drive.item.unnamed')
}

const confirm = ref<string | null>(null)
const closing = ref<string | null>(null)
async function close(request: FileRequestInfo) {
  closing.value = request.id
  try {
    await driveApi.closeRequest(request.id)
    requests.value = requests.value.map((r) => (r.id === request.id ? { ...r, closed_at: new Date().toISOString() } : r))
    toast.success(t('drive.requests.closed'))
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    closing.value = null
    confirm.value = null
  }
}
</script>

<template>
  <div class="page">
    <DrivePageHeader :title="t('app.nav.requests')" :note="t('drive.requests.note')">
      <template #actions>
        <SgButton variant="primary" icon="plus" :disabled="!online" :disabled-reason="t('auth.offlineReason')" @click="ui.open({ kind: 'request' })">
          {{ t('drive.request.new') }}
        </SgButton>
      </template>
    </DrivePageHeader>

    <SgAlert v-if="failure" tone="danger">
      {{ failure }}
      <template #actions><SgButton size="sm" icon="refresh" @click="load">{{ t('common.retry') }}</SgButton></template>
    </SgAlert>
    <div v-else-if="loading" aria-busy="true"><SgSkeleton :lines="5" /></div>
    <SgEmptyState v-else-if="!requests.length" :title="t('drive.empty.requestsTitle')" :description="t('drive.empty.requests')" icon="inbox">
      <SgButton variant="primary" icon="plus" @click="ui.open({ kind: 'request' })">{{ t('drive.request.new') }}</SgButton>
    </SgEmptyState>

    <table v-else class="table">
      <caption class="sr-only">{{ t('app.nav.requests') }}</caption>
      <thead>
        <tr>
          <th scope="col">{{ t('drive.request.name') }}</th>
          <th scope="col" class="table__meta">{{ t('drive.request.folder') }}</th>
          <th scope="col" class="table__meta">{{ t('drive.requests.received') }}</th>
          <th scope="col">{{ t('drive.links.status') }}</th>
          <th scope="col"><span class="sr-only">{{ t('drive.column.actions') }}</span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="request in requests" :key="request.id">
          <td>
            <bdi class="table__strong">{{ request.title }}</bdi>
            <span class="table__sub">{{ t('drive.link.createdOn', { date: formatDate(new Date(request.created_at), locale) }) }}</span>
          </td>
          <td class="table__meta">
            <NuxtLink :to="drive.workspaces.value.some((w) => w.root.id === request.folder.id) ? '/drive' : `/drive/f/${request.folder.id}`">
              <bdi>{{ folderName(request) }}</bdi>
            </NuxtLink>
          </td>
          <td class="table__meta">{{ t('drive.requests.files', { n: request.uploads }, request.uploads) }}</td>
          <td>
            <span class="status" :class="open(request) ? 'is-active' : 'is-expired'">
              {{ open(request) ? (request.expires_at ? t('drive.requests.until', { date: formatDate(new Date(request.expires_at), locale) }) : t('drive.requests.open')) : request.closed_at ? t('drive.requests.closedState') : t('drive.links.state.expired') }}
            </span>
          </td>
          <td class="table__actions">
            <template v-if="open(request)">
              <template v-if="confirm === request.id">
                <SgButton size="sm" variant="danger" :loading="closing === request.id" :loading-label="t('drive.requests.closing')" @click="close(request)">{{ t('drive.requests.close') }}</SgButton>
                <SgButton size="sm" variant="ghost" @click="confirm = null">{{ t('common.cancel') }}</SgButton>
              </template>
              <SgButton v-else size="sm" :disabled="!online" :disabled-reason="t('auth.offlineReason')" @click="confirm = request.id">{{ t('drive.requests.close') }}</SgButton>
            </template>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.page {
  display: grid;
  gap: var(--s-4);
}
</style>
