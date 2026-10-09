<script setup lang="ts">
// Acceptance of the Terms and the Privacy policy (Law 18-07 on personal data), required to sign up.
defineProps<{ error?: string }>()
const model = defineModel<boolean>({ default: false })
const { t } = useI18n()
</script>

<template>
  <div>
    <SgCheckbox v-model="model" :invalid="Boolean(error)" required>
      <i18n-t keypath="signup.terms.label" scope="global">
        <template #terms>
          <NuxtLink to="/legal/terms" target="_blank">{{ t('signup.terms.terms') }}</NuxtLink>
        </template>
        <template #privacy>
          <NuxtLink to="/legal/privacy" target="_blank">{{ t('signup.terms.privacy') }}</NuxtLink>
        </template>
      </i18n-t>
    </SgCheckbox>
    <p v-if="error" class="form__error" role="alert"><SgIcon name="alert" :size="14" />{{ error }}</p>
  </div>
</template>
