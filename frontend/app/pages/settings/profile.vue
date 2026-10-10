<script setup lang="ts">
import { accountApi } from '~/services/api/account'

// Name, email, organization, and the key fingerprint colleagues compare when sharing.
definePageMeta({ layout: 'app', middleware: 'auth' })
const { t, locale } = useI18n()
const toast = useToast()
const online = useOnline()
const errorMessage = useErrorMessage()
const account = useAccountDetails()

const name = ref('')
const touched = ref(false)
const saving = ref(false)
const emailOpen = ref(false)
const fingerprint = ref('')

onMounted(async () => {
  await account.load()
  name.value = account.details.value?.name ?? ''
  try {
    fingerprint.value = await (await useCrypto()).identityFingerprint()
  } catch {
    // Shown as soon as the keys are available; nothing else depends on it.
  }
})

const details = computed(() => account.details.value)
const changed = computed(() => Boolean(details.value) && name.value.trim() !== details.value!.name)
const nameError = computed(() => {
  if (!touched.value) return ''
  if (!name.value.trim()) return t('signup.errors.name')
  if ([...name.value.trim()].length > 120) return t('settings.profile.errors.long')
  return ''
})

async function saveName() {
  touched.value = true
  if (nameError.value || !changed.value) return
  saving.value = true
  try {
    account.set(await accountApi.update({ name: name.value.trim() }))
    toast.success(t('settings.profile.saved'))
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <SettingsShell :title="t('settings.profile.title')" :lead="t('settings.profile.lead')">
    <div v-if="account.loading.value && !details" class="settings-loading" aria-busy="true"><SgSkeleton :lines="6" /></div>
    <SgAlert v-else-if="account.error.value && !details" tone="danger">
      {{ errorMessage(account.error.value) }}
      <template #actions>
        <SgButton size="sm" icon="refresh" @click="account.load(true)">{{ t('common.retry') }}</SgButton>
      </template>
    </SgAlert>

    <template v-else-if="details">
      <SettingsSection :title="t('settings.profile.name')" :description="t('settings.profile.nameHint')">
        <form class="row-form" novalidate @submit.prevent="saveName">
          <SgField :label="t('signup.fields.name')" :error="nameError">
            <SgInput v-model="name" autocomplete="name" :placeholder="t('placeholders.name')" :disabled="saving" @blur="touched = true" />
          </SgField>
          <SgButton
            type="submit"
            variant="primary"
            :loading="saving"
            :loading-label="t('settings.saving')"
            :disabled="!changed || !online"
            :disabled-reason="!online ? t('auth.offlineReason') : t('settings.noChanges')"
          >
            {{ t('settings.save') }}
          </SgButton>
        </form>
      </SettingsSection>

      <SettingsSection :title="t('settings.profile.email')" :description="t('settings.profile.emailHint')">
        <div class="value-row">
          <bdi class="value-row__value">{{ details.email }}</bdi>
          <SgButton icon="mail" :disabled="!online" :disabled-reason="t('auth.offlineReason')" @click="emailOpen = true">{{ t('settings.profile.changeEmail') }}</SgButton>
        </div>
      </SettingsSection>

      <SettingsSection v-if="details.kind === 'org'" :title="t('settings.profile.organization')" info="roles">
        <dl class="facts-grid">
          <div><dt>{{ t('signup.org.orgName') }}</dt><dd><bdi>{{ details.org_name }}</bdi></dd></div>
          <div><dt>{{ t('settings.profile.role') }}</dt><dd>{{ details.role === 'admin' ? t('settings.profile.roleAdmin') : t('settings.profile.roleMember') }}</dd></div>
        </dl>
        <p class="form__note">{{ details.role === 'admin' ? t('settings.profile.adminNote') : t('settings.profile.memberNote') }}</p>
      </SettingsSection>

      <SettingsSection :title="t('settings.profile.fingerprint')" :description="t('settings.profile.fingerprintHint')">
        <SgFingerprint v-if="fingerprint" :value="fingerprint" />
        <SgSkeleton v-else width="320px" />
      </SettingsSection>

      <SettingsSection :title="t('settings.profile.account')">
        <dl class="facts-grid">
          <div><dt>{{ t('settings.profile.since') }}</dt><dd>{{ formatDate(new Date(details.created_at), locale) }}</dd></div>
          <div><dt>{{ t('settings.profile.type') }}</dt><dd>{{ details.kind === 'org' ? t('app.workspace.org') : t('settings.profile.individual') }}</dd></div>
        </dl>
      </SettingsSection>

      <SettingsEmailDialog v-if="emailOpen" v-model:open="emailOpen" @changed="(next) => account.set(next)" />
    </template>
  </SettingsShell>
</template>
