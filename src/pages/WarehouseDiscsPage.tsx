import { WarehouseInitialReadState } from './WarehouseInitialReadState'
import { WarehousePendingDiscList } from './WarehousePendingDiscList'
import { WarehouseDiscControls } from './WarehouseDiscControls'
import { WarehouseDiscActionList } from './WarehouseDiscActionList'
import { initialFilters, type FilterState } from './warehouseDiscPresentation'
import { matchesWarehouseDiscFilters } from './warehouseDiscFilters'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAccountDecisionWorld } from '../application/accountDecisionWorld'
import { useWarehouseActions } from '../application/useWarehouseActions'
import { deriveAlternativeRecommendations } from './warehouseActionAlternatives'
import { WarehouseErrorState } from './WarehouseErrorState'
import { WarehouseActionDrawerSection } from './WarehouseActionDrawerSection'
import {
  defaultWarehouseActionListOrder,
  projectWarehouseActionListJoin,
} from './warehouseActionListJoin'
import { AccountRequiredState } from '../components/ui/AccountRequiredState'
import { WarehouseEmptyDiscsState } from './WarehouseEmptyDiscsState'
import {
  warehouseActionRowHeight,
  warehouseActionMobileRowHeight,
  warehouseActionWindowSize,
} from './warehouseActionListConfig'
import { WarehouseWorkbenchHeader } from './WarehouseWorkbenchHeader'
import '../components/AppEntryState.css'
import { useCatalogBrowseState } from '../components/assets/r6/useCatalogBrowseState'
import { warehousePageActionProjection } from './warehousePageActionProjection'

function warehousePageData(decisionWorld: ReturnType<typeof useAccountDecisionWorld>) {
  if (decisionWorld.liveInput !== undefined) return decisionWorld.liveInput?.warehouse ?? null
  return decisionWorld.run?.input.warehouse ?? null
}

export function WarehouseDiscsPage() {
  const decisionWorld = useAccountDecisionWorld()
  const data = warehousePageData(decisionWorld)
  return (
    <WarehouseDiscsWorkbench
      key={data?.account?.id ?? 'no-account'}
      decisionWorld={decisionWorld}
      data={data}
    />
  )
}

