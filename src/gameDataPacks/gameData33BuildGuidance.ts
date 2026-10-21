import raw from './data/reviewed-phoenix-build-guidance.3.3.json'
import type { AgentProfileField } from './agentProfileFieldProjection'
import type { GameData32BuildGuidance } from './gameData32BuildGuidance'
import type { CandidateWarehouseConstraint } from './candidateWarehouseConstraints'
import type { CandidateSetPlan } from './candidateSetPlans'
import type { StatKey } from '../domain/schemas'
import { stableContentHash } from '../domain/stableContentHash'
import {
  getCurrentAgentNumericContract,
  isReviewedPhoenixNumericContract,
  resolveCurrentAgentInitialNumericPassive,
} from '../calculation/currentAgentNumericContracts'
import { getPhoenixAscensionMaterialFacts33 } from '../calculation/phoenixAscensionMaterials33'
import {
  gameData33OfficialPhaseOneUrl,
  gameData33SourceDeltaSha256,
} from './gameData33CatalogEntities'

const sourceSha256 = '237C5B060657DB1FD8ABABE6CD26FB275C325D74A67EDA481BDE6732C7D93DFE'
const providerManifestSha256 = '4D30F529D6E0568A130EBE4D79557B30D9C65D2219E77461763DF1C4B42CB029'
const reviewedContentHash = 'fnv1a-8b50487a'
export const phoenixBuildGuidanceSource33 = Object.freeze({
  gameVersion: '3.3',
  sourceSha256,
  providerManifestSha256,
})
type SourceSelection = { gameVersion: string; sourceSha256: string; providerManifestSha256: string }
type SkillKey = 'core' | 'basic' | 'special' | 'chain' | 'assist' | 'dodge'
type MainStats = Partial<Record<'4' | '5' | '6', StatKey[]>>
export type GameData33BuildGuidance = Omit<GameData32BuildGuidance, 'gameVersion'> & {
  gameVersion: '3.3'
}
/** The Owner extends the existing consumer version union when integrating this candidate. */
export type CandidateWarehouseConstraint33 = Omit<CandidateWarehouseConstraint, 'gameVersion'> & {
  gameVersion: '3.3'
}

function sourceIsReviewed(input: SourceSelection) {
  return (
    input.gameVersion === '3.3' &&
    input.sourceSha256.toUpperCase() === sourceSha256 &&
    input.providerManifestSha256.toUpperCase() === providerManifestSha256 &&
    raw.source.sha256 === sourceSha256 &&
    raw.source.providerManifestSha256 === providerManifestSha256 &&
    raw.source.providerLiveVersion === '3.3' &&
    stableContentHash(raw) === reviewedContentHash
  )
}

export const gameData33BuildSources = Object.freeze({
  phoenixInGame33: {
    id: raw.id,
    url: raw.source.url,
    sourceVersion: '3.3',
    checkedAt: raw.source.checkedAt,
    contentHash: sourceSha256,
    verified: true,
    licenseBoundary:
      '锁定游戏内推荐的最小结构化事实与原件SHA；不分发原文或媒体，不作为全队DPS或Formal证明。',
  },
})

/** Mirrors the already adopted game enum in snapshotAgentSkills.ts, not export positions. */
const skillTypeToKey: Readonly<Partial<Record<number, SkillKey>>> = {
  0: 'basic',
  1: 'special',
  2: 'dodge',
  3: 'chain',
  5: 'core',
  6: 'assist',
}
export function decodePhoenixSkillPriority33(groups: readonly (readonly number[])[]) {
  if (!Array.isArray(groups) || groups.some((group) => !Array.isArray(group))) return null
  const ids = groups.flat()
  if (groups.length !== 3 || groups.some((group) => group.length !== 2) || new Set(ids).size !== 6)
    return null
  const mapped = groups.map((group) => group.map((id: number) => skillTypeToKey[id]))
  if (mapped.some((group) => group.some((key: SkillKey | undefined) => key === undefined)))
    return null
  return mapped as SkillKey[][]
}

/** Source part4/5/6 are priority labels. Physical slot legality determines the projection. */
export function mapPhoenixRecommendedMainStats33(props: readonly number[]): MainStats | null {
  const mapping: Readonly<Record<number, { stat: StatKey; slots: readonly ('4' | '5' | '6')[] }>> =
    {
      31402: { stat: 'anomaly_mastery', slots: ['6'] },
      31203: { stat: 'anomaly_proficiency', slots: ['4'] },
      31603: { stat: 'fire_dmg', slots: ['5'] },
      12102: { stat: 'atk_percent', slots: ['4', '5', '6'] },
    }
  const result: MainStats = {}
  for (const prop of props) {
    const entry = mapping[prop]
    if (!entry) return null
    for (const slot of entry.slots) {
      result[slot] ??= []
      if (!result[slot]!.includes(entry.stat)) result[slot]!.push(entry.stat)
    }
  }
  return ['4', '5', '6'].every((slot) => result[slot as '4' | '5' | '6']?.length) ? result : null
}

