import type { CoreWarehouse } from '../accounts/coreFlow'
import { valueBenchmarkEvidencePolicy } from '../calculation/valueBenchmarkEvidence'
import { currentFormulaMechanicContractHash } from '../calculation/currentFormulaMechanicContracts'
import { currentWEnginePersonalPlanningEffectVersion } from '../calculation/currentWEnginePersonalPlanningEffects'
import { teamAssignmentObjectivePolicy } from '../optimizer/selectTeamObjectiveAssignment'
import type { AgentDiscProfile } from '../assault/engine'
import { contentHash } from '../evaluation/contentHash'
import { currentDataAuthorityProjection } from '../gameDataPacks/currentDataAuthorityProjection'
import { rosterFingerprintFacts } from '../application/publicRosterFingerprintFacts'
import { getCandidateWarehouseProfiles } from '../optimizer/candidateWarehouseSolver'
import { accountOptimizerInputHash } from '../optimizer/optimizeAccountBuilds'
import { current31TeamEngineD1Pack } from '../teamEngine/current31D1Pack'
import type { BuildAccountDecisionInput } from './accountDecisionService'
import { current31TeamStrengthCalibrationBoundary } from './current31TeamStrengthCalibration'
import { current31TeamStrengthProductReadiness } from './current31TeamStrengthProductGate'
import { teamRatingDecisionTable } from './teamRatingEvaluator'
import { portfolioSelectionPolicy } from '../optimizer/multiTeamCoordinator'
import { candidateSetPlanPolicyVersion } from '../gameDataPacks/candidateSetPlanPolicy'
import {
  warehouseAnalysisRuleVersion,
  warehouseUsePolicyVersion,
} from '../warehouse/warehousePolicyVersion'
import {
  absoluteDiscRetentionCatalogHash,
  absoluteDiscRetentionPolicy,
} from '../warehouse/absoluteDiscRetentionCatalog'

export const accountDecisionFingerprintContract = 'soda-account-decision-fingerprint/v4' as const

export function accountDecisionModelHashForEvidencePolicy(evidencePolicy: string) {
  return contentHash({
    mechanicDecisionTable: teamRatingDecisionTable,
    teamStrengthCalibration: current31TeamStrengthCalibrationBoundary,
    variantBangbooRecommendation: current31VariantBangbooRecommendationSet,
    normalizedBangbooBinding: 'scheme-parameter-adapter-v1',
    driveDiscFourPiecePolicy: 'disc-fixed-event-passives-r1',
    equipmentFormulaContract: currentFormulaMechanicContractHash,
    personalWEngineEffectVersion: currentWEnginePersonalPlanningEffectVersion,
    valueBenchmarkEvidencePolicy: evidencePolicy,
    teamAssignmentObjectivePolicy,
    candidateSetPlanPolicyVersion,
    warehouseUsePolicyVersion,
    warehouseAnalysisRuleVersion,
    absoluteDiscRetentionCatalogHash,
    absoluteDiscRetentionPolicy,
    teamStrengthProductGate: current31TeamStrengthProductReadiness,
    portfolioSelectionPolicy,
  })
}

export type AccountDecisionFingerprint = {
  contract: typeof accountDecisionFingerprintContract
  inputHash: string
  components: {
    dataAuthorityHash: string
    accountHash: string
    warehouseHash: string
    rosterHash: string
    planningHash: string
    preferenceHash: string
    profilesHash: string
    optimizerOptionsHash: string
    teamEnginePackHash: string
    planningEvaluationHash: string
    planningAuthorityHash: string
    decisionModelHash: string
  }
}

function sortedRecord(input: Readonly<Record<string, unknown>>) {
  return Object.fromEntries(
    Object.entries(input).sort(([left], [right]) => left.localeCompare(right)),
  )
}

export function resolveDecisionProfiles(
  warehouse: CoreWarehouse,
  suppliedProfiles: AgentDiscProfile[] | undefined,
) {
  const ownedAgentIds = warehouse.roster.agents
    .filter((agent) => agent.owned)
    .map((agent) => agent.agentId)
    .sort((left, right) => left.localeCompare(right))
  const profiles =
    suppliedProfiles ??
    getCandidateWarehouseProfiles(ownedAgentIds, [
      ...new Set(warehouse.discs.map((disc) => disc.setId)),
    ])
  return { ownedAgentIds, profiles }
}

/** Stable read-only identity used by every production stale check for Account Decision inputs. */
export function buildAccountDecisionInputFingerprint({
  warehouse,
  profiles: suppliedProfiles,
  drafts,
  activePlanIds,
  developmentPriorityAgentIds = [],
  preference,
  optimizerOptions = {},
  planningDpsEvaluations = [],
  planningCandidateAuthorities = {},
}: BuildAccountDecisionInput): AccountDecisionFingerprint {
  if (!warehouse.accountId) throw new Error('决策指纹只接受具名活动账户，不能回退到旧表。')
  const { profiles } = resolveDecisionProfiles(warehouse, suppliedProfiles)
  const components = {
    dataAuthorityHash: contentHash(currentDataAuthorityProjection),
    accountHash: contentHash({ accountId: warehouse.accountId }),
    warehouseHash: contentHash(
      [...warehouse.discs].sort((left, right) => left.id.localeCompare(right.id)),
    ),
    // Compatibility hydration adds missing directory rows in memory using the read time as
    // `syncedAt`. Those projection timestamps are not account facts and must not make a read-only
    // snapshot immediately stale. Explicit roster changes still alter their semantic fields.
    rosterHash: contentHash(rosterFingerprintFacts(warehouse.roster)),
    planningHash: contentHash({
      drafts: [...drafts].sort((left, right) => left.id.localeCompare(right.id)),
      activePlanIds: sortedRecord(activePlanIds),
      developmentPriorityAgentIds: [...developmentPriorityAgentIds].sort((left, right) =>
        left.localeCompare(right),
      ),
    }),
    preferenceHash: contentHash({
      teamCount: preference.teamCount,
      templateIds: [...preference.templateIds].sort(),
      fixedAgentIds: [...preference.fixedAgentIds].sort(),
      fixedBangbooIds: [...preference.fixedBangbooIds].sort(),
      planIdsByAgent: sortedRecord(preference.planIdsByAgent),
    }),
    profilesHash: contentHash(
      [...profiles].sort((left, right) => left.agentId.localeCompare(right.agentId)),
    ),
    optimizerOptionsHash: accountOptimizerInputHash(profiles, optimizerOptions),
    teamEnginePackHash: contentHash(current31TeamEngineD1Pack),
    planningEvaluationHash: contentHash(planningDpsEvaluations),
    planningAuthorityHash: contentHash(sortedRecord(planningCandidateAuthorities)),
    decisionModelHash: accountDecisionModelHashForEvidencePolicy(valueBenchmarkEvidencePolicy),
  }
  return {
    contract: accountDecisionFingerprintContract,
    inputHash: contentHash(components),
    components,
  }
}
import { current31VariantBangbooRecommendationSet } from './current31VariantBangbooRecommendation'
