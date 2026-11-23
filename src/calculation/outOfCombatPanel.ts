import {
  flatStatMap,
  percentStatMap,
  knownNonPanelTwoPieceStats,
  twoPiecePercentPanelKey,
  twoPiecePostFlatPanelKey,
  emptyValues,
  initialValues,
  unsupported,
  add,
} from './outOfCombatPanelValues'
import { resolveDriveDiscMainStatValue, hasLegalSixDriveDiscs } from './outOfCombatDiscStats'
export { resolveDriveDiscMainStatValue, hasLegalSixDriveDiscs } from './outOfCombatDiscStats'
import {
  getCurrentDriveDiscFormulaData,
  resolveCurrentDriveDiscTwoPieceModifiers,
} from '../gameDataPacks/currentDriveDiscFormulaCatalog'
import { getCurrentWEngineStaticData } from '../gameDataPacks/currentWEngineStaticCatalog'
import { FIRST_PLUMAGE_STABLE_ID, resolveFirstPlumageInitialStats } from './reviewedWEngine33'
import {
  currentPanelData,
  getCurrentPanelGrowthAgent,
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
import {
  getCurrentAgentNumericContract,
  resolveCurrentAgentInitialNumericPassive,
} from './currentAgentNumericContracts'
import { validateOutOfCombatGrowth } from './outOfCombatGrowthValidation'
import { projectOutOfCombatInitialModifiers } from './outOfCombatInitialModifiers'
import { evaluateSourceBoundSheerForce32 } from './currentSourceBoundSheerForce32'
import { attributePanelKeys, type ExtendedPanelKey } from '../domain/characterPanelStats'
import {
  getReviewedAgentMenuBaseStats,
  getReviewedWEngineMenuBaseStat,
} from '../gameDataPacks/panel/reviewedMenuBaseStats'
import {
  outOfCombatKeys,
  type PanelInput,
  type PanelResult,
  type PanelTrace,
} from './outOfCombatPanelSupport'
import {
  getReviewedRuptureAdrenalineRegen,
  getReviewedRuptureResourceBaseline,
  reviewedAgentPanelBaseline32,
} from '../gameDataPacks/reviewedAgentPanelBaseline32'
import { projectReviewedClaretResourcePanel32 } from './reviewedClaretResourceEvents32'
export { outOfCombatKeys, projectPanelEngineSupport } from './outOfCombatPanelSupport'
export type {
  OutOfCombatKey,
  PanelInput,
  PanelTrace,
  PanelResult,
  PanelEngineSupport,
} from './outOfCombatPanelSupport'

/** Menu consumers share the arithmetic while normalizing only source white bases. */
export function projectOutOfCombatMenuPanel(input: PanelInput): PanelResult {
  return projectOutOfCombatPanel(input, 'menu_white_base')
}

export function projectOutOfCombatPanel(
  input: PanelInput,
  basis: 'source_precision' | 'menu_white_base' = 'source_precision',
): PanelResult {
  const reviewed = currentPanelData.agents[input.agentId]
  const agent =
    reviewed?.kind === 'menu_observed' &&
    (input.level !== reviewed.level ||
      input.ascension !== reviewed.ascension ||
      input.core !== reviewed.core)
      ? getCurrentPanelGrowthAgent(input.agentId)
      : reviewed
  const engine = currentPanelData.wEngines[input.wEngine.id]
  if (!agent || !engine) return unsupported('未知 agentId 或 engineId。')
  const growthError = validateOutOfCombatGrowth(input)
  if (growthError) return unsupported(growthError)
  if (
    !Number.isInteger(input.core) ||
    input.core < -1 ||
    (agent.kind === 'growth' && input.core >= agent.core.length) ||
    (agent.kind === 'menu_observed' && input.core !== agent.core) ||
    !Number.isInteger(input.wEngine.refinement) ||
    input.wEngine.refinement < 1 ||
    input.wEngine.refinement > 5 ||
    !hasLegalSixDriveDiscs(input.discs)
  )
    return unsupported('必须提供合法的六个唯一盘位、核心和改装。')

  const values = agent.kind === 'menu_observed' ? emptyValues() : initialValues()
  const percent = emptyValues()
  const postFlat = emptyValues()
  const trace: PanelTrace[] = []
  const damageBonuses = Object.fromEntries(
    Object.values(attributePanelKeys).map((key) => [key, 0]),
  ) as Record<(typeof attributePanelKeys)[keyof typeof attributePanelKeys], number>

  const contract = agent.kind === 'growth' ? getCurrentAgentNumericContract(input.agentId) : null
  const promotion = contract?.promotionStats[input.ascension] ?? { hp: 0, atk: 0, def: 0 }

  if (agent.kind === 'growth') {
    const publishedBase = getReviewedAgentMenuBaseStats(input.agentId, input.level, input.ascension)
    ;(['hp', 'atk', 'def'] as const).forEach((key) => {
      const [base, growth] = agent.stats[key]
      const promotionValue = promotion[key]
      const sourceBase = base + growth * (input.level - 1) + promotionValue
      add(
        values,
        trace,
        key,
        publishedBase?.values[key] ??
          (basis === 'menu_white_base' ? Math.floor(sourceBase) : sourceBase),
        publishedBase
          ? `character:${input.agentId}:official-menu-base:${publishedBase.source.entryVersion}`
          : `character:${input.agentId}:base+growth+promotion${basis === 'menu_white_base' ? ':menu-white' : ''}`,
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
    const initialPassive = resolveCurrentAgentInitialNumericPassive(input.agentId, input.core + 2)
    if (initialPassive.status === 'unsupported') return unsupported(initialPassive.reason)
    if (initialPassive.anomalyProficiency)
      add(
        postFlat,
        trace,
        'anomalyProficiency',
        initialPassive.anomalyProficiency,
        initialPassive.sourceRefs.join('|'),
        'post_flat',
      )
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
  if (input.wEngine.id === FIRST_PLUMAGE_STABLE_ID) {
    const initial = resolveFirstPlumageInitialStats({
      refinement: input.wEngine.refinement,
      specialtyMatches:
        getCurrentAgentNumericContract(input.agentId)?.identity.specialty ===
        engineStatic?.specialty,
    })
    if (initial.status !== 'supported') return unsupported(initial.blockers.join('；'))
    add(
      postFlat,
      trace,
      'anomalyProficiency',
      initial.anomalyProficiency,
      `wengine:${FIRST_PLUMAGE_STABLE_ID}:unconditional-ap`,
      'post_flat',
    )
  }
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
    basis === 'menu_white_base' ? Math.floor(baseValue) : baseValue,
    publishedEngineBase
      ? `wengine:${input.wEngine.id}:official-menu-base:${publishedEngineBase.source.entryVersion}`
      : `wengine:${engine.evidence}:${engineEvidenceTag}_base${basis === 'menu_white_base' ? ':menu-white' : ''}`,
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
    for (const [attribute, key] of Object.entries(attributePanelKeys)) {
      if (main.stat === `${attribute}_dmg`) {
        damageBonuses[key] += main.value
        trace.push({
          key,
          source: `disc:${disc.id}:main`,
          operation: 'post_flat',
          value: main.value,
        })
      }
    }
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
      const attributeEntry = Object.entries(attributePanelKeys).find(
        ([attribute]) => modifier.stat === `${attribute}_dmg_`,
      )
      if (attributeEntry) {
        const key = attributeEntry[1]
        damageBonuses[key] += modifier.value * 100
        trace.push({
          key,
          source: `set:${setId}:2pc source-catalog`,
          operation: 'post_flat',
          value: modifier.value * 100,
        })
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

  const initialModifiers = projectOutOfCombatInitialModifiers({
    agentId: input.agentId,
    potentialImage: input.potentialImage,
    critDamage: values.critDamage + postFlat.critDamage,
  })
  if (initialModifiers.status === 'unsupported') return unsupported(initialModifiers.reason)
  for (const modifier of initialModifiers.modifiers)
    add(postFlat, trace, modifier.key, modifier.value, modifier.source, 'post_flat')
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

  const extended: Partial<Record<ExtendedPanelKey, number>> = { ...damageBonuses }
  const adrenalineRegen = getReviewedRuptureAdrenalineRegen(input.agentId)
  if (adrenalineRegen !== undefined) {
    extended.adrenalineRegen = adrenalineRegen
    trace.push({
      key: 'adrenalineRegen',
      source: `character:${input.agentId}:reviewed-rupture-adrenaline-base-3.2-to-3.3`,
      operation: 'base',
      value: adrenalineRegen,
    })
  }
  const sharpnessPanel = projectReviewedClaretResourcePanel32(input.agentId)
  const resourceBaseline = getReviewedRuptureResourceBaseline(input.agentId)
  if (resourceBaseline) {
    extended.maxAdrenaline = resourceBaseline.base.maxAdrenaline
    trace.push({
      key: 'maxAdrenaline',
      operation: 'base',
      value: extended.maxAdrenaline,
      source: `${resourceBaseline.source.url}#${resourceBaseline.source.locator};sha256=${resourceBaseline.source.sha256}`,
    })
    if (
      'adrenalineGenerationRate' in resourceBaseline.base &&
      typeof resourceBaseline.base.adrenalineGenerationRate === 'number'
    ) {
      extended.adrenalineGenerationRate = resourceBaseline.base.adrenalineGenerationRate
      trace.push({
        key: 'adrenalineGenerationRate',
        operation: 'base',
        value: extended.adrenalineGenerationRate,
        source: 'miyoushe:73100348:image017:out-of-combat-base-reference',
      })
    }
  }
  if (sharpnessPanel)
    for (const key of ['sharpEnergyRegen', 'maxSharpEnergy'] as const) {
      extended[key] = sharpnessPanel[key]
      trace.push({
        key,
        source: sharpnessPanel.sources[key],
        operation: 'base',
        value: sharpnessPanel[key],
      })
    }
  const automaticEnergyRecovery =
    agent.kind === 'growth' ? agent.stats.energyRegen : agent.values.energyRegen
  if (automaticEnergyRecovery > 0) {
    extended.energyGenerationRate = reviewedAgentPanelBaseline32.normalEnergy.generationRate
    extended.maxEnergy = reviewedAgentPanelBaseline32.normalEnergy.maxEnergy
    trace.push(
      {
        key: 'energyGenerationRate',
        source: `${reviewedAgentPanelBaseline32.source.id}#${reviewedAgentPanelBaseline32.source.locator}`,
        operation: 'base',
        value: reviewedAgentPanelBaseline32.normalEnergy.generationRate,
      },
      {
        key: 'maxEnergy',
        source: `${reviewedAgentPanelBaseline32.source.id}#${reviewedAgentPanelBaseline32.source.locator}`,
        operation: 'base',
        value: reviewedAgentPanelBaseline32.normalEnergy.maxEnergy,
      },
    )
  }
  if (getCurrentAgentNumericContract(input.agentId)?.identity.specialty === 'rupture') {
    const initialStats = { atk: values.atk, hp: values.hp }
    const sheer = evaluateSourceBoundSheerForce32({
      agentId: input.agentId,
      level: input.level,
      coreLevel: input.core + 2,
      initialStats,
      finalStats: initialStats,
    })
    if (sheer.status === 'supported') {
      extended.sheerForce = sheer.sheerForce
      trace.push({
        key: 'sheerForce',
        source: sheer.sourceRefs.join('|'),
        operation: 'final',
        value: sheer.sheerForce,
      })
    }
  }
  return {
    status: 'ok',
    values: { ...values, ...extended },
    trace,
    menuRounding: 'menu_rule_missing',
  }
}
