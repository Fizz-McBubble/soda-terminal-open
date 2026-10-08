import { WarehouseInitialReadState } from './WarehouseInitialReadState'
import { WarehousePendingDiscList } from './WarehousePendingDiscList'
import { WarehouseDiscControls } from './WarehouseDiscControls'
import { WarehouseDiscActionList } from './WarehouseDiscActionList'
import {
  initialFilters,
  type FilterState,
  statusText,
  warehouseActionStrengthLabel,
} from './warehouseDiscPresentation'
import { matchesWarehouseDiscFilters } from './warehouseDiscFilters'
import { Archive } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAccountDecisionWorld } from '../application/accountDecisionWorld'
import { displayWarehouseActionProjection } from '../application/warehouseActionContract'
import { WarehouseActionDrawer } from './WarehouseActionDrawer'
import {
  defaultWarehouseActionListOrder,
  projectWarehouseActionListJoin,
} from './warehouseActionListJoin'
import { AccountRequiredState } from '../components/ui/AccountRequiredState'
import {
  warehouseActionRowHeight,
  warehouseActionMobileRowHeight,
  warehouseActionWindowSize,
} from './warehouseActionListConfig'
import { WarehouseWorkbenchHeader } from './WarehouseWorkbenchHeader'

export function WarehouseDiscsPage() {
  const [searchParams] = useSearchParams()
  const decisionWorld = useAccountDecisionWorld()
  const [narrowRows, setNarrowRows] = useState(
    () => window.matchMedia?.('(max-width: 760px)').matches ?? false,
  )
  useEffect(() => {
    const media = window.matchMedia?.('(max-width: 760px)')
    const update = () => {
      const listWidth = listBodyRef.current?.clientWidth ?? Number.POSITIVE_INFINITY
      setNarrowRows(Boolean(media?.matches) || listWidth <= 760)
    }
    update()
    media?.addEventListener?.('change', update)
    const list = listBodyRef.current
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    if (list && observer) observer.observe(list)
    return () => {
      media?.removeEventListener?.('change', update)
      observer?.disconnect()
    }
  }, [decisionWorld.status])
  const rowHeight = narrowRows ? warehouseActionMobileRowHeight : warehouseActionRowHeight
  const data = decisionWorld.run
    ? {
        account: decisionWorld.run.input.warehouse.account,
        discs: decisionWorld.run.input.warehouse.discs,
        roster: decisionWorld.run.input.warehouse.roster,
      }
    : (decisionWorld.liveInput?.warehouse ?? null)
  const projection = useMemo(
    () =>
      decisionWorld.status === 'current' || decisionWorld.status === 'stale'
        ? displayWarehouseActionProjection(decisionWorld.run.warehouseActions, decisionWorld.status)
        : null,
    [decisionWorld],
  )
  const alternativeRecommendations = useMemo(
    () =>
      new Map(
        (projection?.actions ?? []).map((item) => {
          const stale = projection?.state === 'stale' || item.recommendationState === 'stale'
          return [
            item.disc.id,
            {
              label: stale ? '旧结果待重新分析' : warehouseActionStrengthLabel(item),
              prioritize:
                !stale && item.recommendationState === 'current' && item.action === 'keep',
            },
          ]
        }),
      ),
    [projection],
  )
  const [filterState, setFilterState] = useState<{ accountId: string | null; value: FilterState }>({
    accountId: null,
    value: initialFilters,
  })
  const [selection, setSelection] = useState<{ accountId: string; discId: string } | null>(null)
  const [comparison, setComparison] = useState<{ accountId: string; discId: string } | null>(null)
  const [sameKindContext, setSameKindContext] = useState<{
    accountId: string
    filters: FilterState
    scrollTop: number
    selectedId: string
  } | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [repairingApplicationData, setRepairingApplicationData] = useState(false)
  const [retryingRead, setRetryingRead] = useState(false)
  const [readRetryError, setReadRetryError] = useState<string | null>(null)
  const listBodyRef = useRef<HTMLDivElement>(null)
  const workbenchRef = useRef<HTMLDivElement>(null)
  const detailRequested = useRef(false)
  const cardNavigationRequested = useRef(false)
  const originalCardScrollTop = useRef(0)
  const originalAlternativesScrollTop = useRef(0)
  const listFocusRequested = useRef(false)
  const alternativeFocusRequested = useRef<string | null>(null)
  const pendingScrollTop = useRef<number | null>(null)
  const [navigationRequest, setNavigationRequest] = useState(0)
  useEffect(() => {
    if (cardNavigationRequested.current) {
      cardNavigationRequested.current = false
      const card = workbenchRef.current?.querySelector<HTMLElement>('.warehouse-action-drawer')
      if (card) card.scrollTop = 0
      card
        ?.querySelector<HTMLElement>('#warehouse-action-drawer-title')
        ?.focus({ preventScroll: true })
    }
    if (alternativeFocusRequested.current) {
      const id = alternativeFocusRequested.current
      const trigger = workbenchRef.current?.querySelector<HTMLElement>(
        `[data-alternative-id="${CSS.escape(id)}"]`,
      )
      if (trigger) {
        alternativeFocusRequested.current = null
        const card = workbenchRef.current?.querySelector<HTMLElement>('.warehouse-action-drawer')
        if (card) card.scrollTop = originalCardScrollTop.current
        const alternatives = card?.querySelector<HTMLElement>('.warehouse-alternatives')
        if (alternatives) alternatives.scrollTop = originalAlternativesScrollTop.current
        trigger.focus({ preventScroll: true })
        return
      }
    }
    if (pendingScrollTop.current !== null && listBodyRef.current) {
      listBodyRef.current.scrollTop = pendingScrollTop.current
      setScrollTop(pendingScrollTop.current)
      pendingScrollTop.current = null
    }
    if (detailRequested.current) {
      detailRequested.current = false
      workbenchRef.current
        ?.querySelector<HTMLElement>('#warehouse-action-drawer-title')
        ?.focus({ preventScroll: true })
      workbenchRef.current
        ?.querySelector<HTMLElement>('.warehouse-action-drawer')
        ?.scrollIntoView({ block: 'start', behavior: 'instant' })
    }
    if (listFocusRequested.current) {
      const row = listBodyRef.current?.querySelector<HTMLElement>('button[aria-pressed="true"]')
      if (!row) return
      listFocusRequested.current = false
      row.focus({ preventScroll: true })
      row.scrollIntoView({ block: 'center', behavior: 'instant' })
    }
  }, [navigationRequest, selection, scrollTop, comparison])
  const filters = filterState.accountId === data?.account?.id ? filterState.value : initialFilters
  const visible = useMemo(() => {
    if (!projection) return []
    return projection.actions.filter((item) => matchesWarehouseDiscFilters(item, filters))
  }, [filters, projection])
  const firstVisible = Math.max(0, Math.floor(scrollTop / rowHeight) - 4)
  const actionList = useMemo(
    () =>
      projectWarehouseActionListJoin(visible, data?.discs ?? [], {
        sortMode: filters.sort,
        ...defaultWarehouseActionListOrder,
      }),
    [data?.discs, filters.sort, visible],
  )
  const windowed = actionList.rows.slice(firstVisible, firstVisible + warehouseActionWindowSize)
  const incomingSelection =
    searchParams.get('account') === data?.account?.id ? searchParams.get('selected') : null
  const selectedId =
    selection && selection.accountId === data?.account?.id ? selection.discId : incomingSelection
  const selectedRow =
    actionList.rows.find((row) => row.item.disc.id === selectedId) ?? actionList.rows[0] ?? null
  const selectedItem = selectedRow?.item ?? null
  const selectedDisc = selectedRow?.disc ?? null
  const comparisonId = comparison?.accountId === data?.account?.id ? comparison?.discId : null
  const detailItem = comparisonId
    ? (projection?.actions.find((item) => item.disc.id === comparisonId) ?? null)
    : selectedItem
  const detailDisc = comparisonId
    ? (data?.discs.find((disc) => disc.id === comparisonId) ?? null)
    : selectedDisc
  const hasFilters = Object.entries(filters).some(
    ([key, value]) => key !== 'sort' && value !== initialFilters[key as keyof FilterState],
  )
  const compatibleAgentIds = [
    ...new Set(projection?.actions.flatMap((item) => item.compatibleAgentIds) ?? []),
  ]
  const ownedAgentIds = new Set(
    data?.roster.agents.filter((agent) => agent.owned).map((agent) => agent.agentId),
  )
  const moreFilterCount = [filters.level !== '', filters.referenced !== 'all'].filter(
    Boolean,
  ).length
  const selectedIndex = actionList.rows.findIndex((row) => row.disc.id === selectedDisc?.id)
  const availableMainStats = new Set(
    (data?.discs ?? [])
      .filter((disc) => !filters.slot || String(disc.slot) === filters.slot)
      .map((disc) => disc.mainStat),
  )
  function moveSelection(offset: number) {
    const row = actionList.rows[selectedIndex + offset]
    if (!row) return
    selectDisc(row.disc.id)
    const nextTop = (selectedIndex + offset) * rowHeight
    const list = listBodyRef.current
    if (
      list &&
      (nextTop < list.scrollTop || nextTop + rowHeight > list.scrollTop + list.clientHeight)
    ) {
      list.scrollTop = nextTop
      setScrollTop(nextTop)
    }
  }
  function updateFilters(updater: (current: FilterState) => FilterState) {
    const accountId = data?.account?.id
    if (!accountId) return
    setFilterState({ accountId, value: updater(filters) })
    setComparison(null)
    setSameKindContext(null)
    setScrollTop(0)
    if (typeof listBodyRef.current?.scrollTo === 'function')
      listBodyRef.current.scrollTo({ top: 0 })
    else if (listBodyRef.current) listBodyRef.current.scrollTop = 0
  }
  function selectDisc(id: string) {
    if (!data?.account) return
    setComparison(null)
    setSelection({ accountId: data.account.id, discId: id })
    if (window.matchMedia?.('(max-width: 760px)').matches) {
      detailRequested.current = true
      setNavigationRequest((request) => request + 1)
    }
  }
  function showAlternative(id: string) {
    if (!data?.account) return
    if (!comparisonId) {
      originalCardScrollTop.current =
        workbenchRef.current?.querySelector<HTMLElement>('.warehouse-action-drawer')?.scrollTop ?? 0
      originalAlternativesScrollTop.current =
        workbenchRef.current?.querySelector<HTMLElement>('.warehouse-alternatives')?.scrollTop ?? 0
    }
    if (!comparisonId && selectedItem)
      setSelection({ accountId: data.account.id, discId: selectedItem.disc.id })
    setComparison({ accountId: data.account.id, discId: id })
    cardNavigationRequested.current = true
    setNavigationRequest((request) => request + 1)
  }
  function returnToOriginal() {
    if (comparisonId) alternativeFocusRequested.current = comparisonId
    setComparison(null)
    setNavigationRequest((request) => request + 1)
  }
  function showSameKind() {
    if (!data?.account || !detailDisc || !selectedItem) return
    setSameKindContext({
      accountId: data.account.id,
      filters,
      scrollTop,
      selectedId: selectedItem.disc.id,
    })
    setFilterState({
      accountId: data.account.id,
      value: {
        ...initialFilters,
        setId: detailDisc.setId,
        slot: String(detailDisc.slot),
        mainStat: detailDisc.mainStat,
        sort: filters.sort === 'development' ? 'game' : filters.sort,
      },
    })
    setComparison(null)
    setScrollTop(0)
    if (typeof listBodyRef.current?.scrollTo === 'function')
      listBodyRef.current.scrollTo({ top: 0 })
    else if (listBodyRef.current) listBodyRef.current.scrollTop = 0
  }
  function returnFromSameKind() {
    if (!data?.account || sameKindContext?.accountId !== data.account.id) return
    setFilterState({ accountId: data.account.id, value: sameKindContext.filters })
    setSelection({ accountId: data.account.id, discId: sameKindContext.selectedId })
    pendingScrollTop.current = sameKindContext.scrollTop
    listFocusRequested.current = true
    setSameKindContext(null)
    setNavigationRequest((request) => request + 1)
  }
  function returnToSelectedDisc() {
    const index = actionList.rows.findIndex((row) => row.item.disc.id === selectedItem?.disc.id)
    if (index < 0 || !listBodyRef.current) return
    if (!listBodyRef.current.querySelector('button[aria-pressed="true"]')) {
      const nextScrollTop = index * rowHeight
      listBodyRef.current.scrollTop = nextScrollTop
      setScrollTop(nextScrollTop)
    }
    listFocusRequested.current = true
    setNavigationRequest((request) => request + 1)
  }

  async function runAnalysis() {
    await decisionWorld.refresh()
  }
  async function retryWarehouseRead() {
    setRetryingRead(true)
    setReadRetryError(null)
    try {
      await decisionWorld.refresh()
    } catch {
      setReadRetryError('重新读取未完成，请稍后重试。账户资料没有被修改。')
    } finally {
      setRetryingRead(false)
    }
  }
  async function repairApplicationData() {
    setRepairingApplicationData(true)
    try {
      await decisionWorld.repairApplicationData()
    } finally {
      setRepairingApplicationData(false)
    }
  }
  if (decisionWorld.status === 'loading' && !data)
    return <WarehouseInitialReadState decisionWorld={decisionWorld} runAnalysis={runAnalysis} />
  if (decisionWorld.status === 'error')
    return (
      <section className="warehouse-empty" aria-live="polite">
        <Archive size={28} />
        <h1>驱动盘分析</h1>
        <p>{decisionWorld.message}</p>
        {decisionWorld.canRepairApplicationData ? (
          <div className="warehouse-empty__actions">
            <p>仅修复应用资料，不修改账户资产。</p>
            <button
              className="button button--primary"
              type="button"
              disabled={repairingApplicationData}
              onClick={() => void repairApplicationData()}
            >
              {repairingApplicationData ? '正在恢复…' : '恢复应用自带资料'}
            </button>
          </div>
        ) : (
          <div className="warehouse-empty__actions">
            <button
              className="button button--primary"
              type="button"
              disabled={retryingRead}
              onClick={() => void retryWarehouseRead()}
            >
              {retryingRead ? '正在重新读取…' : '重新读取仓库'}
            </button>
            {readRetryError ? <p role="alert">{readRetryError}</p> : null}
          </div>
        )}
      </section>
    )
  if (!data?.account || !data.roster) return <AccountRequiredState title="先创建或选择账户" />
  if (data.discs.length === 0)
    return (
      <section className="warehouse-empty" aria-live="polite">
        <Archive size={28} />
        <h1>还没有可分析的驱动盘</h1>
        <p>先扫描或导入当前账户的驱动盘；有数据后，这里会给出保留、观察和清理候选建议。</p>
        <Link className="button button--primary" to="/system/scanner">
          前往扫描与导入
        </Link>
      </section>
    )
  return (
    <div
      className="warehouse-workbench"
      ref={workbenchRef}
      style={{ '--warehouse-row-height': `${rowHeight}px` } as CSSProperties}
    >
      <WarehouseWorkbenchHeader
        discCount={data.discs.length}
        accountId={data.account.id}
        selectedDiscId={selectedDisc?.id ?? selectedId ?? null}
        projection={projection}
        runAnalysis={runAnalysis}
        calculation={decisionWorld.calculation}
        calculationCancelled={decisionWorld.calculationCancelled}
        cancelCalculation={decisionWorld.cancelCalculation}
      />
      <WarehouseDiscControls
        filters={filters}
        updateFilters={updateFilters}
        data={data}
        availableMainStats={availableMainStats}
        compatibleAgentIds={compatibleAgentIds}
        ownedAgentIds={ownedAgentIds}
        moreFilterCount={moreFilterCount}
        hasFilters={hasFilters}
        projection={projection}
      />
      {!projection ? (
        <WarehousePendingDiscList
          key={`${data.account.id}:${filters.setId}:${filters.slot}:${filters.mainStat}:${filters.level}:${filters.sort}`}
          discs={data.discs}
          filters={filters}
          selectedId={selectedId}
          selectDisc={selectDisc}
        />
      ) : (
        <div className="warehouse-action-workspace">
          <WarehouseDiscActionList
            actionList={actionList}
            listBodyRef={listBodyRef}
            setScrollTop={setScrollTop}
            rowHeight={rowHeight}
            firstVisible={firstVisible}
            windowed={windowed}
            selectedItem={selectedItem}
            data={data}
            selectDisc={selectDisc}
            selectionNotice={
              selectedId && selectedRow && selectedRow.disc.id !== selectedId
                ? '原选择已不在当前结果，已暂时定位到当前排序中的第一张。'
                : undefined
            }
            sameKindContext={
              sameKindContext?.accountId === data.account.id
                ? { label: '正在浏览同类盘', onReturn: returnFromSameKind }
                : undefined
            }
          />
          {detailItem && detailDisc ? (
            <WarehouseActionDrawer
              key={`${detailDisc.id}:${comparisonId ? 'compare' : 'detail'}`}
              navigation={
                !comparisonId
                  ? {
                      index: selectedIndex,
                      total: actionList.rows.length,
                      onPrevious: () => moveSelection(-1),
                      onNext: () => moveSelection(1),
                    }
                  : undefined
              }
              onReturnToList={comparisonId ? undefined : returnToSelectedDisc}
              onSelectAlternative={showAlternative}
              onShowSameKind={showSameKind}
              onReturnToOriginal={comparisonId ? returnToOriginal : undefined}
              comparisonOrigin={
                comparisonId && selectedItem && selectedDisc
                  ? { item: selectedItem, disc: selectedDisc }
                  : undefined
              }
              item={detailItem}
              disc={detailDisc}
              discs={data.discs}
              decisionLabel={warehouseActionStrengthLabel(detailItem)}
              alternativeRecommendations={alternativeRecommendations}
              relations={statusText(detailItem)}
            />
          ) : (
            <aside className="warehouse-action-drawer warehouse-action-drawer--empty">
              {comparisonId ? (
                <>
                  <p role="status">替代盘记录或分析结果已不可用，请更新仓库后重新分析。</p>
                  <button className="button button--quiet" type="button" onClick={returnToOriginal}>
                    返回原盘
                  </button>
                </>
              ) : (
                '当前筛选下没有可查看的驱动盘。'
              )}
            </aside>
          )}
        </div>
      )}
    </div>
  )
}
