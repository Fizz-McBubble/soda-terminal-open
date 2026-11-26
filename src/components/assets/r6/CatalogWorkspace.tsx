import { useEffect, useRef, useState } from 'react'
import { CatalogCard, DiscCard } from './Cards'
import { useReconciledSelection } from './state'
import type { SelectMenuOption } from './SelectMenu'
import { PlayerSelect } from '../../PlayerSelect'
import type { AssetGoldenProps, CatalogItem, CatalogKind, DiscItem } from './types'
import { preloadSelectedAgentAvatar } from '../../selectedAgentAvatarPreload'
import { DiscWorkspaceModeSwitch } from '../../DiscWorkspaceModeSwitch'
import { DiscBulkDeleteDialog } from './DiscBulkDeleteDialog'
import { CatalogPagination } from './CatalogPagination'
import {
  useCatalogBrowseState,
  useCatalogBrowseScroll,
  useCatalogBrowseSizing,
} from './useCatalogBrowseState'
import { matchesAgentSearchQuery } from '../../../application/agentSearchAliases'
import { useCatalogPagination } from './useCatalogPagination'
import { useStateTransitionMotion } from '../../../motion/useStateTransitionMotion'
import type { DiscSortMode } from '../../../domain/discOrdering'
import {
  discWorkspacePath,
  factsLabel,
  incomingDiscSelection,
  isOwned,
  specialtyLabel,
} from './catalogWorkspaceHelpers'
import { sortDiscs } from './catalogWorkspaceDiscOrder'
import { CatalogWorkspaceFilterBar } from './CatalogWorkspaceFilterBar'
import { CatalogWorkspaceEditorAside } from './CatalogWorkspaceEditorAside'

const columns: Record<CatalogKind, number> = { agents: 9, wengines: 10, bangboos: 10, discs: 10 }

