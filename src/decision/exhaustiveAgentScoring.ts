import type { AccountRoster } from '../assault/types'
import {
  compileNormalizedAgentEventSchedule,
  currentNormalizedPlanningBaseline,
} from '../calculation/currentNormalizedPlanningBaseline'
import type { PlanningEffectRuntimeMember } from '../calculation/currentPlanningEffectRuntime'
import type { PlanningEventUsage } from '../calculation/planningCalculationContextCompiler'
import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import type { DriveDisc } from '../domain/schemas'
import { getProjectedBuildKnowledgeProfile } from '../gameDataPacks/agentProfile'
import { resolveBuildIntentWEngineIds } from '../gameDataPacks/buildIntentWEngineIdentity'
import { getCurrentWEngineStaticData } from '../gameDataPacks/currentWEngineStaticCatalog'
import { stableContentHash } from '../gameDataPacks/types'
import type { AccountBuildResult } from '../optimizer/optimizeAccountBuilds'
import {
  accountSkillLevel,
  projectNormalizedAccountFinalStats,
} from './normalizedPlanningCandidateEvaluator'

export type AgentAlternative = {
  agentId: string
  wEngineCopyId: string
  wEngineId: string
  finalStatsHash: string
  totalDamage: number
  runtimeMember: PlanningEffectRuntimeMember
  eventUsages: PlanningEventUsage[]
}

export function compileAgentAlternatives(input: {
  roster: AccountRoster
  allocation: AccountBuildResult
  discs: readonly DriveDisc[]
}) {
  const discById = new Map(input.discs.map((disc) => [disc.id, disc]))
  return new Map(
    input.roster.agents
      .filter((agent) => agent.owned)
      .map((agent) => {
        // Exhaustive numeric diagnostics must not inherit the Team Engine ordered global
        // allocation used for downstream execution. Independent projections are deterministic
        // per agent; they may reuse discs across members, so this result is explicitly not a
        // candidate-specific Warehouse Fit or an account-bound optimum.
        const loadout = input.allocation.independent.find((item) => item.agentId === agent.agentId)
        const discs =
          loadout?.discs
            .map((item) => discById.get(item.disc.id))
            .filter((disc): disc is DriveDisc => Boolean(disc)) ?? []
        const skillLevels = Object.fromEntries(
          ['basic', 'dodge', 'assist', 'special', 'chain', 'core'].map((skill) => [
            skill,
            accountSkillLevel(agent, skill),
          ]),
        )
        const schedule = compileNormalizedAgentEventSchedule({
          agentId: agent.agentId,
          skillLevels,
        })
        const intendedIds = resolveBuildIntentWEngineIds(
          agent.agentId,
          getProjectedBuildKnowledgeProfile(agent.agentId).recommendation?.wEngines ?? [],
        )
        const intendedRank = new Map(intendedIds.map((engineId, index) => [engineId, index]))
        const agentSpecialty = getCurrentAgentEventContract(agent.agentId)?.identity.specialty
        const specialty = agentSpecialty === 'attack' ? 'damage' : agentSpecialty
        if (discs.length !== 6 || schedule.status === 'unsupported')
          return [agent.agentId, [] as AgentAlternative[]] as const
        const alternatives = (input.roster.wEngines ?? [])
          .flatMap((copy) => {
            const engine = getCurrentWEngineStaticData(copy.engineId)
            if (!engine) return []
            const intended = intendedRank.has(copy.engineId)
            if (!intended && specialty && engine.specialty !== specialty) return []
            const stats = projectNormalizedAccountFinalStats({
              agent,
              engineId: copy.engineId,
              discs,
            })
            if (!stats) return []
            const defenseMultiplier = 160 / (160 + currentNormalizedPlanningBaseline.enemy.defense)
            const totalDamage =
              stats.attack *
              schedule.normalizedDamageMultiplier *
              (1 + stats.critRate * stats.critDamage) *
              (1 + stats.damageBonus) *
              defenseMultiplier *
              (1 - currentNormalizedPlanningBaseline.enemy.resistance)
            return [
              {
                agentId: agent.agentId,
                wEngineCopyId: copy.copyId,
                wEngineId: copy.engineId,
                finalStatsHash: stableContentHash({
                  agentId: agent.agentId,
                  copy,
                  discs,
                  stats,
                  skillLevels,
                }),
                totalDamage,
                runtimeMember: {
                  agentId: agent.agentId,
                  mindscape: agent.mindscape,
                  coreLevel: Math.min(7, accountSkillLevel(agent, 'core')),
                  skillLevels,
                  initialStats: stats.initialStats,
                  finalStats: stats.finalStats,
                },
                eventUsages: schedule.eventUsages,
              },
            ]
          })
          .sort((left, right) => {
            return (
              right.totalDamage - left.totalDamage ||
              (intendedRank.get(left.wEngineId) ?? Number.MAX_SAFE_INTEGER) -
                (intendedRank.get(right.wEngineId) ?? Number.MAX_SAFE_INTEGER) ||
              left.wEngineCopyId.localeCompare(right.wEngineCopyId)
            )
          })
        // With three members, at most two higher-ranked physical copies can be
        // occupied by teammates, so the first three alternatives are sufficient.
        return [agent.agentId, alternatives.slice(0, 3)] as const
      }),
  )
}

export function bestDistinctAssignment(
  memberIds: readonly string[],
  alternatives: Map<string, AgentAlternative[]>,
) {
  const [first, second, third] = memberIds.map((agentId) => alternatives.get(agentId) ?? [])
  let best: AgentAlternative[] | null = null
  for (const left of first ?? [])
    for (const middle of second ?? []) {
      if (middle.wEngineCopyId === left.wEngineCopyId) continue
      for (const right of third ?? []) {
        if (
          right.wEngineCopyId === left.wEngineCopyId ||
          right.wEngineCopyId === middle.wEngineCopyId
        )
          continue
        const candidate = [left, middle, right]
        if (
          !best ||
          candidate.reduce((sum, item) => sum + item.totalDamage, 0) >
            best.reduce((sum, item) => sum + item.totalDamage, 0)
        )
          best = candidate
      }
    }
  return best
}
