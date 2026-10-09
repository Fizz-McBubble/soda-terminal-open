import { resolvePotentialImage } from '../assault/agentCapabilities'
import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'

/** Typed source domains and stat references shared by the planning expression runtime. */
export type PlanningEffectRuntimeStats = {
  atk: number
  def: number
  hp: number
  crit_: number
  crit_dmg_: number
  anomMas: number
  anomProf: number
  impact: number
  /** Source-bound unconditional initial CR conversion already included in final impact once. */
  initialImpactConversion32?: {
    effectKey: string
    impactIncrease: number
    bindingHash: string
    sourceRefs: string[]
  }
  pen_: number
  /** Flat penetration; pen_ is the separate fractional penetration ratio. */
  pen?: number
  /** Static damage bonus for this member's event attribute, as a fraction. */
  damageBonus?: number
  /** Required for a member's mixed-attribute events when its static bonus is nonzero. */
  damageBonusesByAttribute?: Readonly<Record<string, number>>
  /** Typed menu bases are required for percentage combat modifiers in 3.2. */
  baseAttack?: number
  baseDefense?: number
  lacerationDamage?: number
  sharpDamageBonus?: number
  sheerForce?: number
  /** Present only for a source-derived static value; absent means an explicit final observation. */
  sheerForceBasis?: { kind: 'source_derived_static'; bindingHash: string; sourceRefs: string[] }
  sheerDamageBonus?: number
  directDamageBonus?: number
  buffBonus?: number
  actionDamageBonuses?: Array<{ actionTypes: readonly string[]; value: number }>
  enerRegen: number
}

export type PlanningEffectRuntimeMember = {
  agentId: string
  /** Explicit actor level; absent values are accepted only by the frozen pre-3.2 baseline. */
  level?: number
  mindscape: number
  /** Account potential image in its source 0..6 domain, when available. */
  potential?: number | null
  coreLevel: number
  skillLevels: Readonly<Record<string, number>>
  initialStats: PlanningEffectRuntimeStats
  finalStats: PlanningEffectRuntimeStats
}

/**
 * Binds the account's potential image for an expression runtime without
 * deriving a skill index or any effect value. The shared account helper only
 * supplies 6 for agents eligible for the image; other missing values are the
 * neutral 0 expression input.
 */
export function bindPlanningEffectRuntimePotentialReference(input: {
  agentId: string
  potential: number | null | undefined
  references: Readonly<Record<string, unknown>>
}): Record<string, unknown> {
  const imageLevel = resolvePotentialImage(input.agentId, input.potential) ?? 0
  // Koleda's newly pinned source table omits the UI's Lv1 "skip" entry.
  // UI2..6 map to upstream1..5; UI0/1 both select upstream0. Other
  // agents retain their separately reviewed source domains.
  const upstreamLevel = input.agentId === 'agent-koleda' ? Math.max(0, imageLevel - 1) : imageLevel
  return {
    ...input.references,
    // This deliberate final binding prevents named baseline fixtures from
    // replacing an observed account value.
    'char.potential': upstreamLevel,
    'own.char.potential': upstreamLevel,
  }
}

export function teamCounts(memberIds: readonly string[]) {
  const specialty: Record<string, number> = {}
  const faction: Record<string, number> = {}
  const attribute: Record<string, number> = {
    physical: 0,
    fire: 0,
    ice: 0,
    electric: 0,
    ether: 0,
    wind: 0,
  }
  for (const agentId of memberIds) {
    const identity = getCurrentAgentEventContract(agentId)?.identity
    if (!identity) continue
    specialty[identity.specialty] = (specialty[identity.specialty] ?? 0) + 1
    faction[identity.faction] = (faction[identity.faction] ?? 0) + 1
    attribute[identity.attribute] = (attribute[identity.attribute] ?? 0) + 1
  }
  return { specialty, faction, attribute }
}

export function planningCharacterReferences32(member: PlanningEffectRuntimeMember) {
  const references: Record<string, number> = {
    'char.mindscape': member.mindscape,
    'own.char.mindscape': member.mindscape,
    'char.core': member.coreLevel - 1,
    'own.char.core': member.coreLevel - 1,
  }
  for (const [skill, level] of Object.entries(member.skillLevels)) {
    if (!['basic', 'dodge', 'assist', 'special', 'chain'].includes(skill)) continue
    references[`char.${skill}`] = level - 1
    references[`own.char.${skill}`] = level - 1
  }
  return references
}

/** Combine different condition providers without discarding the same actor's
 * already resolved preparation. Later providers replace only matching keys. */
