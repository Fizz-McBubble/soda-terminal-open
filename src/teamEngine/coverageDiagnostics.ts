import type {
  TeamEngineBoxInput,
  TeamEngineCandidate,
  TeamEngineFailureCode,
  TeamEnginePack,
  TeamEngineResult,
} from './contracts'

export type TeamEngineCoverageReasonCode =
  | TeamEngineFailureCode
  | 'assemble_only_not_recommended'
  | 'adapter_missing_bangboo'
  | 'adapter_missing_kernel'
  | 'adapter_unknown_kernel'
  | 'adapter_unknown_agent_rule'

export type TeamEngineCoverageReason = {
  code: TeamEngineCoverageReasonCode
  detail: string
  candidateId: string
  kernelId: string | null
  memberIds: string[]
  bangbooId: string | null
  agentId?: string
}

export type TeamEngineAdapterDrop = {
  candidateId: string
  kernelId: string | null
  memberIds: string[]
  bangbooId: string | null
  reasons: TeamEngineCoverageReason[]
}

export type TeamEngineAdapterDiagnostics = {
  inputRecommendations: number
  acceptedRecommendations: number
  droppedRecommendations: number
  byReason: Partial<Record<TeamEngineCoverageReasonCode, number>>
  drops: TeamEngineAdapterDrop[]
}

export type TeamEngineCoverageStage = {
  total: number
  candidateIds: string[]
  byClassification: Partial<Record<TeamEngineCandidate['classification'], number>>
  byReason: Partial<Record<TeamEngineCoverageReasonCode, number>>
}

export type TeamEngineCoverageDiagnostics = {
  input: {
    ownedAgentCount: number
    ownedBangbooCount: number
    preferredAgentCount: number
    warehouseReadyAgentCount: number
  }
  source: {
    gameVersion: string
    kernelCount: number
    familyCount: number
    agentRuleCount: number
    ownedAgentRuleCount: number
    ownedAgentRuleGapCount: number
    ownedAgentRuleGapIds: string[]
    bangbooRuleCount: number
    legacyAssemblyCount: number
    sourceIds: string[]
  }
  stages: {
    recommendations: TeamEngineCoverageStage
    rejected: TeamEngineCoverageStage
    assembleOnly: TeamEngineCoverageStage
  }
  adapter: TeamEngineAdapterDiagnostics
  reasons: TeamEngineCoverageReason[]
}

function increment(
  counts: Partial<Record<TeamEngineCoverageReasonCode, number>>,
  code: TeamEngineCoverageReasonCode,
) {
  counts[code] = (counts[code] ?? 0) + 1
}

function stageFor(
  candidates: readonly TeamEngineCandidate[],
  reasons: readonly TeamEngineCoverageReason[],
): TeamEngineCoverageStage {
  const byClassification: TeamEngineCoverageStage['byClassification'] = {}
  const byReason: TeamEngineCoverageStage['byReason'] = {}
  for (const candidate of candidates) {
    byClassification[candidate.classification] =
      (byClassification[candidate.classification] ?? 0) + 1
  }
  for (const reason of reasons) increment(byReason, reason.code)
  return {
    total: candidates.length,
    candidateIds: candidates.map((candidate) => candidate.candidateId),
    byClassification,
    byReason,
  }
}

function failureReasons(candidate: TeamEngineCandidate): TeamEngineCoverageReason[] {
  return candidate.failures.map((failure) => ({
    code: failure.code,
    detail: failure.detail,
    candidateId: candidate.candidateId,
    kernelId: candidate.kernelId,
    memberIds: [...candidate.memberIds],
    bangbooId: candidate.bangbooId,
    ...(failure.agentId ? { agentId: failure.agentId } : {}),
  }))
}

function assembleOnlyReason(candidate: TeamEngineCandidate): TeamEngineCoverageReason[] {
  return [
    {
      code: 'assemble_only_not_recommended',
      detail: candidate.claim,
      candidateId: candidate.candidateId,
      kernelId: candidate.kernelId,
      memberIds: [...candidate.memberIds],
      bangbooId: candidate.bangbooId,
    },
  ]
}

/**
 * Explains every recommendation that cannot cross the physical-disc adapter.
 * This helper is deliberately pure and does not change the recommendation set.
 */
