import { resolveDriveDiscMainStatValue, hasLegalSixDriveDiscs } from './outOfCombatDiscStats'
export { resolveDriveDiscMainStatValue, hasLegalSixDriveDiscs } from './outOfCombatDiscStats'
import type { DriveDisc, StatKey } from '../domain/schemas'
import {
  getCurrentDriveDiscFormulaData,
  resolveCurrentDriveDiscTwoPieceModifiers,
} from '../gameDataPacks/currentDriveDiscFormulaCatalog'
import { getCurrentWEngineStaticData } from '../gameDataPacks/currentWEngineStaticCatalog'
import {
  currentPanelData,
  resolveCurrentAgentCoreGrowth,
} from '../gameDataPacks/panel/currentPanelData'
import {
  currentFormulaBaseStats,
  currentFormulaBaseStatsSource,
} from '../gameDataPacks/currentFormulaBaseStats'
import {
  calculateWEngineBaseStatExact,
  calculateWEngineSecondaryStat,
} from '../gameDataPacks/panel/wEngineGrowth'
import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'
import { evaluateInitialCritConversion32 } from './currentInitialCritConversion32'
import {
  getReviewedAgentMenuBaseStats,
  getReviewedWEngineMenuBaseStat,
} from '../gameDataPacks/panel/reviewedMenuBaseStats'

