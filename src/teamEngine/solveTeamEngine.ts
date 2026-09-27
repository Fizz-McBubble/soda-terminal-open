import type {
  AgentRule,
  CurrentMetaStrengthBand,
  PairSynergyKernel,
  TeamEngineBoxInput,
  TeamEngineCandidate,
  TeamEngineFailure,
  TeamEnginePack,
  TeamEngineResult,
  TeamEngineTraceStep,
} from './contracts'
import { evaluateTeamMethodFormation } from './teamMethodR1'

function boxReadiness(
  memberIds: readonly string[],
  input: TeamEngineBoxInput,
): { classification: 'ready' | 'developing' | 'unbuilt'; detail: string } {
  const cultivation = input.cultivationByAgentId ?? {}
  const warehouseReady = new Set(input.warehouseReadyAgentIds ?? memberIds)
  const states = memberIds.map((agentId) => cultivation[agentId] ?? 'developing')
  if (states.includes('unbuilt') || memberIds.some((agentId) => !warehouseReady.has(agentId))) {
    return {
      classification: 'unbuilt',
      detail: '成员养成或仓库配装未闭合，仅能作为投资方向。',
    }
  }
  if (states.every((state) => state === 'ready')) {
    return { classification: 'ready', detail: '三名成员养成与仓库配装均已就绪。' }
  }
  return { classification: 'developing', detail: '队伍机制闭环，但仍有成员需继续养成。' }
}

function preferredAgentCount(memberIds: readonly string[], input: TeamEngineBoxInput) {
  const preferredAgentIds = new Set(input.preferredAgentIds ?? [])
  return memberIds.filter((agentId) => preferredAgentIds.has(agentId)).length
}

function currentMetaStrengthAuthority(pack: TeamEnginePack) {
  if (pack.currentMetaStrength.contract !== 'soda-current-meta-strength/r1')
    throw new Error('Team Engine 只消费 Current Meta Strength R1。')
  const bandDefinitionByKernelId = new Map(
    pack.currentMetaStrength.kernelBands.map((definition) => [definition.kernelId, definition]),
  )
  const kernelIds = new Set(pack.kernels.map(({ kernelId }) => kernelId))
  if (
    bandDefinitionByKernelId.size !== kernelIds.size ||
    pack.currentMetaStrength.kernelBands.length !== kernelIds.size ||
    [...kernelIds].some((kernelId) => !bandDefinitionByKernelId.has(kernelId))
  )
    throw new Error('Current Meta Strength R1 必须为每个 production kernel 提供唯一 band。')
  for (const definition of pack.currentMetaStrength.kernelBands)
    if (
      !definition.refs.some(
        (ref) => ref.gameVersion === pack.gameVersion && ref.status !== 'limited',
      )
    )
      throw new Error('Current Meta Strength R1 band 必须保留 current comparative evidence。')
  for (const edge of pack.currentMetaStrength.partialOrder) {
    if (!kernelIds.has(edge.higherKernelId) || !kernelIds.has(edge.lowerKernelId))
      throw new Error('Current Meta Strength R1 partial order 只能引用当前 production kernel。')
    if (
      bandDefinitionByKernelId.get(edge.higherKernelId)?.band !==
      bandDefinitionByKernelId.get(edge.lowerKernelId)?.band
    )
      throw new Error('Current Meta Strength R1 partial order 只能细化同 band 关系。')
    if (!edge.refs.some((ref) => ref.gameVersion === pack.gameVersion && ref.status !== 'limited'))
      throw new Error(
        'Current Meta Strength R1 partial order 必须保留 current comparative evidence。',
      )
  }
  return { bandDefinitionByKernelId, edges: pack.currentMetaStrength.partialOrder }
}

function partialOrderPrecedes(
  higherKernelId: string,
  lowerKernelId: string,
  edges: TeamEnginePack['currentMetaStrength']['partialOrder'],
) {
  const pending = [higherKernelId]
  const visited = new Set<string>()
  while (pending.length) {
    const current = pending.pop()!
    if (current === lowerKernelId) return true
    if (visited.has(current)) continue
    visited.add(current)
    for (const edge of edges) if (edge.higherKernelId === current) pending.push(edge.lowerKernelId)
  }
  return false
}

function rejectedCandidate(
  kernel: PairSynergyKernel,
  memberIds: [string, string, string],
  failures: TeamEngineFailure[],
  trace: TeamEngineTraceStep[],
  input: TeamEngineBoxInput,
  metaBand: CurrentMetaStrengthBand,
  metaSourceIds: readonly string[],
): TeamEngineCandidate {
  return {
    candidateId: `${kernel.kernelId}:${memberIds.join('+')}`,
    kernelId: kernel.kernelId,
    familyId: kernel.familyId,
    label: kernel.label,
    memberIds,
    bangbooId: null,
    bangbooSelection: {
      status: 'not_evaluated',
      reason: '队伍机制在邦布选择前已被阻断。',
    },
    scenarioTags: [...kernel.scenarioTags],
    classification: 'cannot_close',
    strengthTier: kernel.strengthEvidence.tier,
    metaBand,
    score: 0,
    preferredAgentCount: preferredAgentCount(memberIds, input),
    claim: failures.map((failure) => failure.detail).join('；'),
    failures,
    trace,
    sourceIds: [
      ...new Set([...kernel.strengthEvidence.refs.map((ref) => ref.sourceId), ...metaSourceIds]),
    ],
  }
}

