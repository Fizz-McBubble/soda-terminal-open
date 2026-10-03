import {
  currentAgentEventContracts,
  getCurrentAgentEventContract,
} from '../../calculation/currentAgentMechanicContracts'
import { currentWEngineStaticCatalog } from '../currentWEngineStaticCatalog'
import { stableContentHash } from '../types'
import { currentCoreGrowthSource } from './currentCoreGrowthIdentity32'
export {
  currentCoreGrowthSource,
  currentCoreGrowthIdentity32,
  currentCoreGrowthHash32,
} from './currentCoreGrowthIdentity32'

/** MIT-derived current panel projection; see upstream/genshinOptimizer/NOTICE.md. */
export type CurrentPanelGrowthAgent = {
  kind: 'growth'
  level: number
  ascension: number
  stats: {
    hp: readonly [number, number, number]
    atk: readonly [number, number, number]
    def: readonly [number, number, number]
    impact: number
    anomalyMastery: number
    anomalyProficiency: number
    energyRegen: number
  }
  core: readonly Partial<{
    hp: number
    atk: number
    atkPercent: number
    hpPercent: number
    critRate: number
    critDamage: number
    anomalyMastery: number
    anomalyMasteryPercent: number
    anomalyProficiency: number
    impact: number
    impactPercent: number
    penRatio: number
    energyRegenPercent: number
    energyRegenFlat: number
  }>[]
}

/** A menu anchor is locked to observed progression; unknown tiers are never inferred. */
export type CurrentPanelObservedAgent = {
  kind: 'menu_observed'
  level: number
  ascension: number
  core: number
  mindscape: number
  values: {
    hp: number
    atk: number
    def: number
    impact: number
    critRate: number
    critDamage: number
    anomalyMastery: number
    anomalyProficiency: number
    pen: number
    penRatio: number
    energyRegen: number
  }
  evidence: 'user-game-menu-remielle-2026-08-25'
}

export type CurrentPanelAgent = CurrentPanelGrowthAgent | CurrentPanelObservedAgent
export type CurrentPanelWEngine = {
  kind: 'level60_static'
  level: 60
  ascension: 5
  baseStat: {
    key: 'atk' | 'def'
    value: number
  }
  /** @deprecated Deprecated attack-only view. Present ONLY on ATK-based W-Engines. */
  atkBase?: number
  secondary: {
    key:
      | 'hp'
      | 'atk'
      | 'def'
      | 'impact'
      | 'critRate'
      | 'critDamage'
      | 'anomalyMastery'
      | 'anomalyProficiency'
      | 'penRatio'
      | 'energyRegen'
    operation: 'percent' | 'post_flat'
    value: number
  }
  evidence: 'locked-upstream-level60-static'
}

type RawCoreStat = Partial<Record<string, number>>

function projectCoreStat(row: RawCoreStat): CurrentPanelGrowthAgent['core'][number] {
  return {
    ...(row.hp === undefined ? {} : { hp: row.hp }),
    ...(row.atk === undefined ? {} : { atk: row.atk }),
    ...(row.atk_ === undefined ? {} : { atkPercent: row.atk_ * 100 }),
    ...(row.hp_ === undefined ? {} : { hpPercent: row.hp_ * 100 }),
    ...(row.crit_ === undefined ? {} : { critRate: row.crit_ * 100 }),
    ...(row.crit_dmg_ === undefined ? {} : { critDamage: row.crit_dmg_ * 100 }),
    ...(row.anomMas === undefined ? {} : { anomalyMastery: row.anomMas }),
    ...(row.anomMas_ === undefined ? {} : { anomalyMasteryPercent: row.anomMas_ * 100 }),
    ...(row.anomProf === undefined ? {} : { anomalyProficiency: row.anomProf }),
    ...(row.impact === undefined ? {} : { impact: row.impact }),
    ...(row.impact_ === undefined ? {} : { impactPercent: row.impact_ * 100 }),
    ...(row.pen_ === undefined ? {} : { penRatio: row.pen_ * 100 }),
    ...(row.enerRegen_ === undefined ? {} : { energyRegenPercent: row.enerRegen_ * 100 }),
    ...(row.enerRegen === undefined ? {} : { energyRegenFlat: row.enerRegen }),
  }
}

