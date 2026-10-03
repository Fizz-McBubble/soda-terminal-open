import type { StatKey } from '../domain/schemas'
import type { AgentProfileField, AgentProfileSourceRef } from './agentProfileFieldProjection'
import type { CandidateSetPlan } from './candidateSetPlans'

const checkedAt = '2026-09-30T12:29:09.2100756Z'
const provenanceBoundary =
  '最小事实提取与来源定位，不复制攻略正文或媒体；来源推荐不是全局强度或 Formal 数值。Gachabase 与锁定上游同根；Prydwen 的 contentHash 标记事实提取 JSON，未冒充原始网页响应哈希。'
type VerifiedBuildSource32 = AgentProfileSourceRef & {
  sourceVersion: '3.2'
  checkedAt: string
  contentHash: string
}

export const gameData32BuildSources: Readonly<Record<string, VerifiedBuildSource32>> =
  Object.freeze({
    claretRelease: {
      id: 'gachabase-release-claret',
      url: 'https://zzz.gachabase.net/agents/1611/claret/release/3.2.0/18761130?lang=en',
      sourceVersion: '3.2',
      checkedAt,
      contentHash: '824763D09A86467208AC596A8AB3446E8941F7D3B3D831FBC9E157147603DF0B',
      licenseBoundary: provenanceBoundary,
    },
    roxyRelease: {
      id: 'gachabase-release-roxy',
      url: 'https://zzz.gachabase.net/agents/1621/roxy/release/3.2.0/18761130?lang=en',
      sourceVersion: '3.2',
      checkedAt,
      contentHash: 'F98A6B5FFBF36BE6C2399499E73EE2408E1E91AC0F32B2317227E7707396BDE9',
      licenseBoundary: provenanceBoundary,
    },
    claretGuide: {
      id: 'prydwen-original-claret32',
      url: 'https://www.prydwen.gg/zenless/characters/claret',
      sourceVersion: '3.2',
      checkedAt,
      contentHash: '028F278DA96D0EB8073767A8790FAF55F8D64F018B91296E3CC098876ECF069A',
      licenseBoundary: provenanceBoundary,
    },
    koledaGuide: {
      id: 'prydwen-original-koleda32',
      url: 'https://www.prydwen.gg/zenless/characters/koleda',
      sourceVersion: '3.2',
      checkedAt,
      contentHash: 'F40C8569D4AC9586A7AD4826ED3D64715C09FFDECA32043258C28CF4C742975C',
      licenseBoundary: provenanceBoundary,
    },
    roxyGuide: {
      id: 'prydwen-original-roxy32',
      url: 'https://www.prydwen.gg/zenless/characters/roxy',
      sourceVersion: '3.2',
      checkedAt: '2026-09-30',
      contentHash: '4781646B6DEB1A7148619A41846AA5AE7B908B5CBC222C279651F638C2596D0D',
      licenseBoundary: provenanceBoundary,
    },
  })

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
    'agent-claret': {
      agentId: 'agent-claret',
      agentName: '克拉蕾',
      gameVersion: '3.2',
      sourceKeys: ['claretRelease', 'claretGuide', 'koledaGuide'],
      wEngineIds: ['wengine-14161', 'wengine-13021', 'wengine-13017'],
      wEngineDirections: [
        '猩红渴望（wengine-14161）：专属锋御方向。',
        '血髓秘匣（wengine-13021）与喵运当头（wengine-13017）：来源讨论的替代方向，精炼与队伍增益影响比较。',
      ],
      setDirections: [
        '棘刺玫瑰 4 件 + 河豚电音 2 件：丽娜队的来源建议；不能无条件套用到减防队。',
        '棘刺玫瑰 4 件 + 啄木鸟电音 / 灵魂摇滚 / 雷暴重金属 / 折枝剑歌 2 件：来源列出的条件化替代。',
      ],
      setPlans: [
        {
          pattern: '4+2',
          primarySetIds: ['set-34200'],
          secondarySetIds: ['set-puffer-electro'],
          purpose: 'conditional',
          sourceText: '棘刺玫瑰 4 件 + 河豚电音 2 件；适用于丽娜队，减防队需重新比较。',
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
          sourceText: '棘刺玫瑰 4 件 + 来源明确列出的各 2 件替代；按队伍和词条比较。',
        },
      ],
      unresolvedSetDirections: [],
      mainStats: {
        '4': ['crit_rate', 'def_percent'],
        '5': ['pen_ratio', 'electric_dmg', 'def_percent'],
        '6': ['def_percent'],
      },
      mainStatLines: [
        '4号位：暴击率优先，防御力百分比为来源备选',
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
        '邦布当前无已闭合的原始来源推荐，不填造推荐名单。',
      ],
      progressionDirections: [
        '核心技与特殊技优先，再比较连携、普通攻击与支援；这是来源养成方向，不是自动指定技能等级。',
      ],
      conditions: [
        '锐化伤害按防御力计算，普通攻击力词条不能沿用传统强攻收益。',
        '初始暴击伤害以 0.35 系数转换为暴击率，锐暴伤害本身不使用普通暴击伤害加成。',
        '超过百分之百暴击率的二次锐暴判定可继续受益；满概率边界需合并实际核心、音擎与队伍条件。',
        '棘刺玫瑰初始防御 1000 / 1800 档位提供不同暴击率；属于套装触发条件，不是毕业面板。',
      ],
      fixedCycleStatus: 'qualitative_only',
      fixedCycleMissingFields,
    },
    'agent-roxy': {
      agentId: 'agent-roxy',
      agentName: '洛克茜',
      gameVersion: '3.2',
      sourceKeys: ['roxyRelease', 'roxyGuide'],
      wEngineIds: ['wengine-14162'],
      wEngineDirections: [
        '绯月银棺（wengine-14162）：专属击破方向；替代音擎排序未闭合当前原始来源。',
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
        '邦布及完整固定轴未闭合当前原始来源，保留明确缺口。',
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

/** Adapter seam for the existing profile owner; these fields remain candidate. */
export function getGameData32BuildGuidanceFields(agentId: string): AgentProfileField[] {
  const guidance = getGameData32BuildGuidance(agentId)
  if (!guidance) return []
  const sourceRefs = guidance.sourceKeys.map((key) => gameData32BuildSources[key]!)
  const common = {
    group: 'build_guidance' as const,
    status: 'candidate' as const,
    gameVersion: '3.2',
    originalSourceVersion: '3.2',
    lastChangeVersion: '3.2',
    currentApplicability: 'continuous' as const,
    sourceRefs,
    verifiedAt: checkedAt,
    conflict: null,
    conditions: guidance.conditions,
  }
  return [
    {
      ...common,
      path: 'build.wengines',
      value: [...guidance.wEngineDirections],
      reason: '来源化音擎方向，不外推为全局排序。',
    },
    {
      ...common,
      path: 'build.drive_disc_sets',
      value: [...guidance.setDirections],
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
