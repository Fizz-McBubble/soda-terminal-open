import type { readDevelopmentCandidateSnapshot } from './agentDevelopmentCandidateSession'
import { saveCurrentAgentBuild } from '../accounts/planningDrafts'
import { getAgentName } from '../application/publicRosterNames'
import { valueBenchmarkSaveLabel } from '../application/valueBenchmarkSaveLabel'
import { formatCandidateSkillDirections } from '../application/publicCandidateLabels'
import { contentHash } from '../application/contentHash'
import { publicVersionIdentity } from '../application/publicVersionIdentity'

type Snapshot = NonNullable<ReturnType<typeof readDevelopmentCandidateSnapshot>>

/** Maps a captured candidate into the player-owned proposal without writing any account facts. */
export function createComparisonSavedBuild(
  agentId: string,
  rank: number,
  candidateSnapshot: Snapshot,
): Parameters<typeof saveCurrentAgentBuild>[1] {
  const candidatePlan = candidateSnapshot.candidates[rank - 1]!
  const candidate = candidatePlan.loadouts[0]!
  const candidatePresentation = candidateSnapshot.presentation!
  const valueBenchmark = candidateSnapshot.valueBenchmarks?.[rank - 1]
  const benchmarkDisposition = valueBenchmarkSaveLabel(valueBenchmark)
  const knowledge = candidateSnapshot.panelPresentation!.saveKnowledge
  const explicitParameters = candidateSnapshot.candidateParametersByRank?.[rank]
  const discIds = candidate.discs.map((item) => item.disc.id)
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
      gameVersion:
        valueBenchmark?.candidate.dimensions.game_version ?? publicVersionIdentity.gameVersion,
      knowledgeVersion: knowledge.version,
      exactVariantKey: null,
      ...(candidateSnapshot.candidateParametersByRank?.[rank]
        ? { comparisonParameters: candidateSnapshot.candidateParametersByRank[rank] }
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
