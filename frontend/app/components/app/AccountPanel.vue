<script setup lang="ts">
// Who is signed in, their settings, the theme and language preferences (only in the app, as
// small dropdowns), keyboard shortcuts and sign out. Shown in the top bar's account popover
// and, on phones, behind "Me" in the bottom bar.
const emit = defineEmits<{ done: [] }>()
const { t } = useI18n()
const { account } = useAccount()
const ui = useDriveUi()

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
        <button type="button" class="acct__link" @click="shortcuts">
          <SgIcon name="info" :size="16" />{{ t('app.account.shortcuts') }}
        </button>
      </li>
    </ul>

    <div class="acct__prefs">
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
