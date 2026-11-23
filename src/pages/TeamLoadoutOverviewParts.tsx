import { ratingExplanation } from './teamLoadoutRatingExplanation'
import { TeamLoadoutPreviewMembers } from './TeamLoadoutPreviewSummary'
import { ArrowRight, Check, ChevronRight, LoaderCircle } from 'lucide-react'
import { decisionFreshnessPresentation } from '../application/playerDecisionPresentation'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { getAgentName } from '../application/publicRosterNames'
import type { TeamLoadoutOverviewFamily, TeamLoadoutOverviewItem } from './teamLoadoutOverviewModel'
import { TeamBangbooSuggestions } from './TeamBangbooSuggestions'
import { orderTeamMembersForDisplay } from '../application/teamMemberDisplayOrder'
import { GraduationCompletionLabel } from './savedTeamGraduationPresentation'
import { TeamLoadoutEntityPortraits } from './TeamLoadoutEntityPortraits'
import { TeamLoadoutRowContent } from './TeamLoadoutRowContent'
import { preloadTeamLoadoutFamilyVisuals } from './teamLoadoutVisualPreload'
import {
  familyRatingLabel,
  ratingLabel,
  ratingTitle,
  referenceSummary,
} from './teamRatingPresentation'
import { teamOutputSystemLabel } from './teamOutputSystemFilter'
import { TeamGuidePreference } from '@soda/team-guide-preference'
import { TeamLoadoutDecisionSummary } from './TeamLoadoutDecisionSummary'
import { TeamLoadoutPreviewEquipment } from './TeamLoadoutPreviewEquipment'
import { useTeamSelectionMotion } from '../motion/useTeamSelectionMotion'
import { resolveTargetTeamBangbooOption } from '../decision/targetTeamSourceBangbooOptions'
import {
  normalizeVisibleDecisionLines,
  presentTeamDecision,
  presentTeamPreparationError,
} from './teamLoadoutVisibleDecisionText'

export {
  TeamSavedPlanList,
  TeamCompletionCandidates,
  TeamConstraintResetPanel,
} from './TeamLoadoutPreparation'

const emptyBangbooSuggestions: NonNullable<TeamLoadoutOverviewItem['bangbooSuggestions']> = []

function presentationReason(family: TeamLoadoutOverviewFamily) {
  return family.variants.length > 1 || /还需补齐装备|成员已齐，?可开始配装/.test(family.reason)
    ? null
    : (normalizeVisibleDecisionLines([family.reason], 'reason')[0] ?? null)
}

function variantAvailabilityLabel(status: TeamLoadoutOverviewItem['executionStatus']) {
  switch (status) {
    case 'direct':
      return '保持当前配装'
    case 'adjust':
      return '需要调整'
    case 'confirm':
      return '待确认'
    case 'build':
      return '还缺装备'
    case null:
      return '待配装'
  }
}

export function TeamRow({
  family,
  selected,
  activeVariantId,
  onSelect,
  recommendationOrdinal,
  showRecommendationOrdinal = false,
}: {
  family: TeamLoadoutOverviewFamily
  selected: boolean
  activeVariantId?: string
  onSelect: () => void
  recommendationOrdinal?: number
  showRecommendationOrdinal?: boolean
}) {
  const primary =
    family.variants.find((variant) => variant.id === activeVariantId) ?? family.variants[0]!
  const stateLabel =
    primary === family.variants[0]
      ? family.stateLabel
      : family.variants.length > 1
        ? `${primary.stateLabel} · ${family.variants.length} 种搭配`
        : primary.stateLabel
  const reason = presentationReason(family)
  const systemLabel = [
    teamOutputSystemLabel(primary),
    showRecommendationOrdinal && recommendationOrdinal ? `第 ${recommendationOrdinal} 队` : null,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <button
      className={`f5v-box-team-row${selected ? ' is-selected' : ''}`}
      type="button"
      aria-pressed={selected}
      aria-label={[family.title, stateLabel, reason].filter(Boolean).join('，')}
      onPointerEnter={() => preloadTeamLoadoutFamilyVisuals(family)}
      onFocus={() => preloadTeamLoadoutFamilyVisuals(family)}
      onClick={() => {
        preloadTeamLoadoutFamilyVisuals(family)
        onSelect()
      }}
    >
      <TeamLoadoutRowContent
        item={primary}
        title={family.title}
        rating={
          <small className="f5v-box-team-reference" title={ratingTitle(primary)}>
            {familyRatingLabel(family, primary)}
          </small>
        }
        meta={
          <>
            <small className={`f5v-box-team-state is-${primary.kind}`}>{stateLabel}</small>
            <small className="f5v-box-team-system-label">{systemLabel}</small>
            {primary.kind === 'saved' && primary.graduationCompletion?.score != null ? (
              <GraduationCompletionLabel completion={primary.graduationCompletion} />
            ) : null}
          </>
        }
      />
      {reason ? <span className="f5v-box-team-row__reason">{reason}</span> : null}
    </button>
  )
}

