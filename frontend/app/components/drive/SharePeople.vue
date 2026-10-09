<script setup lang="ts">
import { CryptoError } from '~/services/crypto/types'
import { driveApi, type Access, type DirectoryEntry, type Member, type ShareRole } from '~/services/api/drive'
import type { DriveItem } from '~/composables/useDrive'

// Share with people in the organization (user-flows.md F5). The item key is sealed to the
// recipient's identity key on this device. If their key changed since the last share, sharing
// stops until the user confirms they checked the new fingerprint with that person.
const props = defineProps<{ item: DriveItem; access: Access }>()
const emit = defineEmits<{ change: [access: Access] }>()

const { t } = useI18n()
const toast = useToast()
const online = useOnline()
const errorMessage = useErrorMessage()
const drive = useDrive()
const { account } = useAccount()

const canManage = computed(() => props.item.role !== 'viewer')

// ---- Directory search (combobox) ----
const query = ref('')
const results = ref<DirectoryEntry[]>([])
const searching = ref(false)
const searchError = ref('')
const listOpen = ref(false)
const activeIndex = ref(-1)
const comboId = useId()
let timer: ReturnType<typeof setTimeout> | undefined
let searchToken = 0

const taken = computed(() => new Set([props.access.owner.user_id, ...props.access.members.map((m) => m.person.user_id), account.value?.user_id]))

watch(query, (value) => {
  clearTimeout(timer)
  searchError.value = ''
  activeIndex.value = -1
  if (value.trim().length < 2) {
    results.value = []
    listOpen.value = false
    return
  }
  timer = setTimeout(async () => {
    const token = ++searchToken
    searching.value = true
    try {
      const found = await driveApi.directory(value.trim())
      if (token !== searchToken) return
      results.value = found.filter((entry) => !taken.value.has(entry.person.user_id))
      listOpen.value = true
    } catch (error) {
      if (token === searchToken) searchError.value = errorMessage(error)
    } finally {
      if (token === searchToken) searching.value = false
    }
  }, 250)
})

// Leaving the field closes the list, after a click on an option had time to register.
function closeListSoon() {
  setTimeout(() => (listOpen.value = false), 150)
}

function onComboKey(event: KeyboardEvent) {
  if (!listOpen.value || !results.value.length) return
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeIndex.value = (activeIndex.value + 1) % results.value.length
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeIndex.value = (activeIndex.value - 1 + results.value.length) % results.value.length
  } else if (event.key === 'Enter' && activeIndex.value >= 0) {
    event.preventDefault()
    pick(results.value[activeIndex.value]!)
  } else if (event.key === 'Escape') {
    event.stopPropagation()
    listOpen.value = false
  }
}

// ---- Sharing ----
const recipient = shallowRef<DirectoryEntry | null>(null)
const role = ref<ShareRole>('viewer')
const sharing = ref(false)
const keyChanged = ref(false)
const verified = ref(false)
const shareError = ref('')

function pick(entry: DirectoryEntry) {
  recipient.value = entry
  query.value = ''
  results.value = []
  listOpen.value = false
  keyChanged.value = false
  verified.value = false
  shareError.value = ''
}

const roles = computed(() => [
  { value: 'viewer', label: t('drive.share.roles.viewer') },
  { value: 'editor', label: t('drive.share.roles.editor') },
])

async function share() {
  const entry = recipient.value
  if (!entry) return
  sharing.value = true
  shareError.value = ''
  try {
    const engine = await useCrypto()
    // After the user verified a changed key, the new key is accepted as the one to trust.
    const seen = keyChanged.value && verified.value ? null : entry.last_seen
    const grant = await engine.shareItem(props.item.id, entry.identity, role.value, seen)
    const member = await driveApi.share(grant)
    emit('change', { ...props.access, members: [...props.access.members, member] })
    drive.patch(props.item.id, { shared: true })
    toast.success(t('drive.share.shared', { name: entry.person.name }))
    recipient.value = null
    keyChanged.value = false
  } catch (error) {
    if (error instanceof CryptoError && error.code === 'SG_ERR_KEY_CHANGED') keyChanged.value = true
    else shareError.value = errorMessage(error)
  } finally {
    sharing.value = false
  }
}

// ---- Existing members ----
const busyMember = ref<string | null>(null)
const confirmRemove = ref<string | null>(null)

async function changeRole(member: Member, next: string) {
  const value = next as ShareRole
  if (value === member.role) return
  busyMember.value = member.person.user_id
  try {
    await driveApi.changeRole(props.item.id, member.person.user_id, value)
    emit('change', {
      ...props.access,
      members: props.access.members.map((m) => (m.person.user_id === member.person.user_id ? { ...m, role: value } : m)),
    })
    toast.success(t('drive.share.roleChanged', { name: member.person.name, role: t(`drive.share.roles.${value}`) }))
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    busyMember.value = null
  }
}

