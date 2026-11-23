import { type TeamPrimaryOutputKind } from '../gameDataPacks/teamOutputModuleContract'
import { type TeamSystemClassificationBasis } from './teamSystemRankingMethod'

export const currentTeamSystemRankingContract = 'soda-current-team-system-ranking/v3' as const

export const currentTeamSystemRankingProducerContract =
  'soda-current-team-system-ranking-producer/v1' as const

export const currentSystemRankingSameCoreIntegrationContract =
  'soda-team-system-ranking-same-core-integration/v1' as const

export type TeamSystemRankingReason =
  | 'mechanic_evidence_missing'
  | 'member_action_evidence_unavailable'
  | 'invalid_mechanics'
  | 'no_primary_output'
  | 'no_classifiable_output'
  | 'nonfinite_mechanic_capacity'

export const systems = [
  'direct_damage',
  'attribute_anomaly',
  'rupture',
  'aftershock',
  'sharp',
] as const

export const statuses = ['ranked', 'unsupported'] as const

export const classificationBases = [
  'reviewed_exact_team_output_module',
  'primary_special_output_family',
  'anomaly_output_capacity',
  'standard_direct_output',
] as const

export const rankingReasons = [
  'mechanic_evidence_missing',
  'member_action_evidence_unavailable',
  'invalid_mechanics',
  'no_primary_output',
  'no_classifiable_output',
  'nonfinite_mechanic_capacity',
] as const

export const requiredSourcePaths = [
  'src/decision/teamSystemRankingMethod.ts',
  'src/decision/teamSameCoreOutputComparison.ts',
  'src/decision/teamStrengthStandardFiniteEventConditions.ts',
  'src/decision/teamSameCoreApplicableCoordinates.ts',
  'src/decision/teamStrengthSupportContribution.ts',
  'src/calculation/fixedEventSupportContribution32.ts',
] as const

export type SameCoreRecordStatus = 'supported' | 'partial' | 'unsupported'

type SameCoreOutputRecord = {
  memberIds: string[]
  subjectAgentId: string
  protocol: string
  status: SameCoreRecordStatus
  referenceIdentity: string
  referenceStatus: string
  sourceAuthority: string
  conditionBindingIdentity?: string | null
  conditionBindingBoundary?: string | null
  conditionBindingScenario?: string | null
  eventPacketIdentity: string | null
  outputSystem: TeamPrimaryOutputKind | null
  baselineIdentity: string | null
  eventUsages: unknown[]
  declaredReferences: Record<string, Record<string, unknown>>
  fixedEventValue: number | null
  consumedBuckets: unknown[]
  unknownEffectKeys: string[]
  blockers: string[]
  boundary: string
}

export type RawArtifact = {
  contract: string
  producerProtocol: string
  gameVersion: string
  intrinsicIndexContentHash: string
  mechanicDataFingerprint: string
  methodContract: string
  adoptionStatus: string
  productionEligible: boolean
  agentIds: string[]
  systems: TeamPrimaryOutputKind[]
  statuses: string[]
  classificationBases: string[]
  reasons: string[]
  rows: number[][]
  sameCoreOutput: {
    protocol: string
    comparisonContract: string
    productionEligible: boolean
    conditionPolicy: string
    standardConditionIdentity: Record<string, unknown>
    boundary: string
    records: SameCoreOutputRecord[]
    coverage: {
      declaredTeams: number
      supported: number
      partial: number
      unsupported: number
      evaluation?: {
        evaluated: number
        supportedTeams: number
        partialTeams: number
        unsupportedTeams: number
        tracedTeams: number
      }
    }
    unknownEffectCounts?: Record<string, number>
  }
  coverage: {
    total: number
    ranked: number
    unsupported: number
    systems: Record<string, number>
    reasons: Record<string, number>
    classificationBases: Record<string, number>
  }
  validation: {
    fixedCounterexamples?: {
      contract?: string
      total?: number
      preserved?: number
      crossOwnerIncomparable?: number
      boundaryViolations?: number
      records?: Array<{
        id?: string
        samePrimaryOutput?: boolean
        relation?: string
      }>
    }
    standardFiniteEvent?: {
      contract?: string
      scenario?: string
      total?: number
      supported?: number
      ordered?: number
      boundary?: string
      records?: Array<{
        id?: string
        leftStatus?: string
        rightStatus?: string
        relation?: string
        fixedEventDelta?: number | null
        conditionIdentity?: { left?: string | null; right?: string | null }
        sourceIdentity?: {
          left?: {
            referenceConditionInstance?: string
            planningConditions?: { version?: string; sourceHash?: string }
          } | null
          right?: {
            referenceConditionInstance?: string
            planningConditions?: { version?: string; sourceHash?: string }
          } | null
        }
        observationLayer?: {
          left?: { status?: string; sourceAuthority?: string } | null
          right?: { status?: string; sourceAuthority?: string } | null
        }
        bindings?: {
          left?: Array<{
            referenceKey?: string
            recipientAgentIds?: string[]
            sourceRefs?: string[]
          }>
          right?: Array<{
            referenceKey?: string
            recipientAgentIds?: string[]
            sourceRefs?: string[]
          }>
        }
      }>
    }
  }
  inputFingerprints: {
    intrinsicIndex: string
    mechanicData: string
    methodContract: string
    methodSha256: string
    generatorSha256: string
    sourceClosureIdentity: string
    sourceClosureSha256: string
    sourceClosure: Array<{ path: string; sha256: string }>
  }
  contentHash: string
}

export type CurrentTeamSystemRanking = {
  genericOrder?: import('./teamGenericOrderContract').GenericTeamOrder
} & (
  | {
      contract: typeof currentTeamSystemRankingContract
      status: 'ranked'
      system: TeamPrimaryOutputKind
      systemLabel: string
      /** Dense ordinal inside the selected system only. */
      systemRank: number
      /** Internal mechanism dominance depth. Never present it as a score. */
      internalScore: number
      classificationBasis: TeamSystemClassificationBasis
      rankScope: 'system'
      crossSystemComparable: false
      sameCoreOutput: {
        status: SameCoreRecordStatus
        eventPacketIdentity: string | null
        boundary: string
      } | null
      contentHash: string
    }
  | {
      contract: typeof currentTeamSystemRankingContract
      status: 'unsupported'
      system: null
      systemLabel: null
      systemRank: null
      internalScore: null
      classificationBasis: null
      reason: TeamSystemRankingReason
      rankScope: 'system'
      crossSystemComparable: false
      sameCoreOutput: null
      contentHash: string
    }
)

export type PreparedRanking = {
  contentHash: string
  agentIds: readonly string[]
  agentIndex: ReadonlyMap<string, number>
  rows: ReadonlyMap<number, readonly number[]>
  sameCoreByKey: ReadonlyMap<string, SameCoreOutputRecord>
  artifact: Omit<RawArtifact, 'rows' | 'contentHash'>
}
