import reviewedTargetPanelGuidanceData from './data/reviewed-target-panel-guidance.3.1.json'
import type { AgentProfileField } from './agentProfile'
import type {
  TargetPanelMetricKey,
  TargetPanelMetricSemantic,
  TargetPanelSemantics,
} from './targetPanelSemantics'
import { stableContentHash } from './types'

type TargetValue = number | { min: number; max?: number; upperOpen?: boolean } | { max: number }
type SourceEntry = (typeof reviewedTargetPanelGuidanceData.entries)[number]

const targetKeyBySourceLabel = {
  atk: 'atk',
  hp: 'hp',
  def: 'def',
  imp: 'impact',
  cr: 'critRate',
  cd: 'critDamage',
  ap: 'anomalyProficiency',
  am: 'anomalyMastery',
  er: 'energyRegen',
  pen: 'pen_ratio',
} as const

const sourceLabelByCode = {
  atk: 'ATK',
  hp: 'HP',
  def: 'DEF',
  imp: 'Impact',
  cr: 'Crit Rate',
  cd: 'Crit DMG',
  ap: 'Anomaly Proficiency',
  am: 'Anomaly Mastery',
  er: 'Energy Regen',
  pen: 'PEN Ratio',
  sf: 'Sheer Force',
} as const

const playerLabelBySourceLabel: Readonly<Record<string, string>> = {
  ATK: '攻击力',
  HP: '生命值',
  DEF: '防御力',
  Impact: '冲击力',
  'Crit Rate': '暴击率',
  'Crit DMG': '暴击伤害',
  'Anomaly Proficiency': '异常精通',
  'Anomaly Mastery': '异常掌控',
  'Energy Regen': '能量回复',
  'PEN Ratio': '穿透率',
  'Sheer Force': '贯穿力',
}

type SourceCode = keyof typeof sourceLabelByCode

const semanticKeyBySourceCode: Partial<Record<SourceCode, TargetPanelMetricKey>> = {
  atk: 'atk',
  hp: 'hp',
  def: 'def',
  imp: 'impact',
  cr: 'critRate',
  cd: 'critDamage',
  ap: 'anomalyProficiency',
  am: 'anomalyMastery',
  er: 'energyRegen',
  pen: 'penRatio',
}

/** Source-explicit combat observations; no combat conversion is inferred. */
const inCombatTargetCodesBySourceId: Readonly<Partial<Record<string, readonly SourceCode[]>>> = {
  'prydwen-banyue-2.4-2026-08-05': ['cr'],
  'prydwen-jane-current-2026-08-05': ['ap'],
  'prydwen-starlight-billy-2.8-2026-07-29': ['cr'],
}