const conditions = [
  '游戏内slot4/slot2表示4件/2件套；part4/part5/part6按属性合法性映射，不作物理盘位。',
  '泛用成型采用Owner复核M1、Lv60、基础技能11、核心7及S音擎P1；A级队友按A6，均非账户观测。',
  '初始异常掌控255门槛仅在对应静态装备分支满足；瞬时增益不计入初始掌控。',
  'M1队伍异常暴伤需目标处于灼蚀；自身燔焰效率需燃烧攻击造成伤害，不默认全程覆盖。',
  'M2自身对灼蚀目标增伤及自身灼烧延长单列，不推算精确抽取收益或全队DPS。',
  '追加能力要求其他异常或同阵营队友；没有精确来源三人及邦布时不补默认队伍。',
]
const mainStatLines = [
  '4号位：异常精通；攻击力百分比为合法替代。',
  '5号位：火属性伤害；攻击力百分比为合法替代。',
  '6号位：异常掌控；攻击力百分比为合法替代，须重新核对初始掌控门槛。',
]
const progressionDirections = [
  '第一优先：核心技与普攻；第二优先：特殊技与连携技；第三优先：支援技与闪避；组内并列。',
  '泛用成型选择M1；M2保留为不同投资分支，不声明精确提升。',
  '无潜能条目，不补潜能6；实际账户等级、影画和技能由玩家数据决定。',
]

export function getGameData33BuildGuidance(
  agentId: string,
  selection: SourceSelection = phoenixBuildGuidanceSource33,
): GameData33BuildGuidance | undefined {
  if (agentId !== raw.agentId || !sourceIsReviewed(selection)) return undefined
  const mainStats = mapPhoenixRecommendedMainStats33([
    ...raw.rawRecommendation.priorityProps,
    raw.rawRecommendation.alternativeProp,
  ])
  if (!mainStats || !decodePhoenixSkillPriority33(raw.rawRecommendation.skillPriorityGroups))
    return undefined
  const setPlans: CandidateSetPlan[] = [
    {
      pattern: '4+2',
      primarySetIds: ['set-freedom-blues'],
      secondarySetIds: ['set-phaethons-melody'],
      purpose: 'recommended',
      sourceText: '游戏内推荐：自由蓝调4件＋法厄同之歌2件。',
    },
    {
      pattern: '4+2',
      primarySetIds: ['set-chaos-jazz'],
      secondarySetIds: ['set-phaethons-melody'],
      purpose: 'recommended',
      sourceText: '游戏内备选：混沌爵士4件＋法厄同之歌2件。',
    },
  ]
  return {
    agentId: raw.agentId,
    agentName: raw.playerName,
    gameVersion: '3.3',
    sourceKeys: ['phoenixInGame33'],
    wEngineIds: ['wengine-14164'],
    wEngineDirections: ['涅槃初翎：本轮具名S音擎P1成型参考；条件火伤不并入静态初始掌控。'],
    setDirections: setPlans.map((plan) => plan.sourceText!),
    setPlans,
    unresolvedSetDirections: [],
    mainStats,
    mainStatLines: [...mainStatLines],
    subStatPriorities: ['anomaly_proficiency', 'atk_percent'],
    subStatPriorityKind: 'unranked',
    subStatLines: ['副词条：异常精通与攻击力百分比；不由排列顺序生成伤害权重。'],
    teamAndBangbooPreconditions: [conditions[5]],
    progressionDirections: [...progressionDirections],
    conditions: [...conditions],
    fixedCycleStatus: 'qualitative_only',
    fixedCycleMissingFields: ['完整动作时序、资源闭环及效果覆盖未由游戏内推荐证明。'],
  }
}

/** Source-bound local reference for formedTeamCultivation; importing it activates nothing. */
export function getPhoenixFormedReference33(
  selection: SourceSelection = phoenixBuildGuidanceSource33,
) {
  if (!sourceIsReviewed(selection)) return null
  return {
    ...raw.formedReference,
    agentId: raw.agentId,
    gameVersion: '3.3' as const,
    mindscape: 1 as const,
    potential: null,
    source: { ...gameData33BuildSources.phoenixInGame33 },
    conditions: [...conditions],
    sourceContentHash: reviewedContentHash,
  }
}