export function TeamDecisionCard({
  family,
  selected,
  activeVariantId,
  onSelect,
  recommendationOrdinal,
  showRecommendationOrdinal = false,
}: {
  family: TeamLoadoutOverviewFamily
  selected: boolean
  activeVariantId?: string
  onSelect: () => void
  recommendationOrdinal?: number
  showRecommendationOrdinal?: boolean
}) {
  const primary =
    family.variants.find((variant) => variant.id === activeVariantId) ?? family.variants[0]!
  const reason = presentationReason(family)
  const stateLabel = primary === family.variants[0] ? family.stateLabel : primary.stateLabel
  const systemLabel = [
    teamOutputSystemLabel(primary),
    showRecommendationOrdinal && recommendationOrdinal ? `第 ${recommendationOrdinal} 队` : null,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <button
      className={`f5v-box-team-decision-card${selected ? ' is-selected' : ''}`}
      type="button"
      aria-pressed={selected}
      aria-label={[family.title, stateLabel, reason].filter(Boolean).join('，')}
      onPointerEnter={() => preloadTeamLoadoutFamilyVisuals(family)}
      onFocus={() => preloadTeamLoadoutFamilyVisuals(family)}
      onClick={() => {
        preloadTeamLoadoutFamilyVisuals(family)
        onSelect()
      }}
    >
      <TeamLoadoutEntityPortraits item={primary} />
      <span className="f5v-box-team-decision-card__copy">
        <span className="f5v-box-team-card__title-line">
          <strong>{family.title}</strong>
          <small className="f5v-box-team-reference" title={ratingTitle(primary)}>
            {familyRatingLabel(family, primary)}
          </small>
        </span>
        <span className="f5v-box-team-card__meta-line">
          <small className={`f5v-box-team-state is-${primary.kind}`}>{stateLabel}</small>
          <small className="f5v-box-team-system-label">{systemLabel}</small>
        </span>
        {reason ? <span className="f5v-box-team-decision-card__reason">{reason}</span> : null}
      </span>
      <ChevronRight aria-hidden="true" size={20} />
    </button>
  )
}

