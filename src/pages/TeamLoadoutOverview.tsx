import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { getAgentName } from '../application/publicRosterNames'
import { useStateTransitionMotion } from '../motion/useStateTransitionMotion'
import { TeamCompletionCandidates, TeamPreview } from './TeamLoadoutOverviewParts'
import type {
  TeamLoadoutOverviewGroup,
  TeamLoadoutOverviewItem,
  TeamLoadoutOverviewModel,
  TeamLoadoutVisibleAnswer,
} from './teamLoadoutOverviewTypes'
import './team-loadout-overview.css'
import './team-loadout-overview.distill.css'
import { rebuildVisibleFamily } from './teamVisibleFamilyPresentation'
import { TeamGroup } from './TeamLoadoutRecommendationGroup'
import { visibleRecommendationFamilies } from './teamRecommendationVisibility'

const recommendedPageSize = 10

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
  recommendedPage: number
  includeReferenceDirections?: boolean
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
  onPrimaryAction: (item: TeamLoadoutOverviewItem) => void
  onDeleteSaved?: (item: TeamLoadoutOverviewItem) => void
  onEmptyAction: () => void
  analysisStale?: boolean
  onReanalyze?: () => void
  restrictedByHardConstraints?: boolean
  initialUiState?: TeamLoadoutOverviewUiState
  onUiStateChange?: (state: TeamLoadoutOverviewUiState) => void
}

