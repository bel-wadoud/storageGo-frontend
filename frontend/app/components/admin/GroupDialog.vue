<script setup lang="ts">
import { ApiError } from '~/services/api/client'
import { adminApi, type AdminMember, type Group } from '~/services/api/admin'

// Create or edit a group: its name, what it's for, and who is in it (searchable, because an
// organization can have hundreds of members).
const props = defineProps<{ group: Group | null; people: AdminMember[] }>()
const emit = defineEmits<{ saved: [group: Group] }>()
const open = defineModel<boolean>('open', { required: true })

const { t } = useI18n()
const online = useOnline()
const errorMessage = useErrorMessage()
const name = ref('')
const description = ref('')
const chosen = ref<string[]>([])
const filter = ref('')
const busy = ref(false)
const failure = ref('')
const nameError = ref('')
const touched = ref(false)

watch(open, (value) => {
  if (!value) return
  name.value = props.group?.name ?? ''
  description.value = props.group?.description ?? ''
  chosen.value = [...(props.group?.member_ids ?? [])]
  filter.value = ''
  failure.value = ''
  nameError.value = ''
  touched.value = false
}, { immediate: true })

const validation = computed(() => {
  if (!name.value.trim()) return t('admin.groups.errors.name')
  if ([...name.value.trim()].length > 60) return t('admin.groups.errors.long')
  return ''
})
watch(name, () => (nameError.value = ''))
const shownError = computed(() => nameError.value || (touched.value ? validation.value : ''))
const visible = computed(() => {
  const text = filter.value.trim().toLowerCase()
  return props.people.filter((m) => !text || `${m.name} ${m.email}`.toLowerCase().includes(text))
})

function toggle(id: string, on: boolean) {
  chosen.value = on ? [...chosen.value, id] : chosen.value.filter((x) => x !== id)
}

async function save() {
  touched.value = true
  if (validation.value) return
  busy.value = true
  failure.value = ''
  try {
    const change = { name: name.value.trim(), description: description.value.trim(), member_ids: chosen.value }
    const saved = props.group ? await adminApi.updateGroup(props.group.id, change) : await adminApi.createGroup(change)
    emit('saved', saved)
    open.value = false
  } catch (error) {
    if (error instanceof ApiError && error.fields?.name === 'taken') nameError.value = t('admin.groups.errors.taken')
    else failure.value = errorMessage(error)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <SgDialog v-model:open="open" :title="group ? t('admin.groups.editTitle', { name: group.name }) : t('admin.groups.newTitle')" :busy="busy">
    <form id="admin-group" class="grp" novalidate @submit.prevent="save">
      <SgField :label="t('admin.groups.name')" :error="shownError" required>
        <SgInput v-model="name" dir="auto" :placeholder="t('admin.groups.namePlaceholder')" :disabled="busy" @blur="touched = true" />
      </SgField>
      <SgField :label="t('admin.groups.description')" optional>
        <SgInput v-model="description" dir="auto" :placeholder="t('admin.groups.descriptionPlaceholder')" :disabled="busy" />
      </SgField>
      <fieldset class="grp__people">
        <legend>{{ t('admin.groups.people', { n: chosen.length }, chosen.length) }}</legend>
        <SgInput v-model="filter" type="search" :placeholder="t('admin.members.search')" :aria-label="t('admin.members.search')" :disabled="busy">
          <template #prefix><SgIcon name="search" :size="16" /></template>
        </SgInput>
        <div class="grp__list">
          <p v-if="!visible.length" class="form__note">{{ t('admin.members.emptyFiltered') }}</p>
          <SgCheckbox
            v-for="person in visible"
            :key="person.id"
            :model-value="chosen.includes(person.id)"
            :label="person.name || person.email"
            :description="person.name ? person.email : undefined"
            :disabled="busy"
            @update:model-value="(on) => toggle(person.id, on)"
          />
        </div>
      </fieldset>
      <SgAlert v-if="failure" tone="danger">{{ failure }}</SgAlert>
    </form>
    <template #footer>
      <SgButton :disabled="busy" :disabled-reason="t('common.pleaseWait')" @click="open = false">{{ t('common.cancel') }}</SgButton>
      <SgButton type="submit" form="admin-group" variant="primary" :loading="busy" :loading-label="t('settings.saving')" :disabled="!online" :disabled-reason="t('auth.offlineReason')">
        {{ group ? t('settings.save') : t('admin.groups.create') }}
      </SgButton>
    </template>
  </SgDialog>
</template>

<style scoped>
.grp {
  display: grid;
  gap: var(--s-4);
}

.grp__people {
  display: grid;
  gap: var(--s-3);
  margin: 0;
  padding: 0;
  border: 0;
  min-width: 0;
}

.grp__people legend {
  margin-bottom: var(--s-2);
  padding: 0;
  font-size: var(--fs-sm);
  font-weight: var(--fw-medium);
}

.grp__list {
  display: grid;
  gap: var(--s-3);
  max-height: 260px;
  padding: var(--s-3);
  overflow-y: auto;
  border: 1px solid var(--rule);
  border-radius: var(--radius-1);
}
</style>
