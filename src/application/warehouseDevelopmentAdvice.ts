import type { DriveDisc } from '../domain/schemas'
import type { DiscEnhancementPotential } from '../warehouse/discEnhancementPotential'
import { driveDiscData } from '../data/gameData'
import { getCandidateWarehouseConstraint } from '../gameDataPacks/candidateWarehouseConstraints'
import type { WarehouseDevelopmentAdvice } from './warehouseDevelopmentPresentation'

export {
  compareWarehouseDevelopmentAdvice,
  warehouseDevelopmentAction,
} from './warehouseDevelopmentPresentation'
export type { WarehouseDevelopmentAdvice } from './warehouseDevelopmentPresentation'

export function warehouseDevelopmentAdvice(
  disc: DriveDisc,
  potential: DiscEnhancementPotential,
  usageAgentIds: readonly string[],
  demandAgentIds: ReadonlySet<string>,
  useAssessment?: import('../warehouse/warehouseUseAssessment').WarehouseUseAssessment,
): WarehouseDevelopmentAdvice {
  const improvingDemandAgentIds = (potential.improvableAgentIds ?? []).filter((id) =>
    demandAgentIds.has(id),
  )
  const remaining = potential.remainingEnhancementNodes
  const maxLevel = driveDiscData?.rules.maxLevelByRarity[disc.rarity ?? 'S']
  const nextReviewLevel =
    maxLevel !== undefined && disc.level < maxLevel
      ? Math.min(maxLevel, Math.floor(disc.level / 3) * 3 + 3)
      : null
  if (useAssessment) {
    const kind =
      useAssessment.status === 'verify'
        ? useAssessment.basis === 'invalid_record'
          ? 'verify_record'
          : 'verify_use'
        : useAssessment.worthInvestment && nextReviewLevel !== null
          ? 'review_after_enhance'
          : remaining === 0
            ? 'review_finished'
            : useAssessment.basis === 'poor_seed' || useAssessment.basis === 'failed_rolls'
              ? 'stop_investment'
              : 'hold_for_need'
    return {
      kind,
      currentEffectiveRolls: useAssessment.effectiveRolls,
      optimisticEffectiveRolls: null,
      effectiveAgentId: useAssessment.agentId,
      remainingNodes: remaining,
      nextReviewLevel: kind === 'review_after_enhance' ? nextReviewLevel : null,
      improvingDemandAgentIds: useAssessment.worthInvestment ? useAssessment.retainedAgentIds : [],
      priority: kind === 'review_after_enhance' ? 0 : kind === 'verify_record' ? 5 : 3,
    }
  }
  const effectiveAgentId =
    improvingDemandAgentIds[0] ??
    potential.relevantAgentIds.find((id) => demandAgentIds.has(id)) ??
    null
  const effectiveWeights = effectiveAgentId
    ? getCandidateWarehouseConstraint(effectiveAgentId)?.subStatWeights
    : null
  const kind = !potential.potentialEvaluated
    ? 'verify_record'
    : remaining === 0
      ? 'review_finished'
      : potential.investmentStopReason ||
          potential.developmentAlternativeIds?.length ||
          potential.optimisticCeilingDominated
        ? 'prefer_alternative'
        : improvingDemandAgentIds.length
          ? 'review_after_enhance'
          : 'hold_for_need'
  return {
    kind,
    currentEffectiveRolls:
      potential.potentialEvaluated && effectiveWeights
        ? disc.subStats.reduce(
            (sum, stat) => sum + ((effectiveWeights[stat.stat] ?? 0) > 0 ? stat.upgrades + 1 : 0),
            0,
          )
        : null,
    // Cross-agent maxima are deliberately not presented as one agent's growth path.
    optimisticEffectiveRolls: null,
    effectiveAgentId,
    remainingNodes: remaining,
    nextReviewLevel,
    improvingDemandAgentIds,
    priority:
      kind === 'review_after_enhance'
        ? improvingDemandAgentIds.some((id) => usageAgentIds.includes(id))
          ? 0
          : 1
        : kind === 'prefer_alternative'
          ? 2
          : kind === 'hold_for_need'
            ? 3
            : kind === 'review_finished'
              ? 4
              : 5,
  }
}
