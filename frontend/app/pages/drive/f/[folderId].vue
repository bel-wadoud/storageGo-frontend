<script setup lang="ts">
// Any folder, by id: /drive/f/{folderId}.
definePageMeta({ layout: 'app', middleware: 'auth' })
const route = useRoute()
const folderId = computed(() => String(route.params.folderId))
</script>

<template>
  <DriveFolderView :key="folderId" :folder-id="folderId" />
</template>