export function inspectTeamEngineAdapterDrop(
  candidate: TeamEngineCandidate,
  pack: TeamEnginePack,
): TeamEngineAdapterDrop | null {
  const rulesById = new Map(pack.agentRules.map((rule) => [rule.agentId, rule]))
  const kernelsById = new Map(pack.kernels.map((kernel) => [kernel.kernelId, kernel]))
  const reasons: TeamEngineCoverageReason[] = []
  const base = {
    candidateId: candidate.candidateId,
    kernelId: candidate.kernelId,
    memberIds: [...candidate.memberIds],
    bangbooId: candidate.bangbooId,
  }
  if (!candidate.kernelId)
    reasons.push({
      ...base,
      code: 'adapter_missing_kernel',
      detail: '推荐结果未提供 production kernel。',
    })
  else if (!kernelsById.has(candidate.kernelId))
    reasons.push({
      ...base,
      code: 'adapter_unknown_kernel',
      detail: `推荐结果引用未知 production kernel：${candidate.kernelId}。`,
    })
  for (const agentId of candidate.memberIds)
    if (!rulesById.has(agentId))
      reasons.push({
        ...base,
        code: 'adapter_unknown_agent_rule',
        detail: `推荐结果引用未知代理人规则：${agentId}。`,
        agentId,
      })
  return reasons.length ? { ...base, reasons } : null
}

export function teamEngineAdapterDiagnostics(
  result: TeamEngineResult,
  pack: TeamEnginePack,
): TeamEngineAdapterDiagnostics {
  const drops = result.recommendations
    .map((candidate) => inspectTeamEngineAdapterDrop(candidate, pack))
    .filter((drop): drop is TeamEngineAdapterDrop => drop !== null)
  const byReason: TeamEngineAdapterDiagnostics['byReason'] = {}
  for (const drop of drops) for (const reason of drop.reasons) increment(byReason, reason.code)
  return {
    inputRecommendations: result.recommendations.length,
    acceptedRecommendations: result.recommendations.length - drops.length,
    droppedRecommendations: drops.length,
    byReason,
    drops,
  }
}

export function deriveTeamEngineCoverageDiagnostics(input: {
  result: TeamEngineResult
  pack: TeamEnginePack
  boxInput: TeamEngineBoxInput
}): TeamEngineCoverageDiagnostics {
  const rejectedReasons = input.result.rejected.flatMap(failureReasons)
  const assembleOnlyReasons = input.result.assembleOnly.flatMap(assembleOnlyReason)
  const reasons = [...rejectedReasons, ...assembleOnlyReasons]
  const adapter = teamEngineAdapterDiagnostics(input.result, input.pack)
  reasons.push(...adapter.drops.flatMap((drop) => drop.reasons))
  for (const candidate of input.result.recommendations)
    if (!candidate.bangbooId)
      reasons.push({
        code: 'adapter_missing_bangboo',
        detail: '队伍可继续协调实体盘，但邦布适配仍未闭合。',
        candidateId: candidate.candidateId,
        kernelId: candidate.kernelId,
        memberIds: [...candidate.memberIds],
        bangbooId: null,
      })
  const sourceIds = new Set<string>()
  const agentRuleIds = new Set(input.pack.agentRules.map((rule) => rule.agentId))
  const ownedAgentRuleGapIds = [...new Set(input.boxInput.ownedAgentIds)]
    .filter((agentId) => !agentRuleIds.has(agentId))
    .sort((left, right) => left.localeCompare(right))
  for (const kernel of input.pack.kernels) {
    for (const ref of kernel.strengthEvidence.refs) sourceIds.add(ref.sourceId)
  }
  for (const rule of input.pack.agentRules)
    for (const ref of rule.evidence) sourceIds.add(ref.sourceId)
  for (const rule of input.pack.bangbooRules)
    for (const ref of rule.provenance) sourceIds.add(ref.sourceId)
  for (const assembly of input.pack.legacyAssemblies)
    for (const sourceId of assembly.sourceIds) sourceIds.add(sourceId)
  return {
    input: {
      ownedAgentCount: new Set(input.boxInput.ownedAgentIds).size,
      ownedBangbooCount: new Set(
        input.boxInput.bangbooCandidateIds ?? input.boxInput.ownedBangbooIds ?? [],
      ).size,
      preferredAgentCount: new Set(input.boxInput.preferredAgentIds ?? []).size,
      warehouseReadyAgentCount: new Set(input.boxInput.warehouseReadyAgentIds ?? []).size,
    },
    source: {
      gameVersion: input.pack.gameVersion,
      kernelCount: input.pack.kernels.length,
      familyCount: new Set(input.pack.kernels.map((kernel) => kernel.familyId)).size,
      agentRuleCount: input.pack.agentRules.length,
      ownedAgentRuleCount: new Set(input.boxInput.ownedAgentIds).size - ownedAgentRuleGapIds.length,
      ownedAgentRuleGapCount: ownedAgentRuleGapIds.length,
      ownedAgentRuleGapIds,
      bangbooRuleCount: input.pack.bangbooRules.length,
      legacyAssemblyCount: input.pack.legacyAssemblies.length,
      sourceIds: [...sourceIds].sort((left, right) => left.localeCompare(right)),
    },
    stages: {
      recommendations: stageFor(input.result.recommendations, []),
      rejected: stageFor(input.result.rejected, rejectedReasons),
      assembleOnly: stageFor(input.result.assembleOnly, assembleOnlyReasons),
    },
    adapter,
    reasons,
  }
}
