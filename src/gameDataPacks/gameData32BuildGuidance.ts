import type { StatKey } from '../domain/schemas'
import type { AgentProfileField } from './agentProfileFieldProjection'
import type { CandidateSetPlan } from './candidateSetPlans'
import type { CandidateWarehouseConstraint } from './candidateWarehouseConstraints'

import { checkedAt, gameData32BuildSources } from './gameData32BuildSources'
export { gameData32BuildSources } from './gameData32BuildSources'
import { reviewedEndgamePanel32 } from './gameData32EndgamePanels'

export type GameData32BuildGuidance = {
  readonly agentId: string
  readonly agentName: string
  readonly gameVersion: '3.2'
  readonly sourceKeys: readonly string[]
  readonly wEngineIds: readonly string[]
  readonly wEngineDirections: readonly string[]
  readonly setDirections: readonly string[]
  readonly setPlans: readonly CandidateSetPlan[]
  readonly unresolvedSetDirections: readonly string[]
  readonly mainStats: Readonly<Partial<Record<'4' | '5' | '6', readonly StatKey[]>>>
  readonly mainStatLines: readonly string[]
  /** Never convert an unranked source list into numeric objective coefficients. */
  readonly subStatPriorities: readonly StatKey[]
  readonly subStatPriorityKind: 'ordered' | 'unranked'
  readonly subStatLines: readonly string[]
  readonly teamAndBangbooPreconditions: readonly string[]
  readonly progressionDirections: readonly string[]
  readonly conditions: readonly string[]
  readonly fixedCycleStatus: 'qualitative_only' | 'missing'
  readonly fixedCycleMissingFields: readonly string[]
}

const fixedCycleMissingFields = [
  '逐动作起止时间、帧数与帧率',
  '长按攻击的释放时点与各伤害命中时点',
  '全队初始能量、锋能、喧响、残痕及风之力',
  '逐动作资源获得、消费与触发间隔',
  '敌人异常与失衡阈值、抗性、基础失衡时间',
  '浸染、涤净、毁伤与增益覆盖的时间记录',
  '周期结束资源守恒及下一周期可重复性',
] as const

