import { supportsPotentialImage } from '../assault/agentCapabilities'
import { currentAgentDirectory } from '../assault/catalog'
import {
  currentAgentEventContracts,
  getCurrentAgentEventContract,
} from '../calculation/currentAgentMechanicContracts'
import type {
  PlanningEffectRuntimeMember,
  PlanningEffectRuntimeStats,
} from '../calculation/currentPlanningEffectDomain'
import { projectOutOfCombatInitialModifiers } from '../calculation/outOfCombatInitialModifiers'
import { currentFormulaBaseStats } from '../gameDataPacks/currentFormulaBaseStats'
import {
  currentCoreGrowthHash32,
  resolveCurrentAgentCoreGrowth,
} from '../gameDataPacks/panel/currentPanelData'
import { stableContentHash } from '../gameDataPacks/types'
import type { TeamStrengthReferenceConditions } from './teamStrengthReferenceConditionsTypes'
import { resolveSkillInvestmentMindscapeBonus } from './skillInvestmentProjection'

/** Local comparison protocol, never an author build or account observation. */
export const teamStrengthReferenceStatePolicy = Object.freeze({
  id: 'team-strength-reference-level60-base-skill11-core7-s0-a6-supported-p6/v2',
  level: 60,
  baseSkillLevel: 11,
  coreLevel: 7,
  mindscapeByRarity: { S: 0, A: 6 },
  supportedPotential: 6,
  unsupportedPotential: 0,
  explicitNumericPotentialWins: true,
  potentialCombatEffects: 'owned-by-source-prepared-event-consumer',
  equipment: 'none',
})

/** The common comparison uses S0/A6, independently of the player's account. */
export function resolveTeamStrengthReferenceMindscape(agentId: string) {
  const rarity = currentAgentDirectory.find((row) => row.id === agentId)?.rarity
  if (rarity === 'S') return teamStrengthReferenceStatePolicy.mindscapeByRarity.S
  if (rarity === 'A') return teamStrengthReferenceStatePolicy.mindscapeByRarity.A
  throw new Error(`评级标准缺少明确S/A身份：${agentId}`)
}

export function resolveTeamStrengthReferencePotential(
  agentId: string,
  referenceConditions?: TeamStrengthReferenceConditions,
) {
  const explicit = referenceConditions?.potentialByAgentId[agentId]
  if (typeof explicit === 'number') {
    if (
      !Number.isInteger(explicit) ||
      explicit < 0 ||
      explicit > 6 ||
      (explicit > 0 && !supportsPotentialImage(agentId))
    )
      throw new Error(`非法评级参考潜能：${agentId}:${explicit}`)
    return explicit
  }
  // The account's preserve_unknown observation policy does not prohibit an
  // explicitly declared theoretical P6 comparison for an eligible agent.
  return supportsPotentialImage(agentId) ? 6 : 0
}

export function computeTeamStrengthReferenceStateIdentity() {
  return stableContentHash({
    policy: teamStrengthReferenceStatePolicy,
    coreGrowth: currentCoreGrowthHash32,
    formulaBaseStats: currentFormulaBaseStats,
    sourceGrowthAndEligibility: currentAgentEventContracts.map((agent) => ({
      agentId: agent.stableId,
      base: agent.baseStats,
      promotion: agent.promotionStats[5],
      source: agent.source,
      supportsPotentialImage: supportsPotentialImage(agent.stableId),
    })),
  })
}
export const teamStrengthReferenceStateIdentity = computeTeamStrengthReferenceStateIdentity()

/** Unequipped source growth at the common rating investment. Potential event
 * buffs remain downstream, so preparing an event cannot count them twice. */
export function createTeamStrengthReferenceRuntimeMember(
  agentId: string,
  referenceConditions?: TeamStrengthReferenceConditions,
): PlanningEffectRuntimeMember {
  const contract = getCurrentAgentEventContract(agentId)
  if (!contract) throw new Error(`缺少角色事件合同：${agentId}`)
  const promotion = contract.promotionStats[5]
  const growth = resolveCurrentAgentCoreGrowth({ agentId, coreLevel: 7, basis: 'source_growth' })
  if (!promotion || growth.status !== 'supported')
    throw new Error(`缺少评级参考养成来源：${agentId}`)
  const core = growth.values
  const base = contract.baseStats
  const mindscape = resolveTeamStrengthReferenceMindscape(agentId)
  const effectiveSkill = 11 + (resolveSkillInvestmentMindscapeBonus(mindscape) ?? 0)
  const potential = resolveTeamStrengthReferencePotential(agentId, referenceConditions)
  const baseAttack = base.atk_base + base.atk_growth * 59 + promotion.atk + (core.atk ?? 0)
  const baseDefense = base.def_base + base.def_growth * 59 + promotion.def
  const stats: PlanningEffectRuntimeStats = {
    atk: baseAttack * (1 + (core.atkPercent ?? 0) / 100),
    def: baseDefense,
    hp:
      (base.hp_base + base.hp_growth * 59 + promotion.hp + (core.hp ?? 0)) *
      (1 + (core.hpPercent ?? 0) / 100),
    baseAttack,
    baseDefense,
    crit_: currentFormulaBaseStats.critRate + (core.critRate ?? 0) / 100,
    crit_dmg_: currentFormulaBaseStats.critDamage + (core.critDamage ?? 0) / 100,
    anomMas:
      (base.anomMas + (core.anomalyMastery ?? 0)) * (1 + (core.anomalyMasteryPercent ?? 0) / 100),
    anomProf: base.anomProf + (core.anomalyProficiency ?? 0),
    impact: (base.impact + (core.impact ?? 0)) * (1 + (core.impactPercent ?? 0) / 100),
    pen_: (core.penRatio ?? 0) / 100,
    pen: 0,
    lacerationDamage: currentFormulaBaseStats.lacerationDamage,
    sharpDamageBonus: currentFormulaBaseStats.sharpDamageBonus,
    enerRegen:
      (base.enerRegen + (core.energyRegenFlat ?? 0)) * (1 + (core.energyRegenPercent ?? 0) / 100),
  }
  const initial = projectOutOfCombatInitialModifiers({
    agentId,
    potentialImage: potential,
    critDamage: stats.crit_dmg_ * 100,
  })
  if (initial.status !== 'supported') throw new Error(initial.reason)
  for (const modifier of initial.modifiers)
    if (modifier.key === 'critRate') stats.crit_ += modifier.value / 100
  return {
    agentId,
    level: 60,
    mindscape,
    potential,
    coreLevel: 7,
    skillLevels: {
      basic: effectiveSkill,
      dodge: effectiveSkill,
      assist: effectiveSkill,
      special: effectiveSkill,
      chain: effectiveSkill,
      core: 7,
    },
    statBasis32: 'out_of_combat',
    initialStats: { ...stats },
    finalStats: { ...stats },
  }
}
