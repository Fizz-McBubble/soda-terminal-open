import type { CoreWarehouse } from '../accounts/coreFlow'
import type { CurrentPlanningScenarioSelection32 } from '../application/publicPlanningScenarioContract'
import { stableContentHash } from '../gameDataPacks/types'
import {
  compareValueBenchmarkSides,
  valueBenchmarkComparabilityKey,
  type ValueBenchmarkSide,
} from '../calculation/valueBenchmarkComparison'
import { hasWellFormedValueBenchmarkCoverage } from '../calculation/valueBenchmarkEvidence'
import { candidateSetPlansForConstraint } from '../gameDataPacks/candidateWarehouseConstraints'
import { evaluateCandidateSetPlanEligibility } from '../gameDataPacks/candidateSetPlanEligibility'
import { candidateLoadoutMatchesSetPlan } from '../optimizer/candidateWarehouseAlternativeRanking'
import { compareCandidatePanelPriority } from '../optimizer/candidateSearchFacts'
import type { CandidateWarehousePlan } from '../optimizer/candidateWarehouseSolver'
import { evaluateDevelopmentRecordedDiscs } from '../pages/developmentRecordedDiscEvaluation'
import type { CandidateSetPlanEligibilityContext } from '../gameDataPacks/candidateSetPlanEligibility'
import { refineComparableCandidatePool } from '../optimizer/refineComparableCandidatePool'
import type { AgentIndependentBuildIntent } from './buildIntent'
import {
  evaluateDevelopmentValueBenchmarkSide,
  type DevelopmentValueBenchmarkEvaluator,
  type DevelopmentComparisonParameters,
} from './developmentValueBenchmark'
import {
  preparedAnomalyCandidateRankingContract,
  type PreparedAnomalyCandidateRanking,
} from './developmentPreparedAnomalySearch'
import { sourceReviewedProtectedUtilityIndices32 } from './teamFunctionalConstraints32'
import { resolveWEngine } from './wEngineResolver'
import { projectNormalizedAccountFinalStatsDetailed } from './normalizedAccountFinalStats'
import {
  resolvePersonalDevelopmentObjective32,
  scopedPersonalFunctionalProtection32,
} from './personalDevelopmentObjective32'
import {
  developmentCandidateRankingContract,
  developmentCandidateRankingVersion,
} from './developmentCandidateRankingIdentity'
export {
  developmentCandidateRankingContract,
  developmentCandidateRankingVersion,
} from './developmentCandidateRankingIdentity'

export type DevelopmentCandidateRankingScope =
  | 'fixed_event_slice'
  | 'declared_event'
  | 'panel_target'
  | 'functional_capacity'
export type DevelopmentCandidateRankingSource =
  | 'dynamic_objective'
  | 'prepared_anomaly_settlement'
  | 'source_and_local_refinement'

type RankingTieBreaker = 'fixed_event_output' | 'loadout_score' | 'fewer_swaps' | 'incoming_order'

export type DevelopmentCandidateRankingBasis =
  | {
      kind: 'functional_capacity'
      capacityKey: string
      capacityKind: 'source_daze_basis' | 'shield_generation' | 'source_support_target'
      value: number
      unit: '失衡量' | '护盾量' | '攻击力' | '贯穿力' | '%' | '系数'
      contextKey: string
      coverageIdentity: string
      direction: 'higher'
      tieBreakers: RankingTieBreaker[]
    }
  | {
      kind: 'panel_target'
      priorityStat: 'anomalyProficiency' | 'energyRegen' | 'source'
      attackDeficit: number
      targetValue: number | null
      direction: 'ascending_deficit_then_descending_priority'
      tieBreakers: RankingTieBreaker[]
    }
  | {
      kind: 'fixed_event_output'
      domain: 'fixed_event_direct_damage'
      metric: 'total_damage'
      totalDamage: number
      planningDps: number | null
      direction: 'higher'
      tieBreakers: RankingTieBreaker[]
    }
  | {
      kind: 'prepared_anomaly_output'
      domain: 'prepared_anomaly_settlement'
      metric: 'total_damage'
      totalDamage: number
      direction: 'higher'
      tieBreakers: RankingTieBreaker[]
    }
  | {
      kind: 'source_priority'
      sourcePlanRank: number
      direction: 'group_partition_only'
      tieBreakers: []
    }
  | {
      kind: 'unranked'
      reason:
        | 'no_comparable_peer'
        | 'coverage_or_target_mismatch'
        | 'objective_unresolved'
        | 'producer_eligibility_unavailable'
        | 'parameter_bound_projection_mismatch'
      direction: null
      tieBreakers: []
    }

