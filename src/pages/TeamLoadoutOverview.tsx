import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { getAgentName } from '../application/publicRosterNames'
import { TeamCompletionCandidates, TeamPreview } from './TeamLoadoutOverviewParts'
import type {
  TeamLoadoutOverviewGroup,
  TeamLoadoutOverviewFamily,
  TeamLoadoutOverviewItem,
  TeamLoadoutOverviewModel,
  TeamLoadoutVisibleAnswer,
} from './teamLoadoutOverviewTypes'
import './team-loadout-overview.css'
import { WorkbenchEmptyState } from '../components/AppEntryState'
import { normalizeVisibleDecisionLines } from './teamLoadoutVisibleDecisionText'
import './team-loadout-overview.distill.css'
import { orderVisibleFamilies, rebuildVisibleFamily } from './teamVisibleFamilyPresentation'
import { TeamGroup } from './TeamLoadoutRecommendationGroup'
import { visibleRecommendationFamilies } from './teamRecommendationVisibility'
import {
  filterTeamFamiliesByOutputSystem,
  normalizeTeamOutputSystemFilter,
  teamOutputSystemOptionsForFamilies,
  type TeamOutputSystemFilter,
} from './teamOutputSystemFilter'

import { TEAM_RECOMMENDATION_PAGE_SIZE } from './TeamLoadoutPagination'

function matchesRecommendedTeam(family: TeamLoadoutOverviewGroup['items'][number], query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  if (!normalizedQuery) return true
  const agentIds = new Set([
    ...family.coreAgentIds,
    ...family.variants.flatMap((variant) => variant.agentIds),
  ])
  return [family.title, ...[...agentIds].map(getAgentName)].some((value) =>
    value.toLocaleLowerCase().includes(normalizedQuery),
  )
}

export type TeamLoadoutOverviewUiState = {
  selectedId: string | null
  recommendedQuery: string
  onlyFavorites: boolean
  activeVariants: Record<string, string>
  selectedBangboos?: Record<string, string>
  recommendedPage: number
  includeReferenceDirections?: boolean
  outputSystem?: TeamOutputSystemFilter
}

export type TeamLoadoutOverviewProps = {
  scopeActions?: ReactNode
  answer: TeamLoadoutVisibleAnswer
  coverage: TeamLoadoutOverviewModel['coverage']
  groups: TeamLoadoutOverviewGroup[]
  favoriteAgentIds?: readonly string[]
  selectedId: string | null
  preparingItemId?: string | null
  preparationError?: { itemId: string; message: string } | null
  contextNote: string | null
  onSelect: (id: string) => void
  onPreviewSelectionChange?: () => void
  onPrimaryAction: (
    item: TeamLoadoutOverviewItem,
    bangboo?: { bangbooId: string; stars: 1 | 2 | 3 | 4 | 5 },
  ) => void
  onDeleteSaved?: (item: TeamLoadoutOverviewItem) => void
  onEmptyAction?: () => void
  recommendationBlock?: { reasons: readonly string[] }
  analysisStale?: boolean
  onReanalyze?: () => void
  restrictedByHardConstraints?: boolean
  initialUiState?: TeamLoadoutOverviewUiState
  onUiStateChange?: (state: TeamLoadoutOverviewUiState) => void
  bangbooStarsById?: Readonly<Record<string, 1 | 2 | 3 | 4 | 5>>
}

