import type { BuildProfile, DriveDisc } from '../domain/schemas'
import { contentHash } from '../evaluation/contentHash'
import { assaultDataVersion, assaultModelVersion, teamTemplates } from './catalog'
import type {
  AccountRoster,
  AgentLoadout,
  AssignedDisc,
  DamageBreakdown,
  OptimizationScenario,
  ScenarioResult,
} from './types'

export type AgentDiscProfile = Pick<
  BuildProfile,
  'agentId' | 'version' | 'statWeights' | 'mainStatFit' | 'setFit'
> & {
  confidence: 'high' | 'medium' | 'low'
  gameVersion: string
  scenario?: string
  setPlans?: Array<{
    pattern: '4+2' | '2+2+2'
    primarySets: string[]
    secondarySets: string[]
  }>
  mainStats?: Record<string, string[]>
  combatMode?: 'general' | 'shiyu' | 'deadly_assault'
  environmentId?: string
  environmentHash?: string
  environmentStatus?: 'formal' | 'review' | 'expired'
  teamContextId?: 'profile_default' | 'burst_window' | 'anomaly_chain'
  teamAssumptions?: string[]
  bangbooIds?: string[]
  contextRationale?: string[]
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits
  return Math.round((value + Number.EPSILON) * factor) / factor
}

export function scoreDiscForProfile(disc: DriveDisc, profile: AgentDiscProfile): AssignedDisc {
  const effective = disc.subStats.filter((stat) => (profile.statWeights[stat.stat] ?? 0) > 0)
  const subScore = effective.reduce(
    (sum, stat) => sum + (profile.statWeights[stat.stat] ?? 0) * (stat.upgrades + 1) * 10,
    0,
  )
  const mainFit =
    profile.mainStatFit[String(disc.slot)]?.[disc.mainStat] ?? (disc.slot <= 3 ? 1 : 0)
  const setFit = profile.setFit[disc.setId] ?? 0
  return {
    disc,
    score: round(mainFit * 20 + subScore + setFit * 8),
    effectiveHits: effective.reduce((sum, stat) => sum + stat.upgrades + 1, 0),
  }
}

function bestUniqueSlotAssignment(
  slotDiscs: DriveDisc[],
  agentIds: string[],
  profiles: Map<string, AgentDiscProfile>,
  candidateLimit: number,
) {
  const candidates = agentIds.map((agentId) =>
    slotDiscs
      .map((disc) => scoreDiscForProfile(disc, profiles.get(agentId)!))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.disc.id.localeCompare(b.disc.id))
      .slice(0, candidateLimit),
  )
  const byDisc = new Map<string, Map<number, AssignedDisc>>()
  candidates.forEach((items, agentIndex) => {
    for (const item of items) {
      const scores = byDisc.get(item.disc.id) ?? new Map<number, AssignedDisc>()
      scores.set(agentIndex, item)
      byDisc.set(item.disc.id, scores)
    }
  })
  type State = { score: number; assignments: AssignedDisc[]; key: string }
  let states = new Map<number, State>([[0, { score: 0, assignments: [], key: '' }]])
  for (const [, scores] of [...byDisc].sort(([left], [right]) => left.localeCompare(right))) {
    const next = new Map(states)
    for (const [mask, state] of states) {
      for (const [agentIndex, item] of scores) {
        const bit = 1 << agentIndex
        if (mask & bit) continue
        const assignments = [...state.assignments]
        assignments[agentIndex] = item
        const candidate = {
          score: state.score + item.score,
          assignments,
          key: assignments.map((assigned) => assigned?.disc.id ?? '~').join('|'),
        }
        const nextMask = mask | bit
        const existing = next.get(nextMask)
        if (
          !existing ||
          candidate.score > existing.score ||
          (candidate.score === existing.score && candidate.key < existing.key)
        )
          next.set(nextMask, candidate)
      }
    }
    states = next
  }
  return states.get((1 << agentIds.length) - 1)?.assignments ?? []
}

