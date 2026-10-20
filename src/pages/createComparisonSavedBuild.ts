import {
  normalizeReviewedEventConditionDeclarations32,
  reviewedEventConditionDeclarationsIdentity32,
} from '../calculation/reviewedEventConditionDeclarations32'
import type { readDevelopmentCandidateSnapshot } from './agentDevelopmentCandidateSession'
import { saveCurrentAgentBuild } from '../accounts/planningDrafts'
import { getAgentName } from '../application/publicRosterNames'
import { valueBenchmarkSaveLabel } from '../application/valueBenchmarkSaveLabel'
import { formatCandidateSkillDirections } from '../application/publicCandidateLabels'
import { contentHash } from '../application/contentHash'
import { publicVersionIdentity } from '../application/publicVersionIdentity'

import { resolveSavedPlanScenarioSelection } from './savedPlanIdentity'

type Snapshot = NonNullable<ReturnType<typeof readDevelopmentCandidateSnapshot>>

/** Maps a captured candidate into the player-owned proposal without writing any account facts. */
export function createComparisonSavedBuild(
  agentId: string,
  rank: number,
  candidateSnapshot: Snapshot,
): Parameters<typeof saveCurrentAgentBuild>[1] {
  const declarations = normalizeReviewedEventConditionDeclarations32(
    candidateSnapshot.eventConditionDeclarationsByAgentId,
    [agentId],
  )
  const declarationIdentity = reviewedEventConditionDeclarationsIdentity32(declarations)
  if (declarationIdentity !== candidateSnapshot.eventConditionDeclarationsIdentity)
    throw new Error('技能事件计算身份缺失或变化，请重新比较。')
  const candidatePlan = candidateSnapshot.candidates[rank - 1]!
  const candidate = candidatePlan.loadouts[0]!
  const candidatePresentation = candidateSnapshot.presentation!
  const valueBenchmark = candidateSnapshot.valueBenchmarks?.[rank - 1]
  const mechanismGrants = valueBenchmark?.candidate.sourceResourceProduction32?.mechanismGrants32
  if (
    mechanismGrants?.status === 'supported' &&
    mechanismGrants.receiptStatus === 'supported' &&
    !candidateSnapshot.resourceGrantDeclaration32
  )
    throw new Error('资源到账输入未持久化，请重新比较后再保存。')
  const benchmarkDisposition = valueBenchmarkSaveLabel(valueBenchmark)
  const knowledge = candidateSnapshot.panelPresentation!.saveKnowledge
  const explicitParameters = candidateSnapshot.candidateParametersByRank?.[rank]
  const discIds = candidate.discs.map((item) => item.disc.id)
  const validatedScenario =
    candidateSnapshot.scenarioSelection !== undefined
      ? resolveSavedPlanScenarioSelection(candidateSnapshot.scenarioSelection)
      : undefined
  if (validatedScenario?.id === 'declared-stun-comparison' && !candidateSnapshot.scenarioIdentity)
    throw new Error('失衡期计算身份缺失，请重新比较。')
  return {
    name: `${getAgentName(agentId)} · 养成方案`,
    selection: { agentIds: [agentId], bangbooId: null, scenario: knowledge.scenario },
    manualOverrides: {
      wEngineDirection: explicitParameters?.wEngine
        ? `方案音擎 ${candidateSnapshot.comparisonOptions?.wEngines.find((row) => row.engineId === explicitParameters.wEngine!.engineId)?.name ?? explicitParameters.wEngine.engineId} Lv${explicitParameters.wEngine.level} / 突破${explicitParameters.wEngine.ascension ?? '来源推导'} / P${explicitParameters.wEngine.refinement}（仅方案参数）`
        : knowledge.currentEngineRecorded
          ? '沿用我的资产中已记录的当前音擎'
          : '当前音擎未记录；本方案仅保存实体驱动盘',
      discDirection: `仓库候选（${benchmarkDisposition}）`,
      progressionDirection:
        formatCandidateSkillDirections(candidatePresentation.progressionDirections) +
        (explicitParameters?.potential !== undefined
          ? `；方案潜能${explicitParameters.potential}（仅方案参数）`
          : ''),
      notes: '养成配装方案；驱动盘可供其他代理人或队伍搭配。',
    },
    knowledgeRefs: [
      {
        profileId: knowledge.profileId,
        status: knowledge.status,
        version: knowledge.version,
        source: knowledge.source,
      },
    ],
    warehouseRefs: discIds,
    solutionContext: {
      contract: 'soda-solution-context/v1',
      scope: 'agent_independent',
      resourcePolicy: 'advisory',
      sourceCandidateId: `development:${agentId}:${contentHash(discIds.toSorted())}`,
      inputFingerprint: contentHash([
        candidateSnapshot.inputFingerprint,
        candidateSnapshot.buildIntent.fingerprint,
        candidateSnapshot.comparisonFingerprint,
        explicitParameters,
      ]),
      solverMethod: candidatePlan.solver?.method ?? 'bounded_heuristic',
      ...((candidateSnapshot.candidateSearchByRank?.[rank] ?? candidateSnapshot.candidateSearch)
        ? {
            candidateSearch:
              candidateSnapshot.candidateSearchByRank?.[rank] ?? candidateSnapshot.candidateSearch,
          }
        : {}),
      gameVersion:
        valueBenchmark?.candidate.dimensions.game_version ?? publicVersionIdentity.gameVersion,
      knowledgeVersion: knowledge.version,
      exactVariantKey: null,
      eventConditionDeclarationsByAgentId: declarations,
      eventConditionDeclarationsIdentity: declarationIdentity,
      ...(candidateSnapshot.resourceGrantDeclaration32
        ? { resourceGrantDeclaration32: candidateSnapshot.resourceGrantDeclaration32 }
        : {}),
      ...(candidateSnapshot.candidateParametersByRank?.[rank]
        ? { comparisonParameters: candidateSnapshot.candidateParametersByRank[rank] }
        : {}),
      ...(validatedScenario ? { scenarioSelection: validatedScenario } : {}),
      ...(candidateSnapshot.scenarioIdentity
        ? { scenarioIdentity: candidateSnapshot.scenarioIdentity }
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
    comparisonCapability: explicitParameters
      ? 'direction'
      : knowledge.status === 'formal'
        ? 'formal'
        : 'direction',
  }
}
