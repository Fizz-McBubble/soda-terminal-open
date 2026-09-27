import type { AccountRoster } from '../assault/types'
import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import {
  hasLegalSixDriveDiscs,
  resolveDriveDiscMainStatValue,
} from '../calculation/outOfCombatPanel'
import type { DriveDisc, StatKey } from '../domain/schemas'
import { resolveCurrentDriveDiscTwoPieceModifiers } from '../gameDataPacks/currentDriveDiscFormulaCatalog'
import { getCurrentWEngineStaticData } from '../gameDataPacks/currentWEngineStaticCatalog'

export type NormalizedPercentageStat = 'hp' | 'atk' | 'def' | 'impact' | 'anomMas' | 'enerRegen'

export const elementalDamageTwoPieceStats = new Set([
  'physical_dmg_',
  'fire_dmg_',
  'ice_dmg_',
  'electric_dmg_',
  'wind_dmg_',
  'ether_dmg_',
])

export function emptyNormalizedPercentages(): Record<NormalizedPercentageStat, number> {
  return { hp: 0, atk: 0, def: 0, impact: 0, anomMas: 0, enerRegen: 0 }
}

export function addStaticTwoPieceModifiers(input: {
  discs: readonly DriveDisc[]
  attribute: string
  percentages: Record<NormalizedPercentageStat, number>
  add: {
    critRate: (value: number) => void
    critDamage: (value: number) => void
    anomalyProficiency: (value: number) => void
    penetrationRatio: (value: number) => void
  }
  damageBonus: { value: number }
  actionDamageBonuses: Array<{ actionTypes: readonly string[]; value: number }>
}) {
  const setCounts = new Map<string, number>()
  input.discs.forEach((disc) => setCounts.set(disc.setId, (setCounts.get(disc.setId) ?? 0) + 1))
  const appliedSetIds: string[] = []
  const excludedSetIds: string[] = []
  const excludedModifiers: Array<{ setId: string; stat: string }> = []
  const unresolvedModifiers: Array<{ setId: string; stat: string }> = []
  for (const [setId, count] of setCounts) {
    if (count < 2) continue
    const modifiers = resolveCurrentDriveDiscTwoPieceModifiers(setId, count)
    if (!modifiers.length) {
      excludedSetIds.push(setId)
      const missing = { setId, stat: 'missing_two_piece_source' }
      excludedModifiers.push(missing)
      unresolvedModifiers.push(missing)
      continue
    }
    const unsupported = modifiers.filter((modifier) => {
      if (
        [
          'hp_',
          'atk_',
          'def_',
          'impact_',
          'anomMas_',
          'enerRegen_',
          'crit_',
          'crit_dmg_',
          'anomProf',
          'pen_',
        ].includes(modifier.stat)
      )
        return false
      if (elementalDamageTwoPieceStats.has(modifier.stat)) return false
      if (modifier.stat === 'action_dmg_') return !modifier.actionTypes?.length
      return !['shield_', 'dazeInc_'].includes(modifier.stat)
    })
    if (unsupported.length) {
      excludedSetIds.push(setId)
      unsupported.forEach((modifier) => {
        const unresolved = { setId, stat: modifier.stat }
        excludedModifiers.push(unresolved)
        unresolvedModifiers.push(unresolved)
      })
      continue
    }
    for (const modifier of modifiers) {
      if (modifier.stat === 'hp_') input.percentages.hp += modifier.value
      if (modifier.stat === 'atk_') input.percentages.atk += modifier.value
      if (modifier.stat === 'def_') input.percentages.def += modifier.value
      if (modifier.stat === 'impact_') input.percentages.impact += modifier.value
      if (modifier.stat === 'anomMas_') input.percentages.anomMas += modifier.value
      if (modifier.stat === 'enerRegen_') input.percentages.enerRegen += modifier.value
      if (modifier.stat === 'crit_') input.add.critRate(modifier.value)
      if (modifier.stat === 'crit_dmg_') input.add.critDamage(modifier.value)
      if (modifier.stat === 'anomProf') input.add.anomalyProficiency(modifier.value)
      if (modifier.stat === 'pen_') input.add.penetrationRatio(modifier.value)
      if (modifier.stat === `${input.attribute}_dmg_`) input.damageBonus.value += modifier.value
      if (modifier.stat === 'action_dmg_')
        input.actionDamageBonuses.push({
          actionTypes: modifier.actionTypes!,
          value: modifier.value,
        })
      if (['shield_', 'dazeInc_'].includes(modifier.stat))
        excludedModifiers.push({ setId, stat: modifier.stat })
    }
    appliedSetIds.push(setId)
  }
  return {
    status: unresolvedModifiers.length ? ('partial' as const) : ('complete' as const),
    appliedSetIds: appliedSetIds.sort(),
    excludedSetIds: excludedSetIds.sort(),
    excludedModifiers: excludedModifiers.sort((left, right) =>
      `${left.setId}:${left.stat}`.localeCompare(`${right.setId}:${right.stat}`),
    ),
    unresolvedModifiers: unresolvedModifiers.sort((left, right) =>
      `${left.setId}:${left.stat}`.localeCompare(`${right.setId}:${right.stat}`),
    ),
  }
}

