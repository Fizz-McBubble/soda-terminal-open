import type { AccountRoster } from '../assault/types'
import type { PlanningEffectRuntimeStats } from '../calculation/currentPlanningEffectDomain'
import { evaluateSourceBoundSheerForce32 } from '../calculation/currentSourceBoundSheerForce32'
import { resolveCurrentAgentCoreGrowth } from '../gameDataPacks/panel/currentPanelData'
import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import {
  hasLegalSixDriveDiscs,
  resolveDriveDiscMainStatValue,
} from '../calculation/outOfCombatPanel'
import type { DriveDisc, StatKey } from '../domain/schemas'
import { resolveCurrentDriveDiscTwoPieceModifiers } from '../gameDataPacks/currentDriveDiscFormulaCatalog'
import { getCurrentWEngineStaticData } from '../gameDataPacks/currentWEngineStaticCatalog'
import {
  currentFormulaBaseStats,
  currentFormulaBaseStatsSource,
} from '../gameDataPacks/currentFormulaBaseStats'
import {
  calculateWEngineBaseStatExact,
  calculateWEngineSecondaryStat,
  defaultAscensionForLevel,
} from '../gameDataPacks/panel/wEngineGrowth'

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
  damageBonusesByAttribute?: Record<string, number>
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
      if (elementalDamageTwoPieceStats.has(modifier.stat) && input.damageBonusesByAttribute) {
        const attribute = modifier.stat.slice(0, -5)
        input.damageBonusesByAttribute[attribute] += modifier.value
      }
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

  const agentLevel = input.agent.level
  if (!Number.isInteger(agentLevel) || agentLevel < 1 || agentLevel > 60)
    return { status: 'unsupported' as const, reasons: ['代理人等级必须在 1 到 60 之间。'] }
  if (!hasLegalSixDriveDiscs(input.discs))
    return { status: 'unsupported' as const, reasons: ['需关联六张不同盘位、合法等级的驱动盘。'] }

  const explicitAscension = (input.agent as { ascension?: unknown }).ascension
  let agentAscension: number
  if (explicitAscension !== undefined && explicitAscension !== null) {
    if (
      typeof explicitAscension !== 'number' ||
      !Number.isInteger(explicitAscension) ||
      explicitAscension < 0 ||
      explicitAscension > 5
    ) {
      return { status: 'unsupported' as const, reasons: ['代理人突破阶段必须在 0 到 5 之间。'] }
    }
    agentAscension = explicitAscension
  } else {
    agentAscension = defaultAscensionForLevel(agentLevel)
  }

  const promotion = contract.promotionStats[agentAscension]
  if (!promotion)
    return {
      status: 'unsupported' as const,
      reasons: [`当前试算缺少该代理人的突破阶段 ${agentAscension} 数据。`],
    }

  const explicitEngineLevel = input.agent.wEngineDetails?.level
  let engineLevel: number
  if (explicitEngineLevel !== undefined && explicitEngineLevel !== null) {
    if (
      typeof explicitEngineLevel !== 'number' ||
      !Number.isInteger(explicitEngineLevel) ||
      explicitEngineLevel < 1 ||
      explicitEngineLevel > 60
    ) {
      return { status: 'unsupported' as const, reasons: ['音擎等级必须在 1 到 60 之间。'] }
    }
    engineLevel = explicitEngineLevel
  } else {
    engineLevel = agentLevel
  }

  const explicitEngineAscension = (input.agent.wEngineDetails as { ascension?: unknown })?.ascension
  let engineAscension: number
  if (explicitEngineAscension !== undefined && explicitEngineAscension !== null) {
    if (
      typeof explicitEngineAscension !== 'number' ||
      !Number.isInteger(explicitEngineAscension) ||
      explicitEngineAscension < 0 ||
      explicitEngineAscension > 5
    ) {
      return { status: 'unsupported' as const, reasons: ['音擎突破阶段必须在 0 到 5 之间。'] }
    }
    engineAscension = explicitEngineAscension
  } else {
    engineAscension = defaultAscensionForLevel(engineLevel)
  }

  const isLv60Engine = engineLevel === 60 && engineAscension === 5
  const engineBaseValue = calculateWEngineBaseStatExact(
    engine.staticStats.baseStat.value,
    engineLevel,
    engineAscension,
  )

  const engineSecondaryValue = isLv60Engine
    ? engine.staticStats.level60SecondaryValue
    : calculateWEngineSecondaryStat(
        engine.staticStats.secondaryStatBaseValue,
        engineLevel,
        engineAscension,
      )

  const engineBaseAttack = engine.staticStats.baseStat.key === 'atk' ? engineBaseValue : 0
  const engineBaseDefense = engine.staticStats.baseStat.key === 'def' ? engineBaseValue : 0

  const coreGrowth = resolveCurrentAgentCoreGrowth({
    agentId: input.agent.agentId,
    coreLevel: input.agent.skillLevels?.core ?? Number.NaN,
    basis: 'source_growth',
  })
  if (coreGrowth.status === 'unsupported')
    return { status: 'unsupported' as const, reasons: [coreGrowth.reason] }
  const core = coreGrowth.values

  const percentages = emptyNormalizedPercentages()
  let attackFlat = 0
  let hpFlat = 0
  let defenseFlat = 0
  percentages.hp += (core.hpPercent ?? 0) / 100
  percentages.atk += (core.atkPercent ?? 0) / 100
  percentages.impact += (core.impactPercent ?? 0) / 100
  percentages.anomMas += (core.anomalyMasteryPercent ?? 0) / 100
  percentages.enerRegen += (core.energyRegenPercent ?? 0) / 100
  let critRate = currentFormulaBaseStats.critRate + (core.critRate ?? 0) / 100
  let critDamage = currentFormulaBaseStats.critDamage + (core.critDamage ?? 0) / 100
  let anomalyProficiency = contract.baseStats.anomProf + (core.anomalyProficiency ?? 0)
  let penetrationRatio = (core.penRatio ?? 0) / 100
  let penetration = 0
  const damageBonus = { value: 0 }
  const damageBonusesByAttribute = Object.fromEntries(
    [...elementalDamageTwoPieceStats].map((key) => [key.slice(0, -5), 0]),
  )
  const actionDamageBonuses: Array<{ actionTypes: readonly string[]; value: number }> = []

  const secondary = engine.staticStats
  if (secondary.secondaryStatKey === 'hp_') percentages.hp += engineSecondaryValue
  if (secondary.secondaryStatKey === 'atk_') percentages.atk += engineSecondaryValue
  if (secondary.secondaryStatKey === 'def_') percentages.def += engineSecondaryValue
  if (secondary.secondaryStatKey === 'impact_') percentages.impact += engineSecondaryValue
  if (secondary.secondaryStatKey === 'anomMas_') percentages.anomMas += engineSecondaryValue
  if (secondary.secondaryStatKey === 'enerRegen_') percentages.enerRegen += engineSecondaryValue
  if (secondary.secondaryStatKey === 'crit_') critRate += engineSecondaryValue
  if (secondary.secondaryStatKey === 'crit_dmg_') critDamage += engineSecondaryValue
  if (secondary.secondaryStatKey === 'anomProf') anomalyProficiency += engineSecondaryValue
  if (secondary.secondaryStatKey === 'pen_') penetrationRatio += engineSecondaryValue

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
      if (stat.stat.endsWith('_dmg')) {
        const attribute = stat.stat.slice(0, -4)
        if (Object.hasOwn(damageBonusesByAttribute, attribute))
          damageBonusesByAttribute[attribute] += value / 100
      }
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
    damageBonusesByAttribute,
    actionDamageBonuses,
  })

  const characterAttack =
    contract.baseStats.atk_base +
    contract.baseStats.atk_growth * (agentLevel - 1) +
    promotion.atk +
    (core.atk ?? 0)
  const characterHp =
    contract.baseStats.hp_base +
    contract.baseStats.hp_growth * (agentLevel - 1) +
    promotion.hp +
    (core.hp ?? 0)
  const characterDefense =
    contract.baseStats.def_base + contract.baseStats.def_growth * (agentLevel - 1) + promotion.def

  const initialAttack = characterAttack + engineBaseAttack
  const initialDefense = characterDefense + engineBaseDefense

  const attack = initialAttack * (1 + percentages.atk) + attackFlat
  const defense = initialDefense * (1 + percentages.def) + defenseFlat

  const baseAttack = initialAttack
  const baseDefense = initialDefense
  const { sharpDamageBonus, lacerationDamage } = currentFormulaBaseStats

  // Upstream `initial` is the completed unconditional static panel, before
  // combat modifiers. The separate base fields retain the growth/engine base.
  // Do not clip CR here: the sharp formula has a second roll above 100%.
  const initialStats: PlanningEffectRuntimeStats = {
    atk: attack,
    def: defense,
    hp: characterHp * (1 + percentages.hp) + hpFlat,
    crit_: Math.max(0, critRate),
    crit_dmg_: Math.max(0, critDamage),
    anomMas: (contract.baseStats.anomMas + (core.anomalyMastery ?? 0)) * (1 + percentages.anomMas),
    anomProf: anomalyProficiency,
    impact: (contract.baseStats.impact + (core.impact ?? 0)) * (1 + percentages.impact),
    pen_: penetrationRatio,
    enerRegen:
      (contract.baseStats.enerRegen + (core.energyRegenFlat ?? 0)) * (1 + percentages.enerRegen),
    baseAttack,
    baseDefense,
    sharpDamageBonus,
    lacerationDamage,
  }
  if (contract.identity.specialty === 'rupture') {
    const sheer = evaluateSourceBoundSheerForce32({
      agentId: input.agent.agentId,
      level: agentLevel,
      coreLevel: input.agent.skillLevels?.core ?? Number.NaN,
      initialStats,
      finalStats: initialStats,
    })
    if (sheer.status === 'unsupported')
      return { status: 'unsupported' as const, reasons: sheer.blockers }
    initialStats.sheerForce = sheer.sheerForce
    initialStats.sheerForceBasis = {
      kind: 'source_derived_static',
      bindingHash: sheer.bindingHash,
      sourceRefs: sheer.sourceRefs,
    }
  }
  const finalStats = {
    ...initialStats,
    atk: attack,
    def: defense,
    hp: characterHp * (1 + percentages.hp) + hpFlat,
    crit_: Math.max(0, critRate),
    crit_dmg_: Math.max(0, critDamage),
    anomMas: initialStats.anomMas,
    anomProf: anomalyProficiency,
    impact: initialStats.impact,
    pen_: penetrationRatio,
    enerRegen: initialStats.enerRegen,
    damageBonus: Math.max(0, damageBonus.value),
    damageBonusesByAttribute,
    pen: penetration,
    actionDamageBonuses,
    defense,
    baseDefense,
    baseAttack,
    level: agentLevel,
    lacerationDamage,
    sharpDamageBonus,
  }
  const stats = {
    attack,
    defense,
    baseHp: characterHp,
    baseAttack,
    baseDefense,
    level: agentLevel,
    critRate: Math.max(0, critRate),
    critDamage: Math.max(0, critDamage),
    damageBonus: Math.max(0, damageBonus.value),
    lacerationDamage,
    sharpDamageBonus,
    progression: { agentLevel, agentAscension, engineLevel, engineAscension },
    baseStatsSource: currentFormulaBaseStatsSource,
    coreGrowth: {
      ...coreGrowth,
      coreIncluded: true as const,
      coreLevel: input.agent.skillLevels.core,
    },
    initialStats,
    finalStats,
    twoPieceProjection,
    boundary:
      '角色来源成长 + 一条累计核心静态成长 + 方案音擎静态值 + 六张实体盘；来源贯穿力初始转换单独纳入，其他核心战斗效果、音擎被动与条件四件套仍显式排除。未复用含核心与影画的菜单观测锚，不宣称完整战斗面板资格。',
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
