import type { AgentProfileField } from './agentProfileFieldProjection'
import type {
  CandidateWarehouseConstraint33,
  GameData33BuildGuidance,
} from './gameData33BuildGuidance'
import { stableContentHash } from '../domain/stableContentHash'
import {
  getCurrentAgentNumericContract,
  isReviewedPhoenixNumericContract,
  isReviewedSeverianNumericContract,
  resolveCurrentAgentInitialNumericPassive,
} from '../calculation/currentAgentNumericContracts'
import { getPhoenixAscensionMaterialFacts33 } from '../calculation/phoenixAscensionMaterials33'
import { getSeverianAscensionMaterialFacts33 } from '../calculation/severianAscensionMaterials33'
import {
  gameData33OfficialPhaseOneUrl,
  gameData33OfficialPhaseTwoUrl,
  gameData33SourceDeltaSha256,
} from './gameData33CatalogEntities'
import {
  decodePhoenixSkillPriority33,
  decodeSeverianSkillPriority33,
} from './gameData33BuildStatMapping'
import {
  conditions,
  gameData33BuildSources,
  getPhoenixFormedReference33,
  getPhoenixInitialMasteryReference33,
  getSeverianFormedReference33,
  phoenixBuildGuidanceData33 as raw,
  phoenixBuildGuidanceSource33,
  providerManifestSha256,
  severianBuildGuidanceData33 as severianRaw,
  severianBuildGuidanceSource33,
  severianConditions,
  severianSourceSha256,
  sourceSha256,
  type SourceSelection,
} from './gameData33BuildGuidanceSources'

