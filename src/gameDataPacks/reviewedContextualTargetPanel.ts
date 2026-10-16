import mechanics from './generated/current-agent-decision-mechanic-catalog.v1.json'
import engines from './generated/current-wengine-static-catalog.v1.json'
import type { TargetPanelSemantics } from './targetPanelSemantics'
import {
  reviewedTemplateMechanicEffectBlueprints32,
  reviewedTemplateMechanicSource32,
} from '../calculation/reviewedTemplateMechanicEffects32'
import {
  createPlanningExpressionDomainRuntime,
  evaluateUpstreamExpressionIr,
  extractUpstreamEffectValueIr,
  type UpstreamExpressionIR,
} from '../calculation/currentUpstreamExpressionIR'

export type ReviewedTargetContext = {
  agentId: string
  coreLevel?: number | null
  specialLevel?: number | null
  engineId?: string | null
  engineRefinement?: number | null
  agentLevel?: number
  mindscape?: number | null
}

const sourceIds = {
  'agent-lucy': '1151',
  'agent-soukaku': '1131',
  'agent-roxy': '1621',
  'agent-astra': '1311',
  'agent-rina': '1211',
  'agent-pan-yinhu': '1421',
  'agent-yuzuha': '1411',
}
const sourceHashes = {
  'agent-lucy': '7B7964B69D7D18A4EAD0914B2DA83915EC4DE5BB795098F078EA9A381DE5B903',
  'agent-soukaku': '2BC7C02BCB4AA77F80E173A3D11B8371198E73D8024D3D98C8A31F5814D5D2CB',
  'agent-roxy': 'DFB173A363EFD3D9384AB3D53C543824B2B420ED14C67FD3039DC5F3C022D27D',
  'agent-astra': 'C56619ADA67799562AB8E48CB15419421B1C15DB7AE49E04C9E6D302802C5846',
  'agent-rina': '25E6A6BCB84531FF113484E1C16C2262B60D05A49D97FC51A6AA5158D98A4225',
  'agent-pan-yinhu': 'CF1E27AAA6504E5C4150961E397FE93DB293FCEA2D6AE2470A600217F00228B5',
  'agent-yuzuha': '61F637F03E82BCE0B22F1FE85D3EEB4BD9ACA00B0787C74137F3ED94737CA8F6',
} as const

