import { buildBoxNumericDecision, type BoxNumericDecision } from '../calculation/boxNumericDecision'
import { applyCurrentTeamDpsAuthorityCalibration } from '../calculation/currentTeamDpsAuthorityCalibration'
import type { TeamEngineResult } from '../teamEngine/contracts'
import { currentCapabilityGapMatrix } from '../gameDataPacks/currentCapabilityGapMatrix'
import { commonForbiddenClaims } from './accountDecisionClaimBoundaries'
import type { AccountDecisionFingerprint } from './accountDecisionFingerprint'
import type { DecisionClaim } from './accountDecisionService'

export function projectAccountBoxPlanning(input: {
  accountId: string
  fingerprint: AccountDecisionFingerprint
  teamEngine: TeamEngineResult
  evaluations: readonly unknown[]
  assemblyBlockersByCandidate: Readonly<Record<string, readonly string[]>>
  exhaustiveCoverage: {
    eligibleFormationCount: number
    assetBoundFormationCount: number
    formationBangbooCandidateCount: number
    scoredFormationBangbooCandidateCount: number
    unsupportedBangbooCandidateCount: number
    complete: boolean
  }
  calibrationRanked: Array<{
    rank: number
    candidateId: string
    memberIds: [string, string, string]
  }>
}) {
  const numericDecision = buildBoxNumericDecision({
    account: {
      accountId: input.accountId,
      rosterHash: input.fingerprint.components.rosterHash,
      warehouseHash: input.fingerprint.components.warehouseHash,
      planningHash: input.fingerprint.components.planningHash,
      stale: false,
    },
    candidates: [
      ...input.teamEngine.recommendations,
      ...input.teamEngine.rejected,
      ...input.teamEngine.assembleOnly,
    ],
    evaluations: input.evaluations,
    assemblyBlockersByCandidate: input.assemblyBlockersByCandidate,
  })
  const decision = applyCurrentTeamDpsAuthorityCalibration(numericDecision, input.calibrationRanked)
  const exhaustiveProductionCoverage =
    input.exhaustiveCoverage.complete &&
    input.exhaustiveCoverage.assetBoundFormationCount ===
      input.exhaustiveCoverage.eligibleFormationCount &&
    input.exhaustiveCoverage.scoredFormationBangbooCandidateCount ===
      input.exhaustiveCoverage.formationBangbooCandidateCount
  const candidateUniverseBlocker = exhaustiveProductionCoverage
    ? []
    : [
        `完整账户候选资产绑定为 ${input.exhaustiveCoverage.assetBoundFormationCount}/${input.exhaustiveCoverage.eligibleFormationCount}，实际评分 ${input.exhaustiveCoverage.scoredFormationBangbooCandidateCount}/${input.exhaustiveCoverage.formationBangbooCandidateCount}；${input.exhaustiveCoverage.unsupportedBangbooCandidateCount} 个邦布候选缺少 source condition 所需的具名 event flag 或累计量，13 个 curated kernel 不能替代缺失候选。`,
      ]
  const boundedDecision: BoxNumericDecision = exhaustiveProductionCoverage
    ? decision
    : {
        ...decision,
        status: 'unsupported',
        claim: {
          strength: 'unsupported',
          label: '当前无可比较数值结果',
          blockers: [...new Set([...candidateUniverseBlocker, ...decision.claim.blockers])],
        },
      }
  const claim: DecisionClaim = {
    status:
      decision.claim.strength === 'current_box_static_model_optimal' &&
      exhaustiveProductionCoverage &&
      decision.authorityCalibration?.status === 'corroborated'
        ? 'candidate'
        : decision.claim.strength === 'supported_scope_optimal'
          ? 'limited'
          : 'unsupported',
    summary: exhaustiveProductionCoverage
      ? `完整账户候选已取得 source-backed effect-bucket asset-bound Team Planning DPS；${decision.claim.label}。`
      : '当前仅完成 curated kernel 数值切片，完整生产候选域仍未闭合。',
    allows: decision.ranked.length
      ? ['按同一 PlanningBaseline 比较 Team Planning DPS，并解释成员贡献']
      : ['查看 calculation support 与被排除候选'],
    forbids: commonForbiddenClaims,
    blockers: [...new Set([...candidateUniverseBlocker, ...decision.claim.blockers])],
  }
  return { decision: boundedDecision, claim }
}

export function planningDpsReadyOwnedAgentIds(ownedAgentIds: readonly string[]) {
  return ownedAgentIds.filter(
    (agentId) =>
      currentCapabilityGapMatrix.rows.find((row) => row.stableId === agentId)?.calculation
        .status === 'ready',
  )
}