/** Increment at the selected level, not cumulative replacement or an executed buff. */
export function getPhoenixMindscapeBranch33(
  level: number,
  selection: SourceSelection = phoenixBuildGuidanceSource33,
) {
  if (!sourceIsReviewed(selection)) return null
  const branch = raw.mindscapeBranches.find((entry) => entry.level === level)
  return branch ? structuredClone(branch) : null
}

/** A named static reference only; temporary AM cannot satisfy the initial-AM threshold. */
export function getPhoenixInitialMasteryReference33(
  input: { sixSlotMainStat: string; transientMasteryPercent?: number } = {
    sixSlotMainStat: 'anomaly_mastery',
  },
  selection: SourceSelection = phoenixBuildGuidanceSource33,
) {
  if (
    !sourceIsReviewed(selection) ||
    !['anomaly_mastery', 'atk_percent'].includes(input.sixSlotMainStat) ||
    (input.transientMasteryPercent !== undefined && input.transientMasteryPercent !== 0)
  )
    return null
  const facts = raw.initialMasteryReference
  const baseMastery = facts.baseMastery + facts.coreFMastery
  const enginePercent =
    (facts.engine.secondaryBaseGameValue / 10000) * (1 + facts.engine.ascensionRandRate / 10000)
  const sixSlotPercent =
    input.sixSlotMainStat === 'anomaly_mastery' ? facts.sixSlotSLevel15MasteryPercent : 0
  const initialMastery =
    baseMastery * (1 + enginePercent + facts.twoPieceMasteryPercent + sixSlotPercent)
  return {
    baseMastery,
    enginePercent,
    twoPiecePercent: facts.twoPieceMasteryPercent,
    sixSlotPercent,
    initialMastery,
    minimum: facts.minimumForScorchCritCap,
    thresholdMet: initialMastery >= facts.minimumForScorchCritCap,
    transientBuffsIncluded: false as const,
    sourceRefs: [
      { ...gameData33BuildSources.phoenixInGame33 },
      { url: facts.engine.url, contentHash: facts.engine.sha256, sourceVersion: '3.3' },
    ],
  }
}

export function getGameData33CandidateWarehouseConstraint(
  agentId: string,
  selection: SourceSelection = phoenixBuildGuidanceSource33,
): CandidateWarehouseConstraint33 | undefined {
  const guidance = getGameData33BuildGuidance(agentId, selection)
  if (!guidance) return undefined
  const first = guidance.setPlans[0]!
  const constraint: Omit<CandidateWarehouseConstraint33, 'contentHash'> = {
    agentId,
    agentName: guidance.agentName,
    gameVersion: '3.3',
    status: 'candidate',
    setPlanReadiness: {
      status: 'executable',
      pattern: first.pattern,
      primarySetIds: [...first.primarySetIds],
      secondarySetIds: [...first.secondarySetIds],
    },
    sources: [{ ...gameData33BuildSources.phoenixInGame33 }],
    setIds: [
      ...new Set(
        guidance.setPlans.flatMap((plan) => [...plan.primarySetIds, ...plan.secondarySetIds]),
      ),
    ],
    setPlans: structuredClone(guidance.setPlans) as CandidateSetPlan[],
    unresolvedSetDirections: [],
    mainStats: structuredClone(guidance.mainStats) as MainStats,
    subStatWeights: { anomaly_proficiency: 1, atk_percent: 1 },
    wEngineDirections: [...guidance.wEngineDirections],
    teamAndBangbooPreconditions: [...guidance.teamAndBangbooPreconditions, ...conditions],
    progressionDirection: [...progressionDirections],
    gaps: [],
    boundary:
      '3.3游戏内来源候选约束；有效副词条沿原计数政策记1，不外推毕业数值、DPS、全局最优或Formal。',
  }
  return { ...constraint, contentHash: stableContentHash(constraint) }
}