/** Initial-stat preparation targets. Their attainment does not observe a combat trigger. */
export function reviewedContextualMechanicTargets(context: ReviewedTargetContext) {
  if (context.agentId === 'agent-sigrid') {
    const core = context.coreLevel
    if (typeof core !== 'number' || !Number.isInteger(core) || core < 1 || core > 7) return null
    const blueprint = reviewedTemplateMechanicEffectBlueprints32.find(
      (row) => row.effectKey === 'agent-sigrid:reviewed_aerial_patrol_crit32',
    )
    if (!blueprint) return null
    const ir = extractUpstreamEffectValueIr(
      blueprint.numericExpression.expressionIr as UpstreamExpressionIR,
    )
    if (ir.status !== 'supported') return null
    const result = evaluateUpstreamExpressionIr(
      ir.value as UpstreamExpressionIR,
      createPlanningExpressionDomainRuntime({
        references: { 'char.core': core - 1, sigridAerialPatrolCritWindow32: true },
      }),
    )
    if (result.status !== 'supported' || typeof result.value !== 'number') return null
    return {
      values: { critRate: 100 - result.value * 100 } as Record<string, number>,
      conditions: [
        `按当前核心技${core}级巡空枪势暴击增益计算初始满暴准备线；未预支其他音擎、盘套或队友暴击增益。`,
        '巡空枪势需要触发并保持对应状态；准备线不代表该战斗窗口正在生效。',
        '攻略33.8%仍为作者配装观测，满核心配合66%增益得到99.8%；机制数学满暴初始线为34%，不把两者混同。',
      ],
      configurationSources: [],
      sourceRef: {
        id: 'reviewed-contextual-target-agent-sigrid',
        url: `https://github.com/frzyc/genshin-optimizer/blob/${reviewedTemplateMechanicSource32.commit}/libs/zzz/dm-localization/assets/locales/en/char_Sigrid_gen.json`,
        sourceVersion: mechanics.gameVersion,
        checkedAt: '2026-10-16',
        contentHash: reviewedTemplateMechanicSource32.localizationHashes.Sigrid,
        licenseBoundary: 'MIT source-bound numeric skill facts; no assumed combat uptime.',
      },
    }
  }
  const id = context.agentId as keyof typeof sourceHashes
  const source = mechanics.formulaEffects.find((row) => row.externalId === sourceIds[id])
  if (!source || source.source.formulaSha256 !== sourceHashes[id]) return null
  const values: Record<string, number> = {}
  const conditions: string[] = []
  const configurationSources: {
    id: string
    url: string
    sourceVersion: string
    checkedAt: string
    contentHash: string
    licenseBoundary: string
  }[] = []
  const refs = source.runtimeDefaults.references as Record<string, unknown>
  const core = context.coreLevel
  const validCore = typeof core === 'number' && Number.isInteger(core) && core >= 1 && core <= 7
  if (id === 'agent-lucy') {
    const skill = context.specialLevel
    if (typeof skill !== 'number' || !Number.isInteger(skill) || skill < 1 || skill > 16)
      return null
    values.atk = (560 - 4 * skill) / (0.13 + 0.008 * skill)
    conditions.push(
      `按当前有效特殊技${skill}级计算600点全队攻击增益的精确初始攻击准备线；不对机制阈值取整。`,
      '加油增益由强化特殊技触发，影画2另支持连携或终结技触发；接受者为全队、邦布与亲卫队，不依赖核心技等级或追加能力队伍条件。',
      '机制准备线与攻略列出的整数配装观测分开保留；达标不证明加油窗口正在生效。',
    )
  } else if (id === 'agent-soukaku') {
    if (!validCore) return null
    const rate = (refs['dm.core.atk_'] as number[] | undefined)?.[core - 1]
    const cap = refs['dm.core.max_atk']
    if (typeof rate !== 'number' || rate <= 0 || typeof cap !== 'number') return null
    values.atk = cap / rate
    conditions.push(
      `按当前核心技${core}级计算初始攻击准备线；普通展旗上限500点攻击，消耗涡流时倍率与上限同时翻倍为1000，准备线相同。`,
      '攻击增益转交给展旗所触发快速支援或连携的接收者；不要求同冰属性或同阵营，额外冰增伤另按追加能力条件。',
      '机制准备线不取整，也不证明展旗、涡流消耗或增益转交已经发生。',
    )
  } else if (id === 'agent-yuzuha') {
    if (!validCore) return null
    values.atk = (refs['dm.core.max_atk'] as number[])[core - 1] / Number(refs['dm.core.atk'])
    conditions.push(
      `按当前核心技${core}级反解狸愿攻击增益上限的精确初始攻击准备线；不将满核心3000套用到低核心。`,
      '两种强化特殊技或终结技命中后给予全队40秒狸愿；攻击转化不要求追加能力队伍条件，额外异常掌控另按追加条件。',
      '先攻击后异常精通为攻略培养优先级；异常精通不是核心攻击转化的触发条件，准备线达标不证明狸愿窗口生效。',
    )
  } else if (id === 'agent-pan-yinhu') {
    if (
      !validCore ||
      !Number.isInteger(context.mindscape) ||
      context.mindscape! < 0 ||
      context.mindscape! > 6
    )
      return null
    const m6 = context.mindscape === 6
    const rate = (refs['dm.core.sheerForce'] as number[])[core - 1]
    values.atk =
      Number(refs[m6 ? 'dm.m6.max_sheerForce' : 'dm.core.max_sheerForce']) /
      (rate + (m6 ? Number(refs['dm.m6.sheerForce']) : 0))
    conditions.push(
      `按当前核心技${core}级与影画${context.mindscape}计算初始攻击准备线；影画6将转化比例加6个百分点、贯穿力上限由540提高至720。`,
      '强化特殊技命中触发快速支援后，随后经该快速支援或连携入场的代理人接收25秒贯穿力；不视为无条件全队增益。',
      '静听嘉音四件套与达标后优先回能保留为攻略配方条件，不是机制转化封顶的前提；准备线不证明转交窗口已激活。',
    )
  } else if (id === 'agent-astra') {
    if (
      !validCore ||
      !Number.isInteger(context.mindscape) ||
      context.mindscape! < 0 ||
      context.mindscape! > 6
    )
      return null
    const rate = (refs['dm.core.atk_'] as number[])[core - 1]
    const m2 = context.mindscape! >= 2
    values.atk =
      (Number(refs['dm.core.max_atk']) + (m2 ? Number(refs['dm.m2.max_increase']) : 0)) /
      (rate + (m2 ? Number(refs['dm.m2.atk_']) : 0))
    conditions.push(
      `按当前核心技${core}级及影画${context.mindscape}计算初始攻击准备线；影画2的19%为核心比例加法，上限同步由1200提高至1600。`,
      '咏叹华彩有效、通过快速支援或连携交接时给予耀嘉音与接收者攻击增益；准备线不证明窗口或转交已发生。',
      '攻略3430与既有整数候选3429/2963保留为配装观测；精确机制满档线使用实际核心与影画计算。',
    )
  } else if (id === 'agent-rina') {
    if (!validCore) return null
    const base = (refs['dm.core.pen_'] as number[])[core - 1]
    values.penRatio =
      ((Number(refs['dm.core.max_pen_']) - base) / Number(refs['dm.core.pen_scaling'])) * 100
    conditions.push(
      `按当前核心技${core}级反解穿透准备线，使用百分数单位；未预支额外战斗穿透增益，不能把满核心72%套给低核心。`,
      '玩偶在场时给其他队员提供穿透；影画1近距离同时放大增益与上限，因此不改变本准备线，但不假定玩偶或距离窗口常驻。',
      '攻略38%–72%是配装区间观测；各核心达到相应全队增益上限的机制准备线另行保留。',
    )
  } else {
    if (!validCore) return null
    const impactCap = (refs['dm.core.maxImpact'] as number[] | undefined)?.[core - 1]
    const damageCap = (refs['dm.core.max_crit_dmg_'] as number[] | undefined)?.[core - 1]
    const lacerationCap = (refs['dm.core.max_laceration_dmg_'] as number[] | undefined)?.[core - 1]
    if ([impactCap, damageCap, lacerationCap].some((value) => typeof value !== 'number'))
      return null
    // Raw sheet multiplies by 100 for each 0.01 initial ER; retain the mapped 0.01 unit.
    values.energyRegen =
      Number(refs['dm.core.initEnerRegen']) +
      (impactCap! * Number(refs['dm.core.enerRegenStep'])) / Number(refs['dm.core.impact'])
    const crit = Math.max(
      damageCap! / Number(refs['dm.core.crit_dmg_']),
      lacerationCap! / Number(refs['dm.core.laceration_dmg_']),
    )
    let engineCrit = 0
    if (context.engineId === 'wengine-14162') {
      const row = engines.items.find((row) => row.stableId === context.engineId)
      const parameter = row?.passiveParameterTable.find(
        (row) => row.refinement === context.engineRefinement,
      )
      if (!parameter) return null
      engineCrit = parameter.params[0] * 100
      configurationSources.push({
        id: 'reviewed-contextual-target-roxy-engine',
        url: `https://github.com/frzyc/genshin-optimizer/blob/${engines.generatedFrom.commit}/${row!.source.dataPath}`,
        sourceVersion: engines.gameVersion,
        checkedAt: '2026-10-16',
        contentHash: row!.source.dataSha256,
        licenseBoundary: 'MIT source numeric engine parameters only.',
      })
    }
    values.critRate = Math.max(0, crit - engineCrit)
    conditions.push(
      `按当前核心技${core}级核对回能转冲击满档与两类接受者的暴击转换准备线；不把满核心3.12套用到其他等级。`,
      context.engineId === 'wengine-14162'
        ? `绯月银棺${context.engineRefinement}阶提供${engineCrit}%战斗暴击，已从所需初始暴击中扣除一次；未预支其他队友或条件增益。`
        : '按未预支其他音擎或队友战斗暴击增益的配置计算初始暴击准备线；有额外增益时可进一步比较。',
      '暴伤增益仅给非锋御接受者，锐暴增益仅给锋御接受者；均需浸染或涤净对应属性及风属性窗口，不代表增益常驻。',
      '3.12是满核心冲击上限，攻略2.88+是常规四加二配装参考；无需把前者强制当成所有配装的硬毕业门。',
    )
  }
  return {
    values,
    conditions,
    configurationSources,
    sourceRef: {
      id: `reviewed-contextual-target-${id}`,
      url: `${source.source.repository}/blob/${source.source.commit}/${source.source.formulaPath}`,
      sourceVersion: mechanics.gameVersion,
      checkedAt: '2026-10-16',
      contentHash: source.source.formulaSha256,
      licenseBoundary:
        'MIT upstream numeric formula facts; source-bound initial-stat preparation only.',
    },
  }
}

