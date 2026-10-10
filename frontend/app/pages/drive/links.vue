<script setup lang="ts">
import { driveApi, type LinkInfo } from '~/services/api/drive'

// My share links. The key part of each link only ever existed on the device that made it, so
// a link can be revoked here but never shown again (01-crypto-design.md §4).
definePageMeta({ layout: 'app', middleware: 'auth' })
const { t, locale } = useI18n()
const toast = useToast()
const online = useOnline()
const errorMessage = useErrorMessage()
const drive = useDrive()
const actions = useDriveActions()
useHead({ title: () => `${t('app.nav.links')} · storageGo` })

const links = ref<LinkInfo[]>([])
const loading = ref(true)
const failure = ref('')

async function load() {
  loading.value = true
  failure.value = ''
  try {
    const page = await driveApi.myLinks(drive.workspaceId.value!)
    await drive.absorb(page.items.flatMap((l) => (l.item ? [l.item] : [])))
    links.value = page.items
  } catch (error) {
    failure.value = errorMessage(error)
  } finally {
    loading.value = false
  }
}
watch(() => drive.workspaceId.value, load, { immediate: true })

function status(link: LinkInfo): 'active' | 'expired' | 'revoked' | 'used' {
  if (link.revoked_at) return 'revoked'
  if (link.expires_at && Date.parse(link.expires_at) <= Date.now()) return 'expired'
  if (link.max_downloads !== null && link.downloads >= link.max_downloads) return 'used'
  return 'active'
}

const confirm = ref<string | null>(null)
const revoking = ref<string | null>(null)
async function revoke(link: LinkInfo) {
  revoking.value = link.id
  try {
    await driveApi.revokeLink(link.id)
    links.value = links.value.map((l) => (l.id === link.id ? { ...l, revoked_at: new Date().toISOString() } : l))
    toast.success(t('drive.link.revoked'))
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    revoking.value = null
    confirm.value = null
  }
}
</script>

<template>
  <div class="page">
    <DrivePageHeader :title="t('app.nav.links')" :note="t('drive.links.note')" info="shareLink" />

    <SgAlert v-if="failure" tone="danger">
      {{ failure }}
      <template #actions><SgButton size="sm" icon="refresh" @click="load">{{ t('common.retry') }}</SgButton></template>
    </SgAlert>
    <div v-else-if="loading" aria-busy="true"><SgSkeleton :lines="5" /></div>
    <SgEmptyState v-else-if="!links.length" :title="t('drive.empty.linksTitle')" :description="t('drive.empty.links')" icon="link" />

    <table v-else class="table">
      <caption class="sr-only">{{ t('app.nav.links') }}</caption>
      <thead>
        <tr>
          <th scope="col">{{ t('drive.column.name') }}</th>
          <th scope="col">{{ t('drive.links.status') }}</th>
          <th scope="col" class="table__meta">{{ t('drive.links.expires') }}</th>
          <th scope="col" class="table__meta">{{ t('drive.links.downloads') }}</th>
          <th scope="col"><span class="sr-only">{{ t('drive.column.actions') }}</span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="link in links" :key="link.id">
          <td>
            <button v-if="link.item && drive.item(link.item.id)?.name" type="button" class="table__name" @click="actions.open(link.item.id, [link.item.id])">
              <SgIcon :name="fileIcon(drive.item(link.item.id)!.type)" :size="16" />
              <SgFileName :name="drive.item(link.item.id)!.name!" />
            </button>
            <span v-else class="table__muted">{{ t('drive.item.unreadable') }}</span>
            <span v-if="link.has_password" class="table__tag"><SgIcon name="lock" :size="12" />{{ t('drive.link.withPassword') }}</span>
          </td>
          <td>
            <span class="status" :class="`is-${status(link)}`">{{ t(`drive.links.state.${status(link)}`) }}</span>
          </td>
          <td class="table__meta">{{ link.expires_at ? formatDate(new Date(link.expires_at), locale) : t('drive.link.noExpiry') }}</td>
          <td class="table__meta">{{ link.max_downloads ? `${link.downloads} / ${link.max_downloads}` : link.downloads }}</td>
          <td class="table__actions">
            <template v-if="status(link) === 'active'">
              <template v-if="confirm === link.id">
                <SgButton size="sm" variant="danger" :loading="revoking === link.id" :loading-label="t('drive.link.revoking')" @click="revoke(link)">{{ t('drive.link.revoke') }}</SgButton>
                <SgButton size="sm" variant="ghost" @click="confirm = null">{{ t('common.cancel') }}</SgButton>
              </template>
              <SgButton v-else size="sm" :disabled="!online" :disabled-reason="t('auth.offlineReason')" @click="confirm = link.id">{{ t('drive.link.revoke') }}</SgButton>
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
