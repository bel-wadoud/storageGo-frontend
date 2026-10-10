<script setup lang="ts">
// A file name that reads correctly in every direction (i18n-rtl.md, rule 3).
//  - Latin names ("Bilan_2025.pdf") are left to right, as they are.
//  - Arabic names keep their direction, and their trailing Latin/number part ("0457.pdf",
//    "2025.pdf") is kept together as one left-to-right unit. Without that, the bidi algorithm
//    splits it and "ملف المريض - 0457.pdf" shows as "ملف المريض - pdf.0457".
// Alignment always follows the page.
const props = defineProps<{ name: string }>()

const RTL = /[֐-ࣿיִ-﷿ﹰ-﻿]/

const parts = computed(() => {
  const name = props.name
  let last = -1
  for (let i = name.length - 1; i >= 0; i--) {
    if (RTL.test(name[i]!)) {
      last = i
      break
    }
  }
  if (last === -1 || last === name.length - 1) return { head: name, tail: '' }
  // Separators right after the Arabic part stay with it (" - ", "_").
  const rest = name.slice(last + 1)
  const lead = /^[\s\-_–—.,()]*/.exec(rest)![0]
  return { head: name.slice(0, last + 1) + lead, tail: rest.slice(lead.length) }
})
</script>

<template>
  <span class="sg-fname" dir="auto" :title="name">{{ parts.head }}<bdi v-if="parts.tail" dir="ltr">{{ parts.tail }}</bdi></span>
</template>

<style scoped>
.sg-fname {
  text-align: match-parent;
}
</style>