/** Sourced candidate guidance. No fabricated graduation panel or action duration. */
export const gameData32BuildGuidance: Readonly<Record<string, GameData32BuildGuidance>> =
  Object.freeze({
    'agent-koleda': {
      agentId: 'agent-koleda',
      agentName: '珂蕾妲',
      gameVersion: '3.2',
      sourceKeys: ['koledaGuide', 'koledaLiveBuild32'],
      wEngineIds: [
        'wengine-14110',
        'wengine-14116',
        'wengine-14157',
        'wengine-13006',
        'wengine-13005',
      ],
      wEngineDirections: [
        '燃狱齿轮（wengine-14110）：来源明确的冲击与强化特殊技方向。',
        '焰心桂冠（wengine-14116）：非锋御队的来源备选；首席跟班（wengine-14157）：锋御队的来源备选，需满足实际失衡需求。',
        '贵重骨核（wengine-13006）与人为刀俎（wengine-13005）：短战与回能条件不同，按实际精炼和队伍比较。',
      ],
      setDirections: [
        '山大王 4 件 + 震星迪斯科 2 件：强攻／命破队，需强化特殊技；连携技也可触发套装，效果窗口须另核。',
        '静听嘉音 4 件 + 山大王／月光骑士颂／震星迪斯科 2 件：锋御队，需团队快速支援。',
        '震星迪斯科 4 件 + 摇摆爵士 2 件：失衡与回能过渡方向。',
      ],
      setPlans: [
        {
          pattern: '4+2',
          primarySetIds: ['set-king-of-the-summit'],
          secondarySetIds: ['set-shockstar-disco'],
          purpose: 'conditional',
          sourceText:
            '强攻／命破队山大王4+震星2；来源强化特殊技场景，连携也可触发，覆盖未知不默认常驻。',
          condition: {
            sourceId: 'hoyobuild-koleda-current-build-20261020',
            sourceUrl: 'https://hoyobuild.com/en/zzz/characters/koleda',
            sourceVersion: '3.2',
            contentHash: 'ADB655BE1C8766DD98C63A2B0DB65797217472EFF605B070FD060A30970CE75B',
            sourceTextVerified: true,
            rule: {
              kind: 'teammate_specialty_and_action',
              specialties: ['attack', 'rupture'],
              action: 'wearer_ex_special',
            },
          },
        },
        {
          pattern: '4+2',
          primarySetIds: ['set-astral-voice'],
          secondarySetIds: [
            'set-king-of-the-summit',
            'set-moonlight-lullaby',
            'set-shockstar-disco',
          ],
          purpose: 'conditional',
          sourceText:
            '锋御队静听嘉音4件；团队快速支援与实际接受者必须另核，不自动获得三层常驻增伤。',
          condition: {
            sourceId: 'hoyobuild-koleda-current-build-20261020',
            sourceUrl: 'https://hoyobuild.com/en/zzz/characters/koleda',
            sourceVersion: '3.2',
            contentHash: 'ADB655BE1C8766DD98C63A2B0DB65797217472EFF605B070FD060A30970CE75B',
            sourceTextVerified: true,
            rule: {
              kind: 'teammate_specialty_and_action',
              specialties: ['armorer'],
              action: 'team_quick_assist',
            },
          },
        },
        {
          pattern: '4+2',
          primarySetIds: ['set-shockstar-disco'],
          secondarySetIds: ['set-swing-jazz'],
          purpose: 'transition',
          sourceText: '震星迪斯科4+摇摆爵士2，失衡与回能过渡。',
        },
      ],
      unresolvedSetDirections: [],
      mainStats: {
        '4': ['crit_rate', 'crit_dmg'],
        '5': ['fire_dmg', 'atk_percent'],
        '6': ['impact'],
      },
      mainStatLines: [
        '4号位：暴击率／暴击伤害',
        '5号位：火属性伤害／攻击力百分比',
        '6号位：冲击力',
      ],
      subStatPriorities: ['crit_rate', 'crit_dmg', 'atk_percent', 'pen', 'atk_flat'],
      subStatPriorityKind: 'ordered',
      subStatLines: [
        '副词条：暴击率、暴击伤害、攻击力百分比、穿透值、固定攻击力；来源次序不转为伤害权重。',
      ],
      teamAndBangbooPreconditions: [
        '当前来源方向：克拉蕾／珂蕾妲／丽娜；仪玄／珂蕾妲／卢西娅；「11号」／珂蕾妲／露西。',
        '邦布随精确队伍核对额外能力；来源列举不成为自动默认。',
        '潜能对锋御与非锋御的增益接受者不同；使用实际潜能等级，不把满潜能增益自动给未解锁账户。',
      ],
      progressionDirections: [
        '核心技 > 特殊技 > 连携技 > 普通攻击 > 支援 > 闪避；来源优先级不替代账号实际技能等级。',
      ],
      conditions: [
        '山大王提供普通暴击伤害，不能当成锋御锐暴增益；静听嘉音按快速支援入场者及实际层数生效。',
        '达到50%暴击率只改变山大王追加团队暴伤档位；并非通用毕业门槛。',
        '3.2页面的明确构筑与已锁定机制交叉核对；不据此声明全队强度、全局最优或完整循环。',
      ],
      fixedCycleStatus: 'qualitative_only',
      fixedCycleMissingFields,
    },
    'agent-claret': {
      agentId: 'agent-claret',
      agentName: '克拉蕾',
      gameVersion: '3.2',
      sourceKeys: ['claretRelease', 'claretGuide', 'koledaGuide', 'claretRoxyBangbooReviewed'],
      wEngineIds: ['wengine-14161', 'wengine-13021', 'wengine-13017'],
      wEngineDirections: [
        '猩红渴望（wengine-14161）：专属锋御方向。',
        '血髓秘匣（wengine-13021）与喵运当头（wengine-13017）：来源讨论的替代方向，精炼与队伍增益影响比较。',
      ],
      setDirections: [
        '荆棘玫瑰 4 件 + 河豚电音 2 件：丽娜队的来源建议；不能无条件套用到减防队。',
        '荆棘玫瑰 4 件 + 啄木鸟电音 / 灵魂摇滚 / 雷暴重金属 / 折枝剑歌 2 件：来源列出的条件化替代。',
      ],
      setPlans: [
        {
          pattern: '4+2',
          primarySetIds: ['set-34200'],
          secondarySetIds: ['set-puffer-electro'],
          purpose: 'conditional',
          sourceText: '荆棘玫瑰 4 件 + 河豚电音 2 件；适用于丽娜队，减防队需重新比较。',
          condition: {
            sourceId: 'prydwen-original-claret32',
            sourceUrl: gameData32BuildSources.claretGuide!.url,
            sourceTextVerified: true,
            sourceVersion: '3.2',
            contentHash: gameData32BuildSources.claretGuide!.contentHash,
            rule: { kind: 'teammate', agentId: 'agent-rina' },
          },
        },
        {
          pattern: '4+2',
          primarySetIds: ['set-34200'],
          secondarySetIds: [
            'set-woodpecker-electro',
            'set-soul-rock',
            'set-thunder-metal',
            'set-branch-blade-song',
          ],
          purpose: 'recommended',
          sourceText: '荆棘玫瑰 4 件 + 来源明确列出的各 2 件替代；按队伍和词条比较。',
        },
      ],
      unresolvedSetDirections: [],
      mainStats: {
        '4': ['crit_rate'],
        '5': ['pen_ratio', 'electric_dmg', 'def_percent'],
        '6': ['def_percent'],
      },
      mainStatLines: [
        '4号位：暴击率',
        '5号位：穿透率优先，电属性伤害、防御力百分比为备选',
        '6号位：防御力百分比',
      ],
      subStatPriorities: ['crit_rate', 'def_percent', 'crit_dmg', 'pen', 'def_flat'],
      subStatPriorityKind: 'ordered',
      subStatLines: ['副词条：暴击率 > 防御力百分比 > 暴击伤害 > 穿透值 > 固定防御力'],
      teamAndBangbooPreconditions: [
        '追加能力需队友为击破、锋御或同属性；诺姆 / 珂蕾妲 + 丽娜是已读取独立攻略讨论的队伍方向。',
        '洛克茜与克拉蕾相互满足追加能力；该机制适配不代表来源已证明全局最优队伍。',
        '珂蕾妲潜能的锋御锐暴增益需采用正确潜能等级映射，不能把暴击伤害增益直接给锋御。',
        '六次毁伤定性顺序：预攒三层残痕及可用终结技，长特殊技 → 连携 → 普攻三段 → 连携 → 普攻三段 → 终结技 → 长特殊技。',
        '来源声称该顺序可置于十二秒基础失衡窗口，未提供完整动作时间与资源表；不得包装成精确固定轴。',
        '邦布来源候选：ZZZ.gg在克拉蕾 + 洛克茜 + 丽娜队列出超极杰克；仅用于该三人场景，需另行核对阵营额外能力，不设自动默认或全局最优。',
      ],
      progressionDirections: [
        '核心技与特殊技优先，再比较连携、普通攻击与支援；这是来源养成方向，不是自动指定技能等级。',
      ],
      conditions: [
        '锐化伤害按防御力计算，普通攻击力词条不能沿用传统强攻收益。',
        '初始暴击伤害以 0.35 系数转换为暴击率，锐暴伤害本身不使用普通暴击伤害加成。',
        '超过百分之百暴击率的二次锐暴判定可继续受益；满概率边界需合并实际核心、音擎与队伍条件。',
        '荆棘玫瑰初始防御 1000 / 1800 档位提供不同暴击率；属于套装触发条件，不是毕业面板。',
      ],
      fixedCycleStatus: 'qualitative_only',
      fixedCycleMissingFields,
    },
    'agent-roxy': {
      agentId: 'agent-roxy',
      agentName: '洛克茜',
      gameVersion: '3.2',
      sourceKeys: [
        'roxyRelease',
        'roxyGuide',
        'roxyAlternativesReviewed',
        'claretRoxyBangbooReviewed',
      ],
      wEngineIds: ['wengine-14162', 'wengine-13005', 'wengine-14110'],
      wEngineDirections: [
        '绯月银棺（wengine-14162）：专属击破方向。',
        '人为刀俎（wengine-13005，Steam Oven）满精：原攻略优先替代方向；需维持80点能量以发挥音擎效果。',
        '燃狱齿轮（wengine-14110）1阶：原攻略在此精炼下次于满精人为刀俎，强化特殊技后续叠层较迟；高精炼需另行比较。',
        '以上比较来源为洛克茜 + 猩红渴望克拉蕾 + 啜泣摇篮丽娜的作者场景；不把该顺序外推为所有队伍、精炼或正式最优。',
      ],
      setDirections: [
        '强攻 / 命破队：山大王 4 件 + 月光骑士颂 / 摇摆爵士 2 件；需强化特殊技触发套装效果。',
        '锋御队：静听嘉音 4 件 + 月光骑士颂 / 摇摆爵士 2 件；需要支援队员或被击飞后的快速支援叠层与传递，不能默认常驻。',
      ],
      setPlans: [
        {
          pattern: '4+2',
          primarySetIds: ['set-king-of-the-summit'],
          secondarySetIds: ['set-moonlight-lullaby', 'set-swing-jazz'],
          purpose: 'conditional',
          sourceText: '强攻 / 命破队：山大王 4 件 + 月光骑士颂 / 摇摆爵士 2 件；需强化特殊技触发。',
          condition: {
            sourceId: 'prydwen-original-roxy32',
            sourceUrl: gameData32BuildSources.roxyGuide!.url,
            sourceTextVerified: true,
            sourceVersion: '3.2',
            contentHash: gameData32BuildSources.roxyGuide!.contentHash,
            rule: {
              kind: 'teammate_specialty_and_action',
              specialties: ['attack', 'rupture'],
              action: 'wearer_ex_special',
            },
          },
        },
        {
          pattern: '4+2',
          primarySetIds: ['set-astral-voice'],
          secondarySetIds: ['set-moonlight-lullaby', 'set-swing-jazz'],
          purpose: 'conditional',
          sourceText:
            '锋御队：静听嘉音 4 件 + 月光骑士颂 / 摇摆爵士 2 件；需要支援队员或被击飞后的快速支援叠层与传递，效果未确认常驻。',
          condition: {
            sourceId: 'prydwen-original-roxy32',
            sourceUrl: gameData32BuildSources.roxyGuide!.url,
            sourceTextVerified: true,
            sourceVersion: '3.2',
            contentHash: gameData32BuildSources.roxyGuide!.contentHash,
            rule: {
              kind: 'teammate_specialty_and_action',
              specialties: ['armorer'],
              action: 'team_quick_assist',
            },
          },
        },
      ],
      unresolvedSetDirections: [],
      mainStats: {
        '4': ['crit_rate'],
        '5': ['pen_ratio', 'wind_dmg', 'atk_percent'],
        '6': ['energy_regen'],
      },
      mainStatLines: [
        '4号位：暴击率',
        '5号位：穿透率 > 风属性伤害 = 攻击力百分比',
        '6号位：能量自动回复',
      ],
      subStatPriorities: ['crit_rate', 'crit_dmg', 'atk_percent', 'pen', 'atk_flat'],
      subStatPriorityKind: 'ordered',
      subStatLines: [
        '副词条：暴击率 > 暴击伤害 > 攻击力百分比 > 穿透值 > 固定攻击力；不转为数值权重。',
      ],
      teamAndBangbooPreconditions: [
        '追加能力需队友为强攻、命破或锋御；与克拉蕾同队可相互满足追加能力。',
        '团队暴伤或锐暴增益需匹配浸染 / 涤净属性及受益角色特性，不能把所有增益同时无条件开启。',
        '邦布来源候选：ZZZ.gg在克拉蕾 + 洛克茜 + 丽娜队列出超极杰克；仅用于该三人场景，需另行核对阵营额外能力，不设自动默认或全局最优。',
        '完整固定轴仍缺逐动作时间与资源记录；来源邦布方向不补足此缺口。',
      ],
      progressionDirections: [
        '核心技与特殊技优先，其次连携和支援，再普通攻击和闪避；不虚构技能目标等级。',
      ],
      conditions: [
        '最大核心的回能转换上限可从技能静态系数推导为初始回能 3.12；其他核心等级不能沿用该上限。',
        '最大核心的团队暴伤 / 锐暴转换在百分之百暴击率达到上限；不是所有核心等级通用的毕业面板。',
        '回能与暴击率先满足真实机制，不能因击破特性直接套用冲击力六号位的通用模板。',
      ],
      fixedCycleStatus: 'missing',
      fixedCycleMissingFields,
    },
  })

