// Which items are selected in the list on screen, and which row has keyboard focus.
// The list tells the store which ids are visible, in order, so ranges and "select all" match
// exactly what the user sees.
export function useSelection() {
  const selected = useState<string[]>('drive:selected', () => [])
  const focused = useState<string | null>('drive:focused', () => null)
  const anchor = useState<string | null>('drive:anchor', () => null)
  const visible = useState<string[]>('drive:visible', () => [])

  function setVisible(ids: string[]) {
    visible.value = ids
    // Items that left the list (moved, trashed, another folder) can't stay selected.
    const kept = selected.value.filter((id) => ids.includes(id))
    if (kept.length !== selected.value.length) selected.value = kept
    if (focused.value && !ids.includes(focused.value)) focused.value = null
  }

  /** single: only this one · toggle: add/remove (Ctrl/⌘, checkbox) · range: from the anchor (Shift). */
  function select(id: string, mode: 'single' | 'toggle' | 'range' = 'single') {
    if (mode === 'range' && anchor.value && visible.value.includes(anchor.value)) {
      const from = visible.value.indexOf(anchor.value)
      const to = visible.value.indexOf(id)
      const [start, end] = from < to ? [from, to] : [to, from]
      selected.value = visible.value.slice(start, end + 1)
    } else if (mode === 'toggle') {
      selected.value = selected.value.includes(id) ? selected.value.filter((x) => x !== id) : [...selected.value, id]
      anchor.value = id
    } else {
      selected.value = [id]
      anchor.value = id
    }
    focused.value = id
  }

  function selectAll() {
    selected.value = [...visible.value]
  }

  function clear() {
    selected.value = []
    anchor.value = null
  }

  return { selected, focused, anchor, visible, setVisible, select, selectAll, clear }
}
