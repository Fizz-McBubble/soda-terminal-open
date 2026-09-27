import { driveDiscData } from '../data/gameData'
import type { DriveDisc, StatKey } from '../domain/schemas'
import {
  getCurrentDriveDiscFormulaData,
  resolveCurrentDriveDiscTwoPieceModifiers,
} from '../gameDataPacks/currentDriveDiscFormulaCatalog'
import { currentPanelData } from '../gameDataPacks/panel/currentPanelData'

export const outOfCombatKeys = [
  'hp',
  'atk',
  'def',
  'impact',
  'critRate',
  'critDamage',
  'anomalyMastery',
  'anomalyProficiency',
  'pen',
  'penRatio',
  'energyRegen',
] as const

export type OutOfCombatKey = (typeof outOfCombatKeys)[number]
export type PanelInput = {
  agentId: string
  level: number
  ascension: number
  core: number
  mindscape?: number
  wEngine: { id: string; level: number; ascension: number; refinement: number }
  discs: DriveDisc[]
}
export type PanelTrace = {
  key: OutOfCombatKey
  source: string
  operation: 'base' | 'percent' | 'post_flat' | 'final' | 'inactive'
  value: number | string
}
export type PanelResult = {
  status: 'ok' | 'unsupported'
  values: Record<OutOfCombatKey, number>
  trace: PanelTrace[]
  menuRounding: 'menu_rule_missing'
  reason?: string
}
export type PanelEngineSupport = {
  agentId: string
  wEngineId: string
  released: boolean
  status: 'computable' | 'unsupported'
  blockers: string[]
}

/** Engine coverage only. Formal readiness is derived by the L3 validator and CalculationContext evidence. */
export function projectPanelEngineSupport(
  entries: Array<{ agentId: string; wEngineId: string; released: boolean }>,
): PanelEngineSupport[] {
  return entries.map((entry) => {
    const blockers = [
      ...(entry.released ? [] : ['not-released']),
      ...(currentPanelData.agents[entry.agentId] ? [] : ['agent-not-registered']),
      ...(currentPanelData.wEngines[entry.wEngineId] ? [] : ['wengine-not-registered']),
    ]
    return { ...entry, status: blockers.length === 0 ? 'computable' : 'unsupported', blockers }
  })
}

type PanelValues = Record<OutOfCombatKey, number>

const defaultCritRate = 5
const defaultCritDamage = 50
const flatStatMap: Partial<Record<StatKey, OutOfCombatKey>> = {
  hp_flat: 'hp',
  atk_flat: 'atk',
  def_flat: 'def',
  crit_rate: 'critRate',
  crit_dmg: 'critDamage',
  anomaly_proficiency: 'anomalyProficiency',
  pen: 'pen',
  pen_ratio: 'penRatio',
}
const percentStatMap: Partial<Record<StatKey, OutOfCombatKey>> = {
  hp_percent: 'hp',
  atk_percent: 'atk',
  def_percent: 'def',
  anomaly_mastery: 'anomalyMastery',
  impact: 'impact',
  energy_regen: 'energyRegen',
}
const knownNonPanelTwoPieceStats = new Set([
  'physical_dmg_',
  'fire_dmg_',
  'ice_dmg_',
  'electric_dmg_',
  'wind_dmg_',
  'ether_dmg_',
  'action_dmg_',
  'shield_',
  'dazeInc_',
])
const twoPiecePercentPanelKey: Partial<Record<string, OutOfCombatKey>> = {
  hp_: 'hp',
  atk_: 'atk',
  def_: 'def',
  impact_: 'impact',
  anomMas_: 'anomalyMastery',
  enerRegen_: 'energyRegen',
}
const twoPiecePostFlatPanelKey: Partial<Record<string, OutOfCombatKey>> = {
  crit_: 'critRate',
  crit_dmg_: 'critDamage',
  anomProf: 'anomalyProficiency',
  pen_: 'penRatio',
}

function emptyValues(): PanelValues {
  return Object.fromEntries(outOfCombatKeys.map((key) => [key, 0])) as PanelValues
}

function initialValues(): PanelValues {
  return { ...emptyValues(), critRate: defaultCritRate, critDamage: defaultCritDamage }
}

function unsupported(reason: string): PanelResult {
  return {
    status: 'unsupported',
    values: emptyValues(),
    trace: [],
    menuRounding: 'menu_rule_missing',
    reason,
  }
}

export function resolveDriveDiscMainStatValue(
  disc: DriveDisc,
): { stat: StatKey; value: number } | null {
  const rarity = disc.rarity ?? 'S'
  const rule = driveDiscData?.rules.mainStatBaseByRarity[rarity].find(
    (item) => item.stat === disc.mainStat,
  )
  const maxLevel = driveDiscData?.rules.maxLevelByRarity[rarity]
  if (!rule || maxLevel === undefined) return null

  const raw = rule.baseValue * (1 + (3 * disc.level) / maxLevel)
  return { stat: disc.mainStat, value: rule.unit === 'flat' ? Math.round(raw) : raw }
}

