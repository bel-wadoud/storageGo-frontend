<script setup lang="ts">
import type { SignupStep } from '~/composables/useSignup'

// A signup step: the auth frame plus named progress ("Organization · Passphrase · Recovery ·
// Team", not "Step 3 of 7").
const props = defineProps<{
  step: SignupStep
  title: string
  lead?: string
  back?: string
  /** A circled "i" explaining a hard word (glossary key, see SgInfo). */
  info?: string
}>()

const { t } = useI18n()
const { draft } = useSignup()

const stages = computed(() => (draft.value.member ? MEMBER_STAGES : draft.value.kind ? SIGNUP_STAGES[draft.value.kind] : null))
const current = computed(() => stages.value?.findIndex((stage) => stage.steps.includes(props.step)) ?? 0)
</script>

<template>
  <AuthShell :title="title" :lead="lead" :back="back" :info="info">
    <template v-if="stages" #top>
      <SgSteps :steps="stages.map((stage) => t(`signup.stages.${stage.key}`))" :current="current" />
    </template>
    <template v-if="$slots.lead" #lead><slot name="lead" /></template>
    <slot />
  </AuthShell>
</template>