function evaluateTeam(
  kernel: PairSynergyKernel,
  agents: [AgentRule, AgentRule, AgentRule],
  pack: TeamEnginePack,
  input: TeamEngineBoxInput,
  metaBand: CurrentMetaStrengthBand,
  metaSourceIds: readonly string[],
): TeamEngineCandidate {
  const memberIds = agents.map((agent) => agent.agentId) as [string, string, string]
  const method = evaluateTeamMethodFormation({
    kernel,
    agents,
    bangbooRules: pack.bangbooRules,
    bangbooCandidateIds: new Set(input.bangbooCandidateIds ?? input.ownedBangbooIds ?? []),
    bangbooStarsById: input.bangbooStarsById,
    fieldTimeBudget: input.fieldTimeBudget ?? 1.35,
    agentStateById: input.agentStateById,
  })
  if (method.status === 'blocked')
    return rejectedCandidate(
      kernel,
      memberIds,
      method.failures,
      method.trace,
      input,
      metaBand,
      metaSourceIds,
    )

  const readiness = boxReadiness(memberIds, input)
  const trace = [
    ...method.trace,
    {
      stage: 'box_correction',
      status: readiness.classification === 'ready' ? 'pass' : 'limited',
      detail: readiness.detail,
    } satisfies TeamEngineTraceStep,
  ]
  const abilityPenalty = method.allowedInactiveAdditionalAbilityAgentIds.length * 5
  const classification =
    readiness.classification === 'unbuilt'
      ? 'transitional'
      : metaBand !== 'viable' && readiness.classification === 'ready'
        ? 'strong_recommendation'
        : 'stable_usable'
  return {
    candidateId: `${kernel.kernelId}:${memberIds.join('+')}`,
    kernelId: kernel.kernelId,
    familyId: kernel.familyId,
    label: kernel.label,
    memberIds,
    bangbooId: method.bangboo?.bangbooId ?? null,
    bangbooStar: method.bangbooStar,
    bangbooSelection: method.bangbooSelection,
    bangbooTeamObjective: method.bangbooTeamObjective,
    scenarioTags: [...kernel.scenarioTags],
    classification,
    strengthTier: kernel.strengthEvidence.tier,
    metaBand,
    score: kernel.strengthEvidence.score - abilityPenalty,
    preferredAgentCount: preferredAgentCount(memberIds, input),
    claim: `${kernel.strengthEvidence.claim}${method.allowedInactiveAdditionalAbilityAgentIds.length ? ` 已显式计入 ${method.allowedInactiveAdditionalAbilityAgentIds.join('、')} 追加能力未激活的损失。` : ''} ${readiness.detail}`,
    failures: [],
    trace,
    sourceIds: [
      ...new Set([
        ...kernel.strengthEvidence.refs.map((ref) => ref.sourceId),
        ...agents.flatMap((agent) => agent.evidence.map((ref) => ref.sourceId)),
        ...(method.bangboo
          ? [
              ...method.bangboo.activation.evidence,
              ...method.bangboo.suitability.evidence,
              ...method.bangboo.provenance,
            ].map((ref) => ref.sourceId)
          : []),
        ...metaSourceIds,
      ]),
    ],
  }
}