const playerConditionsBySourceId: Readonly<Record<string, readonly string[]>> = {
  'prydwen-alice-current-2026-08-05': ['装备专属音擎时，战斗内异常掌控额外提高 60。'],
  'prydwen-anby-current-2026-08-05': ['若使用「山大王」，暴击率需达到 50%。'],
  'prydwen-astra-yao-current-2026-08-05': [
    '攻击力 3430 用于达到核心技的最高全队增益；能量回复范围取决于副词条、主词条和音擎。',
  ],
  'prydwen-banyue-2.4-2026-08-05': ['暴击率按战斗内数值计，包含驱动盘与专属音擎。'],
  'prydwen-burnice-current-2026-08-05': ['攻击力范围取决于音擎和驱动盘主词条。'],
  'prydwen-caesar-current-2026-08-05': [
    '冲击力最重要；异常流或暴击流任选其一，标注“可选”的属性不是通用要求。',
  ],
  'prydwen-cissia-2.7-2026-06-14': ['暴击率范围按装备专属音擎时计算。'],
  'prydwen-evelyn-current-2026-08-05': [
    '暴击率已包含核心被动；需先有 55% 的局外暴击率，叠加核心的 25% 后才能触发该能力。',
  ],
  'prydwen-harumasa-current-2026-08-05': ['暴击率上限为 75%。'],
  'prydwen-jane-current-2026-08-05': [
    '异常精通按战斗内数值计；达到 420 可触及激情提供的 600 点战斗内攻击力上限。',
  ],
  'prydwen-ju-fufu-current-2026-08-05': ['使用四件套「山大王」时，暴击率需达到 50%。'],
  'prydwen-koleda-current-2026-08-05': ['若使用「山大王」，暴击率需达到 50%。'],
  'prydwen-lighter-current-2026-08-05': ['若使用「山大王」，暴击率需达到 50%。'],
  'prydwen-lucia-2.3-2026-08-05': ['生命值区间内以 24000 为优先目标。'],
  'prydwen-lucy-current-2026-08-05': ['攻击力随特殊技等级变化，不能作为无条件攻击力目标。'],
  'prydwen-lycaon-current-2026-08-05': ['若使用「山大王」，暴击率需达到 50%。'],
  'prydwen-manato-2.3-2026-08-05': ['暴击率为战斗内 90–100%；暴击伤害按战斗前面板计。'],
  'prydwen-miyabi-current-2026-08-05': ['攻击力范围取决于驱动盘主词条。'],
  'prydwen-nicole-current-2026-08-05': ['攻击力和异常精通均为可选属性。'],
  'prydwen-orphie-magus-current-2026-08-05': ['暴击率已包含奥菲丝&「鬼火」的被动与驱动盘被动。'],
  'prydwen-pan-yinhu-current-2026-08-05': [
    '只要求攻击力达到 3000，不把伤害向的暴击属性作为必要目标。',
  ],
  'prydwen-promeia-2.8-2026-07-29': ['若使用异常精通主词条音擎，异常精通额外增加 90。'],
  'prydwen-pulchra-current-2026-08-05': ['冲击力最重要；异常流或暴击流任选其一。'],
  'prydwen-pyrois-3.0-2026-07-29': ['暴击率按角色特定被动与 1 影生效前的数值计。'],
  'prydwen-qingyi-current-2026-08-05': [
    '若使用「山大王」，暴击率需达到 50%；攻击力战斗内还会提高。',
  ],
  'prydwen-remielle-2026-07-29': [
    '攻击力超过 4000 不再带来明显伤害收益；异常精通范围取决于 4 号位与二件套选择。',
  ],
  'prydwen-rina-current-2026-08-05': [
    '核心技 6 级时，穿透率达到 72% 才能提供完整的 30% 全队增益。',
  ],
  'prydwen-seth-current-2026-08-05': ['护盾以初始攻击力 3750 为上限；此处为较高的硬目标。'],
  'prydwen-soldier-0-anby-current-2026-08-05': [
    '暴击率按额外能力与「影之和谐」之前计算；暴击伤害按核心被动之前计算。',
  ],
  'prydwen-soukaku-current-2026-08-05': ['攻击力随核心技等级变化，不能作为无条件攻击力目标。'],
  'prydwen-starlight-billy-2.8-2026-07-29': ['暴击率按战斗内数值计，包含驱动盘与专属音擎。'],
  'prydwen-sunna-2.6-2026-08-05': ['来源标明其他属性不相关。'],
  'prydwen-trigger-current-2026-08-05': ['冲击力最重要；装备专属音擎时能力的暴击率上限为 90%。'],
  'prydwen-vivian-current-2026-08-05': ['异常精通按战斗前面板计。'],
  'prydwen-yanagi-current-2026-08-05': ['攻击力范围取决于音擎。'],
  'prydwen-ye-shunguang-2.5-2026-08-05': ['状态面板中的暴击率上限为 50%。'],
  'prydwen-yidhari-2.3-2026-08-05': [
    '按战斗前面板计，且假设四件「云岿如我」提供 12% 暴击率、1 影「海妖摇篮」提供 20% 暴击率；战斗内暴击率为 90.6–97.2%。',
  ],
  'prydwen-yixuan-current-2026-08-05': ['暴击率已包含驱动盘。'],
  'prydwen-yuzuha-current-2026-08-05': [
    '攻击力低于 3000 时优先攻击力，其后优先异常精通；物理队与非物理队的暴击路线不同。',
  ],
  'prydwen-zhu-yuan-current-2026-08-05': [
    '额外能力生效时暴击率为 90–100%；有妮可 6 影时上限为 55%。暴击伤害按未使用「混沌重金属」计算。',
  ],
}

function isSourceCode(value: string): value is SourceCode {
  return Object.hasOwn(sourceLabelByCode, value)
}

