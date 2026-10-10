<script setup lang="ts">
import { ApiError } from '~/services/api/client'
import { adminApi, type Group, type InviteOutcome, type MemberRole, type Seats } from '~/services/api/admin'

// Invite people (personas.md, Karim: "fast bulk invite"): paste addresses or import a CSV,
// pick the role and groups, and see the seats before sending. With no seats left, inviting
// is blocked with the way out (Billing), never a silent failure.
const props = defineProps<{ seats: Seats; groups: Group[]; domain: string }>()
const emit = defineEmits<{ sent: [outcome: InviteOutcome] }>()
const open = defineModel<boolean>('open', { required: true })

const MAX_INVITES = 500
const MAX_CSV_BYTES = 1024 * 1024

const { t, locale } = useI18n()
const toast = useToast()
const online = useOnline()
const errorMessage = useErrorMessage()

const list = ref('')
const role = ref<MemberRole>('member')
const chosen = ref<string[]>([])
const sending = ref(false)
const failure = ref('')
const result = ref<InviteOutcome | null>(null)
const picker = ref<HTMLInputElement | null>(null)

watch(open, (value) => {
  if (!value) return
  list.value = ''
  role.value = 'member'
  chosen.value = []
  failure.value = ''
  result.value = null
}, { immediate: true })

const parsed = computed(() => parseEmailList(list.value))
const free = computed(() => Math.max(0, props.seats.total - props.seats.used - props.seats.pending))
const outside = computed(() => (props.domain ? parsed.value.valid.filter((email) => !email.endsWith(`@${props.domain}`)) : []))
const roles = computed(() => [
  { value: 'member', label: t('admin.members.roles.member') },
  { value: 'admin', label: t('admin.members.roles.admin') },
])

const listError = computed(() => {
  if (parsed.value.invalid.length) return t('signup.invite.errors.invalid', { list: parsed.value.invalid.slice(0, 3).join(', ') }, parsed.value.invalid.length)
  if (parsed.value.valid.length > MAX_INVITES) return t('signup.invite.errors.tooMany', { max: formatNumber(MAX_INVITES, locale.value) })
  if (parsed.value.valid.length > free.value) return t('admin.invite.tooManySeats', { n: free.value }, free.value)
  return ''
})

const blocked = computed(() => {
  if (!online.value) return t('auth.offlineReason')
  if (!free.value) return t('admin.invite.noSeatsShort')
  if (!parsed.value.valid.length) return t('signup.invite.errors.none')
  if (listError.value) return t('signup.invite.errors.fixFirst')
  return ''
})

async function importCsv(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (file.size > MAX_CSV_BYTES) {
    toast.error(t('signup.invite.csvTooLarge'))
    return
  }
  try {
    const found = parseEmailList(await file.text())
    if (!found.valid.length) {
      toast.warning(t('signup.invite.csvEmpty', { name: file.name }))
      return
    }
    const before = new Set(parsed.value.valid)
    const added = found.valid.filter((email) => !before.has(email))
    list.value = [list.value.trim(), ...added].filter(Boolean).join('\n')
    toast.success(t('signup.invite.csvImported', { n: added.length, name: file.name }, added.length))
  } catch {
    toast.error(t('signup.invite.csvUnreadable', { name: file.name }))
  }
}

