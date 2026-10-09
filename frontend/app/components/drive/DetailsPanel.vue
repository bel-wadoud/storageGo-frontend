<script setup lang="ts">
import { driveApi, type Access, type ActivityEvent, type Version } from '~/services/api/drive'
import type { IconName } from '~/utils/icons'

// Details of the selected item: Info · Access · Encryption · Versions · Activity.
// Encryption shows evidence, not adjectives (principles.md §1): the algorithm, the key's
// fingerprint, how many wrapped copies exist, and whether integrity was verified here.
const emit = defineEmits<{ close: [] }>()

const { t, locale } = useI18n()
const toast = useToast()
const errorMessage = useErrorMessage()
const drive = useDrive()
const selection = useSelection()
const menu = useItemMenu()

type Tab = 'info' | 'access' | 'encryption' | 'versions' | 'activity'
const tab = ref<Tab>('info')

const selected = computed(() => selection.selected.value.map((id) => drive.item(id)).filter(Boolean) as NonNullable<ReturnType<typeof drive.item>>[])
const item = computed(() => (selected.value.length === 1 ? selected.value[0]! : null))

const tabs = computed(() => {
  const list: { key: Tab; label: string }[] = [
    { key: 'info', label: t('drive.details.info') },
    { key: 'access', label: t('drive.details.access') },
    { key: 'encryption', label: t('drive.details.encryption') },
  ]
  if (item.value?.kind === 'file') list.push({ key: 'versions', label: t('drive.details.versions') })
  list.push({ key: 'activity', label: t('drive.details.activity') })
  return list
})
watch(tabs, (list) => {
  if (!list.some((x) => x.key === tab.value)) tab.value = 'info'
})

// ---- Lazy data per tab ----
const access = ref<Access | null>(null)
const versions = ref<Version[] | null>(null)
const activity = ref<ActivityEvent[] | null>(null)
const fingerprint = ref('')
const loading = ref(false)
const failure = ref('')

async function loadTab() {
  const current = item.value
  failure.value = ''
  if (!current) return
  try {
    if (tab.value === 'access' && !access.value) {
      loading.value = true
      access.value = await driveApi.access(current.id)
    } else if (tab.value === 'encryption') {
      fingerprint.value = await keyFingerprint(current.record.wrapped_key)
      if (!access.value) {
        loading.value = true
        access.value = await driveApi.access(current.id)
      }
    } else if (tab.value === 'versions' && !versions.value) {
      loading.value = true
      versions.value = await driveApi.versions(current.id)
    } else if (tab.value === 'activity' && !activity.value) {
      loading.value = true
      activity.value = await driveApi.activity(current.id)
    }
  } catch (error) {
    failure.value = errorMessage(error)
  } finally {
    loading.value = false
  }
}

watch(
  () => item.value?.id,
  () => {
    access.value = null
    versions.value = null
    activity.value = null
    fingerprint.value = ''
    loadTab()
  },
)
watch(tab, loadTab)
onMounted(loadTab)

const location = computed(() => {
  if (!item.value?.parentId) return ''
  return drive.workspaces.value.find((w) => w.root.id === item.value!.parentId)?.name ?? drive.item(item.value.parentId)?.name ?? ''
})

const restoring = ref<string | null>(null)
async function restoreVersion(version: Version) {
  if (!item.value) return
  restoring.value = version.id
  try {
    const record = await driveApi.restoreVersion(item.value.id, version.id)
    await drive.absorb([record])
    versions.value = await driveApi.versions(item.value.id)
    toast.success(t('drive.details.versionRestored', { date: formatDateTime(version.created_at, locale.value) }))
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    restoring.value = null
  }
}

const activityIcon: Record<string, IconName> = {
  created: 'plus',
  uploaded: 'upload',
  renamed: 'pencil',
  moved: 'folder-move',
  shared: 'users',
  unshared: 'users',
  link_created: 'link',
  link_revoked: 'link',
  downloaded: 'download',
  trashed: 'trash',
  restored: 'restore',
  version_restored: 'history',
}
</script>

