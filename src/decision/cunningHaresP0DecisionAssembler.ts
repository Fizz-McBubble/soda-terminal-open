import type { AccountRoster } from '../assault/types'
import type { DriveDisc } from '../domain/schemas'
import { stableContentHash } from '../gameDataPacks/types'
import { resolveDriveDiscMainStatValue } from '../calculation/outOfCombatPanel'
import {
  cunningHaresP0BaselineId,
  evaluateCunningHaresP0,
} from '../calculation/planningCunningHaresP0'
import type { TeamEngineCandidate } from '../teamEngine/contracts'
import type { TeamExecution } from './teamExecutionProjection'

const target = ['agent-billy', 'agent-nicole', 'agent-anby'] as const
const facts = {
  'agent-billy': {
    engineId: 'wengine-13108',
    base: 113,
    growth: 6.7335,
    promotion: 202,
    multiplierBase: 0.076,
    multiplierGrowth: 0.007,
    eventId: '1081003',
  },
  'agent-nicole': {
    engineId: 'wengine-13103',
    base: 93,
    growth: 5.3249,
    promotion: 167,
    multiplierBase: 0.389,
    multiplierGrowth: 0.036,
    eventId: '1031001',
  },
  'agent-anby': {
    engineId: 'wengine-13101',
    base: 95,
    growth: 5.423,
    promotion: 169,
    multiplierBase: 0.312,
    multiplierGrowth: 0.029,
    eventId: '1011001',
  },
} as const

export function resolveCunningHaresP0Multiplier(
  agentId: keyof typeof facts,
  basicSkillLevel: number,
) {
  const fact = facts[agentId]
  return fact.multiplierBase + fact.multiplierGrowth * (basicSkillLevel - 1)
}

function panel(agentId: keyof typeof facts, discs: DriveDisc[]) {
  const fact = facts[agentId]
  let atkPct = agentId === 'agent-billy' ? 0.25 : 0
  let atkFlat = 0
  let critRate = 0.05
  let critDamage = 0.5
  let damageBonus = 0
  const setCounts = new Map<string, number>()
  for (const disc of discs) {
    setCounts.set(disc.setId, (setCounts.get(disc.setId) ?? 0) + 1)
    const main = resolveDriveDiscMainStatValue(disc)
    for (const stat of [
      ...disc.subStats,
      ...(main ? [{ stat: main.stat, value: main.value }] : []),
    ]) {
      if (stat.stat === 'atk_percent') atkPct += stat.value / 100
      if (stat.stat === 'atk_flat') atkFlat += stat.value
      if (stat.stat === 'crit_rate') critRate += stat.value / 100
      if (stat.stat === 'crit_dmg') critDamage += stat.value / 100
      if (
        (agentId === 'agent-billy' && stat.stat === 'physical_dmg') ||
        (agentId === 'agent-nicole' && stat.stat === 'ether_dmg') ||
        (agentId === 'agent-anby' && stat.stat === 'electric_dmg')
      )
        damageBonus += stat.value / 100
    }
  }
  // The only adopted two-piece fields used by this P0 slice; all active four-piece and W-Engine passives stay inactive.
  if ((setCounts.get('set-woodpecker-electro') ?? 0) >= 2) critRate += 0.08
  if (agentId === 'agent-billy' && (setCounts.get('set-fanged-metal') ?? 0) >= 2) damageBonus += 0.1
  return {
    attack:
      (fact.base + fact.growth * 59 + fact.promotion + 42 * (1 + 9.409 + 4.461)) * (1 + atkPct) +
      atkFlat,
    critRate,
    critDamage,
    damageBonus,
  }
}