export function solveTeamEngine(pack: TeamEnginePack, input: TeamEngineBoxInput): TeamEngineResult {
  const metaStrength = currentMetaStrengthAuthority(pack)
  const rulesById = new Map(pack.agentRules.map((rule) => [rule.agentId, rule]))
  const ownedAgentIds = new Set(input.ownedAgentIds)
  const recommendations: TeamEngineCandidate[] = []
  const rejected: TeamEngineCandidate[] = []

  for (const kernel of pack.kernels) {
    const metaDefinition = metaStrength.bandDefinitionByKernelId.get(kernel.kernelId)!
    const metaBand = metaDefinition.band
    const metaSourceIds = [
      ...metaDefinition.refs.map((ref) => ref.sourceId),
      ...metaStrength.edges
        .filter(
          (edge) =>
            edge.higherKernelId === kernel.kernelId || edge.lowerKernelId === kernel.kernelId,
        )
        .flatMap((edge) => edge.refs.map((ref) => ref.sourceId)),
    ]
    const missingCore = kernel.coreAgentIds.filter((agentId) => !ownedAgentIds.has(agentId))
    if (missingCore.length) {
      rejected.push(
        rejectedCandidate(
          kernel,
          [...kernel.coreAgentIds, kernel.eligibleThirdAgentIds[0] ?? 'missing-third'] as [
            string,
            string,
            string,
          ],
          [{ code: 'missing_core_agent', detail: `缺少双人核心成员：${missingCore.join('、')}。` }],
          [
            {
              stage: 'core',
              status: 'fail',
              detail: `缺少双人核心成员：${missingCore.join('、')}。`,
            },
          ],
          input,
          metaBand,
          metaSourceIds,
        ),
      )
      continue
    }
    const thirds = kernel.eligibleThirdAgentIds.filter((agentId) => ownedAgentIds.has(agentId))
    if (!thirds.length) {
      rejected.push(
        rejectedCandidate(
          kernel,
          [...kernel.coreAgentIds, kernel.eligibleThirdAgentIds[0] ?? 'missing-third'] as [
            string,
            string,
            string,
          ],
          [{ code: 'no_eligible_third', detail: '已识别双人核心，但 BOX 中没有已验证的第三人。' }],
          [
            {
              stage: 'core',
              status: 'pass',
              detail: `已识别核心：${kernel.coreAgentIds.join(' + ')}。`,
            },
            { stage: 'pair_synergy', status: 'fail', detail: '缺少能补齐闭环的第三人。' },
          ],
          input,
          metaBand,
          metaSourceIds,
        ),
      )
      continue
    }
    for (const thirdId of thirds) {
      const agents = [...kernel.coreAgentIds, thirdId].map((agentId) => rulesById.get(agentId))
      if (agents.some((agent) => !agent)) continue
      const candidate = evaluateTeam(
        kernel,
        agents as [AgentRule, AgentRule, AgentRule],
        pack,
        input,
        metaBand,
        metaSourceIds,
      )
      if (candidate.classification === 'cannot_close') rejected.push(candidate)
      else recommendations.push(candidate)
    }
  }

  const assembleOnly = pack.legacyAssemblies
    .filter((assembly) => assembly.memberIds.every((agentId) => ownedAgentIds.has(agentId)))
    .map<TeamEngineCandidate>((assembly) => ({
      candidateId: `legacy:${assembly.assemblyId}`,
      kernelId: null,
      familyId: null,
      label: assembly.label,
      memberIds: assembly.memberIds,
      bangbooId: assembly.bangbooId,
      bangbooStar: assembly.bangbooId ? 1 : null,
      bangbooSelection: assembly.bangbooId
        ? { status: 'selected', bangbooId: assembly.bangbooId }
        : { status: 'no_authoritative_recommendation', bangbooIds: [] },
      scenarioTags: [],
      classification: 'assemble_only_not_recommended',
      strengthTier: null,
      metaBand: null,
      score: 0,
      preferredAgentCount: preferredAgentCount(assembly.memberIds, input),
      claim: assembly.reason,
      failures: [],
      trace: [
        { stage: 'core', status: 'limited', detail: '仅确认账户拥有三名成员。' },
        {
          stage: 'pair_synergy',
          status: 'limited',
          detail: '缺少当前版本双人核心与队伍闭环证据。',
        },
      ],
      sourceIds: assembly.sourceIds,
    }))

  const metaBandRank = { apex: 3, meta: 2, viable: 1 } as const
  recommendations.sort((left, right) => {
    const bandDelta = metaBandRank[right.metaBand!] - metaBandRank[left.metaBand!]
    if (bandDelta) return bandDelta
    const leftPrecedes = partialOrderPrecedes(left.kernelId!, right.kernelId!, metaStrength.edges)
    const rightPrecedes = partialOrderPrecedes(right.kernelId!, left.kernelId!, metaStrength.edges)
    if (leftPrecedes !== rightPrecedes) return leftPrecedes ? -1 : 1
    return (
      right.preferredAgentCount - left.preferredAgentCount ||
      left.candidateId.localeCompare(right.candidateId)
    )
  })
  rejected.sort((left, right) => left.candidateId.localeCompare(right.candidateId))
  assembleOnly.sort((left, right) => left.candidateId.localeCompare(right.candidateId))
  return {
    contract: 'soda-team-engine-result/v1',
    gameVersion: pack.gameVersion,
    recommendations,
    rejected,
    assembleOnly,
    boundaries: [
      '本引擎只输出版本化 Candidate 推荐，不输出 Formal、DPS、最高或数学最优。',
      '旧模板只能证明可组成，不进入推荐排序。',
      'Current Meta Strength R1 只使用 apex / meta / viable 与具名 partial order，不输出精确战力。',
      '养成与仓库就绪度只决定 executable、direction 与缺口，不改变 Meta band。',
      '培养优先角色只在同一 Meta band 且没有 evidence-backed partial order 时形成 soft preference。',
      '兼容 score 不参与跨 family 排序，也不表示战力、DPS 或精确名次。',
      '驱动盘与多队实体资产分配仍由既有仓库求解器负责。',
    ],
  }
}