export function projectGameData33BuildGuidanceFields(
  agentId: string,
  guidance: GameData33BuildGuidance,
  constraint: CandidateWarehouseConstraint33,
  selection?: SourceSelection,
): AgentProfileField[] {
  const isSeverian = agentId === severianRaw.agentId
  const source = isSeverian
    ? gameData33BuildSources.severianInGame33
    : gameData33BuildSources.phoenixInGame33
  const common = {
    group: 'build_guidance' as const,
    status: 'candidate' as const,
    gameVersion: '3.3',
    originalSourceVersion: '3.3',
    lastChangeVersion: '3.3',
    currentApplicability: 'continuous' as const,
    sourceRefs: [{ ...source }],
    verifiedAt: source.checkedAt,
    conflict: null,
    conditions: [...guidance.conditions],
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
      reason: isSeverian
        ? '按来源件数消费主副套，并保留替代套装分支。'
        : '按来源件数消费主副套，并保留替代4件分支。',
    },
    {
      ...common,
      path: 'build.main_sub_stats',
      value: { mainStats: [...guidance.mainStatLines], subStats: [...guidance.subStatLines] },
      reason: '按属性合法主词落位，来源优先字段名不作为盘位。',
    },
    {
      ...common,
      path: 'build.team_bangboo_scenario',
      value: [...guidance.teamAndBangbooPreconditions],
      reason: isSeverian
        ? '保留追加能力条件；未有经过复核的三人攻略来源时不伪造默认队伍，邦布由玩家选择。'
        : '保留追加能力条件；具名社区三人参考在独立来源字段中，邦布由玩家选择。',
    },
    {
      ...common,
      path: 'build.progression',
      value: [...guidance.progressionDirections],
      reason: '来源技能优先组与Owner成型参考分别保存，不推断组内顺序。',
    },
  ]
  if (isSeverian) {
    const resolvedSelection = selection ?? severianBuildGuidanceSource33
    fields.push({
      ...common,
      path: 'progression.skill_core_cinema',
      value: {
        kind: 'current_skill_core_cinema',
        skillPriority: {
          groups: decodeSeverianSkillPriority33(severianRaw.rawRecommendation.skillPriorityGroups),
          globalOrderClaimed: false,
        },
        cinema: {
          recommendedLevels: [1],
          notableLevels: severianRaw.mindscapeBranches.map((branch) => ({
            level: branch.level,
            selectedForGenericReference: branch.selectedForGenericReference,
          })),
          pullOrder: null,
          status: 'key_levels_only',
        },
        formedReference: getSeverianFormedReference33(resolvedSelection),
      },
      reason: 'Owner有界复核选M1，M2保留不同条件分支，不宣称精确抽取收益。',
    })
    const numeric = getCurrentAgentNumericContract(agentId)
    const materials = getSeverianAscensionMaterialFacts33()
    if (
      numeric &&
      isReviewedSeverianNumericContract(numeric) &&
      numeric.source.provider === 'nanoka'
    ) {
      const promotion = numeric.promotionStats[5]
      const coreF = numeric.coreStats[5]
      const coreFCritDamage = coreF && 'crit_dmg_' in coreF ? (coreF.crit_dmg_ ?? 0) : 0
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
              critDamage: 'crit_dmg_' in row ? (row.crit_dmg_ ?? 0) * 100 : 0,
            })),
            factRepresentation: 'current_panel_growth_projection',
            completion: 'static_panel_and_ascension_material_facts_known',
            ascensionMaterials: materials,
            levelExperience: materials.levelExperience,
            source: {
              id: 'nanoka-3.3-character-1631:numeric-and-ascension',
              sourceVersion: '3.3',
              evaluatedForVersion: '3.3',
              contentHash: numeric.source.rawSha256,
              providerManifestSha256: numeric.source.providerManifestSha256,
            },
          },
          status: 'verified_candidate',
          conditions: [
            ...severianConditions,
            'LV60/A5静态成长与五次突破材料按同一1631原件逐行采用；当前等级、突破与材料持有量来自账户。',
            '逐级经验需求与突破成本分开保存；未换算经验道具，不包含技能、核心、音擎或完整培养总成本。',
          ],
          reason: '锁定Nanoka原件、provider与1631数值身份共同验证五次突破；不复用其他角色材料。',
        })
      const ref = severianRaw.additionalAbilityCritCapReference
      if (coreF && Math.abs(coreFCritDamage * 100 - ref.coreFCritDamagePercent) < 1e-6)
        fields.push({
          ...common,
          path: 'build.target_panel',
          value: {
            kind: 'mechanical_additional_ability_crit_rate_cap',
            level: 60,
            ascension: 5,
            coreLevel: 7,
            targetSemantics: {
              kind: 'mechanical_cap_not_graduation_panel',
              stat: 'crit_rate',
              maximumCritRatePercent: ref.additionalAbility.maximumCritRatePercent,
              atkPerCritRatePercent: ref.additionalAbility.atkPerCritRatePercent,
              maximumBonusAtk: ref.additionalAbility.maximumBonusAtk,
              wholeBuildGraduationClaimed: false,
            },
            sourceNumericBaseAndCore: {
              baseCritRatePercent: ref.baseCritRatePercent,
              baseCritDamagePercent: ref.baseCritDamagePercent,
              coreFCritDamagePercent: ref.coreFCritDamagePercent,
              includesEquipment: false,
            },
            authorFinalPanelTargets: null,
            rankingReview: 'not_claimed',
          },
          displayValue: [
            '追加能力「最优编配」生效时，每 1% 暴击率提供 8.5 攻击力，按最高 100% 暴击率计入，最多 850 攻击力。',
            '裸装暴击率为 5%，核心技 F 的静态暴击伤害为 78.8%（50% 基础与 28.8% 成长）。',
          ],
          conditions: severianConditions,
          reason: '条件成立时的机制上限。完整培养目标仍待同装备、同打法的可追溯面板。',
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
          stableId: severianRaw.agentId,
          externalId: severianRaw.gameId,
          provider: 'nanoka',
          rawSha256: severianSourceSha256,
          providerManifestSha256,
          sourceDeltaSha256: gameData33SourceDeltaSha256,
          releaseState: 'released',
          releaseAt: '2026-11-11T12:00:00+08:00',
        },
        numericSourceComparison: null,
        adoptedBuildFields: fields.map((field) => ({
          fieldPath: field.path,
          sourceStatus: field.status,
          contentHash: stableContentHash(field),
        })),
        limitedCapabilityStatus: {
          sourceBoundNumericPanel: Boolean(numeric && isReviewedSeverianNumericContract(numeric)),
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
          id: 'official-3.3-phase-ii-2026-11-11',
          url: gameData33OfficialPhaseTwoUrl,
          sourceVersion: '3.3',
          checkedAt: severianRaw.source.checkedAt,
          contentHash: null,
          licenseBoundary: '官方仅核对下半发行身份，不代替Nanoka数值、战斗模型或媒体许可。',
        },
      ],
      conditions: [
        ...severianConditions,
        '3.3下半新代理人没有3.2同角色对照；只复核具名新来源与当前已采用字段，不宣称作者重排或伪造毕业数据。',
      ],
      reason: '已发布3.3下半新角色的来源与采用范围可核对；有限能力及未推导结论分别保留。',
    })
    return fields
  }
  const resolvedSelection = selection ?? phoenixBuildGuidanceSource33
  fields.push({
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
      formedReference: getPhoenixFormedReference33(resolvedSelection),
    },
    reason: 'Owner有界复核选M1，M2保留不同条件分支，不宣称精确抽取收益。',
  })
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
    const example = getPhoenixInitialMasteryReference33(undefined, resolvedSelection)
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
            atk: { requirement: 'required', boundary: 'minimum', observation: 'reference' },
            anomalyProficiency: {
              requirement: 'required',
              boundary: 'minimum',
              observation: 'reference',
            },
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
          authorFinalPanelTargets: {
            attack: { min: 2400, max: 2600, upperOpen: true },
            anomalyProficiency: { min: 330, max: 420, upperOpen: true },
            scope: 'level60_source_reference_not_full_graduation',
            observation: 'unspecified',
          },
          displayVariants: ['攻击力 2400–2600+', '异常精通 330–420+'],
          rankingReview: 'not_claimed',
        },
        displayValue: [
          '初始异常掌控255：灼蚀异常暴击率达到上限的机制门槛；瞬时增益不计入。',
          '核心7裸装异常精通203＝基础118＋无条件核心被动85；这是初始事实，不是装备后毕业目标。',
          '专属音擎60级、法厄同之歌2件与6号位异常掌控的具名静态示例为255.36；换配置须重新核对。',
          '攻击力2400–2600+、异常精通330–420+，仅供参考。',
        ],
        sourceRefs: [
          ...common.sourceRefs,
          {
            id: 'prydwen-phoenix-endgame-reference-3.3-20261031',
            url: 'https://www.prydwen.gg/zenless/characters/phoenix',
            sourceVersion: '3.3',
            checkedAt: '2026-10-31',
            contentHash: '8D111BF3FD8C5F37CC1D20E6C02173B894CCF7BCFCF2C0A41F714BBEFEE72A8C',
            licenseBoundary:
              '原页 L606–616；hash 为归档多页摘录文件而非网页全文，build update 标注 3.3。攻击与精通为作者参考区间，面板口径、影画与装备假设未明确。',
          },
          {
            id: 'nanoka-3.3-weapon-14164:static-anomaly-mastery',
            url: raw.initialMasteryReference.engine.url,
            sourceVersion: '3.3',
            checkedAt: raw.source.checkedAt,
            contentHash: raw.initialMasteryReference.engine.sha256,
            licenseBoundary: '具名静态音擎基础值与突破系数；不包含条件火伤或媒体再分发许可。',
          },
        ],
        conditions: [...conditions, '攻击力与异常精通区间仅供参考，不作为达标线。'],
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
