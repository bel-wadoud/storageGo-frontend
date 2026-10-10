<script setup lang="ts">
import { authApi } from '~/services/api/auth'

// Signs out in two halves: the keys are wiped from this device's memory first (always works,
// even offline), then the session is closed on the server. If the server can't be reached,
// the device is still signed out and the page says so, with a retry.
definePageMeta({ layout: 'auth' })

const { t } = useI18n()
const errorMessage = useErrorMessage()
const { setAccount } = useAccount()

const state = ref<'working' | 'done' | 'partial'>('working')
const reason = ref('')

async function signOut() {
  state.value = 'working'
  await lockCrypto()
  setAccount(null)
  useAccountDetails().details.value = null
  useDrive().clear()
  useSelection().clear()
  useSignin().reset()
  useSignup().reset()
  try {
    await authApi.logout()
    state.value = 'done'
  } catch (error) {
    reason.value = errorMessage(error)
    state.value = 'partial'
  }
}

onMounted(signOut)
</script>

<template>
  <AuthShell
    :title="state === 'working' ? t('signout.working') : t('signout.title')"
    :lead="state === 'working' ? undefined : t('signout.lead')"
  >
    <div class="form">
      <div v-if="state === 'working'" aria-live="polite">
        <SgProgress :label="t('signout.working')" />
      </div>

      <SgAlert v-else-if="state === 'partial'" tone="warning" :title="t('signout.partialTitle')">
        {{ t('signout.partial') }} {{ reason }}
        <template #actions>
          <SgButton size="sm" icon="refresh" @click="signOut">{{ t('common.retry') }}</SgButton>
        </template>
      </SgAlert>

      <SgAlert v-else tone="success">{{ t('signout.done') }}</SgAlert>

      <div v-if="state !== 'working'" class="form__actions">
        <SgButton variant="primary" size="lg" icon-end="arrow-end" :to="SIGNIN_PATHS.email">{{ t('signout.signIn') }}</SgButton>
      </div>
    </div>
  </AuthShell>
</template>