async function remove(member: Member) {
  busyMember.value = member.person.user_id
  try {
    await driveApi.unshare(props.item.id, member.person.user_id)
    const members = props.access.members.filter((m) => m.person.user_id !== member.person.user_id)
    emit('change', { ...props.access, members })
    if (!members.length && !props.access.links.some((l) => !l.revoked_at)) drive.patch(props.item.id, { shared: false })
    toast.success(t('drive.share.removed', { name: member.person.name }))
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    busyMember.value = null
    confirmRemove.value = null
  }
}
</script>

<template>
  <div class="people">
    <template v-if="canManage">
      <div class="combo">
        <SgField :label="t('drive.share.add')" :hint="searchError || undefined">
          <SgInput
            v-model="query"
            role="combobox"
            :aria-expanded="listOpen"
            :aria-controls="`${comboId}-list`"
            :aria-activedescendant="activeIndex >= 0 ? `${comboId}-opt-${activeIndex}` : undefined"
            aria-autocomplete="list"
            autocomplete="off"
            :placeholder="t('drive.share.addPlaceholder')"
            :disabled="!online"
            @keydown="onComboKey"
            @blur="closeListSoon"
          >
            <template #suffix>
              <SgSpinner v-if="searching" decorative size="sm" />
              <SgIcon v-else name="search" :size="16" />
            </template>
          </SgInput>
        </SgField>
        <ul v-show="listOpen" :id="`${comboId}-list`" class="combo__list" role="listbox" :aria-label="t('drive.share.add')">
          <li v-if="!results.length" class="combo__none" role="option" aria-disabled="true" aria-selected="false">{{ t('drive.share.noMatch') }}</li>
          <li
            v-for="(entry, index) in results"
            :id="`${comboId}-opt-${index}`"
            :key="entry.person.user_id"
            role="option"
            class="combo__option"
            :class="{ 'is-active': index === activeIndex }"
            :aria-selected="index === activeIndex"
            @mousedown.prevent="pick(entry)"
          >
            <SgAvatar :name="entry.person.name" :size="28" />
            <span class="combo__text">
              <bdi>{{ entry.person.name }}</bdi>
              <bdi class="combo__email">{{ entry.person.email }}</bdi>
            </span>
          </li>
        </ul>
      </div>

      <div v-if="recipient" class="pick">
        <div class="pick__who">
          <SgAvatar :name="recipient.person.name" :size="36" />
          <div class="pick__text">
            <p class="pick__name"><bdi>{{ recipient.person.name }}</bdi></p>
            <p class="pick__email"><bdi>{{ recipient.person.email }}</bdi></p>
          </div>
          <SgButton variant="ghost" size="sm" icon-only icon="x" :label="t('drive.share.cancelPick')" @click="recipient = null" />
        </div>
        <SgFingerprint :value="recipient.fingerprint" :label="t('drive.share.theirFingerprint')" />

        <SgAlert v-if="keyChanged" tone="warning" :title="t('drive.share.keyChangedTitle', { name: recipient.person.name })">
          <p>{{ t('drive.share.keyChanged', { name: recipient.person.name }) }}</p>
          <SgCheckbox v-model="verified" :label="t('drive.share.verified', { name: recipient.person.name })" />
        </SgAlert>

        <div class="pick__row">
          <SgField :label="t('drive.share.role')">
            <SgSelect v-model="role" :options="roles" :disabled="sharing" />
          </SgField>
          <SgButton
            variant="primary"
            icon="users"
            :loading="sharing"
            :loading-label="t('drive.share.sharing')"
            :disabled="!online || (keyChanged && !verified)"
            :disabled-reason="!online ? t('auth.offlineReason') : t('drive.share.verifyFirst')"
            @click="share"
          >
            {{ keyChanged ? t('drive.share.shareAnyway') : t('drive.share.share') }}
          </SgButton>
        </div>
        <SgAlert v-if="shareError" tone="danger">{{ shareError }}</SgAlert>
      </div>
    </template>
    <SgAlert v-else tone="info">{{ t('drive.reason.viewOnly', { owner: item.owner.name }) }}</SgAlert>

    <div class="members">
      <p class="members__title">{{ t('drive.share.hasAccess') }}</p>
      <ul>
        <li class="member">
          <SgAvatar :name="access.owner.name" :size="32" />
          <div class="member__text">
            <p class="member__name"><bdi>{{ access.owner.name }}</bdi></p>
            <p class="member__meta"><bdi>{{ access.owner.email }}</bdi></p>
          </div>
          <span class="member__role">{{ t('drive.share.roles.owner') }}</span>
        </li>
        <li v-for="member in access.members" :key="member.person.user_id" class="member" :aria-busy="busyMember === member.person.user_id || undefined">
          <SgAvatar :name="member.person.name" :size="32" />
          <div class="member__text">
            <p class="member__name"><bdi>{{ member.person.name }}</bdi></p>
            <p class="member__meta">
              <bdi>{{ member.person.email }}</bdi> · <span class="mono" dir="ltr">{{ member.fingerprint.split(' ').slice(0, 2).join(' ') }}…</span>
            </p>
            <p v-if="member.key_changed" class="member__warn">
              <SgIcon name="alert" :size="13" />{{ t('drive.share.memberKeyChanged') }}
            </p>
          </div>
          <template v-if="confirmRemove === member.person.user_id">
            <span class="member__confirm">{{ t('drive.share.removeConfirm') }}</span>
            <SgButton size="sm" variant="danger" :loading="busyMember === member.person.user_id" :loading-label="t('drive.share.removing')" @click="remove(member)">
              {{ t('drive.share.remove') }}
            </SgButton>
            <SgButton size="sm" variant="ghost" @click="confirmRemove = null">{{ t('common.cancel') }}</SgButton>
          </template>
          <template v-else-if="canManage">
            <SgSelect
              class="member__select"
              :model-value="member.role"
              :options="roles"
              :aria-label="t('drive.share.roleFor', { name: member.person.name })"
              :disabled="busyMember === member.person.user_id || !online"
              @update:model-value="(value) => changeRole(member, value)"
            />
            <SgButton
              variant="ghost"
              size="sm"
              icon-only
              icon="x"
              :label="t('drive.share.removeFor', { name: member.person.name })"
              :disabled="!online"
              :disabled-reason="t('auth.offlineReason')"
              @click="confirmRemove = member.person.user_id"
            />
          </template>
          <span v-else class="member__role">{{ t(`drive.share.roles.${member.role}`) }}</span>
        </li>
      </ul>
      <p class="members__note">{{ t('drive.share.recallNote') }}</p>
    </div>
  </div>
