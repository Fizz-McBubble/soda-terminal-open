import type { PlanningEffectRuntimeMember } from './currentPlanningEffectRuntime'
import type { SourceBackedPlanningEffectBucket } from './currentPlanningDamageModifiers'
import type { PlanningEventUsage } from './planningCalculationContextCompiler'
import type { PlanningBaseline } from './planningDpsContract'
import type {
  PotentialApplicationBinding,
  PotentialApplicationEvent,
} from './potentialApplicationBinding'
import type { resolveCurrentPlanningEventEffects32 } from './currentPlanningEventEffectResolution32'
import type { CommonAnomalyEventObservation32 } from './currentCommonAnomalyEffects32'

export type CurrentPlanningEventDamageInput32 = {
  member: PlanningEffectRuntimeMember
  buckets: readonly SourceBackedPlanningEffectBucket[]
  eventUsages: readonly PlanningEventUsage[]
  baseline: PlanningBaseline
  /** Trusted producer's current occurrence/snapshot clock; never inferred from a provider. */
  settlementAtSeconds?: number
  diagnosticBlockers?: string[]
  potentialEvents?: Readonly<Record<string, PotentialApplicationEvent>>
  potentialApplications?: PotentialApplicationBinding[]
  eventEffectContext?: {
    memberIds: readonly string[]
    members: readonly PlanningEffectRuntimeMember[]
    entries: Parameters<typeof resolveCurrentPlanningEventEffects32>[0]['entries']
    baselineReferencesByAgentId?: Readonly<Record<string, Readonly<Record<string, unknown>>>>
    commonAnomalyEvents?: Readonly<Record<string, readonly CommonAnomalyEventObservation32[]>>
    consumedBuckets: SourceBackedPlanningEffectBucket[]
    exclusions: Array<{ effectKey: string; reason: string; fields: string[]; sourceRefs: string[] }>
    disabledSupportProviderIds?: readonly string[]
    equipmentEffectExclusions?: readonly unknown[]
  }
}