export function accountSkillLevel(agent: AccountRoster['agents'][number], skill: string) {
  const recorded = agent.skillLevels[skill as keyof typeof agent.skillLevels]
  if (typeof recorded === 'number' && recorded > 0) return recorded
  const rarity = getCurrentAgentEventContract(agent.agentId)?.identity.rarity
  return rarity === 'A' ? 15 : 11
}

export function projectNormalizedAccountFinalStatsDetailed(input: {
  agent: AccountRoster['agents'][number]
  engineId: string
  discs: DriveDisc[]
}) {
  const contract = getCurrentAgentEventContract(input.agent.agentId)
  const engine = getCurrentWEngineStaticData(input.engineId)
  // This path reads the catalog's independent base/promotion source, never the
  // menu-observed panel. That keeps Remielle's observed M2 anchor from adding
  // registered or unregistered core/mindscape stats to a core-free baseline.
  if (!contract)
    return { status: 'unsupported' as const, reasons: ['当前试算未找到该代理人的静态数据。'] }
  if (!engine)
    return { status: 'unsupported' as const, reasons: ['当前试算未找到该方案音擎的静态数据。'] }
  if (input.agent.level !== 60)
    return { status: 'unsupported' as const, reasons: ['当前试算仅支持 60 级代理人。'] }
  if (!hasLegalSixDriveDiscs(input.discs))
    return { status: 'unsupported' as const, reasons: ['需关联六张不同盘位、合法等级的驱动盘。'] }
  const promotion = contract.promotionStats[5]
  if (!promotion)
    return {
      status: 'unsupported' as const,
      reasons: ['当前试算缺少该代理人的 60 级突破数据。'],
    }
  const percentages = emptyNormalizedPercentages()
  let attackFlat = 0
  let hpFlat = 0
  let defenseFlat = 0
  let critRate = 0.05
  let critDamage = 0.5
  let anomalyProficiency = contract.baseStats.anomProf
  let penetrationRatio = 0
  let penetration = 0
  const damageBonus = { value: 0 }
  const actionDamageBonuses: Array<{ actionTypes: readonly string[]; value: number }> = []
  const secondary = engine.staticStats
  if (secondary.secondaryStatKey === 'hp_') percentages.hp += secondary.level60SecondaryValue
  if (secondary.secondaryStatKey === 'atk_') percentages.atk += secondary.level60SecondaryValue
  if (secondary.secondaryStatKey === 'def_') percentages.def += secondary.level60SecondaryValue
  if (secondary.secondaryStatKey === 'impact_')
    percentages.impact += secondary.level60SecondaryValue
  if (secondary.secondaryStatKey === 'anomMas_')
    percentages.anomMas += secondary.level60SecondaryValue
  if (secondary.secondaryStatKey === 'enerRegen_')
    percentages.enerRegen += secondary.level60SecondaryValue
  if (secondary.secondaryStatKey === 'crit_') critRate += secondary.level60SecondaryValue
  if (secondary.secondaryStatKey === 'crit_dmg_') critDamage += secondary.level60SecondaryValue
  if (secondary.secondaryStatKey === 'anomProf')
    anomalyProficiency += secondary.level60SecondaryValue
  if (secondary.secondaryStatKey === 'pen_') penetrationRatio += secondary.level60SecondaryValue
  const damageKey = `${contract.identity.attribute}_dmg` as StatKey
  for (const disc of input.discs) {
    const main = resolveDriveDiscMainStatValue(disc)
    const stats = [...disc.subStats, ...(main ? [{ ...main, upgrades: 0 }] : [])]
    for (const stat of stats) {
      const value = stat.value
      if (stat.stat === 'hp_percent') percentages.hp += value / 100
      if (stat.stat === 'atk_percent') percentages.atk += value / 100
      if (stat.stat === 'def_percent') percentages.def += value / 100
      if (stat.stat === 'hp_flat') hpFlat += value
      if (stat.stat === 'atk_flat') attackFlat += value
      if (stat.stat === 'def_flat') defenseFlat += value
      if (stat.stat === 'crit_rate') critRate += value / 100
      if (stat.stat === 'crit_dmg') critDamage += value / 100
      if (stat.stat === damageKey) damageBonus.value += value / 100
      if (stat.stat === 'anomaly_mastery') percentages.anomMas += value / 100
      if (stat.stat === 'anomaly_proficiency') anomalyProficiency += value
      if (stat.stat === 'pen') penetration += value
      if (stat.stat === 'pen_ratio') penetrationRatio += value / 100
      if (stat.stat === 'energy_regen') percentages.enerRegen += value / 100
      if (stat.stat === 'impact') percentages.impact += value / 100
    }
  }
  const twoPieceProjection = addStaticTwoPieceModifiers({
    discs: input.discs,
    attribute: contract.identity.attribute,
    percentages,
    add: {
      critRate: (value) => (critRate += value),
      critDamage: (value) => (critDamage += value),
      anomalyProficiency: (value) => (anomalyProficiency += value),
      penetrationRatio: (value) => (penetrationRatio += value),
    },
    damageBonus,
    actionDamageBonuses,
  })
  const characterAttack =
    contract.baseStats.atk_base + contract.baseStats.atk_growth * 59 + promotion.atk
  const characterHp = contract.baseStats.hp_base + contract.baseStats.hp_growth * 59 + promotion.hp
  const characterDefense =
    contract.baseStats.def_base + contract.baseStats.def_growth * 59 + promotion.def
  const attack =
    (characterAttack + engine.staticStats.level60BaseAttack) * (1 + percentages.atk) + attackFlat
  const initialAttack = characterAttack + engine.staticStats.level60BaseAttack
  const initialStats = {
    atk: initialAttack,
    def: characterDefense,
    hp: characterHp,
    crit_: 0.05,
    crit_dmg_: 0.5,
    anomMas: contract.baseStats.anomMas,
    anomProf: contract.baseStats.anomProf,
    impact: contract.baseStats.impact,
    pen_: 0,
    enerRegen: contract.baseStats.enerRegen,
  }
  const finalStats = {
    ...initialStats,
    atk: attack,
    def: characterDefense * (1 + percentages.def) + defenseFlat,
    hp: characterHp * (1 + percentages.hp) + hpFlat,
    crit_: Math.min(1, Math.max(0, critRate)),
    crit_dmg_: Math.max(0, critDamage),
    anomMas: contract.baseStats.anomMas * (1 + percentages.anomMas),
    anomProf: anomalyProficiency,
    impact: contract.baseStats.impact * (1 + percentages.impact),
    pen_: penetrationRatio,
    enerRegen: contract.baseStats.enerRegen * (1 + percentages.enerRegen),
    damageBonus: Math.max(0, damageBonus.value),
    pen: penetration,
    actionDamageBonuses,
  }
  const stats = {
    attack,
    critRate: Math.min(1, Math.max(0, critRate)),
    critDamage: Math.max(0, critDamage),
    damageBonus: Math.max(0, damageBonus.value),
    initialStats,
    finalStats,
    twoPieceProjection,
    boundary:
      '角色 60 级来源成长 + 方案音擎 60 级静态值 + 六张实体盘；角色核心、音擎被动与条件四件套在 R1 基线中显式不激活。已知护盾/失衡二件套不属于固定直接伤害或局外面板字段，作为排除项保留。',
  }
  if (twoPieceProjection.status === 'partial')
    return {
      status: 'unsupported' as const,
      reasons: twoPieceProjection.unresolvedModifiers.map(
        ({ setId, stat }) => `未采用静态二件套字段：${setId}.${stat}；不能按 0 继续归一化投影。`,
      ),
      twoPieceProjection,
    }
  return { status: 'supported' as const, stats, twoPieceProjection }
}

/** Compatibility wrapper for existing callers that have no reason surface yet. */
export function projectNormalizedAccountFinalStats(input: {
  agent: AccountRoster['agents'][number]
  engineId: string
  discs: DriveDisc[]
}) {
  const result = projectNormalizedAccountFinalStatsDetailed(input)
  return result.status === 'supported' ? result.stats : null
}