<template>
  <aside class="dpanel" :aria-label="t('drive.details.label')">
    <div class="dpanel__head">
      <h2 class="dpanel__title">{{ t('drive.details.label') }}</h2>
      <SgButton variant="ghost" size="sm" icon-only icon="x" :label="t('drive.details.close')" @click="emit('close')" />
    </div>

    <p v-if="!selected.length" class="dpanel__empty">{{ t('drive.details.none') }}</p>

    <div v-else-if="!item" class="dpanel__many">
      <p class="dpanel__name">{{ t('drive.selection.count', { n: selected.length }, selected.length) }}</p>
      <p class="dpanel__meta">
        {{ formatBytes(selected.reduce((sum, i) => sum + (i.kind === 'file' ? i.size : 0), 0), locale) }}
      </p>
    </div>

    <template v-else>
      <div class="dpanel__who">
        <span class="dpanel__icon" :class="`is-${item.type}`"><SgIcon :name="fileIcon(item.type)" :size="22" /></span>
        <div class="dpanel__id">
          <p class="dpanel__name"><bdi>{{ item.name ?? t('drive.item.unreadable') }}</bdi></p>
          <p class="dpanel__meta">{{ t(`drive.type.${item.type}`) }}<template v-if="item.kind === 'file'"> · {{ formatBytes(item.size, locale) }}</template></p>
        </div>
      </div>

      <SgTabs v-model="tab" :label="t('drive.details.label')" :tabs="tabs">
        <template #info>
          <dl class="facts-list">
            <div><dt>{{ t('drive.details.type') }}</dt><dd>{{ t(`drive.type.${item.type}`) }}</dd></div>
            <div v-if="item.kind === 'file'"><dt>{{ t('drive.column.size') }}</dt><dd>{{ formatBytes(item.size, locale) }}</dd></div>
            <div v-if="location"><dt>{{ t('drive.column.location') }}</dt><dd><bdi>{{ location }}</bdi></dd></div>
            <div><dt>{{ t('drive.column.owner') }}</dt><dd><bdi>{{ item.owner.name }}</bdi></dd></div>
            <div><dt>{{ t('drive.details.yourRole') }}</dt><dd>{{ t(`drive.share.roles.${item.role}`) }}</dd></div>
            <div><dt>{{ t('drive.details.created') }}</dt><dd>{{ formatDateTime(item.createdAt, locale) }}</dd></div>
            <div><dt>{{ t('drive.column.updated') }}</dt><dd>{{ formatDateTime(item.updatedAt, locale) }}</dd></div>
            <div><dt>{{ t('drive.details.sharing') }}</dt><dd>{{ item.shared ? t('drive.details.sharedYes') : t('drive.details.sharedNo') }}</dd></div>
          </dl>
        </template>

        <template #access>
          <SgSkeleton v-if="loading && !access" :lines="3" />
          <SgAlert v-else-if="failure" tone="danger">{{ failure }}</SgAlert>
          <div v-else-if="access" class="access">
            <ul>
              <li><SgAvatar :name="access.owner.name" :size="26" /><bdi>{{ access.owner.name }}</bdi><span>{{ t('drive.share.roles.owner') }}</span></li>
              <li v-for="member in access.members" :key="member.person.user_id">
                <SgAvatar :name="member.person.name" :size="26" /><bdi>{{ member.person.name }}</bdi><span>{{ t(`drive.share.roles.${member.role}`) }}</span>
              </li>
            </ul>
            <p class="dpanel__meta">{{ t('drive.details.links', { n: access.links.filter((l) => !l.revoked_at).length }, access.links.filter((l) => !l.revoked_at).length) }}</p>
            <SgButton v-if="item.role !== 'viewer'" size="sm" icon="users" @click="menu.run('share', [item.id])">{{ t('drive.details.manage') }}</SgButton>
          </div>
        </template>

        <template #encryption>
          <dl class="facts-list">
            <div><dt>{{ t('drive.details.algorithm') }}</dt><dd class="mono">AES-256-GCM</dd></div>
            <div v-if="item.kind === 'file'"><dt>{{ t('drive.details.chunks') }}</dt><dd>{{ t('drive.details.chunksValue') }}</dd></div>
            <div>
              <dt>{{ t('drive.details.copies') }}</dt>
              <dd>
                <template v-if="access">{{ t('drive.details.copiesValue', { n: 1 + access.members.length + access.links.filter((l) => !l.revoked_at).length }) }}</template>
                <SgSkeleton v-else width="80px" />
              </dd>
            </div>
            <div v-if="item.kind === 'file'">
              <dt>{{ t('drive.details.integrity') }}</dt>
              <dd>
                <span v-if="drive.verified.value[item.id]" class="dpanel__ok">
                  <SgIcon name="check-circle" :size="14" />{{ t('drive.details.verified', { when: formatWhen(drive.verified.value[item.id]!, locale) }) }}
                </span>
                <template v-else>{{ t('drive.details.notVerified') }}</template>
              </dd>
            </div>
          </dl>
          <SgFingerprint v-if="fingerprint" class="dpanel__fp" :value="fingerprint" :label="t('drive.details.fingerprint')" />
          <p class="dpanel__note">{{ item.kind === 'file' ? t('drive.details.fileNote') : t('drive.details.folderNote') }}</p>
        </template>

        <template #versions>
          <SgSkeleton v-if="loading && !versions" :lines="3" />
          <SgAlert v-else-if="failure" tone="danger">{{ failure }}</SgAlert>
          <ul v-else-if="versions" class="versions">
            <li v-for="version in versions" :key="version.id">
              <div>
                <p>{{ formatDateTime(version.created_at, locale) }}</p>
                <p class="dpanel__meta"><bdi>{{ version.created_by.name }}</bdi> · {{ formatBytes(version.size, locale) }}</p>
              </div>
              <span v-if="version.current" class="versions__current">{{ t('drive.details.current') }}</span>
              <SgButton
                v-else-if="item.role !== 'viewer'"
                size="sm"
                icon="restore"
                :loading="restoring === version.id"
                :loading-label="t('drive.details.restoring')"
                :disabled="restoring !== null && restoring !== version.id"
                @click="restoreVersion(version)"
              >
                {{ t('drive.action.restore') }}
              </SgButton>
            </li>
          </ul>
        </template>

        <template #activity>
          <SgSkeleton v-if="loading && !activity" :lines="4" />
          <SgAlert v-else-if="failure" tone="danger">{{ failure }}</SgAlert>
          <p v-else-if="activity && !activity.length" class="dpanel__meta">{{ t('drive.details.noActivity') }}</p>
          <ol v-else-if="activity" class="events">
            <li v-for="event in activity" :key="event.id">
              <SgIcon :name="activityIcon[event.action] ?? 'activity'" :size="15" />
              <div>
                <p>{{ t(`drive.activity.${event.action}`, { who: event.actor.name }) }}</p>
                <time class="dpanel__meta" :datetime="event.at">{{ formatWhen(event.at, locale) }}</time>
              </div>
            </li>
          </ol>
          <p class="dpanel__note">{{ t('drive.details.activityNote') }}</p>
        </template>
      </SgTabs>
    </template>
  </aside>