export const outOfCombatKeys = [
  'hp',
  'atk',
  'def',
  'impact',
  'critRate',
  'critDamage',
  'lacerationDamage',
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
  /** Learned-growth row0..5 (A..F) maps to account core2..7.
   * Explicit -1 alone maps to account core1's source-proven zero enhancement;
   * missing/NaN never select this zero row. */
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

const defaultCritRate = currentFormulaBaseStats.critRate * 100
const defaultCritDamage = currentFormulaBaseStats.critDamage * 100
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
  return {
    ...emptyValues(),
    critRate: defaultCritRate,
    critDamage: defaultCritDamage,
    lacerationDamage: currentFormulaBaseStats.lacerationDamage * 100,
  }
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
    agent.kind === 'menu_observed' &&
    (input.level !== agent.level || input.ascension !== agent.ascension)
  ) {
    return unsupported('观测锚点仅登记了 60级/5突破的菜单观测值。')
  }
  if (!Number.isInteger(input.level) || input.level < 1 || input.level > 60) {
    return unsupported('代理人等级必须在 1 到 60 之间。')
  }
  if (!Number.isInteger(input.ascension) || input.ascension < 0 || input.ascension > 5) {
    return unsupported('代理人突破阶段必须在 0 到 5 之间。')
  }
  if (
    !Number.isInteger(input.wEngine.level) ||
    input.wEngine.level < 1 ||
    input.wEngine.level > 60
  ) {
    return unsupported('音擎等级必须在 1 到 60 之间。')
  }
  if (
    !Number.isInteger(input.wEngine.ascension) ||
    input.wEngine.ascension < 0 ||
    input.wEngine.ascension > 5
  ) {
    return unsupported('音擎突破阶段必须在 0 到 5 之间。')
  }
  if (
    !Number.isInteger(input.core) ||
    input.core < -1 ||
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

  const contract = agent.kind === 'growth' ? getCurrentAgentEventContract(input.agentId) : null
  const promotion = contract?.promotionStats[input.ascension] ?? { hp: 0, atk: 0, def: 0 }

  if (agent.kind === 'growth') {
    const publishedBase = getReviewedAgentMenuBaseStats(input.agentId, input.level, input.ascension)
    ;(['hp', 'atk', 'def'] as const).forEach((key) => {
      const [base, growth] = agent.stats[key]
      const promotionValue = promotion[key]
      add(
        values,
        trace,
        key,
        publishedBase?.values[key] ?? base + growth * (input.level - 1) + promotionValue,
        publishedBase
          ? `character:${input.agentId}:official-menu-base:${publishedBase.source.entryVersion}`
          : `character:${input.agentId}:base+growth+promotion`,
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
    const coreGrowth = resolveCurrentAgentCoreGrowth({
      agentId: input.agentId,
      coreLevel: input.core + 2,
      basis: 'source_growth',
    })
    if (coreGrowth.status === 'unsupported') return unsupported(coreGrowth.reason)
    const core = coreGrowth.values
    if (coreGrowth.kind === 'source_proven_zero_growth')
      trace.push({
        key: 'atk',
        source: 'character:source_proven_zero_growth:row0',
        operation: 'inactive',
        value: '明确核心1的来源零提升；不代表核心被动无效。',
      })
    // Source flat core growth belongs to the white base before equipment percentages.
    for (const [key, sourceKey, value] of [
      ['hp', 'hp', core.hp],
      ['atk', 'atk', core.atk],
      ['energyRegen', 'enerRegen', core.energyRegenFlat],
      ['anomalyMastery', 'anomMas', core.anomalyMastery],
      ['anomalyProficiency', 'anomProf', core.anomalyProficiency],
      ['impact', 'impact', core.impact],
    ] as const)
      if (value) add(values, trace, key, value, `character:coreStats.${sourceKey}`, 'base')
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
    if (core.energyRegenPercent)
      add(
        percent,
        trace,
        'energyRegen',
        core.energyRegenPercent,
        'character:coreStats.enerRegen_',
        'percent',
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
    if (core.impactPercent)
      add(percent, trace, 'impact', core.impactPercent, 'character:coreStats.impact_', 'percent')
    if (core.penRatio)
      add(postFlat, trace, 'penRatio', core.penRatio, 'character:coreStats.pen_', 'post_flat')
  } else {
    for (const key of outOfCombatKeys)
      if (key === 'lacerationDamage')
        add(
          values,
          trace,
          key,
          currentFormulaBaseStats.lacerationDamage * 100,
          currentFormulaBaseStatsSource.evidenceRef,
          'base',
        )
      else add(values, trace, key, agent.values[key], `game-menu:${agent.evidence}:base`, 'base')
    if (input.mindscape !== agent.mindscape)
      trace.push({
        key: 'atk',
        source: 'character:mindscape:registered-mechanics-only',
        operation: 'inactive',
        value: `M${input.mindscape} 与观测锚点 M${agent.mindscape} 不同；当前登记影画仅含战斗机制字段，未登记局外静态属性变化。`,
      })
  }

  const engineStatic = getCurrentWEngineStaticData(input.wEngine.id)
  const isLv60Engine = input.wEngine.level === 60 && input.wEngine.ascension === 5
  const baseKey = engine.baseStat?.key ?? 'atk'
  const publishedEngineBase = getReviewedWEngineMenuBaseStat(
    input.wEngine.id,
    input.wEngine.level,
    input.wEngine.ascension,
  )
  const baseValue =
    publishedEngineBase?.baseStat.key === baseKey
      ? publishedEngineBase.baseStat.value
      : agent.kind === 'menu_observed' && isLv60Engine
        ? (engine.baseStat?.value ?? engine.atkBase ?? 0)
        : engineStatic
          ? calculateWEngineBaseStatExact(
              engineStatic.staticStats.baseStat.value,
              input.wEngine.level,
              input.wEngine.ascension,
            )
          : (engine.baseStat?.value ?? engine.atkBase ?? 0)

  const secondaryValue = isLv60Engine
    ? engine.secondary.value
    : engineStatic
      ? engineStatic.staticStats.secondaryStatKey === 'anomProf'
        ? calculateWEngineSecondaryStat(
            engineStatic.staticStats.secondaryStatBaseValue,
            input.wEngine.level,
            input.wEngine.ascension,
          )
        : calculateWEngineSecondaryStat(
            engineStatic.staticStats.secondaryStatBaseValue,
            input.wEngine.level,
            input.wEngine.ascension,
          ) * 100
      : engine.secondary.value

  const engineEvidenceTag = isLv60Engine ? 'lv60' : `lv${input.wEngine.level}`
  add(
    values,
    trace,
    baseKey,
    baseValue,
    publishedEngineBase
      ? `wengine:${input.wEngine.id}:official-menu-base:${publishedEngineBase.source.entryVersion}`
      : `wengine:${engine.evidence}:${engineEvidenceTag}_base`,
    'base',
  )
  add(
    engine.secondary.operation === 'percent' ? percent : postFlat,
    trace,
    engine.secondary.key,
    secondaryValue,
    `wengine:${engine.evidence}:${engineEvidenceTag}_second_stat`,
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

  const initialCritConversion = evaluateInitialCritConversion32({
    agentId: input.agentId,
    initialStats: { crit_dmg_: (values.critDamage + postFlat.critDamage) / 100 },
  })
  if (initialCritConversion.status === 'unsupported')
    return unsupported(initialCritConversion.blockers.join('；'))
  if (initialCritConversion.critRate !== 0)
    add(
      postFlat,
      trace,
      'critRate',
      initialCritConversion.critRate * 100,
      initialCritConversion.sourceRefs.join('|'),
      'post_flat',
    )
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
