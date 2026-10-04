import {
  legalSubStats,
  optimisticCeiling,
  type DimensionCeiling,
  type PotentialDimension,
} from './discEnhancementCeiling'
import {
  normalizedScore,
  weightFor,
  rollScale,
  realizedScore,
  hasConsistentDevelopmentStats,
} from './discEnhancementScoring'
import type { DriveDisc } from '../domain/schemas'
import { evaluationRules } from '../evaluation/rules'
import type { SubStatHistory } from '../evaluation/subStatHistory'
import type { CandidateWarehouseConstraint } from '../gameDataPacks/candidateWarehouseConstraints'
import { resolveCurrentReleasedIdentity } from '../gameDataPacks/currentReleasedIdentityMap'
import { deriveSubStatHistory } from '../evaluation/subStatHistory'
import { driveDiscData } from '../data/gameData'
import {
  assessWarehouseInvestment,
  type WarehouseInvestmentAssessment,
} from './warehouseInvestmentAssessment'
import { resolveDriveDiscMainStatValue } from '../calculation/outOfCombatPanel'
import {
  prepareDiscObjectiveCoverage,
  type DiscReplacementObjective,
} from './discReplacementObjective'

export type EnhancementPotentialAgent = {
  agentId: string
  /** Distinct build/team branches for one agent remain separate proof dimensions. */
  contextId?: string
  constraint: CandidateWarehouseConstraint
  replacementObjective?: DiscReplacementObjective
}

export type DiscEnhancementPotential = {
  potentialEvaluated: boolean
  optimisticCeilingDominated: boolean
  usedGenericFallback: boolean
  initialSubStatCount: 3 | 4 | null
  remainingEnhancementNodes: number | null
  remainingRollOpportunities: number | null
  unlocksRemaining: 0 | 1 | null
  knownNonTargetRolls: number | null
  maxRealizedEffectiveRolls: number | null
  maxOptimisticEffectiveRolls: number | null
  communityMinimumEffectiveRolls: 2 | 5 | null
  communityViable: boolean | null
  relevantAgentIds: string[]
  undominatedAgentIds: string[]
  /** Strict optimistic improvement over the best present same-class score, by role. */
  improvableAgentIds?: string[]
  candidateAlternativeIds: string[]
  coverageAlternativeIds: string[]
  /** Finished-disc coverage also preserves useful stat tradeoffs in tied roles. */
  completedCoverageAlternativeIds?: string[]
  /** Same remaining growth paths; cultivation priority only, never deletion proof. */
  developmentAlternativeIds?: string[]
  investmentStopReason?: WarehouseInvestmentAssessment
  investmentAlternativeIds?: string[]
  dominatingAlternativeId: string | null
  reason: 'dominated' | 'can_catch_up' | 'missing_history' | 'missing_profile' | 'no_alternative'
}

function isSameReplacementClass(target: DriveDisc, candidate: DriveDisc) {
  if (
    candidate.id === target.id ||
    candidate.setId !== target.setId ||
    candidate.slot !== target.slot ||
    candidate.mainStat !== target.mainStat
  )
    return false
  const candidateHistory = deriveSubStatHistory(candidate)
  const maxLevel = driveDiscData?.rules.maxLevelByRarity[candidate.rarity ?? 'S']
  const targetMain = resolveDriveDiscMainStatValue(target)
  const candidateMain = resolveDriveDiscMainStatValue(candidate)
  return (
    candidateHistory.status === 'known' &&
    maxLevel !== undefined &&
    candidate.level <= maxLevel &&
    new Set(candidate.subStats.map((item) => item.stat)).size === candidate.subStats.length &&
    candidate.subStats.every(
      (item) =>
        Number.isFinite(item.value) &&
        item.value >= 0 &&
        Number.isInteger(item.upgrades) &&
        item.upgrades >= 0,
    ) &&
    targetMain !== null &&
    candidateMain !== null &&
    candidateMain.value >= targetMain.value
  )
}

