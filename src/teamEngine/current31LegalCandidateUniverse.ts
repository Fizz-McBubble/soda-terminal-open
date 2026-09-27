import { currentAssetProjection } from '../gameDataPacks/currentAssetProjection'
import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import { currentBangbooMechanicContractIds } from '../calculation/currentBangbooMechanicContracts'

const releasedAgentIds = currentAssetProjection.agents
  .filter((agent) => agent.releaseState === 'released' && agent.accountOwnable)
  .map((agent) => agent.stableId)
  .sort((left, right) => left.localeCompare(right))

const releasedBangbooIds = currentAssetProjection.bangboos
  .filter((bangboo) => bangboo.releaseState === 'released' && bangboo.accountOwnable)
  .map((bangboo) => bangboo.stableId)
  .sort((left, right) => left.localeCompare(right))

const bangbooContractIds = new Set(currentBangbooMechanicContractIds)

export type LegalAgentFormation = readonly [string, string, string]

function enumerateAgentFormations(agentIds: readonly string[]) {
  const formations: LegalAgentFormation[] = []
  for (let first = 0; first < agentIds.length - 2; first += 1)
    for (let second = first + 1; second < agentIds.length - 1; second += 1)
      for (let third = second + 1; third < agentIds.length; third += 1)
        formations.push([agentIds[first]!, agentIds[second]!, agentIds[third]!])
  return formations
}

export const current31LegalAgentFormations = Object.freeze(
  enumerateAgentFormations(releasedAgentIds),
)

const uncoveredAgentIds = releasedAgentIds.filter(
  (agentId) => getCurrentAgentEventContract(agentId) === null,
)
const uncoveredBangbooIds = releasedBangbooIds.filter(
  (bangbooId) => !bangbooContractIds.has(bangbooId),
)

export const current31LegalCandidateUniverse = Object.freeze({
  contract: 'soda-team-legal-candidate-universe/v1',
  gameVersion: '3.1-phase-ii',
  legality: {
    rule: 'three_distinct_released_account_ownable_agents_plus_optional_released_bangboo',
    agentCount: releasedAgentIds.length,
    bangbooCount: releasedBangbooIds.length,
    agentFormationCount: current31LegalAgentFormations.length,
    optionalBangbooChoiceCount: releasedBangbooIds.length + 1,
    formationBangbooCandidateCount:
      current31LegalAgentFormations.length * (releasedBangbooIds.length + 1),
  },
  numericOperandCoverage: {
    agentEventContractsReady: releasedAgentIds.length - uncoveredAgentIds.length,
    agentEventContractsRequired: releasedAgentIds.length,
    bangbooContractsReady: releasedBangbooIds.length - uncoveredBangbooIds.length,
    bangbooContractsRequired: releasedBangbooIds.length,
    coveredFormationCount: uncoveredAgentIds.length ? 0 : current31LegalAgentFormations.length,
    coveredFormationBangbooCandidateCount:
      uncoveredAgentIds.length || uncoveredBangbooIds.length
        ? 0
        : current31LegalAgentFormations.length * (releasedBangbooIds.length + 1),
    uncoveredAgentIds,
    uncoveredBangbooIds,
  },
  decisionScoreCoverage: {
    status: 'pending_agent_rule_and_team_context',
    boundary:
      '事件数值 operand 全量存在不等于队伍 DPS：追加能力、队伍效果、循环与账户最终属性仍必须进入同一 CalculationContext。',
  },
})

export function auditLegalFormationNumericOperands(
  memberIds: readonly string[],
  bangbooId: string | null,
) {
  const blockers: string[] = []
  if (memberIds.length !== 3 || new Set(memberIds).size !== 3)
    blockers.push('合法编队必须恰好包含三名不重复代理人。')
  memberIds.forEach((agentId) => {
    if (!releasedAgentIds.includes(agentId))
      blockers.push(`代理人不在 current released 范围：${agentId}`)
    else if (!getCurrentAgentEventContract(agentId))
      blockers.push(`代理人缺少数值事件合同：${agentId}`)
  })
  if (bangbooId !== null) {
    if (!releasedBangbooIds.includes(bangbooId))
      blockers.push(`邦布不在 current released 范围：${bangbooId}`)
    else if (!bangbooContractIds.has(bangbooId)) blockers.push(`邦布缺少机制合同：${bangbooId}`)
  }
  return blockers.length
    ? { status: 'unsupported' as const, blockers: [...new Set(blockers)] }
    : { status: 'supported' as const }
}
