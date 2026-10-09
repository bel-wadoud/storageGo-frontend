import { driveApi } from '~/services/api/drive'

// What the user can do to items. Changes show immediately (optimistic) and are rolled back
// with a message if the server refuses. Every action ends with something visible: the change
// itself, a toast (with Undo when possible), or an error that says what to do next.
export function useDriveActions() {
  const { t } = useI18n()
  const toast = useToast()
  const errorMessage = useErrorMessage()
  const drive = useDrive()
  const ui = useDriveUi()
  const selection = useSelection()
  const transfers = useTransfers()

  const label = (ids: string[]) =>
    ids.length === 1 ? (drive.item(ids[0]!)?.name ?? t('drive.item.unnamed')) : t('drive.count.items', { n: ids.length }, ids.length)

  /** Opens a folder, or previews a file (with the other files of the list for ← →). */
  function open(id: string, siblings: string[] = []) {
    const item = drive.item(id)
    if (!item) return
    if (item.trashedAt) return
    if (item.kind === 'folder') return navigateTo(`/drive/f/${encodeURIComponent(id)}`)
    const files = siblings.filter((x) => drive.item(x)?.kind === 'file')
    const list = files.includes(id) ? files : [id]
    ui.preview.value = { ids: list, index: list.indexOf(id) }
  }

  async function createFolder(parentId: string, name: string): Promise<string> {
    const engine = await useCrypto()
    const created = await engine.createFolder(parentId, name)
    const record = await driveApi.createFolder(created, created.id)
    drive.setName(record.id, name)
    await drive.absorb([record])
    drive.addToList(`folder:${parentId}`, record.id)
    selection.select(record.id)
    return record.id
  }

  async function rename(id: string, name: string) {
    const previous = drive.item(id)?.name ?? null
    const engine = await useCrypto()
    const { enc_name } = await engine.renameItem(id, name)
    drive.setName(id, name)
    try {
      const record = await driveApi.rename(id, enc_name)
      drive.patch(id, { enc_name: record.enc_name, updated_at: record.updated_at })
    } catch (error) {
      if (previous !== null) drive.setName(id, previous)
      throw error
    }
  }

  async function move(ids: string[], targetId: string) {
    const engine = await useCrypto()
    const moved: string[] = []
    try {
      for (const id of ids) {
        const item = drive.item(id)
        if (!item || item.parentId === targetId) continue
        const wrapped = await engine.rewrapForMove(id, item.kind === 'folder', targetId)
        const before = { parent_id: item.parentId, wrapped_key: item.record.wrapped_key }
        drive.patch(id, { parent_id: targetId, wrapped_key: wrapped })
        try {
          await driveApi.move(id, targetId, wrapped)
          drive.addToList(`folder:${targetId}`, id)
          moved.push(id)
        } catch (error) {
          drive.patch(id, before)
          throw error
        }
      }
      const target = drive.item(targetId)
      toast.success(t('drive.toast.moved', { what: label(moved.length ? moved : ids), where: target?.name ?? '' }))
    } catch (error) {
      toast.error(moved.length ? t('drive.toast.movedSome', { n: moved.length, reason: errorMessage(error) }) : errorMessage(error))
    }
  }

  /** Moves to Trash, with Undo. Trash keeps items 30 days (org policy can change it). */
  async function trash(ids: string[]) {
    if (!ids.length) return
    const now = new Date().toISOString()
    const what = label(ids)
    for (const id of ids) drive.patch(id, { trashed_at: now })
    selection.clear()
    try {
      await driveApi.trashItems(ids)
      const workspace = drive.workspaceId.value
      for (const id of ids) drive.addToList(`trash:${workspace}`, id)
      toast.success(t('drive.toast.trashed', { what }, ids.length), {
        action: { label: t('drive.action.undo'), onClick: () => restore(ids, true) },
      })
    } catch (error) {
      for (const id of ids) drive.patch(id, { trashed_at: null })
      toast.error(errorMessage(error))
    }
  }

  async function restore(ids: string[], undo = false) {
    const what = label(ids)
    const before = ids.map((id) => [id, drive.records.value[id]?.trashed_at ?? null] as const)
    for (const id of ids) drive.patch(id, { trashed_at: null })
    try {
      await driveApi.restoreItems(ids)
      for (const id of ids) {
        const parent = drive.records.value[id]?.parent_id
        if (parent) drive.addToList(`folder:${parent}`, id)
      }
      toast.success(undo ? t('drive.toast.undone') : t('drive.toast.restored', { what }, ids.length))
    } catch (error) {
      for (const [id, at] of before) drive.patch(id, { trashed_at: at })
      toast.error(errorMessage(error))
    }
  }

  /** Permanent: the dialog asked the user to type the count first (principle 3). */
  async function deleteForever(ids: string[]) {
    await driveApi.deleteForever(ids)
    const engine = await useCrypto()
    const next = { ...drive.records.value }
    for (const id of ids) {
      delete next[id]
      engine.forget(id)
    }
    drive.records.value = next
    selection.clear()
    toast.success(t('drive.toast.deleted', { n: ids.length }, ids.length))
  }

  async function toggleStar(id: string) {
    const item = drive.item(id)
    if (!item) return
    const starred = !item.starred
    drive.patch(id, { starred })
    try {
      await driveApi.setStarred(id, starred)
      if (starred) drive.addToList(`starred:${drive.workspaceId.value}`, id)
    } catch (error) {
      drive.patch(id, { starred: !starred })
      toast.error(errorMessage(error))
    }
  }

  function download(ids: string[]) {
    for (const id of ids) if (drive.item(id)?.kind === 'file') transfers.download(id)
  }

  function details(id: string) {
    selection.select(id)
    ui.toggleDetails(true)
  }

  return { open, createFolder, rename, move, trash, restore, deleteForever, toggleStar, download, details }
}