</template>

<style scoped>
.dpanel {
  display: grid;
  align-content: start;
  gap: var(--s-4);
  height: 100%;
  padding: var(--s-4);
  overflow-y: auto;
}

.dpanel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dpanel__title {
  margin: 0;
  font-size: var(--fs-md);
  font-weight: var(--fw-medium);
}

.dpanel__empty {
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--fg-2);
}

.dpanel__who {
  display: flex;
  align-items: center;
  gap: var(--s-3);
}

.dpanel__icon {
  display: inline-grid;
  place-items: center;
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-1);
  background: var(--surface-3);
  color: var(--fg-2);
}

.dpanel__icon.is-folder {
  color: var(--signal-text);
}

.dpanel__id {
  min-width: 0;
}

.dpanel__name {
  margin: 0;
  overflow-wrap: anywhere;
  font-weight: var(--fw-medium);
}

.dpanel__meta {
  margin: 0;
  font-size: var(--fs-xs);
  color: var(--fg-2);
}

.dpanel__note {
  margin: var(--s-4) 0 0;
  font-size: var(--fs-xs);
  color: var(--fg-2);
  line-height: var(--lh-read);
}

.dpanel__ok {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--success);
}

.dpanel__fp {
  margin-top: var(--s-4);
}

.facts-list {
  display: grid;
  gap: var(--s-3);
  margin: 0;
}

.facts-list div {
  display: grid;
  gap: 2px;
}

.facts-list dt {
  font-size: var(--fs-xs);
  color: var(--fg-2);
}

.facts-list dd {
  margin: 0;
  font-size: var(--fs-sm);
}

.access {
  display: grid;
  gap: var(--s-3);
}

.access ul,
.versions,
.events {
  display: grid;
  gap: var(--s-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.access li {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  font-size: var(--fs-sm);
}

.access li span:last-child {
  margin-inline-start: auto;
  font-size: var(--fs-xs);
  color: var(--fg-2);
}

.versions li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-3);
  padding-bottom: var(--s-2);
  border-bottom: 1px solid var(--rule-soft);
}

.versions p,
.events p {
  margin: 0;
  font-size: var(--fs-sm);
}

.versions__current {
  font-size: var(--fs-xs);
  color: var(--success);
}

.events li {
  display: flex;
  gap: var(--s-2);
}

.events .sg-icon {
  margin-top: 3px;
  color: var(--fg-2);
}
</style>