/** Converts only confirmed Decision Run assets to the frozen P0 static model. */
export function assembleCunningHaresP0DecisionEvaluation(input: {
  accountId: string
  rosterHash: string
  warehouseHash: string
  planningHash: string
  capturedAt: string
  candidate: TeamEngineCandidate
  execution: TeamExecution | undefined
  roster: AccountRoster
  discs: readonly DriveDisc[]
}) {
  const { candidate, execution } = input
  if (
    candidate.memberIds.join('|') !== target.join('|') ||
    candidate.bangbooId !== 'bangboo-amillion'
  )
    return null
  if (!execution || execution.status !== 'ready') return null
  const byDisc = new Map(input.discs.map((disc) => [disc.id, disc]))
  const members = target.map((agentId) => {
    const executionMember = execution.members.find((member) => member.agentId === agentId)
    const agent = input.roster.agents.find((item) => item.agentId === agentId)
    const selected = executionMember?.suggested.wEngine
    const copy = selected
      ? input.roster.wEngines?.find((item) => item.copyId === selected.copyId)
      : null
    const agentDiscs =
      executionMember?.suggested.discIds
        .map((id) => byDisc.get(id))
        .filter((disc): disc is DriveDisc => Boolean(disc)) ?? []
    const fact = facts[agentId]
    if (
      !agent ||
      agent.level !== 60 ||
      !agent.skillLevels.basic ||
      agentDiscs.length !== 6 ||
      selected?.fact !== 'confirmed' ||
      !copy ||
      copy.engineId !== fact.engineId ||
      copy.level !== 60
    )
      return null
    const stats = panel(agentId, agentDiscs)
    const basicSkillLevel = agent.skillLevels.basic
    const multiplier = resolveCunningHaresP0Multiplier(agentId, basicSkillLevel)
    return {
      agentId,
      level: 60,
      ...stats,
      multiplier,
      eventId: fact.eventId,
      eventCount: 1,
      finalStatsHash: stableContentHash({
        agentId,
        copy,
        discs: agentDiscs,
        stats,
        basicSkillLevel,
        eventId: fact.eventId,
        multiplier,
        inactive: ['wengine-passive', 'four-piece'],
      }),
      wEngineCopyId: copy.copyId,
      discIds: agentDiscs.map((disc) => disc.id) as [
        string,
        string,
        string,
        string,
        string,
        string,
      ],
    }
  })
  const completedMembers = members.filter(
    (member): member is NonNullable<typeof member> => member !== null,
  )
  if (completedMembers.length !== target.length) return null
  const bangboo = input.roster.bangboos.find((item) => item.bangbooId === 'bangboo-amillion')
  if (!bangboo || !bangboo.owned || bangboo.level !== 60 || bangboo.stars !== 1) return null
  const output = evaluateCunningHaresP0({
    account: {
      accountId: input.accountId,
      rosterHash: input.rosterHash,
      warehouseHash: input.warehouseHash,
      planningHash: input.planningHash,
      capturedAt: input.capturedAt,
    },
    baseline: {
      schemaVersion: 'planning-baseline-v1',
      baselineId: cunningHaresP0BaselineId,
      gameVersion: '3.1',
      phaseId: 'static-comparison',
      enemy: {
        id: 'p0-enemy-lv70',
        defense: 700,
        resistance: 0.2,
        stunMultiplier: 1,
        vulnerability: 0,
      },
      rounding: 'nearest-0.01',
      formulaHash: 'soda-direct-damage-core-r25-v1',
      sourcePackHash: 'hakushin-27140bb6',
      declaredDurationSeconds: 30,
    },
    members: completedMembers,
    bangboo: {
      level: 60,
      ascensionLevelCap: 60,
      stars: 1,
      activeSkillLevel: 10,
      chainSkillLevel: 10,
      activeUseCount: 1,
      chainUseCount: 1,
      enemyCount: 1,
      cunningHaresMemberCount: 3,
    },
  })
  return output.status === 'supported'
    ? {
        candidateId: candidate.candidateId,
        planning: output.planning,
        assetBinding: output.assetBinding,
        projection: output.projection,
        execution: output.execution,
      }
    : null
}
