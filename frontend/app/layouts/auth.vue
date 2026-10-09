<script setup lang="ts">
// Calm layout for signup, sign-in and recovery: one idea per screen, a readable measure,
// start-aligned. The footer carries the one fact every auth screen should state.
const { t } = useI18n()
const online = useOnline()
</script>

<template>
  <div class="auth">
    <header class="auth__header no-print">
      <SgLogo />
      <div class="auth__prefs">
        <SgLanguageSwitcher />
        <SgThemeToggle />
      </div>
    </header>

    <div v-if="!online" class="auth__offline no-print">
      <SgAlert tone="warning">{{ t('auth.offline') }}</SgAlert>
    </div>

    <main id="main" class="auth__main">
      <slot />
    </main>

    <footer class="auth__footer no-print">
      <p class="auth__fact">{{ t('auth.fact') }}</p>
      <nav class="auth__links" :aria-label="t('auth.legalNav')">
        <NuxtLink to="/legal/terms">{{ t('auth.terms') }}</NuxtLink>
        <NuxtLink to="/legal/privacy">{{ t('auth.privacy') }}</NuxtLink>
        <NuxtLink to="/security">{{ t('auth.security') }}</NuxtLink>
      </nav>
    </footer>
  </div>
</template>

<style scoped>
.auth {
  display: grid;
  grid-template-rows: auto auto 1fr auto;
  min-height: 100dvh;
  width: 100%;
  max-width: 1120px;
  margin-inline: auto;
  padding-inline: var(--s-4);
}

.auth__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-3);
  padding-block: var(--s-4);
  border-bottom: 1px solid var(--rule);
}

.auth__prefs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2);
}

.auth__offline {
  padding-top: var(--s-4);
}

.auth__main {
  width: 100%;
  max-width: 34rem;
  padding-block: var(--s-8) var(--s-9);
}

.auth__footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--s-3) var(--s-6);
  padding-block: var(--s-5);
  border-top: 1px solid var(--rule);
  font-size: var(--fs-xs);
  color: var(--fg-2);
}

.auth__fact {
  margin: 0;
  max-width: 60ch;
}

.auth__links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-4);
}

.auth__links a {
  color: var(--fg-2);
  text-decoration: underline;
  text-underline-offset: 3px;
  text-decoration-color: var(--rule);
  transition:
    color var(--dur-1) var(--ease),
    text-decoration-color var(--dur-1) var(--ease);
}

.auth__links a:hover {
  color: var(--fg);
  text-decoration-color: currentColor;
}

@media print {
  .auth {
    display: block;
    max-width: none;
    min-height: 0;
    padding: 0;
  }

  .auth__main {
    max-width: none;
    padding: 0;
  }
}

@media (min-width: 900px) {
  .auth {
    padding-inline: var(--s-7);
  }

  .auth__main {
    padding-block: var(--s-9) var(--s-10);
  }
}
</style>
