import type { TargetTeamPlanningContextInput } from './targetTeamPlanningContextInput'
import { resolvePotentialImage, supportsPotentialImage } from '../assault/agentCapabilities'
import { compileNormalizedAgentEventSchedule } from '../calculation/currentNormalizedPlanningBaseline'
import type { PlanningEffectRuntimeMember } from '../calculation/currentPlanningEffectRuntime'
import type {
  PlanningContextMemberAsset,
  PlanningEventUsage,
} from '../calculation/planningCalculationContextCompiler'
import { stableContentHash } from '../gameDataPacks/types'
import {
  accountSkillLevel,
  projectNormalizedAccountFinalStatsDetailed,
} from './normalizedPlanningCandidateEvaluator'
import { hasCompleteAgentSkillLevels } from '../accounts/agentProgressionRules'

/** Compile account-owned assets and event members without evaluating team effects. */
export function compileTargetTeamPlanningMembers(input: TargetTeamPlanningContextInput) {
  const blockers: string[] = []
  const discById = new Map(input.warehouse.discs.map((disc) => [disc.id, disc]))
  const parameterByAgentId = new Map(
    input.parameters.wEngines.map((parameter) => [parameter.agentId, parameter]),
  )
  const eventUsages: PlanningEventUsage[] = []
  const assets: PlanningContextMemberAsset[] = []
  const effectRuntimeMembers: PlanningEffectRuntimeMember[] = []

  for (const agentId of input.fit.memberIds) {
    const agent = input.warehouse.roster.agents.find(
      (item) => item.agentId === agentId && item.owned,
    )
    const parameter = parameterByAgentId.get(agentId)
    const loadout = input.fit.loadouts.find((item) => item.agentId === agentId)
    const discs =
      loadout?.discIds
        .map((discId) => discById.get(discId))
        .filter((disc): disc is NonNullable<typeof disc> => Boolean(disc)) ?? []
    if (!agent) blockers.push(`目标成员不在当前账号已拥有代理人中：${agentId}`)
    if (!parameter) blockers.push(`目标成员缺少方案音擎参数：${agentId}`)
    if (discs.length !== 6) blockers.push(`目标成员缺少六张实体盘：${agentId}`)
    if (!agent || !parameter || discs.length !== 6) continue
    const skillLevels = Object.fromEntries(
      ['basic', 'dodge', 'assist', 'special', 'chain', 'core'].map((skill) => [
        skill,
        accountSkillLevel(agent, skill),
      ]),
    )
    if (!hasCompleteAgentSkillLevels(skillLevels)) {
      blockers.push(`${agentId}：技能等级未完整观测，不能用默认值补算。`)
      continue
    }
    const schedule = compileNormalizedAgentEventSchedule({ agentId, skillLevels })
    const selectedPotential = input.parameters.potentialByAgentId?.[agentId] ?? agent.potentialImage
    if (
      input.parameters.potentialByAgentId?.[agentId] !== undefined &&
      (!supportsPotentialImage(agentId) ||
        !Number.isInteger(selectedPotential) ||
        Number(selectedPotential) < 0 ||
        Number(selectedPotential) > 6)
    )
      blockers.push(`${agentId} 的显式潜能参数无效。`)
    const projection = projectNormalizedAccountFinalStatsDetailed({
      agent: {
        ...agent,
        potentialImage: selectedPotential,
        wEngineDetails: {
          id: parameter.engineId,
          name: parameter.engineId,
          level: parameter.level ?? 60,
          ascension: parameter.ascension,
          refinement: parameter.refinement,
        },
      },
      engineId: parameter.engineId,
      discs,
      ...(input.statProbesByAgentId?.[agentId]
        ? { statProbe: input.statProbesByAgentId[agentId] }
        : {}),
    })
    const stats = projection.status === 'supported' ? projection.stats : null
    if (schedule.status === 'unsupported') blockers.push(...schedule.blockers)
    if (projection.status === 'unsupported')
      blockers.push(...projection.reasons.map((reason) => `${agentId}：${reason}`))
    if (schedule.status === 'unsupported' || !stats) continue
    eventUsages.push(...schedule.eventUsages)
    const finalStatsHash = stableContentHash({ agentId, parameter, discs, stats, skillLevels })
    assets.push({
      agentId,
      level: agent.level,
      mindscape: agent.mindscape,
      potential: resolvePotentialImage(agentId, selectedPotential) ?? null,
      skillLevels,
      wEngine: {
        copyId: `scheme:${agentId}:${parameter.engineId}`,
        engineId: parameter.engineId,
        level: parameter.level ?? 60,
        refinement: parameter.refinement,
      },
      discs: discs.map((disc) => ({
        id: disc.id,
        slot: disc.slot,
        setId: disc.setId,
        level: disc.level,
        statsHash: stableContentHash(disc),
      })),
      finalStatsHash,
      evidenceRefs: [
        `account:${input.warehouse.accountId ?? 'legacy-local'}:roster`,
        `account:${input.warehouse.accountId ?? 'legacy-local'}:warehouse`,
        input.modifierProjection.fingerprint,
      ],
    })
    effectRuntimeMembers.push({
      agentId,
      level: agent.level,
      mindscape: agent.mindscape,
      potential: resolvePotentialImage(agentId, selectedPotential) ?? null,
      coreLevel: skillLevels.core,
      skillLevels,
      statBasis32: stats.statBasis32,
      initialStats: stats.initialStats,
      finalStats: stats.finalStats,
    })
  }
  return { blockers, eventUsages, assets, effectRuntimeMembers }
}