export function getGameData32BuildGuidance(agentId: string): GameData32BuildGuidance | null {
  return gameData32BuildGuidance[agentId] ?? null
}

/** The guide and inventory solver share the same typed set roles. */
export function getGameData32SetPlanReadiness(
  guidance: GameData32BuildGuidance,
): CandidateWarehouseConstraint['setPlanReadiness'] {
  const first = guidance.setPlans[0]
  return first
    ? {
        status: 'executable',
        pattern: first.pattern,
        primarySetIds: [...first.primarySetIds],
        secondarySetIds: [...first.secondarySetIds],
      }
    : {
        status: 'non_executable',
        reason: 'unresolved_set_roles',
        missingEvidence: '来源未给出可验证的主副套角色。',
      }
}

/** Adapter seam for the existing profile owner; these fields remain candidate. */
export function getGameData32BuildGuidanceFields(agentId: string): AgentProfileField[] {
  const guidance = getGameData32BuildGuidance(agentId)
  if (!guidance) return []
  const sourceRefs = guidance.sourceKeys.map((key) => gameData32BuildSources[key]!)
  const sourceVersions = [...new Set(sourceRefs.map((source) => source.sourceVersion))]
  const common = {
    group: 'build_guidance' as const,
    status: 'candidate' as const,
    gameVersion: '3.2',
    originalSourceVersion: sourceVersions.length === 1 ? sourceVersions[0]! : null,
    lastChangeVersion: '3.2',
    currentApplicability: 'continuous' as const,
    sourceRefs,
    verifiedAt:
      sourceRefs
        .map((source) => source.checkedAt)
        .sort()
        .at(-1) ?? checkedAt,
    conflict: null,
    conditions: guidance.conditions,
  }
  return [
    ...reviewedEndgamePanel32(agentId),
    {
      ...common,
      path: 'build.wengines',
      value: [...guidance.wEngineDirections],
      reason: '来源化音擎方向，不外推为全局排序。',
    },
    {
      ...common,
      path: 'build.drive_disc_sets',
      value: getGameData32SetPlanReadiness(guidance),
      displayValue: [...guidance.setDirections],
      conditions: [...guidance.conditions, ...guidance.setDirections],
      reason: guidance.unresolvedSetDirections.join('；') || '来源明确套装件数；保留队伍条件。',
    },
    {
      ...common,
      path: 'build.main_sub_stats',
      value: { mainStats: [...guidance.mainStatLines], subStats: [...guidance.subStatLines] },
      reason: '保存词条方向和机制条件，不生成未验证数值权重或毕业面板。',
    },
    {
      ...common,
      path: 'build.team_bangboo_scenario',
      value: [...guidance.teamAndBangbooPreconditions],
      reason: '追加能力适配及定性手法；邦布与精确固定轴缺口不被推荐文本掩盖。',
    },
    {
      ...common,
      path: 'build.progression',
      value: [...guidance.progressionDirections],
      reason: '来源技能优先级，不伪造目标等级。',
    },
  ]
}