export function allocateLoadouts(
  discs: DriveDisc[],
  agentIds: string[],
  profilesInput: AgentDiscProfile[],
  options: {
    discReuse: OptimizationScenario['discReuse']
    allowLocked?: boolean
    excludedDiscIds?: string[]
    candidateLimit?: number
  },
): { loadouts: AgentLoadout[]; error: string | null } {
  const profiles = new Map(profilesInput.map((profile) => [profile.agentId, profile]))
  const missingProfiles = agentIds.filter((agentId) => !profiles.has(agentId))
  if (missingProfiles.length)
    return { loadouts: [], error: `缺少版本化构筑资料：${missingProfiles.join('、')}` }
  const excluded = new Set(options.excludedDiscIds ?? [])
  const available = discs.filter(
    (disc) => !excluded.has(disc.id) && (options.allowLocked !== false || !disc.locked),
  )
  const byAgent = new Map(agentIds.map((agentId) => [agentId, [] as AssignedDisc[]]))
  for (let slot = 1; slot <= 6; slot += 1) {
    const slotDiscs = available.filter((disc) => disc.slot === slot)
    if (!slotDiscs.length) return { loadouts: [], error: `${slot}号位没有可用驱动盘。` }
    if (options.discReuse === 'independent') {
      for (const agentId of agentIds) {
        const best = slotDiscs
          .map((disc) => scoreDiscForProfile(disc, profiles.get(agentId)!))
          .filter((item) => item.score > 0)
          .sort((a, b) => b.score - a.score || a.disc.id.localeCompare(b.disc.id))[0]
        if (!best) return { loadouts: [], error: `${agentId} 的 ${slot}号位没有合法候选。` }
        byAgent.get(agentId)!.push(best)
      }
      continue
    }
    const assigned = bestUniqueSlotAssignment(
      slotDiscs,
      agentIds,
      profiles,
      options.candidateLimit ?? 14,
    )
    if (assigned.length !== agentIds.length)
      return { loadouts: [], error: `${slot}号位没有足够的互不重复候选盘。` }
    assigned.forEach((item, index) => byAgent.get(agentIds[index])!.push(item))
  }
  return {
    loadouts: agentIds.map((agentId) => {
      const selected = byAgent.get(agentId) ?? []
      const profile = profiles.get(agentId)!
      return {
        agentId,
        discs: selected,
        totalScore: round(selected.reduce((sum, item) => sum + item.score, 0)),
        confidence: profile.confidence,
        boundary: `仅代表 ${profile.gameVersion} 构筑模板内的盘面比较，不等于伤害或危局分。`,
      }
    }),
    error: null,
  }
}

export type DamageInput = {
  attack: number
  multiplier: number
  damageBonus: number
  critRate: number
  critDamage: number
  defenseMultiplier: number
  resistanceMultiplier: number
  stunMultiplier: number
  anomalyDamage: number
  cycleSeconds: number
}

export function calculateDamage(input: DamageInput) {
  const critExpectation = 1 + input.critRate * input.critDamage
  const direct =
    input.attack *
    input.multiplier *
    (1 + input.damageBonus) *
    critExpectation *
    input.defenseMultiplier *
    input.resistanceMultiplier *
    input.stunMultiplier
  const cycleDamage = direct + input.anomalyDamage
  return {
    direct: round(direct),
    anomaly: round(input.anomalyDamage),
    cycleDamage: round(cycleDamage),
    dps: round(cycleDamage / input.cycleSeconds),
    critExpectation: round(critExpectation),
  }
}

const completenessRank = { missing: 0, partial: 1, complete: 2 } as const

export type TeamSearchConstraints = {
  lockedAgentIds?: string[]
  excludedAgentIds?: string[]
  lockedTeamIds?: string[]
  excludedTeamIds?: string[]
}