export function getGameData33BuildGuidanceFields(
  agentId: string,
  selection: SourceSelection = phoenixBuildGuidanceSource33,
): AgentProfileField[] {
  const guidance = getGameData33BuildGuidance(agentId, selection)
  const constraint = getGameData33CandidateWarehouseConstraint(agentId, selection)
  if (!guidance || !constraint) return []
  const common = {
    group: 'build_guidance' as const,
    status: 'candidate' as const,
    gameVersion: '3.3',
    originalSourceVersion: '3.3',
    lastChangeVersion: '3.3',
    currentApplicability: 'continuous' as const,
    sourceRefs: [{ ...gameData33BuildSources.phoenixInGame33 }],
    verifiedAt: raw.source.checkedAt,
    conflict: null,
    conditions: [...conditions],
  }
  const fields: AgentProfileField[] = [
    {
      ...common,
      path: 'build.wengines',
      value: [...guidance.wEngineDirections],
      reason: '本轮具名音擎参考，不伪造全局排序。',
    },
    {
      ...common,
      path: 'build.drive_disc_sets',
      value: constraint.setPlanReadiness,
      displayValue: [...guidance.setDirections],
      reason: '按来源件数消费主副套，并保留替代4件分支。',
    },
    {
      ...common,
      path: 'build.main_sub_stats',
      value: { mainStats: [...mainStatLines], subStats: [...guidance.subStatLines] },
      reason: '按属性合法主词落位，来源优先字段名不作为盘位。',
    },
    {
      ...common,
      path: 'build.team_bangboo_scenario',
      value: [...guidance.teamAndBangbooPreconditions],
      reason: '只保留追加能力条件，不补精确三人或邦布。',
    },
    {
      ...common,
      path: 'build.progression',
      value: [...progressionDirections],
      reason: '来源技能优先组与Owner成型参考分别保存，不推断组内顺序。',
    },
    {
      ...common,
      path: 'progression.skill_core_cinema',
      value: {
        kind: 'current_skill_core_cinema',
        skillPriority: {
          groups: decodePhoenixSkillPriority33(raw.rawRecommendation.skillPriorityGroups),
          globalOrderClaimed: false,
        },
        cinema: {
          recommendedLevels: [1],
          notableLevels: raw.mindscapeBranches.map((branch) => ({
            level: branch.level,
            selectedForGenericReference: branch.selectedForGenericReference,
          })),
          pullOrder: null,
          status: 'key_levels_only',
        },
        formedReference: getPhoenixFormedReference33(selection),
      },
      reason: 'Owner有界复核选M1，M2保留不同条件分支，不宣称精确抽取收益。',
    },
  ]
  const numeric = getCurrentAgentNumericContract(agentId)
  const materials = getPhoenixAscensionMaterialFacts33()
  if (
    numeric &&
    isReviewedPhoenixNumericContract(numeric) &&
    numeric.source.provider === 'nanoka'
  ) {
    const promotion = numeric.promotionStats[5]
    const coreF = numeric.coreStats[5]
    const coreFAnomalyMastery = coreF && 'anomMas' in coreF ? (coreF.anomMas ?? 0) : 0
    if (promotion && coreF && materials?.status === 'supported')
      fields.push({
        ...common,
        path: 'progression.lv60_and_ascension',
        value: {
          kind: 'current_level60_and_ascension_facts',
          level: 60,
          ascension: 5,
          stats: {
            hp: [numeric.baseStats.hp_base, numeric.baseStats.hp_growth, promotion.hp],
            atk: [numeric.baseStats.atk_base, numeric.baseStats.atk_growth, promotion.atk],
            def: [numeric.baseStats.def_base, numeric.baseStats.def_growth, promotion.def],
            impact: numeric.baseStats.impact,
            anomalyMastery: numeric.baseStats.anomMas,
            anomalyProficiency: numeric.baseStats.anomProf,
            energyRegen: numeric.baseStats.enerRegen,
          },
          core: numeric.coreStats.map((row) => ({
            atk: 'atk' in row ? (row.atk ?? 0) : 0,
            anomalyMastery: 'anomMas' in row ? (row.anomMas ?? 0) : 0,
          })),
          factRepresentation: 'current_panel_growth_projection',
          completion: 'static_panel_and_ascension_material_facts_known',
          ascensionMaterials: materials,
          levelExperience: materials.levelExperience,
          source: {
            id: 'nanoka-3.3-character-1641:numeric-and-ascension',
            sourceVersion: '3.3',
            evaluatedForVersion: '3.3',
            contentHash: numeric.source.rawSha256,
            providerManifestSha256: numeric.source.providerManifestSha256,
          },
        },
        status: 'verified_candidate',
        conditions: [
          ...conditions,
          'LV60/A5静态成长与五次突破材料按同一1641原件逐行采用；当前等级、突破与材料持有量来自账户。',
          '逐级经验需求与突破成本分开保存；未换算经验道具，不包含技能、核心、音擎或完整培养总成本。',
        ],
        reason: '锁定Nanoka原件、provider与1641数值身份共同验证五次突破；不复用其他角色材料。',
      })
    const passive = resolveCurrentAgentInitialNumericPassive(agentId, 7)
    const example = getPhoenixInitialMasteryReference33(undefined, selection)
    if (
      coreF &&
      passive.status === 'supported' &&
      example &&
      numeric.baseStats.anomMas === raw.initialMasteryReference.baseMastery &&
      coreFAnomalyMastery === raw.initialMasteryReference.coreFMastery
    )
      fields.push({
        ...common,
        path: 'build.target_panel',
        value: {
          kind: 'mechanical_initial_anomaly_mastery_cap',
          level: 60,
          ascension: 5,
          coreLevel: 7,
          targetSemantics: {
            kind: 'mechanical_cap_not_graduation_panel',
            stat: 'initial_anomaly_mastery',
            minimumForScorchCritCap: raw.initialMasteryReference.minimumForScorchCritCap,
            temporaryBuffsCount: false,
            wholeBuildGraduationClaimed: false,
          },
          sourceNumericBaseAndCore: {
            baseAnomalyMastery: numeric.baseStats.anomMas,
            coreFAnomalyMastery,
            baseAndCoreAnomalyMastery: numeric.baseStats.anomMas + coreFAnomalyMastery,
            baseAnomalyProficiency: numeric.baseStats.anomProf,
            unconditionalCorePassiveAnomalyProficiency: passive.anomalyProficiency,
            initialAnomalyProficiencyBeforeEquipment:
              numeric.baseStats.anomProf + passive.anomalyProficiency,
            includesEquipment: false,
          },
          namedStaticExample: example,
          authorFinalPanelTargets: { attack: null, anomalyProficiency: null },
          rankingReview: 'not_claimed',
        },
        displayValue: [
          '初始异常掌控255：灼蚀异常暴击率达到上限的机制门槛；瞬时增益不计入。',
          '核心7裸装异常精通203＝基础118＋无条件核心被动85；这是初始事实，不是装备后毕业目标。',
          '专属音擎60级、法厄同之歌2件与6号位异常掌控的具名静态示例为255.36；换配置须重新核对。',
        ],
        sourceRefs: [
          ...common.sourceRefs,
          {
            id: 'nanoka-3.3-weapon-14164:static-anomaly-mastery',
            url: raw.initialMasteryReference.engine.url,
            sourceVersion: '3.3',
            checkedAt: raw.source.checkedAt,
            contentHash: raw.initialMasteryReference.engine.sha256,
            licenseBoundary: '具名静态音擎基础值与突破系数；不包含条件火伤或媒体再分发许可。',
          },
        ],
        conditions: [
          ...conditions,
          '没有作者最终攻击力或异常精通目标；机械门槛不代表全配装毕业、伤害排序或DPS。',
        ],
        reason: '复用已绑定数值与初始被动，区分AM255机械上限、裸装基础事实和具名装备示例。',
      })
  }
  fields.push({
    ...common,
    path: 'build.version_change_impact',
    value: {
      baseVersion: null,
      targetVersion: '3.3',
      disposition: 'new_agent_current_fields_reviewed',
      sourceIdentity: {
        stableId: raw.agentId,
        externalId: raw.gameId,
        provider: 'nanoka',
        rawSha256: sourceSha256,
        providerManifestSha256,
        sourceDeltaSha256: gameData33SourceDeltaSha256,
        releaseState: 'released',
        releaseAt: '2026-10-21',
      },
      numericSourceComparison: null,
      adoptedBuildFields: fields.map((field) => ({
        fieldPath: field.path,
        sourceStatus: field.status,
        contentHash: stableContentHash(field),
      })),
      limitedCapabilityStatus: {
        sourceBoundNumericPanel: Boolean(numeric && isReviewedPhoenixNumericContract(numeric)),
        sourceSkillParameterAggregatesAreExecutableEvents: false,
        completeFixedCycleClaimed: false,
        exactDpsClaimed: false,
        accountObservationClaimed: false,
      },
      rankingReview: 'not_claimed',
      formalPromotion: false,
      importPromotion: false,
    },
    sourceRefs: [
      ...common.sourceRefs,
      {
        id: 'official-3.3-phase-i-2026-10-21',
        url: gameData33OfficialPhaseOneUrl,
        sourceVersion: '3.3',
        checkedAt: raw.source.checkedAt,
        contentHash: null,
        licenseBoundary: '官方仅核对发行身份，不代替Nanoka数值、战斗模型或媒体许可。',
      },
    ],
    conditions: [
      ...conditions,
      '3.3新代理人没有3.2同角色对照；只复核具名新来源与当前已采用字段，不宣称作者重排。',
    ],
    reason: '已发布3.3新角色的来源与采用范围可核对；有限能力及未推导结论分别保留。',
  })
  return fields
}