export function isConstraintCompatible(disc: DriveDisc, constraint: CandidateWarehouseConstraint) {
  if (!(driveDiscData?.rules.mainStatsBySlot[String(disc.slot)] ?? []).includes(disc.mainStat))
    return false
  if (!constraint.setIds.includes(disc.setId)) return false
  if (disc.slot <= 3) return true
  return (constraint.mainStats[String(disc.slot) as '4' | '5' | '6'] ?? []).includes(disc.mainStat)
}

function unevaluated(
  history: SubStatHistory,
  reason: 'missing_history' | 'missing_profile',
): DiscEnhancementPotential {
  return {
    potentialEvaluated: false,
    optimisticCeilingDominated: false,
    usedGenericFallback: false,
    initialSubStatCount: history.initialSubStatCount,
    remainingEnhancementNodes:
      history.status === 'known' ? history.remainingEnhancementNodes : null,
    remainingRollOpportunities:
      history.status === 'known' ? history.remainingRollOpportunities : null,
    unlocksRemaining: history.status === 'known' ? history.unlocksRemaining : null,
    knownNonTargetRolls: null,
    maxRealizedEffectiveRolls: null,
    maxOptimisticEffectiveRolls: null,
    communityMinimumEffectiveRolls: null,
    communityViable: null,
    relevantAgentIds: [],
    undominatedAgentIds: [],
    candidateAlternativeIds: [],
    coverageAlternativeIds: [],
    dominatingAlternativeId: null,
    reason,
  }
}

