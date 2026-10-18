import {
  normalizeReviewedEventConditionDeclarations32,
  reviewedEventConditionDeclarationsIdentity32,
} from '../calculation/reviewedEventConditionDeclarations32'
import type { DevelopmentWorkbenchEquipmentDecision } from '../application/publicDevelopmentWorkbenchPresentation'
import type { CurrentAgentBuildInput } from '../accounts/planningDrafts'
import { contentHash } from '../application/contentHash'
import { formatCandidateSkillDirections } from '../application/publicCandidateLabels'
import { publicVersionIdentity } from '../application/publicVersionIdentity'
import { valueBenchmarkSaveLabel } from '../application/valueBenchmarkSaveLabel'
import { readDevelopmentCandidateSnapshot } from './agentDevelopmentCandidateSession'

type CandidateSnapshot = NonNullable<ReturnType<typeof readDevelopmentCandidateSnapshot>>
type CandidatePlan = CandidateSnapshot['candidates'][number]

export function createAgentDevelopmentSavedPlan(input: {
  agentId: string
  agentName: string
  candidatePlan: CandidatePlan
  candidateSnapshot: CandidateSnapshot | null
  candidateIndex: number
  equipment: DevelopmentWorkbenchEquipmentDecision
}): CurrentAgentBuildInput {
  const { agentId, agentName, candidatePlan, candidateSnapshot, candidateIndex, equipment } = input
  const declarations = normalizeReviewedEventConditionDeclarations32(
    candidateSnapshot?.eventConditionDeclarationsByAgentId,
    [agentId],
  )
  const declarationIdentity = reviewedEventConditionDeclarationsIdentity32(declarations)
  if (declarationIdentity !== candidateSnapshot?.eventConditionDeclarationsIdentity)
    throw new Error('技能事件计算身份缺失或变化，请重新比较。')
  const candidate = candidatePlan.loadouts[0]
  const profileSave = equipment.profileSave
  const discIds = candidate.discs.map((item) => item.disc.id)
  const valueBenchmark = candidateSnapshot?.valueBenchmarks?.[candidateIndex]
  if (
    valueBenchmark?.candidate.sourceResourceProduction32?.mechanismGrants32?.receiptStatus ===
      'supported' &&
    !candidateSnapshot?.resourceGrantDeclaration32
  )
    throw new Error('资源到账输入未持久化，请重新比较后再保存。')
  const benchmarkDisposition = valueBenchmarkSaveLabel(valueBenchmark)
  return {
    name: `${agentName} · 养成方案`,
    selection: {
      agentIds: [agentId],
      bangbooId: null,
      scenario: profileSave!.scenario,
    },
    manualOverrides: {
      wEngineDirection: equipment.engine.currentId
        ? '沿用我的资产中记录的当前音擎'
        : '当前音擎未记录；本方案仅保存实体驱动盘',
      discDirection: `仓库候选（${benchmarkDisposition}）`,
      progressionDirection: formatCandidateSkillDirections(profileSave!.progressionDirections),
      notes: '单人参考方案；会保留用盘提示，但不会锁定驱动盘或限制队伍配装。',
    },
    knowledgeRefs: [
      {
        profileId: profileSave!.profileId,
        status: profileSave!.status,
        version: profileSave!.version,
        source: profileSave!.source,
      },
    ],
    warehouseRefs: discIds,
    solutionContext: {
      contract: 'soda-solution-context/v1',
      scope: 'agent_independent',
      resourcePolicy: 'advisory',
      sourceCandidateId: `development:${agentId}:${contentHash(discIds.toSorted())}`,
      inputFingerprint: candidateSnapshot
        ? contentHash([
            candidateSnapshot.inputFingerprint,
            candidateSnapshot.buildIntent.fingerprint,
          ])
        : 'unavailable',
      solverMethod: candidatePlan.solver?.method ?? 'bounded_heuristic',
      gameVersion: publicVersionIdentity.gameVersion,
      knowledgeVersion: profileSave!.version,
      exactVariantKey: null,
      eventConditionDeclarationsByAgentId: declarations,
      eventConditionDeclarationsIdentity: declarationIdentity,
      ...(candidateSnapshot?.resourceGrantDeclaration32
        ? { resourceGrantDeclaration32: candidateSnapshot.resourceGrantDeclaration32 }
        : {}),
      scenarioSelection: candidateSnapshot?.scenarioSelection,
      scenarioIdentity: candidateSnapshot?.scenarioIdentity,
      ...(candidateSnapshot?.candidateParametersByRank?.[candidateIndex + 1]
        ? {
            comparisonParameters: candidateSnapshot.candidateParametersByRank[candidateIndex + 1],
          }
        : {}),
    },
    candidateWarehouse: {
      ...(candidatePlan.inventoryTransition ? { inventoryTransition: true as const } : {}),
      scope: 'agent',
      totalScore: candidatePlan.totalScore,
      loadouts: [
        {
          agentId,
          totalScore: candidate.totalScore,
          discIds: candidate.discs.map((item) => item.disc.id),
          effectiveRolls: candidate.discs.reduce((total, item) => total + item.effectiveRolls, 0),
          setPattern: candidate.setPattern,
          degraded: candidate.degraded,
        },
      ],
      boundary: candidatePlan.boundary,
    },
    comparisonCapability: profileSave!.status === 'formal' ? 'formal' : 'direction',
  }
}