const projectedAgents = Object.fromEntries(
  currentAgentEventContracts.map((agent) => {
    const promotion = agent.promotionStats[5]
    if (!promotion || agent.coreStats.length !== 6)
      throw new Error(`角色面板来源不完整：${agent.stableId}`)
    return [
      agent.stableId,
      {
        kind: 'growth' as const,
        level: 60,
        ascension: 5,
        stats: {
          hp: [agent.baseStats.hp_base, agent.baseStats.hp_growth, promotion.hp] as const,
          atk: [agent.baseStats.atk_base, agent.baseStats.atk_growth, promotion.atk] as const,
          def: [agent.baseStats.def_base, agent.baseStats.def_growth, promotion.def] as const,
          impact: agent.baseStats.impact,
          anomalyMastery: agent.baseStats.anomMas,
          anomalyProficiency: agent.baseStats.anomProf,
          energyRegen: agent.baseStats.enerRegen,
        },
        core: agent.coreStats.map((row) => projectCoreStat(row)),
      },
    ]
  }),
) satisfies Record<string, CurrentPanelGrowthAgent>

const coreSourceBindings = new Map(
  currentAgentEventContracts.map((actor) => [
    actor.stableId,
    {
      source: stableContentHash(actor.source),
      coreRows: stableContentHash(actor.coreStats),
    },
  ]),
)
const checkedCoreSources = new WeakMap<object, boolean>()

function matchesCoreSource(contract: (typeof currentAgentEventContracts)[number]) {
  const checked = checkedCoreSources.get(contract)
  if (checked !== undefined) return checked
  const binding = coreSourceBindings.get(contract.stableId)
  const matches =
    !!binding &&
    binding.source === stableContentHash(contract.source) &&
    binding.coreRows === stableContentHash(contract.coreStats)
  // Source catalog objects are static; input stats/levels are never cached.
  checkedCoreSources.set(contract, matches)
  return matches
}

/** Explicit account1 selects char/util's sourced zero growth row, not unknown.
 * Learned2..7 -> stored source row indices0..5 (A..F). char/util prepends its
 * own zero row, making these cumulative growth table entries1..6; do not sum
 * earlier entries. The menu anchor includes core and is never a growth addend. */
