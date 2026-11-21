import type { PlanningEffectRuntimeMember } from './currentPlanningEffectDomain'
import type { SourceBackedPlanningEffectBucket } from './currentPlanningDamageModifiers'
import type { PlanningBaseline } from './planningDpsContract'
import type { PreparedAnomalyPreparation32 } from './reviewedPreparedAnomalyDeclarations32'
import type { ReviewedPreparedPolarityInput32 } from './reviewedPreparedPolarityObjective32'
import type { CurrentWEngineFormulaRuntime } from './currentWEnginePersonalPlanningEffects'

export type ReviewedPreparedAnomalyObjectiveInput32 = {
  member: PlanningEffectRuntimeMember
  members?: readonly PlanningEffectRuntimeMember[]
  baseline: PlanningBaseline
  preparation?: PreparedAnomalyPreparation32
  /** Explicit formation buckets only. Equipment is separately resolved below. */
  effectBuckets?: readonly SourceBackedPlanningEffectBucket[]
  equipmentModifierBuckets?: readonly SourceBackedPlanningEffectBucket[]
  wEngine?: { engineId: string; refinement: number; runtime?: CurrentWEngineFormulaRuntime }
  discs?: readonly { setId: string }[]
  sourceIdentityHash?: string
  originalEquipment?: ReviewedPreparedPolarityInput32['originalEquipment']
  baselineReferencesByAgentId?: ReviewedPreparedPolarityInput32['baselineReferencesByAgentId']
  /** Event clock required when a target-bound party observation is supplied. */
  settlementAtSeconds?: number
}
