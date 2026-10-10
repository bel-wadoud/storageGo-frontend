<script setup lang="ts">
// Who is signed in, their settings, the theme and language preferences (only in the app, as
// small dropdowns), keyboard shortcuts and sign out. Shown in the top bar's account popover
// and, on phones, behind "Me" in the bottom bar. Every few months it also asks whether the
// user still has their recovery kit (key-model-ux.md: the kit only helps if it still exists).
import { accountApi } from '~/services/api/account'

const emit = defineEmits<{ done: [] }>()
const { t } = useI18n()
const { account } = useAccount()
const details = useAccountDetails()
const ui = useDriveUi()
const toast = useToast()
const errorMessage = useErrorMessage()

const confirming = ref(false)
async function stillHaveKit() {
  confirming.value = true
  try {
    const { kit_confirmed_at } = await accountApi.confirmKit()
    details.patch({ kit_confirmed_at, kit_reminder_due: false })
    toast.success(t('settings.kit.thanks'))
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    confirming.value = false
  }
}

function shortcuts() {
  emit('done')
  ui.open({ kind: 'shortcuts' })
}
</script>

<template>
  <div v-if="account" class="acct">
    <div class="acct__who">
      <SgAvatar :name="account.name" :size="40" />
      <div class="acct__text">
        <p class="acct__name"><bdi>{{ account.name }}</bdi></p>
        <p class="acct__meta"><bdi>{{ account.email }}</bdi></p>
        <p v-if="account.org_name" class="acct__meta"><bdi>{{ account.org_name }}</bdi></p>
      </div>
    </div>

    <div v-if="account.kit_reminder_due" class="acct__kit" role="group" :aria-label="t('app.account.kitTitle')">
      <p class="acct__kit-title"><SgIcon name="key" :size="16" />{{ t('app.account.kitTitle') }}</p>
      <p class="acct__kit-text">{{ t('app.account.kitText') }}</p>
      <div class="acct__kit-actions">
        <SgButton size="sm" variant="primary" :loading="confirming" :loading-label="t('settings.saving')" @click="stillHaveKit">
          {{ t('app.account.kitYes') }}
        </SgButton>
        <SgButton size="sm" variant="ghost" :disabled="confirming" to="/settings/security?kit=regenerate#kit" @click="emit('done')">
          {{ t('app.account.kitNew') }}
        </SgButton>
      </div>
    </div>

    <ul class="acct__links">
      <li>
        <NuxtLink to="/settings/profile" class="acct__link">
          <SgIcon name="user" :size="16" />{{ t('app.account.profile') }}
        </NuxtLink>
      </li>
      <li>
        <NuxtLink to="/settings/security" class="acct__link">
          <SgIcon name="key" :size="16" />{{ t('app.account.security') }}
        </NuxtLink>
      </li>
      <li>
        <NuxtLink to="/settings/notifications" class="acct__link">
          <SgIcon name="bell" :size="16" />{{ t('settings.nav.notifications') }}
        </NuxtLink>
      </li>
      <li>
        <NuxtLink to="/settings/plan" class="acct__link">
          <SgIcon name="sheet" :size="16" />{{ t('settings.nav.plan') }}
        </NuxtLink>
      </li>
      <li>
        <button type="button" class="acct__link" @click="shortcuts">
          <SgIcon name="info" :size="16" />{{ t('app.account.shortcuts') }}
        </button>
      </li>
    </ul>

    <div class="acct__prefs">
      <NuxtLink to="/settings/language" class="acct__more">{{ t('app.account.allDisplay') }}</NuxtLink>
      <div class="acct__pref">
        <span>{{ t('theme.label') }}</span>
        <SgThemeToggle />
      </div>
      <div class="acct__pref">
        <span>{{ t('language.label') }}</span>
        <SgLanguageSwitcher />
      </div>
    </div>

    <NuxtLink to="/signout" class="acct__link acct__signout">
      <SgIcon name="logout" :size="16" />{{ t('signin.unlock.signOut') }}
    </NuxtLink>
  </div>
</template>

<style scoped>
.acct {
  display: grid;
  padding: var(--s-2);
}

.acct__who {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  padding: var(--s-3);
}

.acct__text {
  min-width: 0;
}

.acct__name,
.acct__meta {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.acct__name {
  font-weight: var(--fw-medium);
}

.acct__meta {
  font-size: var(--fs-xs);
  color: var(--fg-2);
}

.acct__kit {
  display: grid;
  gap: var(--s-2);
  margin: 0 var(--s-1) var(--s-2);
  padding: var(--s-3);
  border: 1px solid var(--rule);
  border-radius: var(--radius-2);
  background: var(--surface-2);
}

.acct__kit-title {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  margin: 0;
  font-size: var(--fs-sm);
  font-weight: var(--fw-medium);
}

.acct__kit-text {
  margin: 0;
  font-size: var(--fs-xs);
  color: var(--fg-2);
}

.acct__kit-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2);
}

.acct__more {
  justify-self: end;
  order: 3;
  font-size: var(--fs-xs);
  color: var(--fg-2);
}

.acct__more:hover {
  color: var(--fg);
}

.acct__links {
  margin: 0;
  padding: var(--s-1) 0;
  list-style: none;
  border-block: 1px solid var(--rule);
}

.acct__link {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  width: 100%;
  min-height: 36px;
  padding: 0 var(--s-3);
  border: 0;
  border-radius: var(--radius-1);
  background: none;
  color: var(--fg);
  font: inherit;
  font-size: var(--fs-sm);
  text-align: start;
  text-decoration: none;
  cursor: pointer;
  transition: background-color var(--dur-1) var(--ease);
}

.acct__link:hover {
  background: var(--surface-2);
}

.acct__link:active {
  background: var(--surface-3);
}

.acct__prefs {
  display: grid;
  gap: var(--s-1);
  padding: var(--s-2) var(--s-3);
  border-bottom: 1px solid var(--rule);
}

.acct__pref {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--fs-sm);
  color: var(--fg-2);
}

.acct__signout {
  margin-top: var(--s-1);
}
</style>
