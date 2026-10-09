import type { ItemRecord, Person, Quota, Role, Workspace } from '~/services/api/drive'
import { driveApi } from '~/services/api/drive'
import type { FileType } from '~/utils/fileType'

// The drive's state for this tab. Every item the app has seen is stored once, by id, with its
// name opened on this device; folder listings and the other lists (recent, starred, trash…)
// only hold ids. So a rename, a move or a star updates every list at once, and a rollback
// after a failed request puts everything back the same way.

export interface DriveItem {
  id: string
  kind: 'file' | 'folder'
  parentId: string | null
  /** The decrypted name, or null when it couldn't be opened. */
  name: string | null
  /** Why the name couldn't be opened (e.g. SG_ERR_AUTH: altered). */
  nameError: string | null
  type: FileType
  size: number
  createdAt: string
  updatedAt: string
  trashedAt: string | null
  owner: Person
  role: Role
  shared: boolean
  starred: boolean
  versions: number
  record: ItemRecord
}

export interface ListState {
  ids: string[]
  cursor: string | null
  loaded: boolean
  loading: boolean
  /** The last load's failure (shown with useErrorMessage by the list). Content loaded before stays. */
  error: unknown
  /** Epoch ms of the last successful load (lists are refreshed in the background after 30 s). */
  loadedAt: number
}

export type SortKey = 'name' | 'updated' | 'size'
export interface Sort {
  key: SortKey
  dir: 'asc' | 'desc'
}

const emptyList = (): ListState => ({ ids: [], cursor: null, loaded: false, loading: false, error: null, loadedAt: 0 })
let sortRestored = false
// One index load at a time per workspace, however many callers ask for it.
const indexLoads = new Map<string, Promise<void>>()

/** How long the search index is used before a background refresh (on the next search). */
const INDEX_MAX_AGE = 10 * 60_000

