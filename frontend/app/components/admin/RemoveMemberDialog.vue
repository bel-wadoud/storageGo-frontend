<script setup lang="ts">
import { ApiError } from '~/services/api/client'
import { adminApi, type AdminMember } from '~/services/api/admin'

// Removing a member (user-flows.md F12): their files in the organization first go to the
// person the administrator picks. Removal stays blocked until someone is chosen, and is
// confirmed by typing the member's email. The last holders of the recovery key can't be removed.
const props = defineProps<{ member: AdminMember; candidates: AdminMember[] }>()
const emit = defineEmits<{ removed: [] }>()
const open = defineModel<boolean>('open', { required: true })

const { t, locale } = useI18n()
const online = useOnline()
const errorMessage = useErrorMessage()
const heir = ref('')
const typed = ref('')
const busy = ref(false)
const failure = ref('')

const options = computed(() =>
  props.candidates
    .filter((m) => m.id !== props.member.id && m.status === 'active')
    .map((m) => ({ value: m.id, label: `${m.name} · ${m.email}` })),
)
const heirName = computed(() => props.candidates.find((m) => m.id === heir.value)?.name ?? '')
const matches = computed(() => typed.value.trim().toLowerCase() === props.member.email.toLowerCase())
const blocked = computed(() => {
  if (!online.value) return t('auth.offlineReason')
  if (!heir.value) return t('admin.remove.pickFirst')
  if (!matches.value) return t('admin.confirm.typeFirst', { word: props.member.email })
  return ''
})

async function remove() {
  if (blocked.value) return
  busy.value = true
  failure.value = ''
  try {
    await adminApi.remove(props.member.id, heir.value)
    // Announce first: closing clears the parent's selection.
    emit('removed')
    open.value = false
  } catch (error) {
    failure.value =
      error instanceof ApiError && error.data?.reason === 'last_key_holder'
        ? t('admin.members.errors.lastKeyHolder')
        : error instanceof ApiError && error.data?.reason === 'self'
          ? t('admin.members.errors.self')
          : errorMessage(error)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <SgDialog v-model:open="open" :title="t('admin.remove.title', { name: member.name || member.email })" :busy="busy">
    <form id="admin-remove" class="rm" novalidate @submit.prevent="remove">
      <p class="rm__text">{{ t('admin.remove.body', { size: formatBytes(member.storage_used, locale) }) }}</p>
      <SgField :label="t('admin.remove.heir')" :hint="t('admin.remove.heirHint')" required>
        <SgSelect v-model="heir" :options="options" :placeholder="t('admin.remove.heirPlaceholder')" :disabled="busy" />
      </SgField>
      <SgAlert v-if="heir" tone="info">{{ t('admin.remove.heirNote', { name: heirName }) }}</SgAlert>
      <SgAlert v-if="member.holds_recovery_key" tone="warning">{{ t('admin.remove.holder') }}</SgAlert>
      <SgField :label="t('admin.confirm.type', { word: member.email })">
        <SgInput v-model="typed" dir="ltr" autocomplete="off" :placeholder="member.email" :disabled="busy" />
      </SgField>
      <SgAlert v-if="failure" tone="danger">{{ failure }}</SgAlert>
    </form>
    <template #footer>
      <SgButton :disabled="busy" :disabled-reason="t('common.pleaseWait')" @click="open = false">{{ t('common.cancel') }}</SgButton>
      <SgButton type="submit" form="admin-remove" variant="danger" :loading="busy" :loading-label="t('admin.remove.removing')" :disabled="Boolean(blocked)" :disabled-reason="blocked">
        {{ t('admin.remove.submit') }}
      </SgButton>
    </template>
  </SgDialog>
</template>

<style scoped>
.rm {
  display: grid;
  gap: var(--s-4);
}

.rm__text {
  margin: 0;
  color: var(--fg-2);
}
</style>
