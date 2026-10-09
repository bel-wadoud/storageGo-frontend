<script setup lang="ts">
// The printed recovery kit: one page, black on white, like an official document.
// Only visible when printing (or "Save as PDF" in the print dialog); never sent anywhere.
defineProps<{ words: string[]; email: string; orgName?: string; created: string; recoverUrl: string }>()
const { t } = useI18n()
</script>

<template>
  <section class="sheet print-only" :aria-label="t('signup.kit.sheet.title')">
    <header class="sheet__head">
      <SgLogo :to="null" />
      <h1 class="sheet__title">{{ t('signup.kit.sheet.title') }}</h1>
    </header>

    <dl class="sheet__facts">
      <div>
        <dt>{{ t('signup.kit.sheet.account') }}</dt>
        <dd><bdi>{{ email }}</bdi></dd>
      </div>
      <div v-if="orgName">
        <dt>{{ t('signup.kit.sheet.organization') }}</dt>
        <dd><bdi>{{ orgName }}</bdi></dd>
      </div>
      <div>
        <dt>{{ t('signup.kit.sheet.created') }}</dt>
        <dd>{{ created }}</dd>
      </div>
    </dl>

    <SgWordGrid :words="words" />

    <div class="sheet__how">
      <h2>{{ t('signup.kit.sheet.howTitle') }}</h2>
      <ol>
        <li>
          {{ t('signup.kit.sheet.how1') }} <bdi class="mono">{{ recoverUrl }}</bdi>
        </li>
        <li>{{ t('signup.kit.sheet.how2') }}</li>
        <li>{{ t('signup.kit.sheet.how3') }}</li>
      </ol>
    </div>

    <p class="sheet__foot">{{ t('signup.kit.sheet.foot') }}</p>
  </section>
</template>

<style scoped>
.sheet {
  color: #000;
  background: #fff;
  font-size: 11pt;
  line-height: 1.5;
}

.sheet__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 10px;
  border-bottom: 1.5px solid #000;
}

.sheet__head :deep(.sg-logo),
.sheet__head :deep(.sg-logo b) {
  color: #000;
}

.sheet__title {
  margin: 0;
  font-size: 16pt;
  font-weight: 500;
}

.sheet__facts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 32px;
  margin: 14px 0 18px;
}

.sheet__facts dt {
  font-size: 9pt;
  color: #444;
}

.sheet__facts dd {
  margin: 0;
}

.sheet__how {
  margin-top: 20px;
}

.sheet__how h2 {
  margin: 0 0 6px;
  font-size: 12pt;
  font-weight: 500;
}

.sheet__how ol {
  margin: 0;
  padding-inline-start: 18px;
}

.sheet__foot {
  margin-top: 20px;
  padding-top: 10px;
  border-top: 1px solid #000;
  font-size: 9pt;
}
</style>
