// Where "Upload" puts files, and whether it can: the open folder when the user can add to it,
// the workspace root from the other pages (recent, shared…), never a view-only folder, never
// when storage is full. Used by the top bar, the bottom bar, the `u` shortcut and empty states.
export function useUploadTarget() {
  const { t } = useI18n()
  const drive = useDrive()
  const ui = useDriveUi()
  const transfers = useTransfers()

  const target = computed(() => {
    if (ui.currentFolderId.value) return ui.canAddHere.value ? ui.currentFolderId.value : null
    return drive.workspace.value?.root.id ?? null
  })

  const full = computed(() => {
    const quota = drive.quota.value
    return Boolean(quota && quota.used >= quota.limit)
  })

  /** Why uploading is blocked right now, or '' when it isn't. */
  const blocked = computed(() => {
    if (full.value) return t('drive.upload.full')
    if (ui.currentFolderId.value && !ui.canAddHere.value) return t('drive.upload.viewOnly')
    if (!target.value) return t('drive.upload.noTarget')
    return ''
  })

  function pick(folder: boolean) {
    if (blocked.value || !target.value) return
    const destination = target.value
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    if (folder) input.webkitdirectory = true
    input.addEventListener('change', () => {
      const files = [...(input.files ?? [])]
      if (!files.length) return
      if (folder) {
        // "Reports/2025/Bilan.pdf" → path ["Reports", "2025"], keeping the folder structure.
        transfers.uploadTree(
          files.map((file) => ({ path: (file.webkitRelativePath || file.name).split('/').slice(0, -1), file })),
          destination,
        )
      } else {
        transfers.upload(files, destination)
      }
    })
    input.click()
  }

  return { target, blocked, pickFiles: () => pick(false), pickFolder: () => pick(true) }
}