export function searchDeadlyAssaultTeams(
  rotationId: string,
  roster: AccountRoster,
  bossIds: string[],
  constraints: TeamSearchConstraints = {},
) {
  const excludedAgents = new Set(constraints.excludedAgentIds ?? [])
  const excludedTeams = new Set(constraints.excludedTeamIds ?? [])
  const lockedAgents = new Set<string>(constraints.lockedAgentIds ?? [])
  const lockedTeams = new Set<string>(constraints.lockedTeamIds ?? [])
  const ownedBangboos = new Set(
    roster.bangboos.filter((item) => item.owned).map((item) => item.bangbooId),
  )
  const exclusions: Array<{ templateId: string; reasons: string[] }> = []
  const candidates = teamTemplates.filter((template) => {
    const reasons: string[] = []
    if (template.rotationId !== rotationId) reasons.push('轮换版本不匹配')
    if (!bossIds.includes(template.bossId)) reasons.push('Boss不在当前轮换')
    if (excludedTeams.has(template.id)) reasons.push('队伍已排除')
    if (template.agentIds.some((id) => excludedAgents.has(id))) reasons.push('包含已排除代理人')
    if (!ownedBangboos.has(template.bangbooId)) reasons.push('未拥有所需邦布')
    for (const agentId of template.agentIds) {
      const agent = roster.agents.find((item) => item.agentId === agentId)
      if (!agent?.owned) reasons.push(`未拥有 ${agentId}`)
      else {
        if (agent.level < template.minimums.level) reasons.push(`${agentId} 等级不足`)
        if (agent.mindscape < template.minimums.mindscape) reasons.push(`${agentId} 影画不足`)
        if (completenessRank[agent.completeness] < completenessRank[template.minimums.completeness])
          reasons.push(`${agentId} 资料不完整`)
      }
    }
    if (reasons.length) exclusions.push({ templateId: template.id, reasons })
    return reasons.length === 0
  })
  const byBoss = bossIds.map((bossId) => candidates.filter((team) => team.bossId === bossId))
  const plans: Array<{ teams: typeof candidates; templatePriority: number }> = []
  const choose = (index: number, selected: typeof candidates) => {
    if (index === byBoss.length) {
      const agents = selected.flatMap((team) => [...team.agentIds])
      const bangboos = selected.map((team) => team.bangbooId)
      const selectedAgentIds = new Set<string>(agents)
      const selectedTeamIds = new Set<string>(selected.map((team) => team.id))
      const includesLocks =
        [...lockedAgents].every((id) => selectedAgentIds.has(id)) &&
        [...lockedTeams].every((id) => selectedTeamIds.has(id))
      if (
        new Set(agents).size === agents.length &&
        new Set(bangboos).size === bangboos.length &&
        includesLocks
      )
        plans.push({
          teams: selected,
          templatePriority: selected.reduce((sum, team) => sum + team.templatePriority, 0),
        })
      return
    }
    for (const team of byBoss[index]) choose(index + 1, [...selected, team])
  }
  choose(0, [])
  plans.sort(
    (a, b) =>
      b.templatePriority - a.templatePriority ||
      a.teams
        .map((team) => team.id)
        .join('|')
        .localeCompare(b.teams.map((team) => team.id).join('|')),
  )
  return { plans, exclusions }
}

function unsupportedDamage(boundary: string): DamageBreakdown {
  return {
    status: 'unsupported',
    direct: null,
    anomaly: null,
    cycleDamage: null,
    dps: null,
    scoreEstimate: null,
    factors: [],
    boundary,
  }
}

function calculateSupportedTeamDamage(
  agentIds: string[],
  roster: AccountRoster,
  scenario: OptimizationScenario,
): DamageBreakdown {
  if (!scenario.enemyModel?.verified) return unsupportedDamage('敌人DEF/RES/失衡模型未验证。')
  const agents = agentIds.map((agentId) => roster.agents.find((agent) => agent.agentId === agentId))
  if (agents.some((agent) => !agent || agent.completeness !== 'complete' || !agent.damageInput)) {
    return unsupportedDamage('至少一名代理人缺少完整面板、技能倍率、循环或来源。')
  }
  const results = agents.map((agent) => {
    const input = agent!.damageInput!
    return {
      agentId: agent!.agentId,
      source: input.source,
      value: calculateDamage({
        ...input,
        defenseMultiplier: scenario.enemyModel!.defenseMultiplier,
        resistanceMultiplier: scenario.enemyModel!.resistanceMultiplier,
        stunMultiplier: scenario.enemyModel!.stunMultiplier,
      }),
    }
  })
  return {
    status: 'supported',
    direct: round(results.reduce((sum, item) => sum + item.value.direct, 0)),
    anomaly: round(results.reduce((sum, item) => sum + item.value.anomaly, 0)),
    cycleDamage: round(results.reduce((sum, item) => sum + item.value.cycleDamage, 0)),
    dps: round(results.reduce((sum, item) => sum + item.value.dps, 0)),
    scoreEstimate: null,
    factors: results.map((item) => ({
      label: `${item.agentId} 循环伤害`,
      value: item.value.cycleDamage,
      source: item.source,
    })),
    boundary: `仅覆盖已声明循环；敌人模型来源：${scenario.enemyModel.source}。未转换为危局得分。`,
  }
}

