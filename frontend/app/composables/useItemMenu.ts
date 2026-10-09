import type { ActionItem } from '~/utils/menu'
import type { DriveItem } from '~/composables/useDrive'

// Which actions an item (or a selection) offers, with the reason when one isn't available,
// and what each action does. Row menus, the selection bar, the details panel, the preview and
// the keyboard shortcuts all use this, so the rules are the same everywhere.
export type ItemAction =
  | 'open'
  | 'download'
  | 'share'
  | 'link'
  | 'rename'
  | 'move'
  | 'star'
  | 'unstar'
  | 'details'
  | 'trash'
  | 'restore'
  | 'delete-forever'

export function useItemMenu() {
  const { t } = useI18n()
  const online = useOnline()
  const drive = useDrive()
  const ui = useDriveUi()
  const actions = useDriveActions()
  const selection = useSelection()

  const canEdit = (item: DriveItem) => item.role !== 'viewer'
  const readable = (item: DriveItem) => item.name !== null

  /** Menu for one item. In Trash, only Restore and Delete forever. */
  function menuFor(item: DriveItem): ActionItem[] {
    const offline = !online.value ? t('auth.offlineReason') : ''
    const noEdit = !canEdit(item) ? t('drive.reason.viewOnly', { owner: item.owner.name }) : ''
    const unreadable = !readable(item) ? t('drive.reason.unreadable') : ''
    if (item.trashedAt) {
      return [
        { key: 'restore', label: t('drive.action.restore'), icon: 'restore', disabled: Boolean(offline), reason: offline },
        { key: 'delete-forever', label: t('drive.action.deleteForever'), icon: 'trash', danger: true, divider: true, disabled: Boolean(offline || noEdit), reason: offline || noEdit },
      ]
    }
    const isFile = item.kind === 'file'
    const items: ActionItem[] = [
      {
        key: 'open',
        label: isFile ? t('drive.action.preview') : t('drive.action.open'),
        icon: isFile ? 'eye' : 'folder',
        disabled: Boolean(unreadable),
        reason: unreadable,
      },
    ]
    if (isFile) items.push({ key: 'download', label: t('drive.action.download'), icon: 'download', disabled: Boolean(offline || unreadable), reason: offline || unreadable })
    items.push(
      { key: 'share', label: t('drive.action.share'), icon: 'users', divider: true, disabled: Boolean(offline || noEdit || unreadable), reason: offline || noEdit || unreadable },
      { key: 'link', label: t('drive.action.link'), icon: 'link', disabled: Boolean(offline || noEdit || unreadable), reason: offline || noEdit || unreadable },
      { key: 'rename', label: t('drive.action.rename'), icon: 'pencil', divider: true, disabled: Boolean(offline || noEdit || unreadable), reason: offline || noEdit || unreadable },
      { key: 'move', label: t('drive.action.move'), icon: 'folder-move', disabled: Boolean(offline || noEdit || unreadable), reason: offline || noEdit || unreadable },
      item.starred
        ? { key: 'unstar', label: t('drive.action.unstar'), icon: 'star', disabled: Boolean(offline), reason: offline }
        : { key: 'star', label: t('drive.action.star'), icon: 'star', disabled: Boolean(offline), reason: offline },
      { key: 'details', label: t('drive.action.details'), icon: 'info' },
      { key: 'trash', label: t('drive.action.trash'), icon: 'trash', danger: true, divider: true, disabled: Boolean(offline || noEdit), reason: offline || noEdit },
    )
    return items
  }

  /** Actions offered for several selected items (the selection bar). */
  function bulkFor(items: DriveItem[]): { key: ItemAction; label: string; disabled: boolean; reason: string }[] {
    const offline = !online.value ? t('auth.offlineReason') : ''
    const someViewOnly = items.some((i) => !canEdit(i)) ? t('drive.reason.someViewOnly') : ''
    if (items.every((i) => i.trashedAt)) {
      return [
        { key: 'restore', label: t('drive.action.restore'), disabled: Boolean(offline), reason: offline },
        { key: 'delete-forever', label: t('drive.action.deleteForever'), disabled: Boolean(offline || someViewOnly), reason: offline || someViewOnly },
      ]
    }
    const files = items.filter((i) => i.kind === 'file')
    return [
      { key: 'download', label: t('drive.action.download'), disabled: Boolean(offline || !files.length), reason: offline || (!files.length ? t('drive.reason.noFiles') : '') },
      { key: 'move', label: t('drive.action.move'), disabled: Boolean(offline || someViewOnly), reason: offline || someViewOnly },
      { key: 'trash', label: t('drive.action.trash'), disabled: Boolean(offline || someViewOnly), reason: offline || someViewOnly },
    ]
  }

  function run(action: ItemAction | string, ids: string[]) {
    const first = ids[0]
    if (!first) return
    switch (action) {
      case 'open':
        return actions.open(first, selection.visible.value)
      case 'download':
        return actions.download(ids)
      case 'share':
        return ui.open({ kind: 'share', itemId: first, tab: 'people' })
      case 'link':
        return ui.open({ kind: 'share', itemId: first, tab: 'link' })
      case 'rename':
        return ui.open({ kind: 'rename', itemId: first })
      case 'move':
        return ui.open({ kind: 'move', itemIds: ids })
      case 'star':
      case 'unstar':
        return actions.toggleStar(first)
      case 'details':
        return actions.details(first)
      case 'trash':
        return actions.trash(ids.filter((id) => {
          const item = drive.item(id)
          return item && canEdit(item)
        }))
      case 'restore':
        return actions.restore(ids)
      case 'delete-forever':
        return ui.open({ kind: 'delete-forever', itemIds: ids })
    }
  }

  return { menuFor, bulkFor, run, canEdit }
}