function WarehouseDiscsWorkbench({
  decisionWorld,
  data,
}: {
  decisionWorld: ReturnType<typeof useAccountDecisionWorld>
  data: ReturnType<typeof warehousePageData>
}) {
  const [searchParams] = useSearchParams()
  const warehouseRead = useWarehouseActions(decisionWorld)
  const browseKey = data?.account ? `warehouse:${data.account.id}` : undefined
  const [listElement, setListElement] = useState<HTMLElement | null>(null)
  const [narrowRows, setNarrowRows] = useState(
    () => window.matchMedia?.('(max-width: 760px)').matches ?? false,
  )
  useLayoutEffect(() => {
    const media = window.matchMedia?.('(max-width: 760px)')
    const update = () => {
      const listWidth = listElement?.clientWidth ?? Number.POSITIVE_INFINITY
      setNarrowRows(Boolean(media?.matches) || listWidth <= 760)
    }
    update()
    media?.addEventListener?.('change', update)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    if (listElement && observer) observer.observe(listElement)
    return () => {
      media?.removeEventListener?.('change', update)
      observer?.disconnect()
    }
  }, [listElement])
  const rowHeight = narrowRows ? warehouseActionMobileRowHeight : warehouseActionRowHeight
  const projection = useMemo(
    () => warehousePageActionProjection(decisionWorld, data?.discs, warehouseRead.projection),
    [decisionWorld, data?.discs, warehouseRead.projection],
  )
  const alternativeRecommendations = useMemo(
    () => deriveAlternativeRecommendations(projection),
    [projection],
  )
  const [filterState, setFilterState] = useCatalogBrowseState<{
    accountId: string | null
    value: FilterState
  }>(browseKey, 'filters', {
    accountId: null,
    value: initialFilters,
  })
  const [selection, setSelection] = useCatalogBrowseState<{
    accountId: string
    discId: string
  } | null>(browseKey, 'selection', null)
  const [comparison, setComparison] = useCatalogBrowseState<{
    accountId: string
    discId: string
  } | null>(browseKey, 'comparison', null)
  const [sameKindContext, setSameKindContext] = useCatalogBrowseState<{
    accountId: string
    filters: FilterState
    scrollTop: number
    selectedId: string
  } | null>(browseKey, 'same-kind', null)
  const [scrollTop, setScrollTop] = useCatalogBrowseState(browseKey, 'scroll-top', 0)
  const [repairingApplicationData, setRepairingApplicationData] = useState(false)
  const [retryingRead, setRetryingRead] = useState(false)
  const [readRetryError, setReadRetryError] = useState<string | null>(null)
  const listBodyRef = useRef<HTMLDivElement>(null)
  const listScrollRestored = useRef(false)
  useLayoutEffect(() => {
    const list = listBodyRef.current
    if (!list || listScrollRestored.current) return
    listScrollRestored.current = true
    list.scrollTop = scrollTop
    if (list.scrollTop !== scrollTop) setScrollTop(list.scrollTop)
  }, [projection, scrollTop, setScrollTop])
  const workbenchRef = useRef<HTMLDivElement>(null)
  const detailRequested = useRef(false)
  const stepperFocus = useRef<'previous' | 'next' | null>(null)
  const cardNavigationRequested = useRef(false)
  const originalCardScrollTop = useRef(0)
  const originalAlternativesScrollTop = useRef(0)
  const listFocusRequested = useRef(false)
  const alternativeFocusRequested = useRef<string | null>(null)
  const pendingScrollTop = useRef<number | null>(null)
  const focusedPendingDiscIdRef = useRef<string | null>(null)
  const lastAccountIdRef = useRef(data?.account?.id)
  if (lastAccountIdRef.current !== data?.account?.id) {
    lastAccountIdRef.current = data?.account?.id
    focusedPendingDiscIdRef.current = null
  }
  const [navigationRequest, setNavigationRequest] = useState(0)
  useEffect(() => {
    if (stepperFocus.current) {
      const stepper = workbenchRef.current?.querySelector('.warehouse-disc-stepper')
      const button =
        stepper?.querySelector<HTMLButtonElement>(
          `[data-disc-step="${stepperFocus.current}"]:enabled`,
        ) ?? stepper?.querySelector<HTMLButtonElement>('button:enabled')
      stepperFocus.current = null
      button?.focus({ preventScroll: true })
    }
    if (cardNavigationRequested.current) {
      cardNavigationRequested.current = false
      const card = workbenchRef.current?.querySelector<HTMLElement>('.warehouse-action-drawer')
      const factComparison = card?.querySelector<HTMLElement>('[data-fact-comparison]')
      if (factComparison) {
        factComparison.focus({ preventScroll: true })
        factComparison.scrollIntoView({ block: 'nearest', behavior: 'instant' })
      } else {
        if (card) card.scrollTop = 0
        card
          ?.querySelector<HTMLElement>('#warehouse-action-drawer-title')
          ?.focus({ preventScroll: true })
      }
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
  }, [navigationRequest, selection, scrollTop, comparison, setScrollTop])
  const filters = filterState.accountId === data?.account?.id ? filterState.value : initialFilters
  const visible = useMemo(() => {
    if (!projection) return []
    return projection.actions.filter((item) => matchesWarehouseDiscFilters(item, filters))
  }, [filters, projection])
  const actionList = useMemo(
    () =>
      projectWarehouseActionListJoin(visible, data?.discs ?? [], {
        sortMode: filters.sort,
        ...defaultWarehouseActionListOrder,
      }),
    [data?.discs, filters.sort, visible],
  )
  const firstVisible = Math.min(
    Math.max(0, Math.floor(scrollTop / rowHeight) - 4),
    Math.max(0, actionList.rows.length - 1),
  )
  const windowed = actionList.rows.slice(firstVisible, firstVisible + warehouseActionWindowSize)
  const incomingSelection =
    searchParams.get('account') === data?.account?.id ? searchParams.get('selected') : null
  const previousIncomingSelection = useRef<string | null>(null)
  useLayoutEffect(() => {
    if (
      incomingSelection &&
      incomingSelection !== previousIncomingSelection.current &&
      data?.account
    ) {
      setSelection({ accountId: data.account.id, discId: incomingSelection })
    }
    previousIncomingSelection.current = incomingSelection
  }, [incomingSelection, data?.account, setSelection])
  const selectedId =
    selection && selection.accountId === data?.account?.id ? selection.discId : incomingSelection
  const selectedRow =
    actionList.rows.find((row) => row.item.disc.id === selectedId) ?? actionList.rows[0] ?? null
  const selectedItem = selectedRow?.item ?? null
  const selectedDisc = selectedRow?.disc ?? null
  const comparisonId =
    comparison &&
    comparison.accountId === data?.account?.id &&
    data?.discs.some((disc) => disc.id === comparison.discId)
      ? comparison.discId
      : null
  const detailItem = comparisonId
    ? (projection?.actions.find((item) => item.disc.id === comparisonId) ?? selectedItem)
    : selectedItem
  const detailDisc = comparisonId
    ? projection?.actions.some((item) => item.disc.id === comparisonId)
      ? (data?.discs.find((disc) => disc.id === comparisonId) ?? null)
      : selectedDisc
    : selectedDisc
  const comparisonFact =
    comparisonId && !projection?.actions.some((item) => item.disc.id === comparisonId)
      ? (data?.discs.find((disc) => disc.id === comparisonId) ?? null)
      : null
  const compatibleAgentIds = [
    ...new Set(projection?.actions.flatMap((item) => item.compatibleAgentIds) ?? []),
  ]
  const ownedAgentIds = new Set(
    data?.roster.agents.filter((agent) => agent.owned).map((agent) => agent.agentId),
  )
  const selectedIndex = actionList.rows.findIndex((row) => row.disc.id === selectedDisc?.id)
  const availableMainStats = new Set(
    (data?.discs ?? [])
      .filter((disc) => !filters.slot || String(disc.slot) === filters.slot)
      .map((disc) => disc.mainStat),
  )
  function moveSelection(offset: number) {
    const row = actionList.rows[selectedIndex + offset]
    if (!row) return
    stepperFocus.current = offset > 0 ? 'next' : 'previous'
    selectDisc(row.disc.id, false)
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
    focusedPendingDiscIdRef.current = null
    setFilterState({ accountId, value: updater(filters) })
    setComparison(null)
    setSameKindContext(null)
    setScrollTop(0)
    if (typeof listBodyRef.current?.scrollTo === 'function')
      listBodyRef.current.scrollTo({ top: 0 })
    else if (listBodyRef.current) listBodyRef.current.scrollTop = 0
  }
  function selectDisc(id: string, openDetail = true) {
    if (!data?.account) return
    setComparison(null)
    setSelection({ accountId: data.account.id, discId: id })
    if (openDetail && window.matchMedia?.('(max-width: 760px)').matches) {
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
    if (decisionWorld.status === 'current' && !warehouseRead.projection) {
      warehouseRead.retry()
      return
    }
    await decisionWorld.refresh()
  }
  async function retryWarehouseRead() {
    setRetryingRead(true)
    setReadRetryError(null)
    try {
      await decisionWorld.refresh()
    } catch {
      setReadRetryError('驱动盘读取未完成，请重试。')
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
      <WarehouseErrorState
        decisionWorld={decisionWorld}
        repairingApplicationData={repairingApplicationData}
        retryingRead={retryingRead}
        readRetryError={readRetryError}
        onRepairApplicationData={() => void repairApplicationData()}
        onRetryWarehouseRead={() => void retryWarehouseRead()}
      />
    )
  if (!data?.account || !data.roster) return <AccountRequiredState title="先创建或选择账户" />
  const latestInput = decisionWorld.liveInput ?? decisionWorld.run?.input
  const currentInput = latestInput?.warehouse.accountId === data.account.id ? latestInput : null
  const sDiscs = data.discs.filter((disc) => disc.rarity === 'S')
  const excludedDiscCount = data.discs.length - sDiscs.length
  if (sDiscs.length === 0) return <WarehouseEmptyDiscsState excludedDiscCount={excludedDiscCount} />
  return (
    <div
      className="warehouse-workbench"
      ref={workbenchRef}
      style={{ '--warehouse-row-height': `${rowHeight}px` } as CSSProperties}
    >
      <WarehouseWorkbenchHeader
        discCount={sDiscs.length}
        excludedDiscCount={excludedDiscCount}
        accountId={data.account.id}
        selectedDiscId={selectedDisc?.id ?? selectedId ?? null}
        filters={filters}
        updateFilters={updateFilters}
        projection={projection}
        runAnalysis={runAnalysis}
        calculation={decisionWorld.calculation ?? warehouseRead.calculation}
        calculationCancelled={decisionWorld.calculationCancelled || warehouseRead.cancelled}
        analysisIssue={
          decisionWorld.analysisIssue ??
          (warehouseRead.error
            ? { kind: 'calculation_failed', message: warehouseRead.error }
            : null)
        }
        cancelCalculation={
          warehouseRead.calculation ? warehouseRead.cancel : decisionWorld.cancelCalculation
        }
      />
      <WarehouseDiscControls
        filters={filters}
        updateFilters={updateFilters}
        data={data}
        availableMainStats={availableMainStats}
        compatibleAgentIds={compatibleAgentIds}
        ownedAgentIds={ownedAgentIds}
        projection={projection}
      />
      {!projection ? (
        <WarehousePendingDiscList
          listRef={setListElement}
          key={`${data.account.id}:${filters.setId}:${filters.slot}:${filters.mainStat}:${filters.level}:${filters.sort}`}
          discs={data.discs.filter((disc) => disc.rarity === 'S')}
          filters={filters}
          selectedId={selectedId}
          drafts={currentInput?.drafts}
          activePlanIds={Object.values(currentInput?.activePlanIds ?? {}).filter(
            (id): id is string => typeof id === 'string',
          )}
          selectDisc={selectDisc}
          rowHeight={rowHeight}
          initialScrollTop={scrollTop}
          onScrollTop={setScrollTop}
          onFocusDisc={(id) => {
            focusedPendingDiscIdRef.current = id
          }}
        />
      ) : (
        <div className="warehouse-action-workspace">
          <WarehouseDiscActionList
            listRef={setListElement}
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
            initialFocusDiscId={focusedPendingDiscIdRef.current}
            onInitialFocusConsumed={() => {
              focusedPendingDiscIdRef.current = null
            }}
          />
          <WarehouseActionDrawerSection
            detailItem={detailItem}
            detailDisc={detailDisc}
            accountId={data.account.id}
            selectedDiscId={selectedDisc?.id}
            comparisonId={comparisonId}
            comparisonFact={comparisonFact}
            selectedIndex={selectedIndex}
            totalRows={actionList.rows.length}
            onMoveSelection={moveSelection}
            onReturnToSelectedDisc={returnToSelectedDisc}
            onSelectAlternative={showAlternative}
            onShowSameKind={showSameKind}
            onReturnToOriginal={returnToOriginal}
            selectedItem={selectedItem}
            selectedDisc={selectedDisc}
            ownedAgentIds={ownedAgentIds}
            discs={data.discs}
            alternativeRecommendations={alternativeRecommendations}
            onReanalyze={runAnalysis}
          />
        </div>
      )}
    </div>
  )
}
