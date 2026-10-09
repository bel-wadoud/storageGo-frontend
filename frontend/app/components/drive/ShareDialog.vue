<script setup lang="ts">
import { driveApi, type Access } from '~/services/api/drive'

// Share: People (members of the organization) · Link (anyone with the link).
const props = defineProps<{ itemId: string; tab?: 'people' | 'link' }>()
const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const errorMessage = useErrorMessage()
const drive = useDrive()

const item = computed(() => drive.item(props.itemId))
const access = ref<Access | null>(null)
const loading = ref(false)
const failure = ref('')
const active = ref<'people' | 'link'>('people')

async function load() {
  loading.value = true
  failure.value = ''
  try {
    access.value = await driveApi.access(props.itemId)
  } catch (error) {
    failure.value = errorMessage(error)
  } finally {
    loading.value = false
  }
}

watch(
  open,
  (value) => {
    if (!value) return
    active.value = props.tab ?? 'people'
    access.value = null
    load()
  },
  { immediate: true },
)

const tabs = computed(() => [
  { key: 'people' as const, label: t('drive.share.people'), icon: 'users' as const, count: access.value?.members.length },
  {
    key: 'link' as const,
    label: t('drive.share.link'),
    icon: 'link' as const,
    count: access.value?.links.filter((l) => !l.revoked_at && (!l.expires_at || Date.parse(l.expires_at) > Date.now())).length,
  },
])
</script>

<template>
  <SgDialog v-model:open="open" :title="t('drive.share.title', { name: item?.name ?? '' })" size="lg">
    <div v-if="loading && !access" class="form" aria-busy="true">
      <SgSkeleton variant="block" height="40px" />
      <SgSkeleton :lines="3" />
    </div>
    <SgAlert v-else-if="failure" tone="danger">
      {{ failure }}
      <template #actions>
        <SgButton size="sm" icon="refresh" @click="load">{{ t('common.retry') }}</SgButton>
      </template>
    </SgAlert>
    <SgTabs v-else-if="access && item" v-model="active" :label="t('drive.share.tabs')" :tabs="tabs">
      <template #people>
        <DriveSharePeople :item="item" :access="access" @change="(next) => (access = next)" />
      </template>
      <template #link>
        <DriveShareLink :item="item" :access="access" @change="(next) => (access = next)" />
      </template>
    </SgTabs>
  </SgDialog>
</template>