function targetValue(text: string): TargetValue | undefined {
  if (text.includes(' max')) {
    const maximum = Number(text.match(/:(\d+(?:\.\d+)?)/)?.[1])
    return Number.isFinite(maximum) ? { max: maximum } : undefined
  }
  const match = text.match(/:(\d+(?:\.\d+)?)(?:-(\d+(?:\.\d+)?))?([+%]*)/)
  if (!match) return undefined
  const min = Number(match[1])
  const max = match[2] === undefined ? undefined : Number(match[2])
  const upperOpen = match[3].includes('+')
  if (max === undefined && !upperOpen) return min
  return { min, ...(max === undefined ? {} : { max }), ...(upperOpen ? { upperOpen: true } : {}) }
}

function sourceCode(stat: string): SourceCode {
  const code = stat.slice(0, stat.indexOf(':'))
  if (!isSourceCode(code)) throw new Error(`Unknown reviewed target-panel source code: ${code}`)
  return code
}

function sourceText(entry: SourceEntry) {
  return entry.s.map(
    (stat) => `${sourceLabelByCode[sourceCode(stat)]}: ${stat.slice(stat.indexOf(':') + 1)}`,
  )
}

function playerVariant(text: string) {
  const special = text.match(/^ATK (\d+) at Special Lv(\d+)$/)
  if (special) return `攻击力 ${special[1]}（特殊技 Lv.${special[2]} 时）`
  const core = text.match(/^ATK (\d+) at Core Passive Level (\d+)$/)
  if (core) return `攻击力 ${core[1]}（核心技 ${core[2]} 级时）`
  return '来源存在技能等级分支，当前不参与局外差距比较。'
}

function displaySourceStat(stat: string) {
  const code = sourceCode(stat)
  const label = playerLabelBySourceLabel[sourceLabelByCode[code]] ?? sourceLabelByCode[code]
  return `${label} ${stat.slice(stat.indexOf(':') + 1).replace(' optional', '（可选）')}`
}

function isValidTargetValue(value: TargetValue) {
  if (typeof value === 'number') return Number.isFinite(value)
  if ('max' in value && !('min' in value)) return Number.isFinite(value.max)
  return (
    Number.isFinite(value.min) &&
    (value.max === undefined || (Number.isFinite(value.max) && value.max >= value.min))
  )
}

function validateReviewedData() {
  const entries = reviewedTargetPanelGuidanceData.entries
  if (entries.length !== 57)
    throw new Error(`Expected 57 reviewed target panels, received ${entries.length}.`)
  const ids = new Set<string>()
  for (const entry of entries) {
    if (ids.has(entry.agentId))
      throw new Error(`Duplicate reviewed target-panel agent ID: ${entry.agentId}`)
    ids.add(entry.agentId)
    if (!entry.id || !entry.slug || !Array.isArray(entry.s) || entry.s.length === 0)
      throw new Error(`Incomplete reviewed target-panel entry: ${entry.agentId}`)
    if (entry.sv !== 'current' && !/^\d+\.\d+$/.test(entry.sv))
      throw new Error(`Invalid frozen source version for ${entry.agentId}: ${entry.sv}`)
    const url = new URL(`https://www.prydwen.gg/zenless/characters/${entry.slug}`)
    if (url.origin !== 'https://www.prydwen.gg' || !url.pathname.startsWith('/zenless/characters/'))
      throw new Error(`Invalid Prydwen source URL for ${entry.agentId}`)
    for (const stat of entry.s) {
      sourceCode(stat)
      const parsed = targetValue(stat)
      if (!parsed || !isValidTargetValue(parsed))
        throw new Error(
          `Unparseable or invalid reviewed target value for ${entry.agentId}: ${stat}`,
        )
    }
  }
}

validateReviewedData()

/**
 * Converts only reviewed, explicit Prydwen LEVEL 60 panel values to the
 * existing workbench target keys. `extraStats`/variants retain source facts
 * that have no consumer key or no unconditional lower-bound meaning.
 */
