<script setup lang="ts">
import { signupApi } from '~/services/api/signup'
import type { OrgRecoveryResult } from '~/services/crypto/types'

definePageMeta({ layout: 'auth', middleware: 'signup', signupStep: 'org-recovery' })

const { t } = useI18n()
const toast = useToast()
const online = useOnline()
const errorMessage = useErrorMessage()
const { draft, update } = useSignup()

const coAdmin = ref('')
const requireTwo = ref(false)
const touched = ref(false)
const phase = ref<'idle' | 'key' | 'saving'>('idle')
const failure = ref('')
const locked = ref(false)

const coAdminValid = computed(() => isEmail(coAdmin.value))
const coAdminError = computed(() => {
  if (!coAdmin.value.trim() || !(touched.value || phase.value !== 'idle')) return ''
  if (!coAdminValid.value) return t('signup.errors.emailInvalid')
  if (normalizeEmail(coAdmin.value) === draft.value.email) return t('signup.orgRecovery.errors.self')
  return ''
})
// Two-admin approval only makes sense once there is a second admin.
watch(coAdminValid, (valid) => !valid && (requireTwo.value = false))

const busy = computed(() => phase.value !== 'idle')

onMounted(async () => {
  // The keys must still be unlocked in this tab to create and escrow the recovery key.
  if (!cryptoSupported()) return
  locked.value = !(await (await useCrypto()).isUnlocked())
})

// Made but not saved yet (network failure): a retry sends the same result with the same key.
const made = shallowRef<{ result: OrgRecoveryResult; idempotencyKey: string } | null>(null)

async function create() {
  touched.value = true
  failure.value = ''
  if (coAdminError.value) {
    nextTick(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
    return
  }
  try {
    if (!made.value) {
      phase.value = 'key'
      const engine = await useCrypto()
      made.value = { result: await engine.setupOrgRecovery(draft.value.orgId ?? ''), idempotencyKey: crypto.randomUUID() }
    }
    phase.value = 'saving'
    const { result, idempotencyKey } = made.value
    await signupApi.setupOrgRecovery(result.setup, result.admin_identity_by_org, requireTwo.value, idempotencyKey)

    let invited = false
    if (coAdmin.value.trim()) {
      try {
        const outcome = await signupApi.invite([{ email: normalizeEmail(coAdmin.value), role: 'admin' }])
        invited = outcome.sent.length > 0
      } catch (error) {
        // Recovery is set up; only the invitation failed. Say so, and let them invite later.
        toast.warning(t('signup.orgRecovery.inviteFailed', { reason: errorMessage(error) }))
      }
    }
    made.value = null
    toast.success(invited ? t('signup.orgRecovery.doneInvited', { email: normalizeEmail(coAdmin.value) }) : t('signup.orgRecovery.done'))
    update({ orgRecovery: 'done' })
    await navigateTo(SIGNUP_PATHS.invite, { replace: true })
  } catch (error) {
    failure.value = errorMessage(error)
  } finally {
    phase.value = 'idle'
  }
}

// Skipping is allowed but must be deliberate: it is the path to unrecoverable files.
const skipping = ref(false)
const skipUnderstood = ref(false)
watch(skipping, (open) => !open && (skipUnderstood.value = false))

function skip() {
  skipping.value = false
  update({ orgRecovery: 'skipped' })
  navigateTo(SIGNUP_PATHS.invite, { replace: true })
}
</script>

<template>
  <SignupShell
    step="org-recovery"
    :title="t('signup.orgRecovery.title', { org: draft.orgName })"
    :lead="t('signup.orgRecovery.lead')"
    info="orgRecovery"
  >
    <SignupKitLost v-if="locked" variant="keys" />

    <form v-else class="form" novalidate @submit.prevent="create">
      <ul class="facts">
        <li>
          <SgIcon name="key" :size="16" />
          <span>{{ t('signup.orgRecovery.fact1') }}</span>
        </li>
        <li>
          <SgIcon name="users" :size="16" />
          <span>{{ t('signup.orgRecovery.fact2') }}</span>
        </li>
        <li>
          <SgIcon name="alert" :size="16" />
          <span>{{ t('signup.orgRecovery.fact3') }}</span>
        </li>
      </ul>

      <SgField :label="t('signup.orgRecovery.coAdmin')" :hint="t('signup.orgRecovery.coAdminHint')" :error="coAdminError" optional info="keyHolder">
        <SgInput
          v-model="coAdmin"
          type="email"
          inputmode="email"
          autocomplete="off"
          :placeholder="t('placeholders.colleagueEmail')"
          dir="ltr"
          spellcheck="false"
          autocapitalize="off"
          :disabled="busy"
          @blur="touched = true"
        />
      </SgField>

      <div>
        <SgCheckbox
          v-model="requireTwo"
          :label="t('signup.orgRecovery.requireTwo')"
          :description="t('signup.orgRecovery.requireTwoHint')"
          :disabled="!coAdminValid || busy"
        />
        <p v-if="!coAdminValid" class="form__note">{{ t('signup.orgRecovery.requireTwoDisabled') }}</p>
      </div>

      <SgAlert v-if="failure" tone="danger">{{ failure }}</SgAlert>

      <div class="form__actions">
        <SgButton
          type="submit"
          variant="primary"
          size="lg"
          icon="key"
          :loading="busy"
          :loading-label="phase === 'saving' ? t('signup.orgRecovery.saving') : t('signup.orgRecovery.creating')"
          :disabled="!online"
          :disabled-reason="t('auth.offlineReason')"
        >
          {{ made ? t('common.retry') : t('signup.orgRecovery.submit') }}
        </SgButton>
        <SgButton variant="ghost" :disabled="busy" :disabled-reason="t('common.pleaseWait')" @click="skipping = true">
          {{ t('signup.orgRecovery.skip') }}
        </SgButton>
      </div>

      <div v-if="busy" aria-live="polite">
        <SgProgress :label="phase === 'saving' ? t('signup.orgRecovery.saving') : t('signup.orgRecovery.creating')" />
      </div>

      <details class="details">
        <summary>{{ t('signup.orgRecovery.detailsTitle') }}</summary>
        <p>{{ t('signup.orgRecovery.details') }}</p>
      </details>
    </form>

    <SgDialog v-model:open="skipping" :title="t('signup.orgRecovery.skipTitle')" size="sm">
      <p>{{ t('signup.orgRecovery.skipBody') }}</p>
      <SgCheckbox v-model="skipUnderstood" :label="t('signup.orgRecovery.skipUnderstood')" />
      <template #footer>
        <SgButton @click="skipping = false">{{ t('signup.orgRecovery.skipCancel') }}</SgButton>
        <SgButton variant="danger" :disabled="!skipUnderstood" :disabled-reason="t('signup.orgRecovery.skipReason')" @click="skip">
          {{ t('signup.orgRecovery.skipConfirm') }}
        </SgButton>
      </template>
    </SgDialog>
  </SignupShell>
</template>
