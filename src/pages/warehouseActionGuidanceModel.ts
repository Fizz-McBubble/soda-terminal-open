import type { WarehouseActionNextStep } from '../application/warehouseActionContract'
import type { WarehouseActionItem } from '../application/warehouseActionProjection'
import { retentionUseMatchesRecommendedSet } from '../warehouse/warehouseRetentionGuidance'

export function hasMismatchedRecommendationWitness(item: WarehouseActionItem) {
  if (item.finalRecommendation?.basis === 'explicit_protection') return false
  const evidence = item.absoluteRetention
  const witnesses = new Set(evidence?.witnessProfileIds ?? [])
  return (evidence?.leadingUses ?? []).some(
    (use) =>
      witnesses.has(use.profileId) &&
      use.branchSetPlan &&
      !(
        evidence?.reasonKind === 'conditional_use' &&
        use.functionalState === 'needs_build_context' &&
        use.twoPieceFit === 'valid'
      ) &&
      !retentionUseMatchesRecommendedSet(item.disc.setId, use),
  )
}

const actualProtectionStatuses = new Set([
  'currently_equipped',
  'active_plan_reference',
  'saved_plan_reference',
  'selected_portfolio_reference',
])

function hasActualProtection(item: WarehouseActionItem) {
  return (
    item.statuses.some((status) => actualProtectionStatuses.has(status)) ||
    item.usageAgentIds.length > 0 ||
    item.affectedPlans.some((plan) => plan.state === 'saved')
  )
}

export function hasFavoriteOnlyProtection(item: WarehouseActionItem) {
  return (
    (item.statuses.includes('favorite') || item.cleanupAssessment?.favorite === true) &&
    !hasActualProtection(item)
  )
}

/** Historical favorites remain a protection source without restoring an editing control. */
export function playerFacingNextStep(
  item: WarehouseActionItem,
): WarehouseActionNextStep | undefined {
  const nextStep = item.nextStep
  if (item.recommendationState === 'stale') return nextStep
  if (hasFavoriteOnlyProtection(item))
    return {
      kind: 'keep',
      targetLevel: null,
      detail: '这张盘已标记保留。',
      stopWhen: '',
    }
  if (!nextStep) return nextStep
  if (
    item.finalRecommendation?.basis !== 'explicit_protection' &&
    !/收藏|保留记录|标记保留/.test(nextStep.detail)
  )
    return nextStep
  if (!hasActualProtection(item)) return undefined
  return {
    ...nextStep,
    detail: '这张盘已被装备或方案使用。',
    stopWhen: '',
  }
}

export function needsWarehouseDecisionRecheck(item: WarehouseActionItem) {
  return (
    hasMismatchedRecommendationWitness(item) ||
    (item.action === 'cleanup' && !item.cleanupAssessment && !item.absoluteRetention)
  )
}