export const TeamPreview = memo(function TeamPreview({
  family,
  activeVariantId,
  onVariantSelect,
  selectedBangboos,
  onSelectBangboo,
  onPrimaryAction,
  preparingItemId,
  preparationError,
  onReturnToList,
  recommendationOrdinal,
  analysisStale = false,
  bangbooStarsById,
}: {
  family: TeamLoadoutOverviewFamily
  activeVariantId?: string
  onVariantSelect?: (id: string) => void
  selectedBangboos?: Readonly<Record<string, string>>
  onSelectBangboo?: (variantId: string, bangbooId: string) => void
  onPrimaryAction: (
    item: TeamLoadoutOverviewItem,
    bangboo?: { bangbooId: string; stars: 1 | 2 | 3 | 4 | 5 },
  ) => void
  preparingItemId?: string | null
  preparationError?: { itemId: string; message: string } | null
  onReturnToList?: () => void
  recommendationOrdinal?: number | null
  analysisStale?: boolean
  bangbooStarsById?: Readonly<Record<string, 1 | 2 | 3 | 4 | 5>>
}) {
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const effectiveVariantId = activeVariantId ?? selectedVariantId ?? family.variants[0]?.id ?? ''
  const item =
    family.variants.find((variant) => variant.id === effectiveVariantId) ?? family.variants[0]!
  const variants = family.variants
  const [localBangboos, setLocalBangboos] = useState<Record<string, string>>({})
  const options = item.bangbooSuggestions ?? emptyBangbooSuggestions
  const hasSchemeParameters = item.kind === 'saved' || item.executionStatus != null
  const automaticBangbooId = useMemo(() => {
    for (const option of options) {
      if (option.activationStatus === 'inactive' || option.activationStatus === 'unknown') continue
      const stars = bangbooStarsById?.[option.bangbooId]
      if (!stars || stars >= option.defaultStars) return option.bangbooId
      const atCurrentStars = resolveTargetTeamBangbooOption(
        {
          memberIds: item.agentIds,
          bangbooStarsById: { [option.bangbooId]: stars },
        },
        option.bangbooId,
      )
      if (atCurrentStars?.activationStatus === 'active') return option.bangbooId
    }
    return undefined
  }, [options, bangbooStarsById, item.agentIds])
  const selectedBangbooId =
    item.kind === 'saved'
      ? item.bangbooId
      : (options.find((option) => option.bangbooId === (selectedBangboos ?? localBangboos)[item.id])
          ?.bangbooId ??
        (hasSchemeParameters ? item.bangbooId : undefined) ??
        automaticBangbooId ??
        item.bangbooId)
  const selectedSuggestion = options.find((option) => option.bangbooId === selectedBangbooId)
  const schemeStars = selectedBangbooId === item.bangbooId ? item.bangbooStars : undefined
  const accountStars = selectedBangbooId ? bangbooStarsById?.[selectedBangbooId] : undefined
  const selectedStars =
    hasSchemeParameters && selectedBangbooId === item.bangbooId
      ? schemeStars
      : (accountStars ?? schemeStars)
  const chosenStars = selectedBangbooId
    ? (selectedStars ?? (item.kind === 'saved' ? undefined : selectedSuggestion?.defaultStars))
    : undefined
  const [expandedFamilyId, setExpandedFamilyId] = useState<string | null>(null)
  const expandedVariants = expandedFamilyId === family.id
  const visibleVariants = expandedVariants
    ? variants
    : [item, ...variants.filter((entry) => entry.id !== item.id)].slice(0, 4)
  const decisionPresentation = presentTeamDecision(item)
  const selectedBangbooOption = useMemo(() => {
    if (!selectedBangbooId) return null
    if (selectedSuggestion && (!selectedStars || selectedStars === selectedSuggestion.defaultStars))
      return selectedSuggestion
    return resolveTargetTeamBangbooOption(
      {
        memberIds: item.agentIds,
        bangbooStarsById: selectedStars ? { [selectedBangbooId]: selectedStars } : undefined,
      },
      selectedBangbooId,
    )
  }, [selectedBangbooId, selectedSuggestion, selectedStars, item.agentIds])
  const ratingNote = ratingExplanation(item)
  const orderedAgentIds = orderTeamMembersForDisplay(
    item.agentIds,
    (id) => id,
    item.deploymentOrder,
  ).slice(0, 3)

  const variantMotionRef = useRef<HTMLDivElement>(null)
  useTeamSelectionMotion({
    scope: variantMotionRef,
    selectionKey: item.id,
    memberIds: orderedAgentIds,
  })

  useEffect(() => {
    preloadTeamLoadoutFamilyVisuals(family)
  }, [family])

  return (
    <aside
      className="f5v-box-team-preview"
      data-motion-team-preview
      aria-labelledby="f5v-box-team-preview-title"
      data-result-state={analysisStale ? 'stale' : item.kind === 'saved' ? 'saved' : 'current'}
    >
      <div className="f5v-box-team-preview__scroll" ref={variantMotionRef}>
        {onReturnToList ? (
          <button
            className="button button--quiet f5v-box-team-mobile-navigation"
            type="button"
            onClick={onReturnToList}
          >
            返回队伍列表
          </button>
        ) : null}
        <header>
          <div className="f5v-box-team-preview__title-line">
            <span className="f5v-box-team-preview__reference" title={ratingTitle(item)}>
              {ratingLabel(item)}
            </span>
            <h2 id="f5v-box-team-preview-title" tabIndex={-1}>
              {item.kind === 'saved' ? family.title : item.title}
            </h2>
            <span className={`f5v-box-team-state is-${item.kind}`}>{item.stateLabel}</span>
            <span className="f5v-box-team-preview__system">
              体系：{teamOutputSystemLabel(item)}
              {recommendationOrdinal ? ` · 第 ${recommendationOrdinal} 队` : null}
            </span>
          </div>
          {ratingNote ? <p className="f5v-box-team-preview__rating-note">{ratingNote}</p> : null}
          {(item.kind !== 'saved' && family.title !== item.title) || item.favoriteLabel ? (
            <div className="f5v-box-team-preview__context">
              {item.kind !== 'saved' && family.title !== item.title ? (
                <span className="f5v-box-team-family-context">
                  {family.title} · {variants.length} 种搭配
                </span>
              ) : null}
              {item.favoriteLabel ? (
                <span className="f5v-box-team-favorite-match">{item.favoriteLabel}</span>
              ) : null}
            </div>
          ) : null}
          {analysisStale ? (
            <p className="f5v-box-team-freshness" role="status">
              {decisionFreshnessPresentation('stale').detail}
            </p>
          ) : null}
          {item.kind === 'saved' && item.graduationCompletion?.score != null ? (
            <GraduationCompletionLabel completion={item.graduationCompletion} />
          ) : null}
        </header>
        <nav className="f5v-box-team-preview__actions" aria-label="所选队伍操作">
          {preparationError?.itemId === item.id ? (
            <p className="f5v-box-team-preview__prepare-error" role="alert">
              {presentTeamPreparationError(preparationError.message, item.kind === 'saved')}
            </p>
          ) : null}
          <button
            className="f5v-box-team-primary"
            type="button"
            disabled={preparingItemId === item.id || analysisStale}
            aria-busy={preparingItemId === item.id}
            data-player-route={item.destination}
            onClick={() => {
              if (selectedBangbooId && chosenStars && chosenStars >= 1 && chosenStars <= 5)
                onPrimaryAction(item, {
                  bangbooId: selectedBangbooId,
                  stars: chosenStars as 1 | 2 | 3 | 4 | 5,
                })
              else onPrimaryAction(item)
            }}
          >
            {preparingItemId === item.id ? (
              <LoaderCircle className="f5v-box-team-busy-icon" size={17} aria-hidden="true" />
            ) : null}
            {preparingItemId === item.id
              ? item.kind === 'saved'
                ? '正在打开保存方案…'
                : '正在搭配装备…'
              : preparationError?.itemId === item.id
                ? item.kind === 'saved'
                  ? '重试打开方案'
                  : '重试配装'
                : item.primaryLabel}
            {preparingItemId !== item.id && !analysisStale ? (
              <ArrowRight size={17} aria-hidden="true" />
            ) : null}
          </button>
        </nav>

        <TeamLoadoutPreviewMembers
          item={item}
          agentIds={orderedAgentIds}
          presentation={decisionPresentation}
        />

        <div data-motion-variant-content>
          <TeamBangbooSuggestions
            options={options}
            memberIds={item.agentIds}
            selectedBangbooId={selectedBangbooId}
            selectedBangbooLabel={
              selectedBangbooId === item.bangbooId ? item.bangbooLabel : undefined
            }
            selectedBangbooStars={selectedStars}
            selectedBangbooStarLabel={
              hasSchemeParameters && selectedBangbooId === item.bangbooId ? '方案' : '当前'
            }
            selectedOption={selectedBangbooOption}
            accountStarsById={bangbooStarsById}
            onSelect={
              item.kind === 'saved'
                ? undefined
                : (bangbooId) => {
                    if (onSelectBangboo) onSelectBangboo(item.id, bangbooId)
                    else setLocalBangboos((current) => ({ ...current, [item.id]: bangbooId }))
                  }
            }
          />
          <TeamLoadoutDecisionSummary item={item} presentation={decisionPresentation} />
          <TeamLoadoutPreviewEquipment item={item} agentIds={orderedAgentIds} />
          <TeamGuidePreference
            key={item.id}
            memberIds={item.agentIds}
            presentation={item.guidePreference}
          />
          {variants.length > 1 ? (
            <section className="f5v-box-team-variants" aria-label="可选搭配">
              <h3>替换成员</h3>
              <div role="group" aria-label="切换可选搭配">
                {visibleVariants.map((variant) => {
                  const isCurrent = variant.id === item.id
                  const replacementAgentIds = variant.agentIds.filter(
                    (agentId) => !item.agentIds.includes(agentId),
                  )
                  const replacementNames = replacementAgentIds.map(getAgentName)
                  const portraitAgentId =
                    replacementAgentIds[0] ?? (isCurrent ? null : variant.agentIds[0])
                  const replacement = {
                    ...variant,
                    agentIds: portraitAgentId ? [portraitAgentId] : [],
                    bangbooId: null,
                  }
                  const label = isCurrent ? '当前搭配' : replacementNames.join('、') || '另一种搭配'
                  const availabilityLabel =
                    variantAvailabilityLabel(variant.executionStatus) ?? '待配装'
                  const bangbooChanged =
                    variant.bangbooId !== item.bangbooId && Boolean(variant.bangbooLabel)
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      className={`f5v-box-team-variant-button${isCurrent ? ' is-selected' : ''}`}
                      aria-label={[
                        availabilityLabel,
                        label,
                        referenceSummary(variant),
                        bangbooChanged ? `邦布：${variant.bangbooLabel}` : null,
                      ]
                        .filter(Boolean)
                        .join('，')}
                      aria-pressed={isCurrent}
                      onClick={() => {
                        setSelectedVariantId(variant.id)
                        onVariantSelect?.(variant.id)
                      }}
                    >
                      <span className="f5v-box-team-variant-leading" aria-hidden="true">
                        {isCurrent ? (
                          <span className="f5v-box-team-variant-current-icon">
                            <Check size={15} strokeWidth={2.6} />
                          </span>
                        ) : (
                          <>
                            <TeamLoadoutEntityPortraits item={replacement} />
                            {replacementAgentIds.length > 1 ? (
                              <span className="f5v-box-team-variant-avatar-count">
                                +{replacementAgentIds.length - 1}
                              </span>
                            ) : null}
                          </>
                        )}
                      </span>
                      <span className="f5v-box-team-variant-name">
                        <strong title={label}>{label}</strong>
                        {bangbooChanged ? (
                          <small title={variant.bangbooLabel}>邦布 · {variant.bangbooLabel}</small>
                        ) : null}
                      </span>
                      <span className="f5v-box-team-variant-meta">
                        <span className="f5v-box-team-variant-rating" title={ratingTitle(variant)}>
                          {ratingLabel(variant)}
                        </span>
                        <span
                          className={`f5v-box-team-variant-status is-${
                            variant.executionStatus ?? 'pending'
                          }`}
                        >
                          {availabilityLabel}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
              {variants.length > 4 ? (
                <button
                  className="f5v-box-team-variants-more"
                  type="button"
                  onClick={() => setExpandedFamilyId(expandedVariants ? null : family.id)}
                >
                  {expandedVariants ? '收起替补' : `展开其余 ${variants.length - 4} 种搭配`}
                </button>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>
    </aside>
  )
})