</template>

<style scoped>
.people {
  display: grid;
  gap: var(--s-5);
}

.combo {
  position: relative;
}

.combo__list {
  position: absolute;
  inset-inline: 0;
  top: calc(100% + 4px);
  z-index: 10;
  max-height: 240px;
  margin: 0;
  padding: 4px;
  overflow-y: auto;
  list-style: none;
  border: 1px solid var(--rule);
  border-radius: var(--radius-2);
  background: var(--surface);
  box-shadow: var(--shadow-pop);
}

.combo__option {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  padding: var(--s-2);
  border-radius: var(--radius-1);
  cursor: pointer;
}

.combo__option:hover,
.combo__option.is-active {
  background: var(--surface-2);
}

.combo__text {
  display: grid;
  font-size: var(--fs-sm);
}

.combo__email {
  font-size: var(--fs-xs);
  color: var(--fg-2);
}

.combo__none {
  padding: var(--s-3);
  font-size: var(--fs-sm);
  color: var(--fg-2);
}

.pick {
  display: grid;
  gap: var(--s-4);
  padding: var(--s-4);
  border: 1px solid var(--rule);
  border-radius: var(--radius-2);
  background: var(--surface-2);
}

.pick__who {
  display: flex;
  align-items: center;
  gap: var(--s-3);
}

.pick__text {
  flex: 1;
  min-width: 0;
}

.pick__name,
.pick__email {
  margin: 0;
}

.pick__name {
  font-weight: var(--fw-medium);
}

.pick__email {
  font-size: var(--fs-sm);
  color: var(--fg-2);
}

.pick__row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--s-3);
}

.pick__row > :first-child {
  flex: 1;
  min-width: 160px;
}

.members__title {
  margin: 0 0 var(--s-2);
  font-size: var(--fs-sm);
  font-weight: var(--fw-medium);
}

.members ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.member {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s-2) var(--s-3);
  padding: var(--s-2) 0;
  border-bottom: 1px solid var(--rule-soft);
}

.member__text {
  flex: 1;
  min-width: 140px;
}

.member__name,
.member__meta,
.member__warn {
  margin: 0;
}

.member__name {
  font-size: var(--fs-sm);
  font-weight: var(--fw-medium);
}

.member__meta {
  font-size: var(--fs-xs);
  color: var(--fg-2);
}

.member__warn {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: var(--fs-xs);
  color: var(--signal-text);
}

.member__role {
  font-size: var(--fs-sm);
  color: var(--fg-2);
}

.member__select {
  width: 140px;
}

.member__confirm {
  font-size: var(--fs-sm);
}

.members__note {
  margin: var(--s-3) 0 0;
  font-size: var(--fs-xs);
  color: var(--fg-2);
}
</style>