export function evaluateDiscEnhancementPotential(input: {
  disc: DriveDisc
  allDiscs: readonly DriveDisc[]
  history: SubStatHistory
  agents: readonly EnhancementPotentialAgent[]
  profileCoverageComplete: boolean
}): DiscEnhancementPotential {
  if (!input.profileCoverageComplete) return unevaluated(input.history, 'missing_profile')
  if (input.history.status !== 'known') return unevaluated(input.history, 'missing_history')
  const maxLevel = driveDiscData?.rules.maxLevelByRarity[input.disc.rarity ?? 'S']
  const capturedCounts = new Map<string, number>()
  for (const disc of input.allDiscs)
    capturedCounts.set(disc.id, (capturedCounts.get(disc.id) ?? 0) + 1)
  if (
    maxLevel === undefined ||
    input.disc.level > maxLevel ||
    (capturedCounts.get(input.disc.id) ?? 0) > 1 ||
    !(driveDiscData?.rules.mainStatsBySlot[String(input.disc.slot)] ?? []).includes(
      input.disc.mainStat,
    ) ||
    input.disc.subStats.some(
      (line) =>
        !Number.isInteger(line.upgrades) ||
        line.upgrades < 0 ||
        !Number.isFinite(line.value) ||
        line.value < 0,
    )
  )
    return unevaluated(input.history, 'missing_history')
  const remainingEnhancementNodes = Math.max(0, Math.ceil((maxLevel - input.disc.level) / 3))
  const history = {
    ...input.history,
    remainingEnhancementNodes,
    remainingRollOpportunities: Math.max(
      0,
      remainingEnhancementNodes - input.history.unlocksRemaining,
    ),
  }

  const compatibleAgents = [
    ...new Map(
      input.agents
        .filter(({ constraint }) => isConstraintCompatible(input.disc, constraint))
        .map(({ agentId, contextId, constraint, replacementObjective }) => {
          const stableAgentId = resolveCurrentReleasedIdentity(agentId)
          return [
            contextId ?? stableAgentId,
            { agentId: stableAgentId, contextId, constraint, replacementObjective },
          ] as const
        }),
    ).values(),
  ].sort((left, right) =>
    (left.contextId ?? left.agentId).localeCompare(right.contextId ?? right.agentId),
  )
  const dimensions: PotentialDimension[] = compatibleAgents.length
    ? compatibleAgents.map(({ agentId, contextId, constraint }) => ({
        id: contextId ?? agentId,
        agentId,
        weights: constraint.subStatWeights,
      }))
    : [
        {
          id: 'generic',
          agentId: null,
          weights: Object.fromEntries(
            legalSubStats.map((stat) => [stat, evaluationRules.stats[stat].genericWeight]),
          ),
        },
      ]
  const ceilings = dimensions
    .map((dimension) => optimisticCeiling(input.disc, history, dimension))
    .filter((ceiling): ceiling is DimensionCeiling => Boolean(ceiling))
  if (ceilings.length !== dimensions.length) return unevaluated(input.history, 'missing_history')
  const objectiveCoverage = new Map(
    compatibleAgents.map(({ agentId, contextId, replacementObjective }) => [
      contextId ?? agentId,
      prepareDiscObjectiveCoverage(input.disc, history, replacementObjective),
    ]),
  )
  const preservesObjective = (alternative: DriveDisc, dimensionId: string, future = false) =>
    objectiveCoverage.get(dimensionId)?.(alternative, future) ?? true

  const alternatives = input.allDiscs
    .filter(
      (candidate) =>
        capturedCounts.get(candidate.id) === 1 && isSameReplacementClass(input.disc, candidate),
    )
    .sort((left, right) => left.id.localeCompare(right.id))
  const candidateAlternatives = alternatives.filter((alternative) =>
    ceilings.every(
      (ceiling) =>
        realizedScore(alternative, ceiling.dimension.weights, 'alternative') > ceiling.realized &&
        preservesObjective(alternative, ceiling.dimension.id),
    ),
  )
  const coverageAlternatives = alternatives.filter((alternative) => {
    const coversEveryDimension = ceilings.every(
      (ceiling) =>
        realizedScore(alternative, ceiling.dimension.weights, 'alternative') >= ceiling.realized &&
        preservesObjective(alternative, ceiling.dimension.id),
    )
    if (!coversEveryDimension) return false
    const strictlyBetterSomewhere = ceilings.some(
      (ceiling) =>
        realizedScore(alternative, ceiling.dimension.weights, 'alternative') > ceiling.realized,
    )
    // Equal physical copies prove that the target has no unique fit, but only the stable
    // earlier identity may cover a tie. This keeps one deterministic baseline per class.
    return strictlyBetterSomewhere || alternative.id.localeCompare(input.disc.id) < 0
  })
  // Compare like-for-like embryos without inventing roll probabilities. Identical
  // visible stat keys at the same rarity/level have the same fourth-line pool and
  // future enhancement paths. Existing score coverage then persists under each
  // corresponding path. Actual independent rolls may diverge: this is a spending
  // priority, not a guarantee that the target could never roll a better outcome.
  const targetStatKeys = input.disc.subStats
    .map((stat) => stat.stat)
    .sort()
    .join('|')
  const legalTargetStats =
    new Set(input.disc.subStats.map((stat) => stat.stat)).size === input.disc.subStats.length &&
    input.disc.subStats.every(
      (stat) => legalSubStats.includes(stat.stat) && stat.stat !== input.disc.mainStat,
    )
  const developmentAlternatives =
    compatibleAgents.length &&
    legalTargetStats &&
    hasConsistentDevelopmentStats(input.disc) &&
    history.remainingEnhancementNodes > 0
      ? coverageAlternatives.filter((alternative) => {
          const alternativeHistory = deriveSubStatHistory(alternative)
          return (
            (alternative.rarity ?? 'S') === (input.disc.rarity ?? 'S') &&
            alternative.level === input.disc.level &&
            alternativeHistory.status === 'known' &&
            hasConsistentDevelopmentStats(alternative) &&
            alternativeHistory.unlocksRemaining === history.unlocksRemaining &&
            // Equal weighted totals can still exchange useful stats (for example
            // crit rate for crit damage). Identical future paths do not remove
            // that existing tradeoff, so identity order must not decide priority.
            ceilings.every(
              ({ dimension, realized }) =>
                realizedScore(alternative, dimension.weights, 'alternative') > realized ||
                legalSubStats
                  .filter((stat) => weightFor(dimension.weights, stat) > 0)
                  .every(
                    (stat) =>
                      realizedScore(alternative, { [stat]: 1 }, 'alternative') >=
                      realizedScore(input.disc, { [stat]: 1 }),
                  ),
            ) &&
            alternative.subStats
              .map((stat) => stat.stat)
              .sort()
              .join('|') === targetStatKeys
          )
        })
      : []
  const targetMaxMain = resolveDriveDiscMainStatValue({ ...input.disc, level: maxLevel })
  const preservesTiedRole = (alternative: DriveDisc, dimension: PotentialDimension) =>
    legalSubStats
      .filter((stat) => stat !== input.disc.mainStat && weightFor(dimension.weights, stat) > 0)
      .every((stat) => {
        const present = input.disc.subStats.some((line) => line.stat === stat)
        const current = realizedScore(input.disc, { [stat]: 1 })
        const remaining = present
          ? history.remainingRollOpportunities
          : history.unlocksRemaining
            ? 1 + history.remainingRollOpportunities
            : 0
        const ceiling = normalizedScore(current + remaining * rollScale(input.disc, stat))
        return realizedScore(alternative, { [stat]: 1 }, 'alternative') >= ceiling
      })
  // Reuse the current-coverage Pareto rule at the optimistic ceiling. Requiring
  // strict improvement in every dimension would retain a disc just because one
  // role ties, even when no role could improve and another is strictly worse.
  // Every dimension must still be covered by this same physical replacement.
  const dominatingAlternatives = alternatives.filter((alternative) => {
    // Identical current stats cannot strictly exceed even the current target,
    // let alone its optimistic ceiling. Full-copy cleanup has its own proof.
    if (
      (alternative.rarity ?? 'S') === (input.disc.rarity ?? 'S') &&
      alternative.subStats.length === input.disc.subStats.length &&
      alternative.subStats.every((line) =>
        input.disc.subStats.some(
          (targetLine) =>
            line.stat === targetLine.stat &&
            line.value === targetLine.value &&
            line.upgrades === targetLine.upgrades,
        ),
      )
    )
      return false
    const alternativeMain = resolveDriveDiscMainStatValue(alternative)
    if (
      targetMaxMain === null ||
      alternativeMain === null ||
      alternativeMain.value < targetMaxMain.value
    )
      return false
    let strictlyBetter = false
    const tiedDimensions: PotentialDimension[] = []
    for (const ceiling of ceilings) {
      if (!preservesObjective(alternative, ceiling.dimension.id, true)) return false
      const score = realizedScore(alternative, ceiling.dimension.weights, 'alternative')
      if (score < ceiling.optimistic) return false
      if (score > ceiling.optimistic) strictlyBetter = true
      else tiedDimensions.push(ceiling.dimension)
    }
    // Check expensive per-stat ceilings only after a strict improvement exists.
    // Weighted ties must not conceal a DEF-to-crit or other useful-stat tradeoff.
    return (
      strictlyBetter &&
      tiedDimensions.every((dimension) => preservesTiedRole(alternative, dimension))
    )
  })
  const completedCoverageAlternatives =
    history.remainingEnhancementNodes === 0
      ? coverageAlternatives.filter((alternative) =>
          ceilings.every(
            (ceiling) =>
              preservesObjective(alternative, ceiling.dimension.id, true) &&
              (realizedScore(alternative, ceiling.dimension.weights, 'alternative') >
                ceiling.realized ||
                preservesTiedRole(alternative, ceiling.dimension)),
          ),
        )
      : []
  const undominatedAgentIds = coverageAlternatives.length
    ? []
    : ceilings.flatMap((ceiling) => {
        if (!ceiling.dimension.agentId) return []
        const individuallyCovered = alternatives.some((alternative) => {
          const score = realizedScore(alternative, ceiling.dimension.weights, 'alternative')
          return (
            preservesObjective(alternative, ceiling.dimension.id) &&
            (score > ceiling.realized ||
              (score === ceiling.realized && alternative.id.localeCompare(input.disc.id) < 0))
          )
        })
        return individuallyCovered ? [] : [ceiling.dimension.agentId]
      })
  // Prefer the strongest actual proof, not whichever identity sorts first.
  // This ordering chooses between already valid proofs; it does not create a
  // new cleanup threshold or assert damage gain from summing role scores.
  const dominatingAlternativeId =
    dominatingAlternatives
      .map((alternative) => ({
        id: alternative.id,
        score: normalizedScore(
          ceilings.reduce(
            (sum, ceiling) =>
              sum + realizedScore(alternative, ceiling.dimension.weights, 'alternative'),
            0,
          ),
        ),
      }))
      .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))[0]?.id ??
    null
  const reason = dominatingAlternativeId
    ? 'dominated'
    : alternatives.length
      ? 'can_catch_up'
      : 'no_alternative'
  const maxRealizedEffectiveRolls = compatibleAgents.length
    ? Math.max(...ceilings.map((ceiling) => ceiling.realizedEffectiveRolls))
    : null
  const maxOptimisticEffectiveRolls = compatibleAgents.length
    ? Math.max(...ceilings.map((ceiling) => ceiling.optimisticEffectiveRolls))
    : null
  const communityMinimumEffectiveRolls = compatibleAgents.length
    ? input.disc.slot <= 3
      ? 5
      : 2
    : null

  const investmentAlternatives = coverageAlternatives.filter(
    (alternative) =>
      alternative.level === driveDiscData?.rules.maxLevelByRarity[alternative.rarity ?? 'S'] &&
      hasConsistentDevelopmentStats(alternative) &&
      alternative.subStats.every(
        (line) => legalSubStats.includes(line.stat) && line.stat !== alternative.mainStat,
      ) &&
      ceilings.every(
        ({ dimension, realized }) =>
          realizedScore(alternative, dimension.weights, 'alternative') > realized ||
          legalSubStats
            .filter((stat) => weightFor(dimension.weights, stat) > 0)
            .every(
              (stat) =>
                realizedScore(alternative, { [stat]: 1 }, 'alternative') >=
                realizedScore(input.disc, { [stat]: 1 }),
            ),
      ),
  )
  const investmentStopReason = assessWarehouseInvestment({
    historyKnown: legalTargetStats && hasConsistentDevelopmentStats(input.disc),
    level: input.disc.level,
    slot: input.disc.slot,
    remainingRollOpportunities: history.remainingRollOpportunities,
    unlocksRemaining: history.unlocksRemaining,
    minKnownNonTargetRolls: Math.min(...ceilings.map((ceiling) => ceiling.knownNonTargetRolls)),
    maxRealizedEffectiveRolls,
    hasCompletedCoverageAlternative: investmentAlternatives.length > 0,
    hasMeaningfulDemand: compatibleAgents.length > 0,
  })

  return {
    investmentStopReason,
    investmentAlternativeIds: investmentAlternatives.map((alternative) => alternative.id),
    potentialEvaluated: true,
    optimisticCeilingDominated: Boolean(dominatingAlternativeId),
    usedGenericFallback: compatibleAgents.length === 0,
    initialSubStatCount: history.initialSubStatCount,
    remainingEnhancementNodes: history.remainingEnhancementNodes,
    remainingRollOpportunities: history.remainingRollOpportunities,
    unlocksRemaining: history.unlocksRemaining,
    knownNonTargetRolls: Math.min(...ceilings.map((ceiling) => ceiling.knownNonTargetRolls)),
    maxRealizedEffectiveRolls,
    maxOptimisticEffectiveRolls,
    communityMinimumEffectiveRolls,
    communityViable:
      maxOptimisticEffectiveRolls === null || communityMinimumEffectiveRolls === null
        ? null
        : maxOptimisticEffectiveRolls >= communityMinimumEffectiveRolls,
    relevantAgentIds: [...new Set(compatibleAgents.map(({ agentId }) => agentId))],
    undominatedAgentIds: [...new Set(undominatedAgentIds)],
    improvableAgentIds: [
      ...new Set(
        ceilings.flatMap((ceiling) =>
          ceiling.dimension.agentId &&
          ceiling.optimistic >
            Math.max(
              ceiling.realized,
              ...alternatives.map((alternative) =>
                realizedScore(alternative, ceiling.dimension.weights, 'alternative'),
              ),
            )
            ? [ceiling.dimension.agentId]
            : [],
        ),
      ),
    ],
    candidateAlternativeIds: candidateAlternatives.map((alternative) => alternative.id),
    coverageAlternativeIds: coverageAlternatives.map((alternative) => alternative.id),
    completedCoverageAlternativeIds: completedCoverageAlternatives.map(
      (alternative) => alternative.id,
    ),
    developmentAlternativeIds: developmentAlternatives.map((alternative) => alternative.id),
    dominatingAlternativeId,
    reason,
  }
}
