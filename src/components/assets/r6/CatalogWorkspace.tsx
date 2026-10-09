import { useEffect, useRef, useState } from 'react'
import { CatalogCard, DiscCard } from './Cards'
import { Editor } from './Editors'
import { useReconciledSelection } from './state'
import { SelectMenu, type SelectMenuOption } from './SelectMenu'
import { PlayerSelect } from '../../PlayerSelect'
import type { AssetGoldenProps, CatalogItem, CatalogKind, DiscItem } from './types'
import { preloadVisualEntityImage } from '../../../assets/visualEntityImageSource'
import { DiscWorkspaceModeSwitch } from '../../DiscWorkspaceModeSwitch'
import { DiscBulkDeleteDialog } from './DiscBulkDeleteDialog'
import { CatalogPagination } from './CatalogPagination'
import { useCatalogPagination } from './useCatalogPagination'
import { publicDiscSetOrder } from '../../../application/publicDiscSetOrder'
import { publicStatOrder } from '../../../application/publicCandidateLabels'
import {
  compareDiscCatalogOrder,
  compareDiscGameOrder,
  compareDiscLevelOrder,
  type DiscSortMode,
} from '../../../domain/discOrdering'
import {
  discWorkspacePath,
  factsLabel,
  incomingDiscSelection,
  isOwned,
  specialtyLabel,
} from './catalogWorkspaceHelpers'

// The shared catalog already orders sets by their sourced release version/date.
const discSetOrder = new Map(publicDiscSetOrder.map((set, index) => [set, index]))
const discMainStatOrder = new Map(publicStatOrder.map((stat, index) => [stat, index]))

const columns: Record<CatalogKind, number> = { agents: 9, wengines: 10, bangboos: 10, discs: 10 }