export function optimizeScenario(
  scenario: OptimizationScenario,
  roster: AccountRoster,
  discs: DriveDisc[],
  profiles: AgentDiscProfile[],
  bossIds: string[] = [],
): { result: ScenarioResult | null; error: string | null } {
  const startedAt = performance.now()
  let agentIds = scenario.agentIds.filter((agentId) =>
    roster.agents.some((agent) => agent.agentId === agentId && agent.owned),
  )
  let selectedTeams: (typeof teamTemplates)[number][] = []
  const warnings: string[] = []
  if (scenario.scope === 'deadly_assault') {
    const search = searchDeadlyAssaultTeams(scenario.rotationId ?? '', roster, bossIds, {
      lockedAgentIds: scenario.lockedAgentIds,
      excludedAgentIds: scenario.excludedAgentIds,
      lockedTeamIds: scenario.lockedTeamIds,
      excludedTeamIds: scenario.excludedTeamIds,
    })
    if (!search.plans.length)
      return {
        result: null,
        error: `没有可信三队方案；${search.exclusions
          .slice(0, 3)
          .map((item) => `${item.templateId}: ${item.reasons[0]}`)
          .join('；')}`,
      }
    selectedTeams = [...search.plans[0].teams]
    agentIds = selectedTeams.flatMap((team) => [...team.agentIds])
    warnings.push(
      `队伍候选优先级 ${search.plans[0].templatePriority} 仅用于候选排序，不是伤害或危局分。`,
    )
  }
  if (!agentIds.length) return { result: null, error: '当前场景没有已拥有代理人。' }
  const currentProfiles = profiles.filter((profile) => profile.gameVersion === scenario.gameVersion)
  const allocation = allocateLoadouts(discs, agentIds, currentProfiles, {
    discReuse: scenario.discReuse,
    excludedDiscIds: scenario.excludedDiscIds,
  })
  if (allocation.error) return { result: null, error: allocation.error }
  const teams = selectedTeams.length
    ? selectedTeams.map((team) => ({
        id: team.id,
        bossId: team.bossId,
        agentIds: [...team.agentIds],
        bangbooId: team.bangbooId,
        damage: unsupportedDamage(
          '缺少完整技能倍率、面板、音擎、Buff覆盖、敌人模型与计分公式，不输出区间或奖励线结论。',
        ),
        reachedMinimum: null,
        reasons: [...team.reasons],
      }))
    : scenario.scope === 'single_team'
      ? [
          {
            id: scenario.id,
            bossId: scenario.enemyIds[0] ?? null,
            agentIds,
            bangbooId: null,
            damage: calculateSupportedTeamDamage(agentIds, roster, scenario),
            reachedMinimum: null,
            reasons: ['伤害只在三名代理人与敌人模型均有来源时计算', '危局得分仍保持未支持'],
          },
        ]
      : []
  return {
    error: null,
    result: {
      scenario: { ...scenario, agentIds },
      loadouts: allocation.loadouts,
      teams,
      reachedTargets: 0,
      totalScore: round(allocation.loadouts.reduce((sum, loadout) => sum + loadout.totalScore, 0)),
      riskCount: allocation.loadouts.filter((loadout) => loadout.confidence !== 'high').length,
      warnings: [
        ...warnings,
        ...(scenario.discReuse === 'independent'
          ? ['各角色独立评估会复用同一盘，方案不可同时装备。']
          : []),
        '当前装备归属未导入，换装风险标记为 unknown。',
      ],
      warehouseHash: contentHash(discs),
      rosterHash: contentHash(roster),
      dataVersion: assaultDataVersion,
      modelVersion: assaultModelVersion,
      elapsedMs: round(performance.now() - startedAt),
    },
  }
}

export function createDeadlyAssaultScenario(rotationId: string): OptimizationScenario {
  return {
    id: `deadly-assault:${rotationId}`,
    rotationId,
    scope: 'deadly_assault',
    gameVersion: '3.0',
    agentIds: [],
    enemyIds: [],
    buffs: [],
    objective: 'reward_lexicographic',
    discReuse: 'globally_unique',
    minimumTarget: null,
    fixedDiscIds: [],
    excludedDiscIds: [],
    lockedAgentIds: [],
    excludedAgentIds: [],
    lockedTeamIds: [],
    excludedTeamIds: [],
  }
}