export function CatalogWorkspace({ props, kind }: { props: AssetGoldenProps; kind: CatalogKind }) {
  const browseKey = `assets:${props.accountId}:${kind}`
  const [discSortMode, setDiscSortMode] = useCatalogBrowseState<
    Exclude<DiscSortMode, 'development'>
  >(browseKey, 'sort', 'game')
  const rows = kind === 'discs' ? sortDiscs(props.discs, discSortMode) : props.catalog[kind]
  const ids = rows.map((row) => row.stableId)
  const discSearch = new URLSearchParams(window.location.search)
  const incomingDiscId =
    incomingDiscSelection(kind, props.accountId, window.location.search) ??
    (kind === 'discs' && !discSearch.has('account')
      ? (discSearch.get('selected') ?? undefined)
      : undefined)
  const incomingCatalogId =
    (kind === 'agents' || kind === 'wengines') &&
    (!discSearch.has('account') || discSearch.get('account') === props.accountId)
      ? (discSearch.get('selected') ?? undefined)
      : undefined
  const [savedSelection, saveSelection] = useCatalogBrowseState<string | undefined>(
    browseKey,
    'selection',
    undefined,
  )
  const [selectedId, setSelectedId] = useReconciledSelection(
    ids,
    incomingDiscId ?? incomingCatalogId ?? savedSelection ?? props.initialSelection?.[kind],
  )
  useEffect(() => saveSelection(selectedId), [selectedId, saveSelection])
  const [query, setQuery] = useCatalogBrowseState(browseKey, 'query', '')
  const [statusFilter, setStatusFilter] = useCatalogBrowseState(browseKey, 'statusFilter', 'all')
  const [primaryFilter, setPrimaryFilter] = useCatalogBrowseState(browseKey, 'primaryFilter', 'all')
  const [secondaryFilter, setSecondaryFilter] = useCatalogBrowseState(
    browseKey,
    'secondaryFilter',
    'all',
  )
  const [bulk, setBulk] = useState(false)
  const [selectedDiscs, setSelectedDiscs] = useState<Set<string>>(new Set())
  const [pendingDelete, setPendingDelete] = useState<Array<{ stableId: string; revision: string }>>(
    [],
  )
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const editorRef = useRef<HTMLElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const currentSelectedDiscs = new Set([...selectedDiscs].filter((id) => ids.includes(id)))

  const revealEditorOnNarrowScreen = () => {
    if (kind === 'discs') return
    if (typeof window.matchMedia !== 'function' || !window.matchMedia('(max-width: 960px)').matches)
      return
    window.requestAnimationFrame(() => editorRef.current?.scrollIntoView({ block: 'start' }))
  }

  const selectCatalogItem = (item: CatalogItem) => {
    if (kind !== 'agents' || item.stableId === selectedId) {
      setSelectedId(item.stableId)
      revealEditorOnNarrowScreen()
      return
    }
    setSelectedId(item.stableId)
    props.onSelectAgent?.(item.stableId)
    revealEditorOnNarrowScreen()
  }
  useEffect(() => {
    if (kind !== 'agents' || !selectedId) return
    void preloadSelectedAgentAvatar(selectedId, 'assets.editor')
  }, [kind, selectedId])
  const gridRef = useRef<HTMLDivElement>(null)
  const splitRef = useRef<HTMLDivElement>(null)
  useCatalogBrowseSizing(kind, splitRef, gridRef)
  useCatalogBrowseScroll(browseKey, gridRef)
  const deleteDialogRef = useRef<HTMLDialogElement>(null)
  const primaryOptions = [
    ...new Set(
      rows.map((row) =>
        kind === 'discs' ? (row as DiscItem).set.playerName : ((row as CatalogItem).rarity ?? ''),
      ),
    ),
  ].filter(Boolean)
  const secondaryOptions = [
    ...new Set(
      rows.map((row) =>
        kind === 'discs' ? String((row as DiscItem).slot) : ((row as CatalogItem).specialty ?? ''),
      ),
    ),
  ].filter(Boolean)
  const statusOptions: SelectMenuOption[] =
    kind === 'discs'
      ? [
          { value: 'all', label: '全部使用状态' },
          { value: 'equipped', label: '当前装备' },
          { value: 'planned', label: '已保存方案' },
          { value: 'unprotected', label: '暂无使用记录' },
        ]
      : [
          {
            value: 'all',
            label: kind === 'wengines' ? '全部使用状态' : '全部拥有状态',
          },
          { value: 'owned', label: kind === 'wengines' ? '当前使用' : '已拥有' },
          {
            value: 'unowned',
            label: kind === 'wengines' ? '暂无使用记录' : '未拥有',
          },
        ]
  const primaryFilterOptions: SelectMenuOption[] = [
    { value: 'all', label: `全部${kind === 'discs' ? '套装' : '稀有度'}` },
    ...primaryOptions.map((value) => ({ value, label: value })),
  ]
  const secondaryFilterOptions: SelectMenuOption[] = [
    {
      value: 'all',
      label: `全部${kind === 'discs' ? '号位' : kind === 'bangboos' ? '类型' : '特性'}`,
    },
    ...secondaryOptions.map((value) => ({
      value,
      label: kind === 'discs' ? `${value}号位` : specialtyLabel(value),
    })),
  ]
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const clearFilters = () => {
    setQuery('')
    setStatusFilter('all')
    setPrimaryFilter('all')
    setSecondaryFilter('all')
  }
  const showSelectedInList = () => {
    clearFilters()
    pagination.reveal(
      rows.findIndex((row) => row.stableId === selectedId),
      JSON.stringify(['', 'all', 'all', 'all', discSortMode]),
    )
    window.requestAnimationFrame(() => {
      const card = gridRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')
      card?.focus()
      card?.scrollIntoView?.({ block: 'nearest' })
    })
  }
  const filtered = rows.filter((row) => {
    const item = row as CatalogItem | DiscItem
    const name =
      kind === 'discs' ? (item as DiscItem).set.playerName : (item as CatalogItem).playerName
    const statusMatches =
      statusFilter === 'all' ||
      (kind === 'discs'
        ? statusFilter === 'unprotected'
          ? (item as DiscItem).protections.every((protection) => protection === 'locked')
          : (item as DiscItem).protections.includes(statusFilter as DiscItem['protections'][number])
        : statusFilter ===
          (isOwned(props, kind, (item as CatalogItem).stableId) ? 'owned' : 'unowned'))
    const primaryMatches =
      primaryFilter === 'all' ||
      primaryFilter ===
        (kind === 'discs' ? (item as DiscItem).set.playerName : (item as CatalogItem).rarity)
    const secondaryMatches =
      kind === 'bangboos' ||
      secondaryFilter === 'all' ||
      secondaryFilter ===
        (kind === 'discs' ? String((item as DiscItem).slot) : (item as CatalogItem).specialty)
    const queryMatches =
      kind === 'agents'
        ? matchesAgentSearchQuery((item as CatalogItem).stableId, name, normalizedQuery)
        : (kind === 'discs'
            ? [
                name,
                (item as DiscItem).mainStat,
                String((item as DiscItem).slot),
                ...(item as DiscItem).tags,
              ].join(' ')
            : name
          )
            .toLocaleLowerCase()
            .includes(normalizedQuery)
    return queryMatches && statusMatches && primaryMatches && secondaryMatches
  })
  const selected = rows.find((row) => row.stableId === selectedId)
  const pagination = useCatalogPagination(
    filtered,
    JSON.stringify([query, statusFilter, primaryFilter, secondaryFilter, discSortMode]),
    selectedId,
    gridRef,
    columns[kind],
    browseKey,
  )
  const kindLabel = {
    agents: '代理人',
    wengines: '音擎',
    bangboos: '邦布',
    discs: '驱动盘',
  }[kind]
  const selectedLabel = selected
    ? kind === 'discs'
      ? `${(selected as DiscItem).set.playerName} · ${(selected as DiscItem).slot}号位`
      : (selected as CatalogItem).playerName
    : undefined
  const selectedMeta = selected
    ? kind === 'discs'
      ? `${(selected as DiscItem).mainStat} · 强化${(selected as DiscItem).level}`
      : [
          (selected as CatalogItem).rarity ? `${(selected as CatalogItem).rarity}级` : null,
          kind === 'bangboos'
            ? '邦布'
            : (selected as CatalogItem).specialty
              ? specialtyLabel((selected as CatalogItem).specialty!)
              : null,
        ]
          .filter(Boolean)
          .join(' · ') || undefined
    : undefined
  useStateTransitionMotion({
    scope: editorRef,
    stateKey: selectedId ?? 'none',
    target: '[data-motion-state-content]',
    transition: 'content',
  })
  const openDeleteDialog = () => {
    const dialog = deleteDialogRef.current
    if (typeof dialog?.showModal === 'function') dialog.showModal()
    else setDeleteDialogOpen(true)
  }
  const closeDeleteDialog = () => {
    const dialog = deleteDialogRef.current
    if (typeof dialog?.close === 'function') dialog.close()
    else setDeleteDialogOpen(false)
    setPendingDelete([])
  }
  return (
    <>
      <div
        ref={splitRef}
        className={`split ${kind === 'discs' ? 'split--disc-browse' : 'split--catalog-browse'}`}
      >
        <section className="catalog">
          <header className="section-head">
            <div>
              <h1>
                {{ agents: '代理人', wengines: '音擎', bangboos: '邦布', discs: '驱动盘' }[kind]}
              </h1>
              <p>
                {props.accountId === 'no-account' && kind === 'agents'
                  ? '浏览图鉴；创建本机账户后可记录拥有情况与养成资料。'
                  : {
                      agents: '选择代理人，查看或修改等级、技能与当前装备。',
                      wengines: '查看音擎使用情况；在代理人资料中更换装备。',
                      bangboos: '查看邦布技能与适配条件。',
                      discs: '查看驱动盘词条，按套装、号位或使用情况筛选。',
                    }[kind]}
              </p>
            </div>
            <div className="section-head__actions">
              {kind === 'discs' ? (
                <>
                  <PlayerSelect
                    aria-label="排序方式"
                    value={discSortMode}
                    onChange={(value) =>
                      setDiscSortMode(value as Exclude<DiscSortMode, 'development'>)
                    }
                  >
                    <option value="game">游戏顺序</option>
                    <option value="catalog">套装号位</option>
                    <option value="level">强化等级</option>
                  </PlayerSelect>
                  <DiscWorkspaceModeSwitch
                    mode="inventory"
                    onNavigate={(path) =>
                      props.onPrimaryNavigate(discWorkspacePath(path, selectedId, props.accountId))
                    }
                  />
                </>
              ) : null}
              <strong
                className="count"
                role="status"
                aria-label={`当前显示 ${filtered.length} 个${kindLabel}，共 ${rows.length} 个`}
              >
                {filtered.length} / {rows.length}
              </strong>
            </div>
          </header>
          <CatalogWorkspaceFilterBar
            kind={kind}
            kindLabel={kindLabel}
            searchRef={searchRef}
            query={query}
            onQueryChange={setQuery}
            statusFilter={statusFilter}
            statusOptions={statusOptions}
            onStatusFilterChange={setStatusFilter}
            primaryFilter={primaryFilter}
            primaryFilterOptions={primaryFilterOptions}
            onPrimaryFilterChange={setPrimaryFilter}
            secondaryFilter={secondaryFilter}
            secondaryFilterOptions={secondaryFilterOptions}
            onSecondaryFilterChange={setSecondaryFilter}
          />
          <div
            key={kind}
            ref={gridRef}
            className={`object-grid ${kind}${bulk ? ' bulk' : ''}`}
            role={filtered.length ? 'listbox' : undefined}
            aria-label={filtered.length ? `${kindLabel}列表` : undefined}
            aria-multiselectable={(filtered.length > 0 && kind === 'discs' && bulk) || undefined}
            onKeyDown={pagination.move}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget))
                pagination.setFocusedId(undefined)
            }}
          >
            {filtered.length === 0 && (
              <div className="empty-state" role="status">
                {rows.length ? (
                  <>
                    <p>没有符合当前搜索或筛选条件的结果。</p>
                    <button
                      type="button"
                      className="quiet"
                      onClick={() => {
                        clearFilters()
                        searchRef.current?.focus()
                      }}
                    >
                      清除筛选
                    </button>
                  </>
                ) : kind === 'discs' ? (
                  <>
                    <p>还没有当前账户的驱动盘记录。</p>
                    <div className="workbench-empty-state__actions app-recovery-actions">
                      <button
                        type="button"
                        className="button button--primary"
                        onClick={() => props.onPrimaryNavigate('/system/scanner')}
                      >
                        扫描与导入
                      </button>
                      <button
                        type="button"
                        className="button button--quiet"
                        onClick={() => props.onPrimaryNavigate('/assets/account#restore-backup')}
                      >
                        恢复已有备份
                      </button>
                    </div>
                  </>
                ) : (
                  <p>当前账户没有可显示的记录。</p>
                )}
              </div>
            )}
            {kind === 'discs'
              ? (pagination.visible as DiscItem[]).map((item) => (
                  <DiscCard
                    key={item.stableId}
                    item={item}
                    selected={!bulk && item.stableId === selectedId}
                    bulk={bulk}
                    checked={currentSelectedDiscs.has(item.stableId)}
                    tabIndex={item.stableId === pagination.tabStopId ? 0 : -1}
                    onFocus={() => pagination.setFocusedId(item.stableId)}
                    onSelect={() => {
                      if (bulk)
                        setSelectedDiscs((current) => {
                          const next = new Set(current)
                          if (next.has(item.stableId)) next.delete(item.stableId)
                          else next.add(item.stableId)
                          return next
                        })
                      else {
                        setSelectedId(item.stableId)
                        revealEditorOnNarrowScreen()
                      }
                    }}
                  />
                ))
              : (pagination.visible as CatalogItem[]).map((item) => (
                  <CatalogCard
                    key={item.stableId}
                    kind={kind}
                    item={item}
                    selected={item.stableId === selectedId}
                    facts={factsLabel(props, kind, item.stableId)}
                    tabIndex={item.stableId === pagination.tabStopId ? 0 : -1}
                    onFocus={() => pagination.setFocusedId(item.stableId)}
                    onSelect={() => selectCatalogItem(item)}
                  />
                ))}
          </div>
          <CatalogPagination
            pagination={pagination}
            total={filtered.length}
            actions={
              kind === 'discs' ? (
                <>
                  <button
                    className={bulk ? 'quiet' : 'danger'}
                    onClick={() => {
                      setBulk(!bulk)
                      setSelectedDiscs(new Set())
                    }}
                  >
                    {bulk ? '退出批量' : '批量删除驱动盘'}
                  </button>
                  {bulk && (
                    <>
                      <span>{currentSelectedDiscs.size} 张已选择</span>
                      <button
                        className="danger"
                        disabled={currentSelectedDiscs.size === 0}
                        onClick={() => {
                          setPendingDelete(
                            props.discs
                              .filter((disc) => currentSelectedDiscs.has(disc.stableId))
                              .map(({ stableId, revision }) => ({ stableId, revision })),
                          )
                          openDeleteDialog()
                        }}
                      >
                        删除所选驱动盘
                      </button>
                    </>
                  )}
                </>
              ) : undefined
            }
          />
        </section>
        <CatalogWorkspaceEditorAside
          editorRef={editorRef}
          kindLabel={kindLabel}
          selectedLabel={selectedLabel}
          selectedMeta={selectedMeta}
          totalRowCount={rows.length}
          selectedId={selectedId}
          selected={selected}
          isPagedVisible={pagination.visible.some((row) => row.stableId === selectedId)}
          isFiltered={filtered.some((row) => row.stableId === selectedId)}
          onShowSelectedInList={showSelectedInList}
          props={props}
          kind={kind}
        />
      </div>
      <DiscBulkDeleteDialog
        dialogRef={deleteDialogRef}
        open={deleteDialogOpen}
        pending={pendingDelete}
        onNativeClose={() => setDeleteDialogOpen(false)}
        onClose={closeDeleteDialog}
        onDelete={props.onDeleteDiscs}
        onDeleted={() => {
          setSelectedDiscs(new Set())
          setBulk(false)
        }}
      />
    </>
  )
}