export function TeamLoadoutOverview({
  scopeActions,
  answer: sourceAnswer,
  coverage,
  groups: analysisGroups,
  favoriteAgentIds,
  selectedId,
  preparingItemId,
  preparationError,
  contextNote: sourceContextNote,
  onSelect,
  onPreviewSelectionChange,
  onPrimaryAction,
  onDeleteSaved,
  onEmptyAction,
  recommendationBlock,
  analysisStale = false,
  onReanalyze,
  restrictedByHardConstraints = false,
  initialUiState,
  onUiStateChange,
  bangbooStarsById,
}: TeamLoadoutOverviewProps) {
  const recommendationsBlocked = Boolean(recommendationBlock)
  const blockedReason = useMemo(
    () =>
      normalizeVisibleDecisionLines(recommendationBlock?.reasons, 'answer').join('；') ||
      '队伍推荐资料暂不可用，请稍后重新分析。',
    [recommendationBlock],
  )
  const { answer, contextNote } = useMemo(() => {
    return {
      answer: {
        ...sourceAnswer,
        summary: normalizeVisibleDecisionLines([sourceAnswer.summary], 'answer').join('；'),
        blockers: normalizeVisibleDecisionLines(sourceAnswer.blockers, 'answer'),
      },
      contextNote: sourceContextNote
        ? normalizeVisibleDecisionLines([sourceContextNote], 'answer').join('；')
        : null,
    }
  }, [sourceAnswer, sourceContextNote])
  // Favorites are a live display preference, not a reason to rerun the equipment solver.
  const groups = useMemo(() => {
    // A blocked authority cannot endorse fallback directions; saved plans remain accessible.
    const availableGroups = recommendationsBlocked
      ? analysisGroups.filter((group) => group.kind === 'saved')
      : analysisGroups
    return favoriteAgentIds
      ? availableGroups.map((group) => ({
          ...group,
          items: group.items.map((family) => ({
            ...family,
            variants: family.variants.map((item) => {
              const matches = item.agentIds.filter((id) => favoriteAgentIds.includes(id))
              return {
                ...item,
                favoriteMatchCount: matches.length,
                favoriteLabel: matches.length
                  ? `包含收藏：${matches.map(getAgentName).join('、')}`
                  : null,
                favoriteReason: matches.length
                  ? '收藏不改变队伍评级，也不要求每队都包含收藏角色。'
                  : null,
              }
            }),
          })),
        }))
      : availableGroups
  }, [analysisGroups, favoriteAgentIds, recommendationsBlocked])
  const motionScope = useRef<HTMLElement>(null)
  const previewRequested = useRef(false)
  const [previewRequest, setPreviewRequest] = useState(0)
  const showPreview = useCallback(() => {
    const heading = motionScope.current?.querySelector<HTMLElement>('#f5v-box-team-preview-title')
    heading?.focus({ preventScroll: true })
    motionScope.current
      ?.querySelector<HTMLElement>('.f5v-box-team-preview')
      ?.scrollIntoView?.({ block: 'start', behavior: 'instant' })
  }, [])
  const selectTeam = useCallback(
    (id: string) => {
      onSelect(id)
      const workspace = motionScope.current?.querySelector<HTMLElement>(
        '.f5v-box-team-overview__workspace',
      )
      const columns = workspace ? getComputedStyle(workspace).gridTemplateColumns.trim() : ''
      const stacked =
        columns !== '' && columns !== 'none' && columns.split(' ').filter(Boolean).length === 1
      if (stacked || window.matchMedia?.('(max-width: 980px)').matches) {
        previewRequested.current = true
        setPreviewRequest((request) => request + 1)
      }
    },
    [onSelect],
  )
  const returnToSelectedTeam = useCallback(() => {
    const row = motionScope.current?.querySelector<HTMLElement>(
      '.f5v-box-team-list button[aria-pressed="true"]',
    )
    const target = row ?? motionScope.current?.querySelector<HTMLElement>('input[type="search"]')
    target?.focus({ preventScroll: true })
    target?.scrollIntoView({ block: 'center', behavior: 'instant' })
  }, [])
  useEffect(() => {
    if (!previewRequested.current) return
    previewRequested.current = false
    showPreview()
  }, [previewRequest, selectedId, showPreview])
  const [recommendedQuery, setRecommendedQuery] = useState(initialUiState?.recommendedQuery ?? '')
  const [onlyFavorites, setOnlyFavorites] = useState(initialUiState?.onlyFavorites ?? false)
  const [outputSystem, setOutputSystem] = useState<TeamOutputSystemFilter>(() =>
    normalizeTeamOutputSystemFilter(initialUiState?.outputSystem),
  )
  const [activeVariants, setActiveVariants] = useState<Record<string, string>>(
    initialUiState?.activeVariants ?? {},
  )
  const [selectedBangboos, setSelectedBangboos] = useState<Record<string, string>>(
    initialUiState?.selectedBangboos ?? {},
  )
  const [recommendedPage, setRecommendedPage] = useState(initialUiState?.recommendedPage ?? 1)
  const updateRecommendedQuery = useCallback(
    (query: string) => {
      onPreviewSelectionChange?.()
      setRecommendedQuery(query)
      setRecommendedPage(1)
    },
    [onPreviewSelectionChange],
  )
  const updateOnlyFavorites = useCallback(
    (checked: boolean) => {
      onPreviewSelectionChange?.()
      setOnlyFavorites(checked)
      setRecommendedPage(1)
    },
    [onPreviewSelectionChange],
  )
  const updateOutputSystem = useCallback(
    (value: TeamOutputSystemFilter) => {
      onPreviewSelectionChange?.()
      setOutputSystem(value)
      setRecommendedPage(1)
    },
    [onPreviewSelectionChange],
  )
  const families = useMemo(
    () => groups.flatMap((group) => [...group.items, ...(group.referenceItems ?? [])]),
    [groups],
  )
  const hasRecommendedTeams = useMemo(
    () => groups.some((group) => group.kind === 'recommended' && group.items.length > 0),
    [groups],
  )
  const completionOnlyGroups = useMemo(
    () =>
      groups.filter(
        (group) => group.items.length === 0 && (group.completionCandidates?.length ?? 0) > 0,
      ),
    [groups],
  )
  const recommendedGroup = useMemo(
    () => groups.find((group) => group.kind === 'recommended'),
    [groups],
  )
  const recommendedSourceFamilies = useMemo(() => {
    // Reference items are filtered views of the same source families. Keep
    // the complete first view when search makes both scopes visible.
    const byId = new Map<string, TeamLoadoutOverviewFamily>()
    for (const family of [
      ...(recommendedGroup?.items ?? []),
      ...(recommendedGroup?.referenceItems ?? []),
    ]) {
      if (!byId.has(family.id)) byId.set(family.id, family)
    }
    return [...byId.values()]
  }, [recommendedGroup])
  const favoriteFilteredItems = useMemo(
    () =>
      recommendedSourceFamilies.flatMap((family) => {
        if (!onlyFavorites) return [family]
        const variants = family.variants.filter((variant) => variant.favoriteMatchCount > 0)
        return variants.length ? [rebuildVisibleFamily(family, variants)] : []
      }),
    [onlyFavorites, recommendedSourceFamilies],
  )
  const recommendedMatchingItems = useMemo(
    () =>
      favoriteFilteredItems.flatMap((family) => {
        if (!matchesRecommendedTeam(family, recommendedQuery)) return []
        const query = recommendedQuery.trim().toLocaleLowerCase()
        if (!query) return [family]
        const matchingVariants = family.variants.filter((variant) =>
          [variant.title, ...variant.agentIds.map(getAgentName)].some((text) =>
            text.toLocaleLowerCase().includes(query),
          ),
        )
        // A family-name search keeps all alternatives; a member search opens the
        // matching trio, rather than an unrelated remembered alternative.
        return matchingVariants.length && matchingVariants.length !== family.variants.length
          ? [rebuildVisibleFamily(family, matchingVariants)]
          : [family]
      }),
    [favoriteFilteredItems, recommendedQuery],
  )
  const outputSystemOptions = useMemo(
    () =>
      teamOutputSystemOptionsForFamilies(
        visibleRecommendationFamilies(recommendedSourceFamilies, false),
      ),
    [recommendedSourceFamilies],
  )
  const effectiveOutputSystem = useMemo<TeamOutputSystemFilter>(
    () =>
      outputSystem !== 'all' && !outputSystemOptions.some((option) => option.value === outputSystem)
        ? 'all'
        : outputSystem,
    [outputSystem, outputSystemOptions],
  )
  const visibleRecommendationItems = useMemo(
    () =>
      visibleRecommendationFamilies(
        recommendedMatchingItems,
        false,
        Boolean(recommendedQuery.trim()),
      ),
    [recommendedMatchingItems, recommendedQuery],
  )
  const orderedRecommendationItems = useMemo(
    () =>
      orderVisibleFamilies(
        filterTeamFamiliesByOutputSystem(visibleRecommendationItems, effectiveOutputSystem),
        activeVariants,
      ),
    [activeVariants, effectiveOutputSystem, visibleRecommendationItems],
  )
  const recommendationOrdinalById = useMemo(
    () => new Map(orderedRecommendationItems.map((family, index) => [family.id, index + 1])),
    [orderedRecommendationItems],
  )
  const recommendedPageCount = Math.max(
    1,
    Math.ceil(orderedRecommendationItems.length / TEAM_RECOMMENDATION_PAGE_SIZE),
  )
  const currentRecommendedPage = Math.min(recommendedPage, recommendedPageCount)
  const recommendationPageStart = (currentRecommendedPage - 1) * TEAM_RECOMMENDATION_PAGE_SIZE
  const recommendationItemsForDisplay = useMemo(
    () =>
      orderedRecommendationItems.slice(
        recommendationPageStart,
        recommendationPageStart + TEAM_RECOMMENDATION_PAGE_SIZE,
      ),
    [orderedRecommendationItems, recommendationPageStart],
  )
  const visibleGroups = useMemo(
    () =>
      groups.map((group) => {
        if (group.kind !== 'recommended') return group
        return { ...group, items: recommendationItemsForDisplay }
      }),
    [groups, recommendationItemsForDisplay],
  )
  const selectableFamilies = useMemo(
    () => [
      ...orderedRecommendationItems,
      ...groups.filter((group) => group.kind !== 'recommended').flatMap((group) => group.items),
    ],
    [groups, orderedRecommendationItems],
  )
  const selected = useMemo(
    () =>
      selectableFamilies.find((family) => family.id === selectedId) ??
      orderedRecommendationItems[0] ??
      (recommendationsBlocked ||
      (!onlyFavorites && !recommendedQuery.trim() && effectiveOutputSystem === 'all')
        ? selectableFamilies[0]
        : null) ??
      null,
    [
      onlyFavorites,
      orderedRecommendationItems,
      effectiveOutputSystem,
      recommendedQuery,
      recommendationsBlocked,
      selectableFamilies,
      selectedId,
    ],
  )
  const selectedRecommendationOrdinal =
    effectiveOutputSystem !== 'all' && selected
      ? (recommendationOrdinalById.get(selected.id) ?? null)
      : null
  const selectedVariantTeamId = selected?.id
  const visibleVariantId =
    selected?.variants.find((variant) => variant.id === activeVariants[selectedVariantTeamId ?? ''])
      ?.id ?? selected?.variants[0]?.id
  const previewIdentity = `${selected?.id ?? ''}:${visibleVariantId ?? ''}`
  const previousPreviewIdentity = useRef(previewIdentity)
  useLayoutEffect(() => {
    if (previousPreviewIdentity.current !== previewIdentity) onPreviewSelectionChange?.()
    previousPreviewIdentity.current = previewIdentity
  }, [previewIdentity, onPreviewSelectionChange])
  const updateSelectedVariant = useCallback(
    (variantId: string) => {
      if (!selectedVariantTeamId) return
      onPreviewSelectionChange?.()
      setActiveVariants((current) => ({ ...current, [selectedVariantTeamId]: variantId }))
    },
    [selectedVariantTeamId, onPreviewSelectionChange],
  )
  const selectBangboo = useCallback(
    (variantId: string, bangbooId: string) => {
      onPreviewSelectionChange?.()
      setSelectedBangboos((current) => ({ ...current, [variantId]: bangbooId }))
    },
    [onPreviewSelectionChange],
  )
  useLayoutEffect(() => {
    onUiStateChange?.({
      selectedId: selected?.id ?? null,
      recommendedQuery,
      onlyFavorites,
      outputSystem: effectiveOutputSystem,
      activeVariants,
      selectedBangboos,
      recommendedPage: currentRecommendedPage,
    })
  }, [
    selected?.id,
    recommendedQuery,
    onlyFavorites,
    effectiveOutputSystem,
    activeVariants,
    selectedBangboos,
    currentRecommendedPage,
    onUiStateChange,
  ])
  const selectedPreview = useMemo(
    () =>
      selected ? (
        <TeamPreview
          family={selected}
          activeVariantId={activeVariants[selected.id] ?? selected.variants[0]?.id}
          onVariantSelect={updateSelectedVariant}
          selectedBangboos={selectedBangboos}
          onSelectBangboo={selectBangboo}
          onPrimaryAction={onPrimaryAction}
          preparingItemId={preparingItemId}
          preparationError={preparationError}
          onReturnToList={returnToSelectedTeam}
          recommendationOrdinal={selectedRecommendationOrdinal}
          analysisStale={analysisStale}
          bangbooStarsById={bangbooStarsById}
        />
      ) : null,
    [
      activeVariants,
      analysisStale,
      bangbooStarsById,
      onPrimaryAction,
      preparationError,
      preparingItemId,
      returnToSelectedTeam,
      selected,
      selectedRecommendationOrdinal,
      selectedBangboos,
      selectBangboo,
      updateSelectedVariant,
    ],
  )
  const analysisActions = useMemo(
    () =>
      (analysisStale || recommendationsBlocked) && onReanalyze ? (
        <div
          className="f5v-box-team-run-state"
          role="status"
          aria-label={recommendationsBlocked ? '队伍建议暂时不可用' : '账户数据已更新'}
        >
          <button
            type="button"
            onClick={onReanalyze}
            title={
              recommendationsBlocked
                ? '重新读取当前资料并分析队伍'
                : '账户数据已更新，当前结果需要重新分析'
            }
          >
            重新分析当前队伍
          </button>
        </div>
      ) : null,
    [analysisStale, onReanalyze, recommendationsBlocked],
  )

  if (!families.length && !completionOnlyGroups.length) {
    const blocker = answer.blockers.find((text) => text !== answer.summary)
    const summary = coverage.available ? answer.summary : '当前版本暂无可用的队伍建议。'
    const description = [
      ...new Set(
        [
          ...(recommendationsBlocked ? [blockedReason] : [summary, blocker]),
          contextNote,
          analysisStale ? '结果已过期。' : null,
        ].filter((text): text is string => Boolean(text)),
      ),
    ].join(' ')
    return (
      <WorkbenchEmptyState
        title={recommendationsBlocked ? '队伍建议暂时不可用' : '当前没有可展示的队伍建议'}
        description={description}
        action={
          <>
            {onEmptyAction && !recommendationsBlocked ? (
              <button className="button button--primary" type="button" onClick={onEmptyAction}>
                前往代理人资产
              </button>
            ) : null}
            {(analysisStale || recommendationsBlocked) && onReanalyze ? (
              <button className="button" type="button" onClick={onReanalyze}>
                重新分析当前队伍
              </button>
            ) : null}
          </>
        }
      >
        {scopeActions}
      </WorkbenchEmptyState>
    )
  }

  return (
    <section className="f5v-box-team-overview" ref={motionScope}>
      <h1 className="f5v-box-team-page-title" tabIndex={-1}>
        当前队伍建议
      </h1>
      {!hasRecommendedTeams && families.length ? (
        <div className="f5v-box-team-overview__scope-actions">
          {scopeActions}
          {analysisActions}
        </div>
      ) : null}
      {recommendationsBlocked || answer.blockers.length || contextNote || !hasRecommendedTeams ? (
        <header className="f5v-box-team-overview__notice">
          {recommendationsBlocked ? (
            <p role="status">{blockedReason}</p>
          ) : (
            <>
              {!hasRecommendedTeams ? <p role="status">{answer.summary}</p> : null}
              {answer.blockers.length ? <p role="status">{answer.blockers[0]}</p> : null}
            </>
          )}
          {contextNote && contextNote !== blockedReason ? <p>{contextNote}</p> : null}
        </header>
      ) : null}

      {selected && restrictedByHardConstraints && !recommendationsBlocked ? (
        <section className="f5v-box-team-restricted-directions">
          <div>
            <h2>仍可参考的培养方向</h2>
            <p>调整当前固定条件后，可尝试以下搭配。</p>
          </div>
          <div className="f5v-box-team-overview__workspace">
            <div className="f5v-box-team-list" aria-label="当前固定条件下的队伍方向">
              {groups
                .filter((group) => group.kind === 'development' || group.kind === 'saved')
                .map((group) => (
                  <TeamGroup
                    key={group.kind}
                    group={group}
                    selectedId={selected.id}
                    activeVariants={activeVariants}
                    onSelect={onSelect}
                    onDeleteSaved={onDeleteSaved}
                  />
                ))}
            </div>
            {selectedPreview}
          </div>
        </section>
      ) : families.length ? (
        <div className="f5v-box-team-overview__workspace">
          <div className="f5v-box-team-list" aria-label="当前账户队伍方向">
            <button
              className="button button--quiet f5v-box-team-mobile-navigation"
              type="button"
              onClick={showPreview}
            >
              查看所选队伍
            </button>
            {visibleGroups.map((group) => (
              <TeamGroup
                key={group.kind}
                group={group}
                scopeActions={scopeActions}
                analysisActions={analysisActions}
                selectedId={selected?.id ?? ''}
                activeVariants={activeVariants}
                onSelect={selectTeam}
                onDeleteSaved={onDeleteSaved}
                recommendedQuery={recommendedQuery}
                onRecommendedQueryChange={updateRecommendedQuery}
                onlyFavorites={onlyFavorites}
                onOnlyFavoritesChange={updateOnlyFavorites}
                outputSystem={effectiveOutputSystem}
                outputSystemOptions={outputSystemOptions}
                onOutputSystemChange={updateOutputSystem}
                recommendationOrdinalById={recommendationOrdinalById}
                showRecommendationOrdinal={effectiveOutputSystem !== 'all'}
                recommendedPage={currentRecommendedPage}
                recommendedPageCount={recommendedPageCount}
                onRecommendedPageChange={setRecommendedPage}
              />
            ))}
          </div>
          {selectedPreview}
        </div>
      ) : completionOnlyGroups.length ? (
        <section className="f5v-box-team-completion-only" role="status">
          <h2>当前可补齐的队伍成员</h2>
          <p>
            暂时没有可推荐的队伍。可以先查看缺少的成员
            {analysisStale && onReanalyze ? '；请先重新分析。' : '。'}
          </p>
          {completionOnlyGroups.map((group) => (
            <TeamCompletionCandidates
              key={group.kind}
              candidates={group.completionCandidates ?? []}
            />
          ))}
          <div className="f5v-box-team-completion-only__actions">
            {onEmptyAction ? (
              <button className="f5v-box-team-primary" type="button" onClick={onEmptyAction}>
                前往代理人资产
              </button>
            ) : null}
            {analysisActions}
          </div>
        </section>
      ) : null}
    </section>
  )
}