export function reviewedTargetPanelGuidance(agentId: string): AgentProfileField | undefined {
  const entry = reviewedTargetPanelGuidanceData.entries.find((item) => item.agentId === agentId)
  if (!entry) return undefined

  const panel: Record<string, TargetValue> = {}
  const targetSemantics: TargetPanelSemantics = {}
  const extraStats: Record<string, TargetValue | { value: TargetValue; unit: string }> = {}
  const optional = new Set<string>()
  for (const stat of entry.s) {
    const code = sourceCode(stat)
    const value = targetValue(stat)
    if (stat.includes(' optional')) optional.add(sourceLabelByCode[code])
    if (value === undefined)
      throw new Error(`Unparseable reviewed target value for ${entry.agentId}: ${stat}`)
    // Prydwen's percentage-form Energy Regen is not the workbench's
    // points/second `energyRegen` value. Keep it visible but non-comparable.
    if (code === 'er' && stat.includes('%')) {
      extraStats.energyRegenPercent = { value, unit: 'percent' }
      continue
    }
    if (code === 'sf') extraStats.sheerForce = value
    else {
      const targetKey = targetKeyBySourceLabel[code as keyof typeof targetKeyBySourceLabel]
      const semanticKey = semanticKeyBySourceCode[code]
      if (!targetKey || !semanticKey)
        throw new Error(`No workbench adapter key for ${entry.agentId}: ${code}`)
      panel[targetKey] = value
      targetSemantics[semanticKey] = {
        requirement: stat.includes(' optional') ? 'optional' : 'required',
        boundary:
          typeof value !== 'number' && 'max' in value && !('min' in value) ? 'cap' : 'minimum',
        observation: inCombatTargetCodesBySourceId[entry.id]?.includes(code)
          ? 'in_combat'
          : 'out_of_combat',
      } satisfies TargetPanelMetricSemantic
    }
  }

  const sourceConditions = [
    ...(entry.c ?? []),
    ...[...optional].map((label) => `${label} is explicitly optional in the source.`),
  ]
  const conditions = [
    ...(playerConditionsBySourceId[entry.id] ?? []),
    ...[...optional].map(
      (label) =>
        `${playerLabelBySourceLabel[label] ?? label} 为来源明确标注的可选属性，不参与局外差距比较。`,
    ),
    ...(Object.hasOwn(extraStats, 'sheerForce')
      ? [
          `另有 ${entry.s
            .filter((stat) => sourceCode(stat) === 'sf')
            .map(displaySourceStat)
            .join('、')} 属性目标；当前不参与局外差距比较。`,
        ]
      : []),
    ...(Object.hasOwn(extraStats, 'energyRegenPercent')
      ? [
          `另有 ${entry.s
            .filter((stat) => sourceCode(stat) === 'er' && stat.includes('%'))
            .map(displaySourceStat)
            .join('、')} 百分比目标；它不是当前面板的能量自动回复数值，不参与局外差距比较。`,
        ]
      : []),
    ...(entry.variants?.length
      ? [
          `攻击力按技能等级分支：${entry.variants.map(playerVariant).join('；')}；当前不参与局外差距比较。`,
        ]
      : []),
  ]
  const observedText = sourceText(entry)
  const sourceVersion = entry.sv === 'current' ? null : entry.sv
  const checkedAt = reviewedTargetPanelGuidanceData.reviewedAt
  const contentHash = stableContentHash({
    sourceId: entry.id,
    url: `https://www.prydwen.gg/zenless/characters/${entry.slug}`,
    lastUpdated: entry.updated ?? '19/August/2026',
    observedText,
    sourceConditions,
    variants: entry.variants ?? [],
  })
  const value = {
    ...panel,
    targetSemantics,
    ...(Object.keys(extraStats).length ? { extraStats } : {}),
    ...(entry.variants?.length
      ? { sourceVariants: entry.variants, displayVariants: entry.variants.map(playerVariant) }
      : {}),
    sourceMetadata: {
      sourceId: entry.id,
      frozenRegistrySourceVersion: entry.sv,
      pageLastUpdated: entry.updated ?? '19/August/2026',
      checkedAt,
      observedPayloadHash: contentHash,
      sourceConditions,
    },
  }

  return {
    group: 'build_guidance',
    path: 'build.target_panel',
    value,
    status: 'candidate',
    gameVersion: reviewedTargetPanelGuidanceData.reviewedForVersion,
    originalSourceVersion: sourceVersion,
    lastChangeVersion: null,
    currentApplicability: 'continuous',
    sourceRefs: [
      {
        id: entry.id,
        url: `https://www.prydwen.gg/zenless/characters/${entry.slug}`,
        sourceVersion,
        checkedAt,
        contentHash,
        licenseBoundary:
          'Public Prydwen rendered guide; citation-only numeric panel facts, no copied page prose or media.',
      },
    ],
    verifiedAt: checkedAt,
    conflict: null,
    reason: `已审阅 Prydwen BUILD 页 BEST ENDGAME STATS（LEVEL 60）数值面板；仅作 candidate 攻略参考，不进入 Formal 或账户计算。${entry.note ? ` ${entry.note}` : ''}`,
    ...(conditions.length ? { conditions } : {}),
  }
}
