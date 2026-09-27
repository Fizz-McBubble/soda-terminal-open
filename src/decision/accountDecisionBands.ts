import type { AccountRoster, RosterAgent } from '../assault/types'
import { resolvePotentialImage } from '../assault/agentCapabilities'
import type { AccountBuildResult } from '../optimizer/optimizeAccountBuilds'
import { reviewedTeamDiscDirections } from '../gameDataPacks/reviewedTeamDiscConditions'
import { current31TeamEngineD1Pack } from '../teamEngine/current31D1Pack'
import type { scoreCurrent31ExhaustiveAccountCandidates } from './exhaustiveAccountCandidateScoring'
import type { assetConflictBands, CultivationPriorityInput } from './teamDecisionAuthority'

export type RankedFormation = ReturnType<
  typeof scoreCurrent31ExhaustiveAccountCandidates
>['authorityFormations'][number]

export type AccountBands = {
  currentReadiness: CultivationPriorityInput['currentReadiness']
  investmentCost: CultivationPriorityInput['investmentCost']
  assetConflict: CultivationPriorityInput['assetConflict']
  replacementCost: CultivationPriorityInput['replacementCost']
  buildCompletionDistance: CultivationPriorityInput['buildCompletionDistance']
  potentialGaps: CultivationPriorityInput['potentialGaps']
}

export type AssetConflictBand = (typeof assetConflictBands)[number]

export type AccountBandContext = {
  agentById: Map<string, RosterAgent>
  globalById: Map<string, AccountBuildResult['global'][number]>
  independentById: Map<string, AccountBuildResult['independent'][number]>
  potentialDirectionsByMembers: Map<string, (typeof reviewedTeamDiscDirections)[number][]>
}

const skillTargets = Object.freeze({
  basic: 12,
  dodge: 12,
  assist: 12,
  special: 12,
  chain: 12,
  core: 7,
})

export function missingSkillInvestments(agent: RosterAgent | undefined) {
  if (!agent) return Object.keys(skillTargets).length + 1
  return (
    (agent.level >= 60 ? 0 : 1) +
    Object.entries(skillTargets).filter(([skill, target]) => {
      const current = agent.skillLevels[skill as keyof RosterAgent['skillLevels']]
      return current === null || current < target
    }).length
  )
}

export function createAccountBandContext(
  roster: AccountRoster,
  allocation: AccountBuildResult,
): AccountBandContext {
  const potentialDirectionsByMembers = new Map<
    string,
    (typeof reviewedTeamDiscDirections)[number][]
  >()
  for (const direction of reviewedTeamDiscDirections) {
    if (!Object.keys(direction.potentialMinimumByAgentId).length) continue
    for (const key of new Set(direction.exactMemberSets.map((ids) => [...ids].sort().join('|')))) {
      const matches = potentialDirectionsByMembers.get(key) ?? []
      matches.push(direction)
      potentialDirectionsByMembers.set(key, matches)
    }
  }
  return {
    agentById: new Map(roster.agents.map((agent) => [agent.agentId, agent])),
    globalById: new Map(allocation.global.map((loadout) => [loadout.agentId, loadout])),
    independentById: new Map(allocation.independent.map((loadout) => [loadout.agentId, loadout])),
    potentialDirectionsByMembers,
  }
}

export function derivePotentialGaps(
  candidate: RankedFormation,
  context: AccountBandContext,
): AccountBands['potentialGaps'] {
  const memberKey = [...candidate.memberIds].sort().join('|')
  const gapsByAgentId = new Map<string, AccountBands['potentialGaps'][number]>()
  for (const direction of context.potentialDirectionsByMembers.get(memberKey) ?? []) {
    for (const [agentId, minimum] of Object.entries(direction.potentialMinimumByAgentId)) {
      const accountAgent = context.agentById.get(agentId)
      const current = resolvePotentialImage(agentId, accountAgent?.potentialImage) ?? 0
      if (accountAgent?.owned !== true || current >= minimum) continue
      const ruleForAgent = current31TeamEngineD1Pack.agentRules.find(
        (rule) => rule.agentId === agentId,
      )
      if (!ruleForAgent) continue
      const previous = gapsByAgentId.get(agentId)
      if (!previous || minimum > previous.minimum)
        gapsByAgentId.set(agentId, {
          agentId,
          agentName: ruleForAgent.name,
          current,
          minimum,
        })
    }
  }
  return [...gapsByAgentId.values()].sort((left, right) =>
    left.agentId.localeCompare(right.agentId),
  )
}

export function deriveAccountBands(
  candidate: RankedFormation,
  context: AccountBandContext,
): AccountBands {
  const missingAgents = candidate.memberIds.filter(
    (agentId) => !context.agentById.get(agentId)?.owned,
  ).length
  // Current equipment boundary: W-Engines are scheme parameters selected in
  // the target-team query, not authoritative account inventory. An empty
  // legacy W-Engine collection must therefore never block BOX readiness.
  const missingWEngines = 0
  const allocationAssessed = candidate.memberIds.every(
    (agentId) => context.globalById.has(agentId) || context.independentById.has(agentId),
  )
  const missingDiscSlots = allocationAssessed
    ? candidate.memberIds.reduce((total, agentId) => {
        const loadout = context.globalById.get(agentId) ?? context.independentById.get(agentId)
        return total + Math.max(0, 6 - (loadout?.discs.length ?? 0))
      }, 0)
    : null
  const missingSkillInvestmentCount = candidate.memberIds.reduce(
    (total, agentId) => total + missingSkillInvestments(context.agentById.get(agentId)),
    0,
  )
  const potentialGaps = derivePotentialGaps(candidate, context)
  const allGlobal = candidate.memberIds.every((agentId) => context.globalById.has(agentId))
  const allIndependent = candidate.memberIds.every((agentId) =>
    context.independentById.has(agentId),
  )
  const buildCompletionDistance = {
    missingAgents,
    missingWEngines,
    missingBangboos: 0,
    missingDiscSlots,
    missingSkillInvestments: missingSkillInvestmentCount,
    missingPotentialInvestments: potentialGaps.length,
  }
  const currentReadiness: AccountBands['currentReadiness'] =
    missingAgents > 0 || missingWEngines > 0
      ? 'blocked'
      : !allocationAssessed
        ? 'not_evaluated'
        : allGlobal &&
            missingDiscSlots === 0 &&
            missingSkillInvestmentCount === 0 &&
            potentialGaps.length === 0
          ? 'ready'
          : allIndependent &&
              missingDiscSlots !== null &&
              missingDiscSlots <= 6 &&
              missingSkillInvestmentCount <= 3 &&
              potentialGaps.length === 0
            ? 'near_ready'
            : 'development'
  const assetConflict: AccountBands['assetConflict'] = !allocationAssessed
    ? 'not_evaluated'
    : allGlobal
      ? 'none'
      : allIndependent
        ? 'resolvable'
        : 'blocking'
  const investmentCost: AccountBands['investmentCost'] =
    currentReadiness === 'ready'
      ? 'low'
      : currentReadiness === 'near_ready'
        ? 'medium'
        : currentReadiness === 'development'
          ? 'high'
          : 'unknown'
  const replacementCost: AccountBands['replacementCost'] =
    assetConflict === 'not_evaluated'
      ? 'unknown'
      : assetConflict === 'none'
        ? 'low'
        : assetConflict === 'resolvable'
          ? 'medium'
          : 'high'
  return {
    currentReadiness,
    investmentCost,
    assetConflict,
    replacementCost,
    buildCompletionDistance,
    potentialGaps,
  }
}