export function mergePlanningReferenceMaps32(
  ...maps: (Readonly<Record<string, Readonly<Record<string, unknown>>>> | undefined)[]
) {
  const result: Record<string, Readonly<Record<string, unknown>>> = {}
  for (const map of maps)
    for (const [agentId, references] of Object.entries(map ?? {}))
      result[agentId] = { ...result[agentId], ...references }
  return result
}

/** Bind factual character/party identities and source constants separately from
 * the explicitly supplied combat observations. No missing trigger is invented. */
export function planningProviderReferences32(input: {
  member: PlanningEffectRuntimeMember
  sourceReferences: Readonly<Record<string, unknown>>
  attributeCounts: Readonly<Record<string, number>>
  observations?: Readonly<Record<string, unknown>>
  finalStats?: PlanningEffectRuntimeStats
}) {
  const member = input.member
  const identity = getCurrentAgentEventContract(member.agentId)?.identity
  return bindPlanningEffectRuntimePotentialReference({
    agentId: member.agentId,
    potential: member.potential,
    references: {
      ...Object.fromEntries(
        Object.entries(input.sourceReferences).filter(([key]) => key.startsWith('dm.')),
      ),
      'team.common.count': input.attributeCounts,
      ...Object.fromEntries(
        Object.entries(input.attributeCounts).map(([key, value]) => [
          `team.common.count.${key}`,
          value,
        ]),
      ),
      ...statReferences('own.initial', member.initialStats),
      ...statReferences('own.final', member.finalStats),
      ...input.observations,
      ...planningCharacterReferences32(member),
      ...(member.level === undefined ? {} : { 'char.lvl': member.level }),
      ...(input.finalStats ? statReferences('own.final', input.finalStats) : {}),
      'char.specialty': identity?.specialty,
      'char.attribute': identity?.attribute,
      'char.faction': identity?.faction,
      'own.char.specialty': identity?.specialty,
      'own.char.attribute': identity?.attribute,
      'own.char.faction': identity?.faction,
    },
  })
}

export function statReferences(
  prefix: 'own.initial' | 'own.final' | 'target.final',
  stats: PlanningEffectRuntimeStats,
) {
  const references: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(stats)) references[`${prefix}.${key}`] = value
  if (stats.lacerationDamage !== undefined)
    references[`${prefix}.laceration_dmg_`] = stats.lacerationDamage
  if (stats.sharpDamageBonus !== undefined)
    references[`${prefix}.sharp_dmg_`] = stats.sharpDamageBonus
  if (stats.sheerDamageBonus !== undefined)
    references[`${prefix}.sheer_dmg_`] = stats.sheerDamageBonus
  if (stats.directDamageBonus !== undefined)
    references[`${prefix}.direct_dmg_`] = stats.directDamageBonus
  if (stats.buffBonus !== undefined) references[`${prefix}.buff_`] = stats.buffBonus
  return references
}

export function effectRuntimeReferences(input: {
  target: PlanningEffectRuntimeMember
  baseReferences: Readonly<Record<string, unknown>>
  requiredReferences: readonly string[]
}) {
  const references: Record<string, unknown> = {
    ...input.baseReferences,
    ...statReferences('target.final', input.target.finalStats),
    'target.char.specialty': getCurrentAgentEventContract(input.target.agentId)?.identity.specialty,
    'target.char.attribute': getCurrentAgentEventContract(input.target.agentId)?.identity.attribute,
    'target.char.faction': getCurrentAgentEventContract(input.target.agentId)?.identity.faction,
  }
  // Missing observations remain absent. The effect compiler distinguishes a
  // source-proven inactive branch from an unobserved conditional.
  return references
}

export function createLevel60NeutralEffectRuntimeMember(
  agentId: string,
): PlanningEffectRuntimeMember {
  const contract = getCurrentAgentEventContract(agentId)
  if (!contract) throw new Error(`缺少角色事件合同：${agentId}`)
  const base = contract.baseStats
  const stats: PlanningEffectRuntimeStats = {
    atk: base.atk_base + base.atk_growth * 59,
    def: base.def_base + base.def_growth * 59,
    hp: base.hp_base + base.hp_growth * 59,
    crit_: 0.05,
    crit_dmg_: 0.5,
    anomMas: base.anomMas,
    anomProf: base.anomProf,
    impact: base.impact,
    pen_: 0,
    enerRegen: base.enerRegen,
  }
  return {
    agentId,
    level: 60,
    mindscape: 0,
    // Frozen neutral fixtures must not inherit the eligible-agent default.
    potential: 0,
    coreLevel: 1,
    skillLevels: { basic: 1, dodge: 1, assist: 1, special: 1, chain: 1, core: 1 },
    initialStats: stats,
    finalStats: stats,
  }
}