export type DevelopmentCandidateRankingEntry = {
  /** One-based lookup into result.candidates; never a global quality rank. */
  candidateRank: number
  candidateIdentity: string
  /** Bound by current producers; optional only for older fixtures/snapshots. */
  calculationIdentity?: string | null
  groupId: string
  groupRank: number | null
  groupSize: number
  comparable: boolean
  comparisonParametersIdentity: string | null
  /** Source preference precedes the numeric or panel objective in this group. */
  recommendedFourPlusTwo?: boolean | null
  orderingPolicy?: readonly (
    | 'recommended_4plus2'
    | 'fixed_event_output'
    | 'prepared_anomaly_output'
    | 'functional_capacity'
    | 'panel_target'
    | 'loadout_score'
    | 'fewer_swaps'
    | 'incoming_order'
  )[]
  basis: DevelopmentCandidateRankingBasis
}

export type DevelopmentCandidateRanking = {
  contract: typeof developmentCandidateRankingContract
  /** Persisted historical rankings keep their original version; consumers must
   * check it against the current producer before presenting a trusted rank. */
  version: string
  candidateRarityScope: 'S'
  source: DevelopmentCandidateRankingSource
  comparisonParametersIdentity: string | null
  entries: DevelopmentCandidateRankingEntry[]
  identity: string
}

/** Rank before comparison parameters, panel rows and saved identities are bound to ranks.
 * Limited coverage ranks only the declared slice;
 * its exclusions are retained and never treated as cancelling overall damage. */
