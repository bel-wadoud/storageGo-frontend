<script setup lang="ts">
// /status: the service status page is hosted apart from storageGo (so it stays up when we're
// down). This address sends there; the URL is set per environment (NUXT_PUBLIC_STATUS_URL).
const config = useRuntimeConfig()
await navigateTo(config.public.statusUrl, { external: true, redirectCode: 302 })
</script>

<template>
  <div />
</template>