export function TeamLoadoutOverview({
  scopeActions,
  answer,
  coverage,
  groups: analysisGroups,
  favoriteAgentIds,
  selectedId,
  preparingItemId,
  preparationError,
  contextNote,
  onSelect,
  onPrimaryAction,
  onDeleteSaved,
  onEmptyAction,
  analysisStale = false,
  onReanalyze,
  restrictedByHardConstraints = false,
  initialUiState,
  onUiStateChange,
}: TeamLoadoutOverviewProps) {
  // Favorites are a live display preference, not a reason to rerun the equipment solver.
  const groups = useMemo(
    () =>
      favoriteAgentIds
        ? analysisGroups.map((group) => ({
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
        : analysisGroups,
    [analysisGroups, favoriteAgentIds],
  )
  const motionScope = useRef<HTMLElement>(null)
  const previewRequested = useRef(false)
  const [previewRequest, setPreviewRequest] = useState(0)
  const showPreview = () => {
    const heading = motionScope.current?.querySelector<HTMLElement>('#f5v-box-team-preview-title')
    heading?.focus({ preventScroll: true })
    motionScope.current
      ?.querySelector<HTMLElement>('.f5v-box-team-preview')
      ?.scrollIntoView({ block: 'start', behavior: 'instant' })
  }
  const selectTeam = (id: string) => {
    onSelect(id)
    if (window.matchMedia?.('(max-width: 980px)').matches) {
      previewRequested.current = true
      setPreviewRequest((request) => request + 1)
    }
  }
  const returnToSelectedTeam = () => {
    const row = motionScope.current?.querySelector<HTMLElement>(
      '.f5v-box-team-list button[aria-pressed="true"]',
    )
    const target = row ?? motionScope.current?.querySelector<HTMLElement>('input[type="search"]')
    target?.focus({ preventScroll: true })
    target?.scrollIntoView({ block: 'center', behavior: 'instant' })
  }
  useEffect(() => {
    if (!previewRequested.current) return
    previewRequested.current = false
    showPreview()
  }, [previewRequest, selectedId])
  const [recommendedQuery, setRecommendedQuery] = useState(initialUiState?.recommendedQuery ?? '')
  const [onlyFavorites, setOnlyFavorites] = useState(initialUiState?.onlyFavorites ?? false)
  const [activeVariants, setActiveVariants] = useState<Record<string, string>>(
    initialUiState?.activeVariants ?? {},
  )
  const [recommendedPage, setRecommendedPage] = useState(initialUiState?.recommendedPage ?? 1)
  const families = groups.flatMap((group) => group.items)
  const hasRecommendedTeams = groups.some(
    (group) => group.kind === 'recommended' && group.items.length > 0,
  )
  const completionOnlyGroups = groups.filter(
    (group) => group.items.length === 0 && (group.completionCandidates?.length ?? 0) > 0,
  )
  const recommendedGroup = groups.find((group) => group.kind === 'recommended')
  const favoriteFilteredItems = useMemo(
    () =>
      (recommendedGroup?.items ?? []).flatMap((family) => {
        if (!onlyFavorites) return [family]
        const variants = family.variants.filter((variant) => variant.favoriteMatchCount > 0)
        return variants.length ? [rebuildVisibleFamily(family, variants)] : []
      }),
    [recommendedGroup, onlyFavorites],
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
  const orderedRecommendationItems = useMemo(
    () =>
      visibleRecommendationFamilies(
        recommendedMatchingItems,
        false,
        Boolean(recommendedQuery.trim()),
      ),
    [recommendedMatchingItems, recommendedQuery],
  )
  const recommendedPageCount = Math.max(
    1,
    Math.ceil(orderedRecommendationItems.length / recommendedPageSize),
  )
  const currentRecommendedPage = Math.min(recommendedPage, recommendedPageCount)
  const recommendationPageStart = (currentRecommendedPage - 1) * recommendedPageSize
  const recommendationItemsForDisplay = orderedRecommendationItems.slice(
    recommendationPageStart,
    recommendationPageStart + recommendedPageSize,
  )
  const visibleGroups = groups.map((group) => {
    if (group.kind !== 'recommended') return group
    return { ...group, items: recommendationItemsForDisplay }
  })
  const selectableFamilies = [
    ...orderedRecommendationItems,
    ...groups.filter((group) => group.kind !== 'recommended').flatMap((group) => group.items),
  ]
  const selected =
    selectableFamilies.find((family) => family.id === selectedId) ??
    orderedRecommendationItems[0] ??
    (!onlyFavorites && !recommendedQuery.trim() ? selectableFamilies[0] : null) ??
    null
  useEffect(() => {
    onUiStateChange?.({
      selectedId: selected?.id ?? null,
      recommendedQuery,
      onlyFavorites,
      activeVariants,
      recommendedPage: currentRecommendedPage,
    })
  }, [
    selected?.id,
    recommendedQuery,
    onlyFavorites,
    activeVariants,
    currentRecommendedPage,
    onUiStateChange,
  ])
  const updateRecommendedQuery = (query: string) => {
    setRecommendedQuery(query)
    setRecommendedPage(1)
  }
  useStateTransitionMotion({
    scope: motionScope,
    stateKey: selected?.id ?? 'empty',
    target: '[data-motion-team-preview]',
    animateOnMount: true,
  })

  return (
    <section className="f5v-box-team-overview" ref={motionScope}>
      <h1 className="f5v-box-team-page-title" tabIndex={-1}>
        当前队伍建议
      </h1>
      {!hasRecommendedTeams ? scopeActions : null}
      {answer.blockers.length ||
      contextNote ||
      !coverage.available ||
      analysisStale ||
      !hasRecommendedTeams ? (
        <header className="f5v-box-team-overview__notice">
          {!hasRecommendedTeams ? <p role="status">{answer.summary}</p> : null}
          {answer.blockers.length ? <p role="status">{answer.blockers[0]}</p> : null}
          {contextNote ? <p>{contextNote}</p> : null}
          {!coverage.available ? <p>部分代理人资料待补齐；仅显示资料完整的队伍</p> : null}
          {analysisStale && onReanalyze ? (
            <div className="f5v-box-team-run-state" role="status" aria-label="账户数据已更新">
              <span>结果已过期</span>
              <button type="button" onClick={onReanalyze}>
                重新分析当前队伍
              </button>
            </div>
          ) : null}
        </header>
      ) : null}

      {selected && restrictedByHardConstraints ? (
        <section className="f5v-box-team-restricted-directions">
          <div>
            <h2>仍可参考的培养方向</h2>
            <p>这些队伍搭配方向仍然成立，但在当前固定条件下不能作为可直接执行的答案。</p>
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
            <TeamPreview
              key={selected.id}
              family={selected}
              activeVariantId={activeVariants[selected.id] ?? selected.variants[0]?.id}
              onVariantSelect={(id) =>
                setActiveVariants((current) => ({ ...current, [selected.id]: id }))
              }
              onPrimaryAction={onPrimaryAction}
              preparingItemId={preparingItemId}
              preparationError={preparationError}
              onReturnToList={returnToSelectedTeam}
            />
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
                selectedId={selected?.id ?? ''}
                activeVariants={activeVariants}
                onSelect={selectTeam}
                onDeleteSaved={onDeleteSaved}
                recommendedQuery={recommendedQuery}
                onRecommendedQueryChange={updateRecommendedQuery}
                onlyFavorites={onlyFavorites}
                onOnlyFavoritesChange={(checked) => {
                  setOnlyFavorites(checked)
                  setRecommendedPage(1)
                }}
                recommendedPage={currentRecommendedPage}
                recommendedPageCount={recommendedPageCount}
                onRecommendedPageChange={setRecommendedPage}
              />
            ))}
          </div>
          {selected ? (
            <TeamPreview
              key={selected.id}
              family={selected}
              activeVariantId={activeVariants[selected.id] ?? selected.variants[0]?.id}
              onVariantSelect={(id) =>
                setActiveVariants((current) => ({ ...current, [selected.id]: id }))
              }
              onPrimaryAction={onPrimaryAction}
              preparingItemId={preparingItemId}
              preparationError={preparationError}
              onReturnToList={returnToSelectedTeam}
            />
          ) : null}
        </div>
      ) : completionOnlyGroups.length ? (
        <section className="f5v-box-team-completion-only" role="status">
          <h2>当前可补齐的队伍成员</h2>
          <p>暂时没有可推荐的队伍。可以先查看缺少的成员，或重新分析。</p>
          {completionOnlyGroups.map((group) => (
            <TeamCompletionCandidates
              key={group.kind}
              candidates={group.completionCandidates ?? []}
            />
          ))}
          <button className="f5v-box-team-primary" type="button" onClick={onEmptyAction}>
            前往代理人资产
          </button>
        </section>
      ) : (
        <section className="f5v-box-team-empty" role="status">
          <h2>当前没有可展示的队伍建议</h2>
          <p>现有账户事实还不足以形成可靠建议，不会用过期资料补齐答案。</p>
          <button className="f5v-box-team-primary" type="button" onClick={onEmptyAction}>
            前往代理人资产
          </button>
        </section>
      )}
    </section>
  )
}