export function resolveCurrentAgentCoreGrowth(input: {
  agentId: string
  coreLevel: number
  basis: 'source_growth' | 'current_panel'
  observedContext?: { level: number; ascension: number; mindscape: number }
}) {
  const unsupported = (reason: string) => ({ status: 'unsupported' as const, reason })
  if (!Number.isInteger(input.coreLevel) || input.coreLevel < 1 || input.coreLevel > 7)
    return unsupported('来源核心成长需明确合法等级1至7；缺失、未知或非法值不能推定为来源零行。')
  const panel = currentPanelData.agents[input.agentId]
  if (input.basis === 'current_panel' && panel?.kind === 'menu_observed') {
    const observed = input.observedContext
    if (
      !observed ||
      observed.level !== panel.level ||
      observed.ascension !== panel.ascension ||
      observed.mindscape !== panel.mindscape ||
      input.coreLevel - 2 !== panel.core
    )
      return unsupported('观测锚的等级、突破、核心与影画上下文不匹配。')
    return {
      status: 'supported' as const,
      kind: 'menu_observed' as const,
      coreIncluded: true as const,
      values: {} as CurrentPanelGrowthAgent['core'][number],
      sourceRefs: [panel.evidence],
    }
  }
  const contract = getCurrentAgentEventContract(input.agentId)
  const growth = projectedAgents[input.agentId]
  const raw = contract?.coreStats[input.coreLevel - 2]
  if (
    !contract ||
    !growth ||
    (input.coreLevel !== 1 && !raw) ||
    !matchesCoreSource(contract) ||
    contract.source.commit !== currentCoreGrowthSource.commit ||
    contract.coreStats.length !== 6 ||
    contract.coreStats.some((row) => Object.values(row).some((value) => !Number.isFinite(value)))
  )
    return unsupported('未建立该主体的来源核心成长记录。')
  if (input.coreLevel === 1) {
    if (input.basis !== 'source_growth')
      return unsupported('当前菜单成长输入使用已学习行；来源零行须显式选择source_growth。')
    return {
      status: 'supported' as const,
      kind: 'source_proven_zero_growth' as const,
      coreIncluded: false as const,
      values: {} as CurrentPanelGrowthAgent['core'][number],
      learnedCoreLevel: null,
      sourceRow: 0,
      sourceRefs: [
        `${currentCoreGrowthSource.path}#${currentCoreGrowthSource.sha256}:402-409`,
        `${contract.source.statsPath}#${contract.source.statsSha256}`,
      ],
    }
  }
  return {
    status: 'supported' as const,
    kind: 'source_growth' as const,
    coreIncluded: false as const,
    values: growth.core[input.coreLevel - 2]!,
    learnedCoreLevel: input.coreLevel,
    sourceRow: input.coreLevel - 1,
    sourceRefs: [
      `${currentCoreGrowthSource.path}#${currentCoreGrowthSource.sha256}`,
      `${contract.source.statsPath}#${contract.source.statsSha256}`,
    ],
  }
}

const percentSecondaryKeys = new Set(['hp_', 'atk_', 'def_', 'impact_', 'anomMas_', 'enerRegen_'])
const secondaryKeyMap = {
  hp_: 'hp',
  atk_: 'atk',
  def_: 'def',
  impact_: 'impact',
  crit_: 'critRate',
  crit_dmg_: 'critDamage',
  anomMas_: 'anomalyMastery',
  anomProf: 'anomalyProficiency',
  pen_: 'penRatio',
  enerRegen_: 'energyRegen',
} as const

const projectedWEngines = Object.fromEntries(
  currentWEngineStaticCatalog.items.map((engine) => {
    const sourceKey = engine.staticStats.secondaryStatKey
    const percent = percentSecondaryKeys.has(sourceKey)
    const baseStat = engine.staticStats.level60BaseStat
    return [
      engine.stableId,
      {
        kind: 'level60_static' as const,
        level: 60 as const,
        ascension: 5 as const,
        baseStat: {
          key: baseStat.key,
          value: baseStat.value,
        },
        ...(baseStat.key === 'atk' ? { atkBase: baseStat.value } : {}),
        secondary: {
          key: secondaryKeyMap[sourceKey],
          operation: percent ? ('percent' as const) : ('post_flat' as const),
          value:
            sourceKey === 'anomProf'
              ? engine.staticStats.level60SecondaryValue
              : engine.staticStats.level60SecondaryValue * 100,
        },
        evidence: 'locked-upstream-level60-static' as const,
      },
    ]
  }),
) satisfies Record<string, CurrentPanelWEngine>

export const currentPanelData: {
  version: string
  agents: Record<string, CurrentPanelAgent>
  wEngines: Record<string, CurrentPanelWEngine>
} = {
  version: `${currentWEngineStaticCatalog.gameVersion}-current-projection`,
  agents: {
    ...projectedAgents,
    'agent-remielle': {
      kind: 'menu_observed',
      level: 60,
      ascension: 5,
      core: 5,
      mindscape: 2,
      values: {
        hp: 7482,
        atk: 823,
        def: 600,
        impact: 83,
        critRate: 5,
        critDamage: 50,
        anomalyMastery: 115,
        anomalyProficiency: 170,
        pen: 0,
        penRatio: 0,
        energyRegen: 1.2,
      },
      evidence: 'user-game-menu-remielle-2026-08-25',
    },
  },
  wEngines: projectedWEngines,
} as const
