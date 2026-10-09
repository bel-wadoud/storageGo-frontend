<script setup lang="ts">
// The workspace's root folder.
definePageMeta({ layout: 'app', middleware: 'auth' })
const drive = useDrive()
const rootId = computed(() => drive.workspace.value?.root.id ?? null)
</script>

<template>
  <DriveFolderView v-if="rootId" :key="rootId" :folder-id="rootId" />
</template>
