// The recovery kit as a text file: the 24 numbered words, who it belongs to, and how to use it.
// Used at signup and when a kit is regenerated in Settings, so both files are the same.
export function useKitFile() {
  const { t } = useI18n()

  return function downloadKit(kit: { words: string[]; email: string; orgName?: string | null; created: string; recoverUrl: string }) {
    const lines = [
      `storageGo · ${t('signup.kit.sheet.title')}`,
      '',
      `${t('signup.kit.sheet.account')}: ${kit.email}`,
      ...(kit.orgName ? [`${t('signup.kit.sheet.organization')}: ${kit.orgName}`] : []),
      `${t('signup.kit.sheet.created')}: ${kit.created}`,
      '',
      ...kit.words.map((word, i) => `${String(i + 1).padStart(2, '0')}  ${word}`),
      '',
      t('signup.kit.sheet.howTitle'),
      `1. ${t('signup.kit.sheet.how1')} ${kit.recoverUrl}`,
      `2. ${t('signup.kit.sheet.how2')}`,
      `3. ${t('signup.kit.sheet.how3')}`,
      '',
      t('signup.kit.sheet.foot'),
      '',
    ]
    // \r\n so the file reads correctly in Windows Notepad too; BOM so Arabic opens as UTF-8.
    const blob = new Blob(['﻿', lines.join('\r\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'storageGo-recovery-kit.txt'
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}