export function useDrive() {
  const records = useState<Record<string, ItemRecord>>('drive:records', () => ({}))
  const names = useState<Record<string, { name: string } | { error: string }>>('drive:names', () => ({}))
  const lists = useState<Record<string, ListState>>('drive:lists', () => ({}))
  const workspaces = useState<Workspace[]>('drive:workspaces', () => [])
  const workspaceId = useState<string | null>('drive:workspace', () => null)
  const quota = useState<Quota | null>('drive:quota', () => null)
  /** Files whose integrity was verified on this device (downloaded or previewed). */
  const verified = useState<Record<string, string>>('drive:verified', () => ({}))
  const sort = useState<Sort>('drive:sort', () => ({ key: 'name', dir: 'asc' }))

  const workspace = computed(() => workspaces.value.find((w) => w.id === workspaceId.value) ?? null)

  function toItem(record: ItemRecord): DriveItem {
    const opened = names.value[record.id]
    const name = opened && 'name' in opened ? opened.name : null
    return {
      id: record.id,
      kind: record.kind,
      parentId: record.parent_id,
      name,
      nameError: opened && 'error' in opened ? opened.error : null,
      type: fileType(name ?? '', record.kind),
      size: record.size,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
      trashedAt: record.trashed_at ?? null,
      owner: record.owner,
      role: record.role,
      shared: record.shared,
      starred: record.starred,
      versions: record.versions,
      record,
    }
  }

  function item(id: string): DriveItem | null {
    const record = records.value[id]
    return record ? toItem(record) : null
  }

  /** Keeps records (and the folders on their paths) and opens the names not opened yet. */
  async function absorb(incoming: ItemRecord[]): Promise<void> {
    const all: ItemRecord[] = []
    for (const record of incoming) {
      for (const ancestor of record.path ?? []) all.push(ancestor)
      all.push(record)
    }
    const next = { ...records.value }
    for (const record of all) {
      const { path: _path, ...rest } = record
      next[record.id] = { ...next[record.id], ...rest, path: record.path ?? next[record.id]?.path }
    }
    records.value = next
    const unopened = incoming.filter((record) => !names.value[record.id] || (record.path ?? []).some((a) => !names.value[a.id]))
    if (!unopened.length) return
    const engine = await useCrypto()
    const opened = await engine.openItems(unopened)
    const nextNames = { ...names.value }
    for (const entry of opened) nextNames[entry.id] = 'name' in entry ? { name: entry.name } : { error: entry.error }
    names.value = nextNames
  }

  /** Updates one record everywhere (optimistic changes and server answers). */
  function patch(id: string, change: Partial<ItemRecord>) {
    const current = records.value[id]
    if (current) records.value = { ...records.value, [id]: { ...current, ...change } }
  }

  function setName(id: string, name: string) {
    names.value = { ...names.value, [id]: { name } }
  }

  function list(key: string): ListState {
    return lists.value[key] ?? emptyList()
  }

  function setList(key: string, change: Partial<ListState>) {
    lists.value = { ...lists.value, [key]: { ...list(key), ...change } }
  }

  /** Puts a new item at the top of a loaded list (a folder just created, a file just uploaded). */
  function addToList(key: string, id: string) {
    const current = list(key)
    if (current.loaded && !current.ids.includes(id)) setList(key, { ids: [id, ...current.ids] })
  }

  /** Loads (or refreshes) a list. Previously loaded content stays visible while it reloads. */
  async function load(
    key: string,
    fetcher: (cursor: string | null) => Promise<{ items: ItemRecord[]; next_cursor: string | null }>,
    options: { more?: boolean; force?: boolean } = {},
  ) {
    const current = list(key)
    if (current.loading) return
    if (!options.more && !options.force && current.loaded && Date.now() - current.loadedAt < 30_000) return
    setList(key, { loading: true, error: null })
    try {
      const page = await fetcher(options.more ? current.cursor : null)
      await absorb(page.items)
      const ids = page.items.map((record) => record.id)
      setList(key, {
        ids: options.more ? [...current.ids, ...ids.filter((id) => !current.ids.includes(id))] : ids,
        cursor: page.next_cursor,
        loaded: true,
        loading: false,
        loadedAt: Date.now(),
      })
    } catch (error) {
      setList(key, { loading: false, error })
    }
  }

  /** A folder's listing, plus the folder itself (with its path, for breadcrumbs and permissions). */
  function loadFolder(id: string, options: { more?: boolean; force?: boolean } = {}) {
    return load(
      `folder:${id}`,
      async (cursor) => {
        const page = await driveApi.children(id, cursor)
        await absorb([page.folder])
        return page
      },
      options,
    )
  }

  /** Items in a loaded folder, in display order, without trashed ones. */
  function folderItems(id: string, locale: string): DriveItem[] {
    return sorted(
      list(`folder:${id}`)
        .ids.map((x) => records.value[x])
        .filter((r): r is ItemRecord => Boolean(r && r.parent_id === id && !r.trashed_at))
        .map(toItem),
      locale,
    )
  }

  /** Ids from the workspace root down to (and including) this item. */
  function ancestry(id: string): string[] {
    const record = records.value[id]
    if (!record) return [id]
    const fromPath = (record.path ?? []).map((a) => a.id)
    if (fromPath.length) return [...fromPath, id]
    const chain: string[] = [id]
    let parent = record.parent_id
    while (parent && records.value[parent] && !chain.includes(parent)) {
      chain.unshift(parent)
      parent = records.value[parent]!.parent_id
    }
    return chain
  }

  // ---- Search index ----
  // Names exist only on this device, so search runs here, over every item of the workspace:
  // the index is fetched once per session (pages of 1,000), names are opened in the worker, and
  // each keystroke only filters what's in memory. The server is never asked per keystroke.
  // Items created or uploaded here are added locally; a background refresh after 10 minutes
  // picks up what colleagues added, without the results flickering.
  function indexKey(workspace = workspaceId.value) {
    return `index:${workspace}`
  }

  function loadIndex(): Promise<void> {
    const workspace = workspaceId.value
    if (!workspace) return Promise.resolve()
    const key = indexKey(workspace)
    const current = list(key)
    if (current.loaded && Date.now() - current.loadedAt < INDEX_MAX_AGE) return Promise.resolve()
    const running = indexLoads.get(key)
    if (running) return running
    const firstLoad = !current.loaded
    const run = (async () => {
      setList(key, { loading: true, error: null })
      try {
        const ids: string[] = []
        let cursor: string | null = null
        do {
          const page = await driveApi.index(workspace, cursor)
          await absorb(page.items)
          ids.push(...page.items.map((record) => record.id))
          cursor = page.next_cursor
          // First load: results appear page by page. A refresh swaps the list once, at the end.
          if (firstLoad) setList(key, { ids: [...ids] })
        } while (cursor)
        const local = list(key).ids.filter((id) => !ids.includes(id) && records.value[id] && Date.parse(records.value[id]!.created_at) > current.loadedAt)
        setList(key, { ids: [...local, ...ids], cursor: null, loaded: true, loading: false, loadedAt: Date.now() })
      } catch (error) {
        setList(key, { loading: false, error })
      }
    })().finally(() => indexLoads.delete(key))
    indexLoads.set(key, run)
    return run
  }

  /** A new item (created or uploaded here) becomes searchable at once. */
  function addToIndex(id: string) {
    const parent = records.value[id]?.parent_id
    const workspace = (parent && workspaceOf(parent)?.id) || workspaceId.value
    addToList(indexKey(workspace), id)
  }

  // ---- Workspaces ----
  async function init() {
    if (workspaces.value.length) return
    const all = await driveApi.workspaces()
    // Each workspace root is opened first: everything else hangs below it.
    await absorb(all.map((w) => w.root))
    for (const w of all) if (!names.value[w.root.id] || 'error' in names.value[w.root.id]!) setName(w.root.id, w.name)
    workspaces.value = all
    let saved: string | null = null
    try {
      saved = localStorage.getItem('sg_workspace')
    } catch {
      // Per-viewer convenience only.
    }
    workspaceId.value = all.find((w) => w.id === saved)?.id ?? all.find((w) => w.kind === 'org')?.id ?? all[0]?.id ?? null
    await refreshQuota()
  }

  function switchWorkspace(id: string) {
    workspaceId.value = id
    try {
      localStorage.setItem('sg_workspace', id)
    } catch {
      // See above.
    }
    quota.value = null
    refreshQuota()
  }

  async function refreshQuota() {
    if (!workspaceId.value) return
    try {
      quota.value = await driveApi.quota(workspaceId.value)
    } catch {
      // The meter keeps its last value; nothing blocks on it.
    }
  }

  /** The workspace a folder belongs to (its path starts at a workspace root). */
  function workspaceOf(folderId: string): Workspace | null {
    const record = records.value[folderId]
    const rootId = record?.path?.[0]?.id ?? (record?.parent_id === null ? record.id : null)
    return workspaces.value.find((w) => w.root.id === rootId || w.root.id === folderId) ?? null
  }

  // ---- Sorting (folders first, then by the chosen column) ----
  function sorted(items: DriveItem[], locale: string, by: Sort = sort.value): DriveItem[] {
    const collator = new Intl.Collator(intlLocale(locale), { numeric: true, sensitivity: 'base' })
    const direction = by.dir === 'asc' ? 1 : -1
    return [...items].sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1
      if (by.key === 'size') return (a.size - b.size) * direction
      if (by.key === 'updated') return (Date.parse(a.updatedAt) - Date.parse(b.updatedAt)) * direction
      return collator.compare(a.name ?? '', b.name ?? '') * direction
    })
  }

  function setSort(next: Sort) {
    sort.value = next
    try {
      localStorage.setItem('sg_sort', JSON.stringify(next))
    } catch {
      // See above.
    }
  }

  if (import.meta.client && !sortRestored) {
    sortRestored = true
    try {
      const saved = JSON.parse(localStorage.getItem('sg_sort') ?? 'null') as Sort | null
      if (saved && ['name', 'updated', 'size'].includes(saved.key)) sort.value = saved
    } catch {
      // See above.
    }
  }

  /** Forgets everything (sign-out, account switch). */
  function clear() {
    records.value = {}
    names.value = {}
    lists.value = {}
    workspaces.value = []
    workspaceId.value = null
    quota.value = null
    verified.value = {}
  }

  return {
    records,
    names,
    workspaces,
    workspaceId,
    workspace,
    quota,
    verified,
    sort,
    toItem,
    item,
    absorb,
    patch,
    setName,
    list,
    setList,
    addToList,
    load,
    loadFolder,
    folderItems,
    indexKey,
    loadIndex,
    addToIndex,
    ancestry,
    init,
    switchWorkspace,
    refreshQuota,
    workspaceOf,
    sorted,
    setSort,
    clear,
  }
}
