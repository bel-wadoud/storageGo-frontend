// Single-letter shortcuts for the drive (accessibility.md). They never fire while typing in a
// field or when a dialog is open, and they can be turned off (WCAG 2.1.4).
//   /  search   u  upload   n  new folder   s  share   i  details   Del  move to Trash   ?  this list
const STORAGE_KEY = 'sg_shortcuts'

export function shortcutsEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
}

export function setShortcutsEnabled(on: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off')
  } catch {
    // Per-viewer preference only.
  }
}

export function useShortcuts(handlers: Partial<Record<'search' | 'upload' | 'newFolder' | 'share' | 'details' | 'trash' | 'help', () => void>>) {
  function onKey(event: KeyboardEvent) {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return
    const target = event.target as HTMLElement | null
    if (target?.closest('input, textarea, select, [contenteditable="true"], [role="menu"], [role="listbox"]')) return
    if (document.querySelector('dialog[open]')) return
    if (!shortcutsEnabled()) return

    const map: Record<string, keyof typeof handlers> = {
      '/': 'search',
      u: 'upload',
      n: 'newFolder',
      s: 'share',
      i: 'details',
      Delete: 'trash',
      '?': 'help',
    }
    const action = map[event.key]
    const handler = action && handlers[action]
    if (!handler) return
    event.preventDefault()
    handler()
  }

  onMounted(() => document.addEventListener('keydown', onKey))
  onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
}
