import type { PlanningEffectRuntimeMember } from '../calculation/currentPlanningEffectDomain'
import type { SourceBackedPlanningEffectBucket } from '../calculation/currentPlanningDamageModifiers'
import type { PlanningBaseline } from '../calculation/planningDpsContract'
import type { CurrentWEngineFormulaRuntime } from '../calculation/currentWEnginePersonalPlanningEffects'
import {
  evaluateReviewedPreparedAnomalyObjective32,
  reviewedPreparedAnomalyObjectiveHash32,
  type PreparedAnomalyPreparation32,
} from '../calculation/reviewedPreparedAnomalyObjective32'
import type { ValueBenchmarkSide } from '../calculation/valueBenchmarkComparison'
import { stableContentHash } from '../gameDataPacks/types'

/** Existing candidate-comparison adapter. Damage is one prepared settlement;
 * no fake duration or DPS, no account writes, and no whole-build promotion. */
export function evaluateDevelopmentPreparedAnomalyBenchmarkSide32(input: {
  member: PlanningEffectRuntimeMember
  members?: readonly PlanningEffectRuntimeMember[]
  baseline: PlanningBaseline
  discs: readonly { setId: string }[]
  wEngine: { engineId: string; refinement: number; runtime?: CurrentWEngineFormulaRuntime }
  engineKey: string
  discLoadoutKey: string
  subjectKey: string
  potential?: number | null
  preparation?: PreparedAnomalyPreparation32
  effectBuckets?: readonly SourceBackedPlanningEffectBucket[]
  sourceIdentityHash?: string
}): ValueBenchmarkSide {
  const result = evaluateReviewedPreparedAnomalyObjective32(input)
  const dimensions = {
    game_version: input.baseline.gameVersion,
    subject: input.subjectKey,
    scenario: `prepared-single-anomaly:${result.status === 'supported' ? result.contextHash : stableContentHash({ agentId: input.member.agentId, preparation: input.preparation ?? null, enemy: input.baseline.enemy })}`,
    event_set:
      result.status === 'supported'
        ? result.identity.preparation.kind
        : 'prepared-anomaly-unresolved',
    duration: 'not_applicable',
    formula: reviewedPreparedAnomalyObjectiveHash32,
    runtime: 'prepared-single-owner-anomaly-runtime32-r1',
    disc_loadout: input.discLoadoutKey,
    w_engine: input.engineKey,
    bangboo: 'none',
    ...(input.potential == null ? {} : { potential: String(input.potential) }),
  }
  if (result.status !== 'supported')
    return {
      state: 'unsupported',
      dimensions,
      totalDamage: null,
      planningDps: null,
      calculationFingerprint: null,
      reasons: result.blockers,
    }
  return {
    state: 'supported',
    dimensions,
    totalDamage: result.settlementDamage,
    planningDps: null,
    calculationFingerprint: result.runtimeHash,
    reasons: [],
    coverage: {
      domain: 'prepared_anomaly_settlement',
      includedEffectKeys: result.included,
      excludedEffects: result.excluded,
      // Preserve the unknown effects AND their actual stat context. Equal
      // labels do not prove the missing mechanisms cancel between loadouts.
      exclusionContextFingerprint: stableContentHash({
        contextHash: result.contextHash,
        initialStats: input.member.initialStats,
        finalStats: input.member.finalStats,
        exclusions: result.excluded,
        discs: input.discs,
        engine: input.wEngine,
      }),
      boundary: result.boundary,
    },
  }
}