type Target = {
  value: unknown
  conditions?: readonly string[]
  sourceRefs?: readonly { id: string }[]
}
export function resolveReviewedContextualTargetPanel<T extends Target | null>(
  panel: T,
  context: ReviewedTargetContext,
): T {
  if (!panel?.value || typeof panel.value !== 'object') return panel
  if (
    context.agentId === 'agent-claret' &&
    panel.sourceRefs?.some((ref) => ref.id === 'prydwen-original-claret32-endgame-20261011')
  ) {
    const conditions = [
      '作者60级培养参考：防御力2300–2600+；仅对照该攻略参考，不是机制满档线或全局最优。',
      context.engineId === 'wengine-14161'
        ? `当前使用猩红渴望${context.engineRefinement ?? '未记录'}阶；攻略128.9%暴击属于专武作者方案，不能不分精炼套用。`
        : '当前不是猩红渴望配置；攻略专武128.9%暴击不作为当前初始暴击目标。',
      `局内接近200%暴击的来源建议包含核心技${context.coreLevel ?? '未录入'}级对应战斗增益、音擎和实际队友增益；不能把200%当初始面板或自动假定增益生效。`,
      '初始暴伤按0.35转换为初始暴击；锐暴伤害不直接使用普通暴伤倍率。核心状态下的战斗暴击另算，不能重复算入初始面板。',
      ...(context.agentLevel !== undefined && context.agentLevel !== 60
        ? ['当前等级不同于作者60级参考，差值仅作培养方向，不作同条件装备收益。']
        : []),
    ]
    return {
      ...panel,
      value: {
        ...(panel.value as object),
        cultivationReference: { keys: ['def'], conditions, sourceVersion: '3.2', level: 60 },
      },
      conditions: [...new Set([...(panel.conditions ?? []), ...conditions])],
    } as T
  }
  const mechanic = reviewedContextualMechanicTargets(context)
  if (!mechanic) return panel
  const previous = panel.value as Record<string, unknown>
  const original = (previous.guideObservation ?? previous) as Record<string, unknown>
  const semantics: TargetPanelSemantics = { ...(original.targetSemantics as TargetPanelSemantics) }
  for (const key of Object.keys(mechanic.values) as (keyof TargetPanelSemantics)[])
    semantics[key] = {
      requirement:
        context.agentId === 'agent-roxy' && key === 'energyRegen' ? 'optional' : 'required',
      boundary: 'minimum',
      observation: 'out_of_combat',
    }
  return {
    ...panel,
    value: {
      ...original,
      ...mechanic.values,
      targetSemantics: semantics,
      contextualMechanicTargets: mechanic.values,
      guideObservation: original,
      guideConditions: previous.guideConditions ?? panel.conditions ?? [],
    },
    sourceRefs: [
      ...(panel.sourceRefs ?? []).filter(
        (ref) => !ref.id.startsWith('reviewed-contextual-target-'),
      ),
      mechanic.sourceRef,
      ...mechanic.configurationSources,
    ],
    conditions: [
      ...new Set([
        ...((previous.guideConditions as string[]) ?? panel.conditions ?? []),
        ...mechanic.conditions,
      ]),
    ],
  } as T
}
