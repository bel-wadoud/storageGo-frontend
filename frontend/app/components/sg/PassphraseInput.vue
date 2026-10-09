<script setup lang="ts">
import type { StrengthScore } from '~/utils/passphraseStrength'

// Attributes like `name` or `id` go to the real <input>; class and style stay on the wrapper.
defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    /** "new-password" when creating one (shows the strength meter), "current-password" to sign in. */
    autocomplete?: 'new-password' | 'current-password'
    placeholder?: string
    disabled?: boolean
    size?: 'md' | 'lg'
  }>(),
  { autocomplete: 'current-password', placeholder: undefined, size: 'md' },
)

const emit = defineEmits<{ strength: [score: StrengthScore] }>()
const model = defineModel<string>({ default: '' })
const { t } = useI18n()
const attrs = useAttrs()
const inputAttrs = computed(() => {
  const { class: _class, style: _style, ...rest } = attrs
  return rest
})

const visible = ref(false)
const capsLock = ref(false)
const showMeter = computed(() => props.autocomplete === 'new-password')
const score = computed(() => passphraseStrength(model.value))

watch(score, (value) => emit('strength', value), { immediate: true })

// Something is always lit while typing: 1 bar for "too weak", up to 4 for "strong".
const lit = (n: number) => Boolean(model.value) && n <= Math.min(score.value + 1, 4)

function trackCapsLock(event: KeyboardEvent) {
  if (typeof event.getModifierState === 'function') capsLock.value = event.getModifierState('CapsLock')
}
</script>

<template>
  <div class="sg-pass" :class="attrs.class" :style="attrs.style as string | undefined">
    <SgInput
      v-bind="inputAttrs"
      v-model="model"
      :type="visible ? 'text' : 'password'"
      :autocomplete="autocomplete"
      :placeholder="placeholder"
      :disabled="disabled"
      :size="size"
      dir="auto"
      autocapitalize="off"
      autocorrect="off"
      spellcheck="false"
      @keydown="trackCapsLock"
      @keyup="trackCapsLock"
      @blur="capsLock = false"
    >
      <template #suffix>
        <SgButton
          variant="ghost"
          size="sm"
          icon-only
          :icon="visible ? 'eye-off' : 'eye'"
          :label="visible ? t('passphrase.hide') : t('passphrase.show')"
          :pressed="visible"
          :disabled="disabled"
          @click="visible = !visible"
        />
      </template>
    </SgInput>

    <p v-if="capsLock" class="sg-pass__caps" role="status">
      <SgIcon name="alert" :size="14" />
      {{ t('passphrase.capsLock') }}
    </p>

    <div v-if="showMeter" class="sg-pass__meter">
      <div class="sg-pass__bars" aria-hidden="true">
        <i v-for="n in 4" :key="n" :class="{ on: lit(n), [`s${score}`]: lit(n) }" />
      </div>
      <p class="sg-pass__score" aria-live="polite">
        <template v-if="model">
          {{ t('passphrase.strength.label') }}: <strong :class="`s${score}`">{{ t(`passphrase.strength.${score}`) }}</strong>
        </template>
      </p>
    </div>
  </div>
</template>

<style scoped>
.sg-pass__caps {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: var(--s-2) 0 0;
  font-size: var(--fs-xs);
  color: var(--signal-text);
}

.sg-pass__meter {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  margin-top: var(--s-2);
}

.sg-pass__bars {
  display: grid;
  flex: 1;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
}

.sg-pass__bars i {
  height: 3px;
  border-radius: 2px;
  background: var(--surface-3);
  transition: background var(--dur-2) var(--ease);
}

.sg-pass__bars i.on.s0,
.sg-pass__bars i.on.s1 {
  background: var(--danger);
}

.sg-pass__bars i.on.s2 {
  background: var(--signal);
}

.sg-pass__bars i.on.s3,
.sg-pass__bars i.on.s4 {
  background: var(--success);
}

.sg-pass__score {
  min-width: 9em;
  margin: 0;
  font-size: var(--fs-xs);
  color: var(--fg-2);
  text-align: end;
}

.sg-pass__score strong.s0,
.sg-pass__score strong.s1 {
  color: var(--danger);
}

.sg-pass__score strong.s2 {
  color: var(--signal-text);
}

.sg-pass__score strong.s3,
.sg-pass__score strong.s4 {
  color: var(--success);
}
</style>