async function send() {
  if (blocked.value) return
  sending.value = true
  failure.value = ''
  try {
    const outcome = await adminApi.invite(parsed.value.valid.map((email) => ({ email, role: role.value, group_ids: chosen.value })))
    emit('sent', outcome)
    if (!outcome.skipped.length) {
      toast.success(t('admin.invite.sent', { n: outcome.sent.length }, outcome.sent.length))
      open.value = false
    } else {
      result.value = outcome
    }
  } catch (error) {
    failure.value =
      error instanceof ApiError && error.data?.reason === 'seats'
        ? t('admin.invite.tooManySeats', { n: Number(error.data.available ?? 0) }, Number(error.data.available ?? 0))
        : errorMessage(error)
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <SgDialog v-model:open="open" :title="t('admin.invite.title')" :description="t('admin.invite.lead')" :busy="sending">
    <!-- Sent, with some skipped -->
    <div v-if="result" class="inv">
      <SgAlert tone="success">{{ t('admin.invite.sent', { n: result.sent.length }, result.sent.length) }}</SgAlert>
      <div>
        <p class="inv__label">{{ t('admin.invite.skipped', { n: result.skipped.length }, result.skipped.length) }}</p>
        <ul class="inv__skipped">
          <li v-for="item in result.skipped" :key="item.email">
            <bdi dir="ltr">{{ item.email }}</bdi> · {{ t(`admin.invite.reasons.${item.reason}`) }}
          </li>
        </ul>
      </div>
    </div>

    <form v-else id="admin-invite" class="inv" novalidate @submit.prevent="send">
      <SgAlert v-if="!free" tone="warning" :title="t('admin.invite.noSeatsTitle')">
        {{ t('admin.invite.noSeats', { total: formatNumber(seats.total, locale) }) }}
        <template #actions><SgButton size="sm" to="/admin/billing#seats" @click="open = false">{{ t('admin.invite.addSeats') }}</SgButton></template>
      </SgAlert>

      <SgField :label="t('admin.invite.emails')" :hint="t('admin.invite.emailsHint')" :error="listError">
        <SgTextarea
          v-model="list"
          dir="ltr"
          :rows="4"
          :placeholder="t('signup.invite.placeholder', { domain: domain || 'example.dz' })"
          :disabled="sending || !free"
        />
      </SgField>
      <div class="inv__row">
        <p class="form__note">
          {{ t('admin.invite.count', { n: parsed.valid.length }, parsed.valid.length) }} ·
          {{ t('admin.invite.free', { n: free }, free) }}
        </p>
        <SgButton size="sm" variant="ghost" icon="upload" :disabled="sending || !free" :disabled-reason="t('admin.invite.noSeatsShort')" @click="picker?.click()">
          {{ t('signup.invite.csv') }}
        </SgButton>
        <input ref="picker" class="sr-only" type="file" accept=".csv,text/csv,text/plain" tabindex="-1" aria-hidden="true" @change="importCsv" />
        <SgInfo term="csv" />
      </div>
      <SgAlert v-if="outside.length" tone="info">{{ t('admin.invite.outside', { n: outside.length, domain }, outside.length) }}</SgAlert>

      <SgField :label="t('admin.invite.role')">
        <SgSelect v-model="role" :options="roles" :disabled="sending" />
      </SgField>
      <p v-if="role === 'admin'" class="form__note">{{ t('admin.invite.adminNote') }}</p>

      <fieldset v-if="groups.length" class="inv__groups">
        <legend>{{ t('admin.invite.groups') }}</legend>
        <SgCheckbox
          v-for="group in groups"
          :key="group.id"
          :model-value="chosen.includes(group.id)"
          :label="group.name"
          :disabled="sending"
          @update:model-value="(on) => (chosen = on ? [...chosen, group.id] : chosen.filter((id) => id !== group.id))"
        />
      </fieldset>

      <SgAlert v-if="failure" tone="danger">{{ failure }}</SgAlert>
    </form>

    <template #footer>
      <template v-if="result">
        <SgButton variant="primary" @click="open = false">{{ t('common.close') }}</SgButton>
      </template>
      <template v-else>
        <SgButton :disabled="sending" :disabled-reason="t('common.pleaseWait')" @click="open = false">{{ t('common.cancel') }}</SgButton>
        <SgButton type="submit" form="admin-invite" variant="primary" icon="mail" :loading="sending" :loading-label="t('signup.invite.sending')" :disabled="Boolean(blocked)" :disabled-reason="blocked">
          {{ parsed.valid.length ? t('admin.invite.submit', { n: parsed.valid.length }, parsed.valid.length) : t('admin.invite.submitNone') }}
        </SgButton>
      </template>
    </template>
  </SgDialog>
</template>

<style scoped>
.inv {
  display: grid;
  gap: var(--s-4);
}

.inv__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-2);
  margin-top: calc(-1 * var(--s-2));
}

.inv__row .form__note {
  margin: 0;
}

.inv__label {
  margin: 0 0 var(--s-2);
  font-weight: var(--fw-medium);
}

.inv__skipped {
  margin: 0;
  padding-inline-start: var(--s-5);
  font-size: var(--fs-sm);
  color: var(--fg-2);
}

.inv__groups {
  display: grid;
  gap: var(--s-2);
  margin: 0;
  padding: 0;
  border: 0;
}

.inv__groups legend {
  margin-bottom: var(--s-2);
  padding: 0;
  font-size: var(--fs-sm);
  font-weight: var(--fw-medium);
}
</style>