export function rankDevelopmentCandidates(input: {
  evaluator?: DevelopmentValueBenchmarkEvaluator
  warehouse: CoreWarehouse
  agentId: string
  candidates: readonly CandidateWarehousePlan[]
  buildIntent: AgentIndependentBuildIntent
  parameters?: DevelopmentComparisonParameters
  scenarioSelection?: CurrentPlanningScenarioSelection32
  eventConditionDeclaration?: import('../calculation/reviewedTemplateEventConditions32').ReviewedTemplateEventConditionDeclaration32
  conditionContext?: CandidateSetPlanEligibilityContext
  rankingSource?: DevelopmentCandidateRankingSource
  preparedCandidateRanking?: PreparedAnomalyCandidateRanking
}) {
  const rankingSource = input.rankingSource ?? 'source_and_local_refinement'
  const comparisonParametersIdentity = input.parameters ? stableContentHash(input.parameters) : null
  const records = (plan: CandidateWarehousePlan) =>
    plan.loadouts[0]?.discs.map((row) => row.disc) ?? []
  const key = (plan: CandidateWarehousePlan) =>
    JSON.stringify(
      records(plan)
        .toSorted((a, b) => a.slot - b.slot)
        .map((disc) => [disc.slot, disc.id]),
    )
  const candidateIdentity = (plan: CandidateWarehousePlan) =>
    stableContentHash({
      agentId: input.agentId,
      discs: records(plan)
        .toSorted((left, right) => left.slot - right.slot)
        .map((disc) => [disc.slot, disc.id]),
    })
  const constraint = input.buildIntent.recommendations.find(
    (row) => row.agentId === input.agentId,
  )?.constraint
  const sourcePlans = constraint ? candidateSetPlansForConstraint(constraint) : []
  // The numeric loadout field may be a historical or unqualified candidate
  // score. Re-evaluate the physical discs under the same frozen source before
  // allowing it to break an otherwise equal comparison.
  const scores = new WeakMap<
    CandidateWarehousePlan,
    ReturnType<typeof evaluateDevelopmentRecordedDiscs>
  >()
  const personalScore = (plan: CandidateWarehousePlan) => {
    if (!scores.has(plan))
      scores.set(
        plan,
        evaluateDevelopmentRecordedDiscs(input.agentId, records(plan), {
          constraint: constraint ?? null,
          independentDirection: input.parameters?.independentDirection,
          conditionContext: input.conditionContext,
        }),
      )
    return scores.get(plan) ?? null
  }
  const knownSameBasis = (plans: readonly CandidateWarehousePlan[]) => {
    const results = plans.map(personalScore)
    return (
      results.length > 0 &&
      results.every(
        (result) =>
          result?.complete &&
          result.totalScore !== undefined &&
          Number.isFinite(result.totalScore) &&
          result.basisFingerprint === results[0]?.basisFingerprint,
      )
    )
  }
  const recommendedFourPlusTwo = (plan: CandidateWarehousePlan): boolean | null => {
    const discs = records(plan)
    if (
      discs.length !== 6 ||
      new Set(discs.map((disc) => disc.id)).size !== 6 ||
      new Set(discs.map((disc) => disc.slot)).size !== 6 ||
      discs.some((disc) => disc.slot < 1 || disc.slot > 6 || disc.rarity !== 'S') ||
      !sourcePlans.length
    )
      return null
    const matching = sourcePlans.filter((source) =>
      candidateLoadoutMatchesSetPlan(plan.loadouts[0], source),
    )
    if (!matching.length) return null
    const statuses = matching.map((source) => ({
      source,
      eligibility: evaluateCandidateSetPlanEligibility(
        input.agentId,
        source,
        input.conditionContext,
      ),
    }))
    if (
      statuses.some(
        ({ source, eligibility }) =>
          source.pattern === '4+2' &&
          (!source.purpose || source.purpose === 'recommended') &&
          (eligibility.status === 'unrestricted' || eligibility.status === 'eligible') &&
          eligibility.effectCoverage !== 'unknown' &&
          eligibility.effectCoverage !== 'not-covered',
      )
    )
      return true
    if (
      statuses.some(
        ({ source, eligibility }) =>
          eligibility.status === 'condition-unknown' ||
          eligibility.effectCoverage === 'unknown' ||
          (source.purpose === 'conditional' && eligibility.status === 'unrestricted'),
      )
    )
      return null
    return false
  }
  const buildCandidateRanking = (
    source: DevelopmentCandidateRankingSource,
    entries: DevelopmentCandidateRankingEntry[],
  ): DevelopmentCandidateRanking => ({
    contract: developmentCandidateRankingContract,
    version: developmentCandidateRankingVersion,
    candidateRarityScope: 'S',
    source,
    comparisonParametersIdentity,
    entries,
    identity: stableContentHash({
      contract: developmentCandidateRankingContract,
      version: developmentCandidateRankingVersion,
      source,
      comparisonParametersIdentity,
      entries,
    }),
  })
  const preparedRanking = input.preparedCandidateRanking
  const trustedPreparedEntries = new Map<
    string,
    PreparedAnomalyCandidateRanking['entries'][number]
  >()
  if (
    rankingSource === 'prepared_anomaly_settlement' &&
    preparedRanking?.contract === preparedAnomalyCandidateRankingContract &&
    preparedRanking.source === rankingSource &&
    preparedRanking.candidateRarityScope === 'S' &&
    preparedRanking.baselineCalculationIdentity &&
    preparedRanking.comparisonParametersIdentity === comparisonParametersIdentity &&
    preparedRanking.identity ===
      stableContentHash({
        contract: preparedRanking.contract,
        source: preparedRanking.source,
        candidateRarityScope: preparedRanking.candidateRarityScope,
        baselineCalculationIdentity: preparedRanking.baselineCalculationIdentity,
        comparisonParametersIdentity: preparedRanking.comparisonParametersIdentity,
        entries: preparedRanking.entries,
      })
  ) {
    const currentIdentityList = input.candidates.map(candidateIdentity)
    const currentIdentities = new Set(currentIdentityList)
    const groups = new Map<string, PreparedAnomalyCandidateRanking['entries']>()
    const seenCandidates = new Set<string>()
    let entriesValid = true
    for (const entry of preparedRanking.entries) {
      if (
        !currentIdentities.has(entry.candidateIdentity) ||
        !entry.calculationIdentity ||
        !entry.coverageIdentity ||
        !entry.groupId ||
        !Number.isInteger(entry.groupRank) ||
        entry.groupRank < 1 ||
        !Number.isInteger(entry.groupSize) ||
        entry.groupSize < 2 ||
        !entry.comparable ||
        !Number.isFinite(entry.totalDamage) ||
        seenCandidates.has(entry.candidateIdentity)
      ) {
        entriesValid = false
        break
      }
      seenCandidates.add(entry.candidateIdentity)
      groups.set(entry.groupId, [...(groups.get(entry.groupId) ?? []), entry])
    }
    const trustedGroups = [...groups.values()].every((group) => {
      const ranks = new Set(group.map((entry) => entry.groupRank))
      return (
        group.length >= 2 &&
        group.every((entry) => entry.groupSize === group.length) &&
        ranks.size === group.length &&
        [...ranks].every((rank) => rank >= 1 && rank <= group.length)
      )
    })
    if (entriesValid && trustedGroups && currentIdentities.size === currentIdentityList.length)
      for (const entry of [...groups.values()].flat())
        trustedPreparedEntries.set(entry.candidateIdentity, entry)
  }
  if (rankingSource === 'prepared_anomaly_settlement') {
    const candidates = refineComparableCandidatePool(input.candidates, [], {
      key,
      group: (plan) =>
        trustedPreparedEntries.get(candidateIdentity(plan))?.groupId ?? candidateIdentity(plan),
      comparable: (a, b) => {
        const left = trustedPreparedEntries.get(candidateIdentity(a))
        const right = trustedPreparedEntries.get(candidateIdentity(b))
        return Boolean(
          left &&
          right &&
          left.groupId === right.groupId &&
          (recommendedFourPlusTwo(a) === null) === (recommendedFourPlusTwo(b) === null),
        )
      },
      compare: (a, b) => {
        const left = trustedPreparedEntries.get(candidateIdentity(a))!
        const right = trustedPreparedEntries.get(candidateIdentity(b))!
        const epsilon =
          Number.EPSILON * 32 * Math.max(1, Math.abs(left.totalDamage), Math.abs(right.totalDamage))
        if (Math.abs(right.totalDamage - left.totalDamage) > epsilon)
          return right.totalDamage - left.totalDamage
        const preferred =
          Number(recommendedFourPlusTwo(b) === true) - Number(recommendedFourPlusTwo(a) === true)
        if (preferred) return preferred
        const scorePeers = input.candidates.filter((plan) => {
          const entry = trustedPreparedEntries.get(candidateIdentity(plan))
          return (
            entry?.groupId === left.groupId &&
            recommendedFourPlusTwo(plan) === recommendedFourPlusTwo(a)
          )
        })
        const scoresKnown = knownSameBasis(scorePeers)
        return (
          (scoresKnown ? personalScore(b)!.totalScore! - personalScore(a)!.totalScore! : 0) ||
          left.swapCount - right.swapCount
        )
      },
    })
    const entries = candidates.map((plan, index): DevelopmentCandidateRankingEntry => {
      const identity = candidateIdentity(plan)
      const evidence = trustedPreparedEntries.get(identity)
      const peers = evidence
        ? candidates.filter((candidate) => {
            const other = trustedPreparedEntries.get(candidateIdentity(candidate))
            return (
              other?.groupId === evidence.groupId &&
              (recommendedFourPlusTwo(candidate) === null) ===
                (recommendedFourPlusTwo(plan) === null)
            )
          })
        : []
      if (evidence && peers.length > 1)
        return {
          candidateRank: index + 1,
          candidateIdentity: identity,
          calculationIdentity: evidence.calculationIdentity,
          groupId: stableContentHash({
            groupId: evidence.groupId,
            sourceEligibilityKnown: recommendedFourPlusTwo(plan) !== null,
          }),
          groupRank: peers.indexOf(plan) + 1,
          groupSize: peers.length,
          comparable: true,
          comparisonParametersIdentity,
          recommendedFourPlusTwo: recommendedFourPlusTwo(plan),
          orderingPolicy: [
            'prepared_anomaly_output',
            ...(recommendedFourPlusTwo(plan) === null ? [] : ['recommended_4plus2' as const]),
            ...(knownSameBasis(
              peers.filter((peer) => recommendedFourPlusTwo(peer) === recommendedFourPlusTwo(plan)),
            )
              ? ['loadout_score' as const]
              : []),
            'fewer_swaps',
            'incoming_order',
          ],
          basis: {
            kind: 'prepared_anomaly_output',
            domain: 'prepared_anomaly_settlement',
            metric: 'total_damage',
            totalDamage: evidence.totalDamage,
            direction: 'higher',
            tieBreakers: knownSameBasis(
              peers.filter((peer) => recommendedFourPlusTwo(peer) === recommendedFourPlusTwo(plan)),
            )
              ? ['loadout_score', 'fewer_swaps', 'incoming_order']
              : ['fewer_swaps', 'incoming_order'],
          },
        }
      return {
        candidateRank: index + 1,
        candidateIdentity: identity,
        calculationIdentity: evidence?.calculationIdentity ?? null,
        groupId: stableContentHash({
          source: rankingSource,
          candidateIdentity: identity,
          ranking: 'unavailable',
        }),
        groupRank: null,
        groupSize: 1,
        comparable: false,
        comparisonParametersIdentity,
        basis: {
          kind: 'unranked',
          reason: evidence ? 'no_comparable_peer' : 'producer_eligibility_unavailable',
          direction: null,
          tieBreakers: [],
        },
      }
    })
    return {
      candidates,
      rankingScopes: [],
      candidateRanking: buildCandidateRanking(rankingSource, entries),
    }
  }
  const sides = new Map<CandidateWarehousePlan, ValueBenchmarkSide>()
  const side = (plan: CandidateWarehousePlan) => {
    if (!sides.has(plan))
      sides.set(
        plan,
        (input.evaluator ?? evaluateDevelopmentValueBenchmarkSide)({
          ...input,
          discs: records(plan),
          stale: false,
        }),
      )
    return sides.get(plan)!
  }
  const protectedIndices = sourceReviewedProtectedUtilityIndices32(input.agentId)
  const fallbackStats = (plan: CandidateWarehousePlan, value: ValueBenchmarkSide) => {
    if (value.functionalStats32) return value.functionalStats32
    if (value.state !== 'unsupported' || plan.loadouts[0]?.panelObjectiveStatus !== 'applied')
      return null
    const agent = input.warehouse.roster.agents.find(
      (row) => row.agentId === input.agentId && row.owned,
    )
    const engine =
      input.parameters?.wEngine ??
      resolveWEngine({ agent, legacyWEngines: input.warehouse.roster.wEngines }).current
    if (!agent || !engine || (input.parameters?.potential ?? agent.potentialImage) == null)
      return null
    const projection = projectNormalizedAccountFinalStatsDetailed({
      agent: {
        ...agent,
        potentialImage: input.parameters?.potential ?? agent.potentialImage,
        wEngineDetails: {
          id: engine.engineId,
          name: engine.engineId,
          level: engine.level,
          ascension:
            input.parameters?.wEngine?.ascension ??
            (agent.wEngineDetails.id === engine.engineId
              ? agent.wEngineDetails.ascension
              : undefined),
          refinement: engine.refinement,
        },
      },
      engineId: engine.engineId,
      discs: records(plan),
    })
    if (projection.status !== 'supported') return null
    const stats = projection.stats.finalStats
    return {
      impact: stats.impact,
      enerRegen: stats.enerRegen,
      anomMas: stats.anomMas,
      anomProf: stats.anomProf,
    }
  }
  const utility = (value: ValueBenchmarkSide, plan: CandidateWarehousePlan) => {
    const stats = fallbackStats(plan, value)
    if (!stats) return null
    const values = [stats.impact, stats.enerRegen, stats.anomMas, stats.anomProf]
    return protectedIndices.every((index) => Number.isFinite(values[index]))
      ? protectedIndices.map((index) => values[index])
      : null
  }
  // A sourced, complete functional outcome may replace only the raw input it
  // actually measures. Any missing or excluded component retains the raw guard.
  const functionalIdentity = (value: ValueBenchmarkSide) => {
    const result = scopedPersonalFunctionalProtection32(value, input.agentId)
    if (!result)
      return {
        status: 'unavailable' as const,
        rows: [],
        unresolvedIdentity: stableContentHash({
          inputs: value.personalFunctionalInputs32 ?? null,
          equipment: value.personalFunctionalEquipmentIdentity32 ?? null,
          capacities: value.functionalCapacities32 ?? null,
        }),
      }
    const rows = result.capacities.toSorted((a, b) => a.key.localeCompare(b.key))
    if (new Set(rows.map((row) => row.key)).size !== rows.length)
      return { status: 'unavailable' as const, rows: [] }
    return { status: 'supported' as const, rows, unresolvedIdentity: result.unresolvedIdentity }
  }
  const functionalUtility = (value: ValueBenchmarkSide, plan: CandidateWarehousePlan) => {
    const raw = utility(value, plan)
    if (!raw) return null
    const evidence = functionalIdentity(value)
    // Personal direct-event output is a slice, not anomaly settlement. Allow
    // proficiency differences only for this output order; panel objectives and
    // all other protected functions remain independent guards.
    const sliceUtility = raw.map((stat, index) =>
      protectedIndices[index] === 3 &&
      !plan.loadouts[0]?.panelObjective &&
      value.coverage?.domain === 'fixed_event_direct_damage'
        ? 'anomaly_slice'
        : stat,
    )
    if (evidence.status !== 'supported') return sliceUtility
    if (
      evidence.rows.some(
        (row) =>
          row.value === null ||
          !Number.isFinite(row.value) ||
          !row.contextKey ||
          !row.sourceRefs.length ||
          row.excluded.length,
      )
    )
      return sliceUtility
    const covered = (index: number) =>
      evidence.rows.some(
        (row) =>
          row.key.startsWith(`${input.agentId}:`) &&
          ((index === 0 && row.kind === 'source_daze_basis') ||
            (index === 1 && row.kind === 'natural_energy_recovery_rate') ||
            (index === 2 && row.kind === 'anomaly_mastery')) &&
          row.value !== null &&
          Number.isFinite(row.value) &&
          row.value > 0 &&
          row.contextKey &&
          row.sourceRefs.length > 0 &&
          row.excluded.length === 0,
      )
    return sliceUtility.map((stat, index) => (covered(protectedIndices[index]!) ? 'covered' : stat))
  }
  const coverage = (value: ValueBenchmarkSide) =>
    hasWellFormedValueBenchmarkCoverage(value.coverage)
      ? [
          value.coverage.domain,
          [...value.coverage.includedEffectKeys].sort(),
          value.coverage.excludedEffects
            .map((effect) => [
              effect.effectKey,
              effect.reason,
              [...effect.fields].sort(),
              [...effect.sourceRefs].sort(),
              effect.effectPath ?? null,
              effect.recipientAgentIds ? [...effect.recipientAgentIds].sort() : null,
              effect.writeFields ? [...effect.writeFields].sort() : null,
              effect.resolvedInactive ?? null,
              effect.action ?? null,
            ])
            .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
        ]
      : null
  const panelFallback = (plan: CandidateWarehousePlan, value: ValueBenchmarkSide) => {
    const panel = plan.loadouts[0]?.panelObjective
    if (
      value.state !== 'unsupported' ||
      Number.isFinite(value.totalDamage) ||
      plan.loadouts[0]?.panelObjectiveStatus !== 'applied' ||
      !panel ||
      !Number.isFinite(panel.attackDeficit) ||
      panel.attackDeficit < 0
    )
      return false
    const priority = panel.priorityStat ?? 'anomalyProficiency'
    const target = priority === 'source' ? panel.hpDeficit : panel[priority]
    return (
      Number.isFinite(target) &&
      (priority !== 'source' || target! >= 0) &&
      Boolean(utility(value, plan)) &&
      [
        'game_version',
        'subject',
        'scenario',
        'event_set',
        'duration',
        'formula',
        'runtime',
        'w_engine',
        'bangboo',
      ].every(
        (key) =>
          typeof value.dimensions[key as keyof typeof value.dimensions] === 'string' &&
          Boolean(value.dimensions[key as keyof typeof value.dimensions]),
      )
    )
  }
  const comparable = (a: CandidateWarehousePlan, b: CandidateWarehousePlan) => {
    const left = side(a),
      right = side(b)
    if (panelFallback(a, left) && panelFallback(b, right)) {
      const leftPanel = a.loadouts[0]!.panelObjective!
      const rightPanel = b.loadouts[0]!.panelObjective!
      return (
        (leftPanel.priorityStat ?? 'anomalyProficiency') ===
        (rightPanel.priorityStat ?? 'anomalyProficiency')
      )
    }
    if (
      resolvePersonalDevelopmentObjective32(input.agentId, left).kind !== 'direct_slice' ||
      resolvePersonalDevelopmentObjective32(input.agentId, right).kind !== 'direct_slice' ||
      left.state !== 'supported' ||
      right.state !== 'supported' ||
      !Number.isFinite(left.totalDamage) ||
      !Number.isFinite(right.totalDamage)
    )
      return false
    const leftPanel = a.loadouts[0]?.panelObjective,
      rightPanel = b.loadouts[0]?.panelObjective
    if (Boolean(leftPanel) !== Boolean(rightPanel)) return false
    if (
      leftPanel &&
      rightPanel &&
      (leftPanel.priorityStat ?? 'anomalyProficiency') !==
        (rightPanel.priorityStat ?? 'anomalyProficiency')
    )
      return false
    if (
      left.coverage?.domain !== 'fixed_event_direct_damage' ||
      right.coverage?.domain !== 'fixed_event_direct_damage' ||
      !hasWellFormedValueBenchmarkCoverage(left.coverage) ||
      !hasWellFormedValueBenchmarkCoverage(right.coverage)
    )
      return false
    const comparison = compareValueBenchmarkSides({
      baseline: left,
      candidate: right,
      changedDimensions: ['disc_loadout'],
      labels: { baseline: '同条件候选', candidate: '同条件候选' },
    })
    return (
      comparison.comparable &&
      (comparison.coverage.generalConclusion === 'supported' ||
        comparison.coverage.generalConclusion === 'limited')
    )
  }
  const protectedComparable = (left: CandidateWarehousePlan, right: CandidateWarehousePlan) =>
    utility(side(left), left) !== null &&
    utility(side(right), right) !== null &&
    (recommendedFourPlusTwo(left) === null) === (recommendedFourPlusTwo(right) === null) &&
    comparable(left, right)
  const baseGroupCache = new WeakMap<CandidateWarehousePlan, string>()
  const baseGroup = (plan: CandidateWarehousePlan) => {
    const cached = baseGroupCache.get(plan)
    if (cached !== undefined) return cached
    const value = side(plan)
    const panel = plan.loadouts[0]?.panelObjective
    const result = stableContentHash({
      source: rankingSource,
      inventoryTransition: plan.inventoryTransition ?? false,
      degraded: plan.loadouts[0]?.degraded ?? false,
      panelObjectiveStatus: plan.loadouts[0]?.panelObjectiveStatus ?? null,
      panelTarget: panel
        ? {
            priorityStat: panel.priorityStat ?? 'anomalyProficiency',
          }
        : null,
      state: value.state,
      selfComparable: comparable(plan, plan),
      context: valueBenchmarkComparabilityKey(value, ['disc_loadout']),
      utility: functionalUtility(value, plan),
      functional: functionalIdentity(value),
      // This ordering describes the declared slice; protected function values
      // must match, and missing effects remain unknown.
      coverage: coverage(value),
      fallbackSetCounts: panelFallback(plan, value)
        ? Object.entries(
            records(plan).reduce<Record<string, number>>((counts, disc) => {
              counts[disc.setId] = (counts[disc.setId] ?? 0) + 1
              return counts
            }, {}),
          ).sort(([a], [b]) => a.localeCompare(b))
        : null,
    })
    baseGroupCache.set(plan, result)
    return result
  }
  const group = (plan: CandidateWarehousePlan) =>
    stableContentHash({
      base: baseGroup(plan),
      sourceEligibilityKnown: recommendedFourPlusTwo(plan) !== null,
    })
  const equippedIds =
    input.warehouse.roster.agents.find((row) => row.agentId === input.agentId)?.equippedDiscIds ??
    []
  const equipped = equippedIds.flatMap(
    (id) => input.warehouse.discs.find((disc) => disc.id === id) ?? [],
  )
  const hasBaseline =
    equippedIds.length === 6 &&
    new Set(equippedIds).size === 6 &&
    equipped.length === 6 &&
    new Set(equipped.map((disc) => disc.slot)).size === 6
  const swaps = (plan: CandidateWarehousePlan) =>
    hasBaseline ? records(plan).filter((disc) => !equippedIds.includes(disc.id)).length : 0
  const candidates = refineComparableCandidatePool(input.candidates, [], {
    key,
    group: baseGroup,
    comparable: protectedComparable,
    compare: (a, b) => {
      if (panelFallback(a, side(a)) && panelFallback(b, side(b))) {
        const targetOrder = compareCandidatePanelPriority(
          a.loadouts[0]?.panelObjective,
          b.loadouts[0]?.panelObjective,
        )
        if (targetOrder) return targetOrder
        return swaps(a) - swaps(b)
      }
      const before = side(a).totalDamage!,
        after = side(b).totalDamage!
      const epsilon = Number.EPSILON * 32 * Math.max(1, Math.abs(before), Math.abs(after))
      if (Math.abs(after - before) > epsilon) return after - before
      const preferred =
        Number(recommendedFourPlusTwo(b) === true) - Number(recommendedFourPlusTwo(a) === true)
      if (preferred) return preferred
      const scorePeers = input.candidates.filter(
        (plan) =>
          group(plan) === group(a) && recommendedFourPlusTwo(plan) === recommendedFourPlusTwo(a),
      )
      const scoresKnown = knownSameBasis(scorePeers)
      return (
        (scoresKnown ? personalScore(b)!.totalScore! - personalScore(a)!.totalScore! : 0) ||
        swaps(a) - swaps(b)
      )
    },
  })
  const entries = candidates.map((plan, index): DevelopmentCandidateRankingEntry => {
    const value = side(plan)
    const identity = candidateIdentity(plan)
    const groupId = group(plan)
    const peers = candidates.filter((candidate) => group(candidate) === groupId)
    const allPeersPairwiseComparable =
      peers.length > 1 &&
      peers.every((left, leftIndex) =>
        peers.slice(leftIndex + 1).every((right) => protectedComparable(left, right)),
      )
    const comparableToGroup = allPeersPairwiseComparable
    const groupRank = comparableToGroup ? peers.indexOf(plan) + 1 : null
    const panel = plan.loadouts[0]?.panelObjective
    const fallback = panelFallback(plan, value)
    const tieBreakers: RankingTieBreaker[] = [
      ...(!fallback &&
      knownSameBasis(
        peers.filter((peer) => recommendedFourPlusTwo(peer) === recommendedFourPlusTwo(plan)),
      )
        ? ['loadout_score' as const]
        : []),
      'fewer_swaps',
      'incoming_order',
    ]
    let basis: DevelopmentCandidateRankingBasis
    if (comparableToGroup && panel && fallback) {
      const priorityStat = panel.priorityStat ?? 'anomalyProficiency'
      basis = {
        kind: 'panel_target',
        priorityStat,
        attackDeficit: panel.attackDeficit,
        targetValue: priorityStat === 'source' ? null : (panel[priorityStat] ?? null),
        direction: 'ascending_deficit_then_descending_priority',
        tieBreakers,
      }
    } else if (
      comparableToGroup &&
      value.coverage?.domain === 'fixed_event_direct_damage' &&
      Number.isFinite(value.totalDamage)
    ) {
      basis = {
        kind: 'fixed_event_output',
        domain: 'fixed_event_direct_damage',
        metric: 'total_damage',
        totalDamage: value.totalDamage!,
        planningDps: Number.isFinite(value.planningDps) ? value.planningDps : null,
        direction: 'higher',
        tieBreakers,
      }
    } else {
      basis = {
        kind: 'unranked',
        reason:
          value.state !== 'supported' || !Number.isFinite(value.totalDamage)
            ? 'objective_unresolved'
            : peers.length > 1
              ? 'coverage_or_target_mismatch'
              : 'no_comparable_peer',
        direction: null,
        tieBreakers: [],
      }
    }
    return {
      candidateRank: index + 1,
      candidateIdentity: identity,
      calculationIdentity: value.calculationFingerprint,
      groupId,
      groupRank,
      groupSize: peers.length,
      comparable: comparableToGroup,
      comparisonParametersIdentity,
      recommendedFourPlusTwo: recommendedFourPlusTwo(plan),
      ...(comparableToGroup
        ? {
            orderingPolicy: [
              fallback ? ('panel_target' as const) : ('fixed_event_output' as const),
              ...(!fallback && recommendedFourPlusTwo(plan) !== null
                ? ['recommended_4plus2' as const]
                : []),
              ...(!fallback && tieBreakers.includes('loadout_score')
                ? ['loadout_score' as const]
                : []),
              'fewer_swaps' as const,
              'incoming_order' as const,
            ],
          }
        : {}),
      basis,
    }
  })
  const rankingScopes: DevelopmentCandidateRankingScope[] = [
    ...new Set(
      candidates.flatMap((plan, index): DevelopmentCandidateRankingScope[] => {
        if (!entries[index]?.comparable) return []
        return [
          entries[index]!.basis.kind === 'panel_target'
            ? 'panel_target'
            : side(plan).coverage!.excludedEffects.length
              ? 'fixed_event_slice'
              : 'declared_event',
        ]
      }),
    ),
  ]
  const candidateRanking = buildCandidateRanking(rankingSource, entries)
  return { candidates, rankingScopes, candidateRanking }
}
