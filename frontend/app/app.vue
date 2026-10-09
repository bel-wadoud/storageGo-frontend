<script setup lang="ts">
// <html lang> and <html dir> follow the active language (dir="rtl" for Arabic).
const head = useLocaleHead({ dir: true, lang: true, seo: false })
useHead(() => ({ htmlAttrs: head.value.htmlAttrs }))
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtWelcome />
    <SgToastHost />
  </div>
</template>