export function CatalogWorkspace({ props, kind }: { props: AssetGoldenProps; kind: CatalogKind }) {
  const [discSortMode, setDiscSortMode] = useState<Exclude<DiscSortMode, 'development'>>('game')
  const rows =
    kind === 'discs'
      ? [...props.discs].sort((left, right) => {
          const leftKey = {
            id: left.stableId,
            setId: left.set.stableId,
            slot: left.slot,
            mainStat: left.mainStatKey ?? left.mainStat,
            level: left.level,
            importBatchId: left.importBatchId,
            importSource: left.importSource,
          }
          const rightKey = {
            id: right.stableId,
            setId: right.set.stableId,
            slot: right.slot,
            mainStat: right.mainStatKey ?? right.mainStat,
            level: right.level,
            importBatchId: right.importBatchId,
            importSource: right.importSource,
          }
          const context = { setOrder: discSetOrder, mainStatOrder: discMainStatOrder }
          return discSortMode === 'game'
            ? compareDiscGameOrder(leftKey, rightKey, context)
            : discSortMode === 'level'
              ? compareDiscLevelOrder(leftKey, rightKey, context)
              : compareDiscCatalogOrder(leftKey, rightKey, context)
        })
      : props.catalog[kind]
  const ids = rows.map((row) => row.stableId)
  const discSearch = new URLSearchParams(window.location.search)
  const incomingDiscId =
    incomingDiscSelection(kind, props.accountId, window.location.search) ??
    (kind === 'discs' && !discSearch.has('account')
      ? (discSearch.get('selected') ?? undefined)
      : undefined)
  const [selectedId, setSelectedId] = useReconciledSelection(
    ids,
    incomingDiscId ?? props.initialSelection?.[kind],
  )
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [primaryFilter, setPrimaryFilter] = useState('all')
  const [secondaryFilter, setSecondaryFilter] = useState('all')
  const [bulk, setBulk] = useState(false)
  const [selectedDiscs, setSelectedDiscs] = useState<Set<string>>(new Set())
  const [pendingDelete, setPendingDelete] = useState<Array<{ stableId: string; revision: string }>>(
    [],
  )
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const editorRef = useRef<HTMLElement>(null)
  const currentSelectedDiscs = new Set([...selectedDiscs].filter((id) => ids.includes(id)))

  const revealEditorOnNarrowScreen = () => {
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
    void preloadVisualEntityImage({
      entityType: 'agent',
      entityId: selectedId,
      slotId: 'agent.square-avatar',
      consumer: 'assets.editor',
    })
  }, [kind, selectedId])
  const gridRef = useRef<HTMLDivElement>(null)
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
          { value: 'all', label: kind === 'wengines' ? '全部使用状态' : '全部状态' },
          { value: 'owned', label: kind === 'wengines' ? '正在使用' : '已拥有' },
          { value: 'unowned', label: kind === 'wengines' ? '暂无使用记录' : '未拥有' },
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
      secondaryFilter === 'all' ||
      secondaryFilter ===
        (kind === 'discs' ? String((item as DiscItem).slot) : (item as CatalogItem).specialty)
    const searchText =
      kind === 'discs'
        ? [
            name,
            (item as DiscItem).mainStat,
            String((item as DiscItem).slot),
            ...(item as DiscItem).tags,
          ].join(' ')
        : name
    return (
      searchText.toLocaleLowerCase().includes(normalizedQuery) &&
      statusMatches &&
      primaryMatches &&
      secondaryMatches
    )
  })
  const selected = rows.find((row) => row.stableId === selectedId)
  const pagination = useCatalogPagination(
    filtered,
    JSON.stringify([query, statusFilter, primaryFilter, secondaryFilter, discSortMode]),
    selectedId,
    gridRef,
    columns[kind],
  )
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
      <div className="split">
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
                      bangboos: '查看邦布技能与适配条件；在队伍配装中选择并确认星级。',
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
              <strong className="count">
                {filtered.length} / {rows.length}
              </strong>
            </div>
          </header>
          <div className={`filterbar${kind === 'discs' ? ' filterbar--discs' : ''}`}>
            <input
              aria-label="搜索名称"
              placeholder="搜索名称"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {kind !== 'bangboos' ? (
              <SelectMenu
                label={kind === 'discs' || kind === 'wengines' ? '使用状态' : '拥有状态'}
                value={statusFilter}
                options={statusOptions}
                onChange={setStatusFilter}
              />
            ) : null}
            <SelectMenu
              label={kind === 'discs' ? '套装' : '稀有度'}
              value={primaryFilter}
              options={primaryFilterOptions}
              onChange={setPrimaryFilter}
            />
            <SelectMenu
              label={kind === 'discs' ? '号位' : kind === 'bangboos' ? '类型' : '特性'}
              value={secondaryFilter}
              options={secondaryFilterOptions}
              onChange={setSecondaryFilter}
            />
          </div>
          <div
            key={kind}
            ref={gridRef}
            className={`object-grid ${kind}${bulk ? ' bulk' : ''}`}
            role="listbox"
            aria-multiselectable={(kind === 'discs' && bulk) || undefined}
            onKeyDown={pagination.move}
          >
            {filtered.length === 0 && (
              <div className="empty-state" role="status">
                <p>
                  {rows.length
                    ? '没有符合当前搜索或筛选条件的结果。'
                    : `当前账户没有可显示的${kind === 'discs' ? '驱动盘' : '对象'}。`}
                </p>
                {rows.length ? (
                  <button type="button" className="quiet" onClick={clearFilters}>
                    清除筛选
                  </button>
                ) : null}
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
        <aside ref={editorRef} className="editor">
          {selected && !pagination.visible.some((row) => row.stableId === selectedId) ? (
            <p className="selection-context" role="status">
              仍在查看：
              {kind === 'discs'
                ? `${(selected as DiscItem).set.playerName} · ${(selected as DiscItem).slot}号位`
                : (selected as CatalogItem).playerName}
              <span>
                {filtered.some((row) => row.stableId === selectedId)
                  ? '此对象不在当前页。'
                  : '此对象不在当前筛选结果中。'}
              </span>
              <button className="text-action" type="button" onClick={showSelectedInList}>
                在列表中显示
              </button>
            </p>
          ) : null}
          {selected ? (
            <Editor props={props} kind={kind} item={selected} />
          ) : (
            <section className="editor-section">
              <h2>暂无可编辑对象</h2>
              <p>扫描、导入或切换账户后，目录会自动更新。</p>
            </section>
          )}
        </aside>
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
