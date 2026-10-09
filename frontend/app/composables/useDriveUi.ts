// UI state shared across the app shell: which dialog is open, the file preview, the details
// panel, and the folder on screen (the target of "Upload" and "New folder" from anywhere).
export type DriveDialog =
  | { kind: 'new-folder'; parentId: string }
  | { kind: 'rename'; itemId: string }
  | { kind: 'move'; itemIds: string[] }
  | { kind: 'share'; itemId: string; tab?: 'people' | 'link' }
  | { kind: 'delete-forever'; itemIds: string[]; emptyTrash?: boolean }
  | { kind: 'request' }
  | { kind: 'shortcuts' }

export function useDriveUi() {
  const dialog = useState<DriveDialog | null>('drive:dialog', () => null)
  const preview = useState<{ ids: string[]; index: number } | null>('drive:preview', () => null)
  const detailsOpen = useState<boolean>('drive:details', () => false)
  const currentFolderId = useState<string | null>('drive:current-folder', () => null)
  /** The current folder can receive new items (not view-only, not trash/search). */
  const canAddHere = useState<boolean>('drive:can-add', () => false)
  /** Mobile navigation drawer. */
  const drawerOpen = useState<boolean>('drive:drawer', () => false)
  /** What's typed in the search field, shared with the search page so results follow each keystroke. */
  const searchQuery = useState<string>('drive:search-query', () => '')
  /** Phones: the search field is shown in the top bar. */
  const searchOpen = useState<boolean>('drive:search-open', () => false)

  function open(next: DriveDialog) {
    dialog.value = next
  }

  function close() {
    dialog.value = null
  }

  function toggleDetails(value = !detailsOpen.value) {
    detailsOpen.value = value
    try {
      localStorage.setItem('sg_details', value ? '1' : '0')
    } catch {
      // Per-viewer convenience only.
    }
  }

  return { dialog, preview, detailsOpen, currentFolderId, canAddHere, drawerOpen, searchQuery, searchOpen, open, close, toggleDetails }
}