export function hasLegalSixDriveDiscs(discs: readonly DriveDisc[]): boolean {
  const slots = discs.map((disc) => disc.slot)
  return (
    discs.length === 6 &&
    new Set(discs.map((disc) => disc.id)).size === 6 &&
    new Set(slots).size === 6 &&
    [1, 2, 3, 4, 5, 6].every((slot) => slots.includes(slot as DriveDisc['slot'])) &&
    discs.every(
      (disc) =>
        (driveDiscData?.rules.mainStatsBySlot[String(disc.slot)] ?? []).includes(disc.mainStat) &&
        Number.isInteger(disc.level) &&
        disc.level >= 0 &&
        disc.level <= (driveDiscData?.rules.maxLevelByRarity[disc.rarity ?? 'S'] ?? -1),
    )
  )
}

function add(
  target: PanelValues,
  trace: PanelTrace[],
  key: OutOfCombatKey,
  value: number,
  source: string,
  operation: PanelTrace['operation'],
) {
  target[key] += value
  trace.push({ key, source, operation, value })
}

export function projectOutOfCombatPanel(input: PanelInput): PanelResult {
  const agent = currentPanelData.agents[input.agentId]
  const engine = currentPanelData.wEngines[input.wEngine.id]
  if (!agent || !engine) return unsupported('未知 agentId 或 engineId。')
  if (
    input.level !== agent.level ||
    input.ascension !== agent.ascension ||
    input.wEngine.level !== engine.level ||
    input.wEngine.ascension !== engine.ascension
  )
    return unsupported('该锚点只冻结了锁定上游的 60级/5突破投影。')
  if (
    input.core < 0 ||
    (agent.kind === 'growth' && input.core >= agent.core.length) ||
    (agent.kind === 'menu_observed' && input.core !== agent.core) ||
    input.wEngine.refinement < 1 ||
    input.wEngine.refinement > 5 ||
    !hasLegalSixDriveDiscs(input.discs)
  )
    return unsupported('必须提供合法的六个唯一盘位、核心和改装。')

  const values = agent.kind === 'menu_observed' ? emptyValues() : initialValues()
  const percent = emptyValues()
  const postFlat = emptyValues()
  const trace: PanelTrace[] = []

  if (agent.kind === 'growth') {
    ;(['hp', 'atk', 'def'] as const).forEach((key) => {
      const [base, growth, promotion] = agent.stats[key]
      add(
        values,
        trace,
        key,
        base + growth * (input.level - 1) + promotion,
        `character:${input.agentId}:base+growth+promotion`,
        'base',
      )
    })
    add(values, trace, 'impact', agent.stats.impact, 'character:impact', 'base')
    add(
      values,
      trace,
      'anomalyMastery',
      agent.stats.anomalyMastery,
      'character:anomalyMastery',
      'base',
    )
    add(
      values,
      trace,
      'anomalyProficiency',
      agent.stats.anomalyProficiency,
      'character:anomalyProficiency',
      'base',
    )
    add(values, trace, 'energyRegen', agent.stats.energyRegen, 'character:energyRegen', 'base')
    const core = agent.core[input.core]!
    if (core.hp) add(values, trace, 'hp', core.hp, 'character:coreStats.hp', 'base')
    if (core.atk) add(values, trace, 'atk', core.atk, 'character:coreStats.atk', 'base')
    if (core.atkPercent)
      add(percent, trace, 'atk', core.atkPercent, 'character:coreStats.atk_', 'percent')
    if (core.critRate)
      add(postFlat, trace, 'critRate', core.critRate, 'character:coreStats.crit_', 'post_flat')
    if (core.critDamage)
      add(
        postFlat,
        trace,
        'critDamage',
        core.critDamage,
        'character:coreStats.crit_dmg_',
        'post_flat',
      )
    if (core.hpPercent)
      add(percent, trace, 'hp', core.hpPercent, 'character:coreStats.hp_', 'percent')
    if (core.energyRegenFlat)
      add(
        postFlat,
        trace,
        'energyRegen',
        core.energyRegenFlat,
        'character:coreStats.enerRegen',
        'post_flat',
      )
    if (core.energyRegenPercent)
      add(
        percent,
        trace,
        'energyRegen',
        core.energyRegenPercent,
        'character:coreStats.enerRegen_',
        'percent',
      )
    if (core.anomalyMastery)
      add(
        postFlat,
        trace,
        'anomalyMastery',
        core.anomalyMastery,
        'character:coreStats.anomMas',
        'post_flat',
      )
    if (core.anomalyMasteryPercent)
      add(
        percent,
        trace,
        'anomalyMastery',
        core.anomalyMasteryPercent,
        'character:coreStats.anomMas_',
        'percent',
      )
    if (core.anomalyProficiency)
      add(
        postFlat,
        trace,
        'anomalyProficiency',
        core.anomalyProficiency,
        'character:coreStats.anomProf',
        'post_flat',
      )
    if (core.impact)
      add(postFlat, trace, 'impact', core.impact, 'character:coreStats.impact', 'post_flat')
    if (core.impactPercent)
      add(percent, trace, 'impact', core.impactPercent, 'character:coreStats.impact_', 'percent')
    if (core.penRatio)
      add(postFlat, trace, 'penRatio', core.penRatio, 'character:coreStats.pen_', 'post_flat')
  } else {
    for (const key of outOfCombatKeys)
      add(values, trace, key, agent.values[key], `game-menu:${agent.evidence}:base`, 'base')
    if (input.mindscape !== agent.mindscape)
      trace.push({
        key: 'atk',
        source: 'character:mindscape:registered-mechanics-only',
        operation: 'inactive',
        value: `M${input.mindscape} 与观测锚点 M${agent.mindscape} 不同；当前登记影画仅含战斗机制字段，未登记局外静态属性变化。`,
      })
  }

  add(values, trace, 'atk', engine.atkBase, `wengine:${engine.evidence}:lv60_base`, 'base')
  add(
    engine.secondary.operation === 'percent' ? percent : postFlat,
    trace,
    engine.secondary.key,
    engine.secondary.value,
    `wengine:${engine.evidence}:lv60_second_stat`,
    engine.secondary.operation,
  )

  for (const disc of input.discs) {
    const main = resolveDriveDiscMainStatValue(disc)
    if (!main) return unsupported(`驱动盘 ${disc.id} 的主词条规则缺失。`)
    const mainFlat = flatStatMap[main.stat]
    const mainPercent = percentStatMap[main.stat]
    if (mainFlat) add(postFlat, trace, mainFlat, main.value, `disc:${disc.id}:main`, 'post_flat')
    if (mainPercent) add(percent, trace, mainPercent, main.value, `disc:${disc.id}:main`, 'percent')
    for (const subStat of disc.subStats) {
      const subFlat = flatStatMap[subStat.stat]
      const subPercent = percentStatMap[subStat.stat]
      if (subFlat) add(postFlat, trace, subFlat, subStat.value, `disc:${disc.id}:sub`, 'post_flat')
      if (subPercent)
        add(percent, trace, subPercent, subStat.value, `disc:${disc.id}:sub`, 'percent')
    }
  }

  const setCounts = new Map<string, number>()
  for (const disc of input.discs) setCounts.set(disc.setId, (setCounts.get(disc.setId) ?? 0) + 1)
  for (const [setId, count] of setCounts) {
    if (count < 2) continue
    if (!getCurrentDriveDiscFormulaData(setId))
      return unsupported(`驱动盘套装 ${setId} 缺少二件套来源，无法投影局外面板。`)
    for (const modifier of resolveCurrentDriveDiscTwoPieceModifiers(setId, count)) {
      const percentKey = twoPiecePercentPanelKey[modifier.stat]
      if (percentKey) {
        add(
          percent,
          trace,
          percentKey,
          modifier.value * 100,
          `set:${setId}:2pc source-catalog`,
          'percent',
        )
        continue
      }
      const postFlatKey = twoPiecePostFlatPanelKey[modifier.stat]
      if (postFlatKey) {
        add(
          postFlat,
          trace,
          postFlatKey,
          modifier.stat === 'anomProf' ? modifier.value : modifier.value * 100,
          `set:${setId}:2pc source-catalog`,
          'post_flat',
        )
        continue
      }
      if (!knownNonPanelTwoPieceStats.has(modifier.stat))
        return unsupported(`驱动盘套装 ${setId} 的二件套字段 ${modifier.stat} 尚未支持。`)
      trace.push({
        key: 'atk',
        source: `set:${setId}:2pc source-catalog`,
        operation: 'inactive',
        value: `${modifier.stat} 是已知但不属于局外面板字段的二件套效果；未在此处折算为通用攻击。`,
      })
    }
  }

  ;(['hp', 'atk', 'def', 'impact', 'anomalyMastery', 'energyRegen'] as const).forEach((key) => {
    values[key] = values[key] * (1 + percent[key] / 100) + postFlat[key]
    trace.push({ key, source: 'base×percent+post_flat', operation: 'final', value: values[key] })
  })
  for (const key of outOfCombatKeys.filter(
    (key) => !['hp', 'atk', 'def', 'impact', 'anomalyMastery', 'energyRegen'].includes(key),
  )) {
    values[key] += postFlat[key]
    trace.push({ key, source: 'base+post_flat', operation: 'final', value: values[key] })
  }
  trace.push({
    key: 'atk',
    source: '4pc/conditional passive',
    operation: 'inactive',
    value: 'not selected for out-of-combat projection',
  })

  return { status: 'ok', values, trace, menuRounding: 'menu_rule_missing' }
}
