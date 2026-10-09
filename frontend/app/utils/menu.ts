import type { IconName } from './icons'

/** One entry of an action menu (see SgActionMenu). */
export interface ActionItem {
  key: string
  label: string
  icon?: IconName
  danger?: boolean
  disabled?: boolean
  /** Why it's disabled (shown next to the item). */
  reason?: string
  /** Draws a rule above this item. */
  divider?: boolean
}
