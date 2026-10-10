<script setup lang="ts">
import { adminApi, type AdminMember, type Group } from '~/services/api/admin'

// Groups / departments (sitemap §5): sets of members to share with at once and to aim
// policies at. Deleting a group never deletes files; it removes what was shared with the group.
definePageMeta({ layout: 'app', middleware: ['auth', 'admin'] })
const { t, locale } = useI18n()
const toast = useToast()
const online = useOnline()
const errorMessage = useErrorMessage()

const groups = ref<Group[]>([])
const people = ref<AdminMember[]>([])
const loading = ref(true)
const failure = shallowRef<unknown>(null)

async function load() {
  loading.value = true
  failure.value = null
  try {
    const all: AdminMember[] = []
    let next: string | undefined
    do {
      const page = await adminApi.members({ status: 'active', cursor: next })
      all.push(...page.items)
      next = page.next_cursor ?? undefined
    } while (next && all.length < 5000)
    groups.value = await adminApi.groups()
    people.value = all
  } catch (error) {
    failure.value = error
  } finally {
    loading.value = false
  }
}
onMounted(load)

const collator = computed(() => new Intl.Collator(intlLocale(locale.value), { sensitivity: 'base', numeric: true }))
const sorted = computed(() => [...groups.value].sort((a, b) => collator.value.compare(a.name, b.name)))
const nameOf = (id: string) => people.value.find((p) => p.id === id)

const editing = ref<Group | null>(null)
const dialogOpen = ref(false)
function openDialog(group: Group | null) {
  editing.value = group
  dialogOpen.value = true
}
function saved(group: Group) {
  const known = groups.value.some((g) => g.id === group.id)
  groups.value = known ? groups.value.map((g) => (g.id === group.id ? group : g)) : [...groups.value, group]
  toast.success(known ? t('admin.groups.saved', { name: group.name }) : t('admin.groups.created', { name: group.name }))
}

const deleting = ref<Group | null>(null)
const deleteOpen = computed({ get: () => deleting.value !== null, set: (v) => !v && (deleting.value = null) })
async function remove() {
  const group = deleting.value!
  await adminApi.deleteGroup(group.id)
  groups.value = groups.value.filter((g) => g.id !== group.id)
  toast.success(t('admin.groups.deleted', { name: group.name }))
}
</script>

<template info="groups">
  <AdminShell :title="t('admin.groups.title')" :lead="t('admin.groups.lead')">
    <template #actions>
      <SgButton variant="primary" icon="plus" :disabled="!online || loading" :disabled-reason="!online ? t('auth.offlineReason') : t('common.pleaseWait')" @click="openDialog(null)">
        {{ t('admin.groups.new') }}
      </SgButton>
    </template>

    <SgAlert v-if="failure" tone="danger">
      {{ errorMessage(failure) }}
      <template #actions><SgButton size="sm" icon="refresh" @click="load">{{ t('common.retry') }}</SgButton></template>
    </SgAlert>
    <div v-else-if="loading" aria-busy="true"><SgSkeleton :lines="6" /></div>
    <SgEmptyState v-else-if="!groups.length" icon="users" :title="t('admin.groups.emptyTitle')" :description="t('admin.groups.empty')">
      <SgButton icon="plus" @click="openDialog(null)">{{ t('admin.groups.new') }}</SgButton>
    </SgEmptyState>

    <ul v-else class="item-list">
      <li v-for="group in sorted" :key="group.id">
        <SgIcon class="item-list__icon" name="users" :size="18" />
        <div class="item-list__main">
          <p class="item-list__title"><bdi>{{ group.name }}</bdi></p>
          <p class="item-list__meta">
            {{ t('admin.groups.count', { n: group.member_ids.length }, group.member_ids.length) }}<template v-if="group.description"> · <bdi>{{ group.description }}</bdi></template>
          </p>
          <p v-if="group.member_ids.length" class="grps__names">
            <bdi>{{ group.member_ids.slice(0, 4).map((id) => nameOf(id)?.name).filter(Boolean).join(', ') }}</bdi><template v-if="group.member_ids.length > 4"> {{ t('admin.groups.andMore', { n: group.member_ids.length - 4 }, group.member_ids.length - 4) }}</template>
          </p>
        </div>
        <div class="item-list__actions">
          <SgButton size="sm" icon="pencil" :disabled="!online" :disabled-reason="t('auth.offlineReason')" @click="openDialog(group)">{{ t('admin.groups.edit') }}</SgButton>
          <SgButton size="sm" variant="ghost" icon="trash" icon-only :label="t('admin.groups.deleteLabel', { name: group.name })" :disabled="!online" :disabled-reason="t('auth.offlineReason')" @click="deleting = group" />
        </div>
      </li>
    </ul>

    <AdminGroupDialog v-if="dialogOpen" v-model:open="dialogOpen" :group="editing" :people="people" @saved="saved" />

    <AdminConfirmDialog
      v-if="deleting"
      v-model:open="deleteOpen"
      :title="t('admin.groups.deleteTitle', { name: deleting.name })"
      :body="t('admin.groups.deleteBody')"
      :note="t('admin.groups.deleteNote')"
      :confirm-label="t('admin.groups.delete')"
      :busy-label="t('admin.groups.deleting')"
      :confirm-word="deleting.name"
      danger
      :run="remove"
    />
  </AdminShell>
</template>

<style scoped>
.grps__names {
  margin: 2px 0 0;
  font-size: var(--fs-xs);
  color: var(--fg-3);
}
</style>
