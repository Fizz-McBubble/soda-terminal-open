import { resolvePotentialImage } from '../assault/agentCapabilities'
import { agentCatalog } from '../assault/catalogData'
import type { StatKey } from '../domain/schemas'
import type { PlayerBuildSource } from './playerBuildSources'
import {
  reviewedEvelynDialynDiscDirection,
  getReviewedAdditionalDiscSources,
} from './reviewedAdditionalDiscDirections'
import type { CandidateSetPlan } from './candidateSetPlans'
import { reviewedImageDiscDirections } from './reviewedImageDiscDirections'

export type ReviewedTeamAgentState = {
  potentialImage?: number | null
}

/**
 * Context deliberately contains only the facts needed to evaluate a source
 * condition.  It is not an account import and does not infer an unknown team.
 */
export type ReviewedTeamDiscConditionContext = {
  memberIds?: readonly string[]
  agentStateById?: Readonly<Record<string, ReviewedTeamAgentState>>
}

export type ReviewedTeamDiscDirection = {
  id: string
  agentId: string
  /** Every member set is an exact, order-independent reviewed trio. */
  exactMemberSets: readonly (readonly [string, string, string])[]
  requiredMemberIds?: readonly string[]
  retainBasePlans?: boolean
  additionalSources?: PlayerBuildSource[]
  teamCondition?: 'aria' | 'other-anomaly-support' | 'direct-damage' | 'anomaly-damage'
  mainStats?: Partial<Record<'4' | '5' | '6', StatKey[]>>
  subStatWeights?: Partial<Record<StatKey, number>>
  potentialMinimumByAgentId: Readonly<Record<string, number>>
  setPlan: CandidateSetPlan
  source: {
    postId: string
    url: string
    contentHash: string
    bodyHash: string
    sourceVersion: string | null
    targetVersion: '3.1'
    locator: {
      kind: 'structured_text_span' | 'archived_image_region'
      text: string
    }
  }
  boundary: string
}

export type AppliedReviewedTeamDiscDirection = Pick<
  ReviewedTeamDiscDirection,
  | 'id'
  | 'agentId'
  | 'setPlan'
  | 'source'
  | 'boundary'
  | 'mainStats'
  | 'subStatWeights'
  | 'additionalSources'
  | 'retainBasePlans'
> & {
  exactMemberIds: [string, string, string]
  potentialMinimumByAgentId: Record<string, number>
  effectivePotentialByAgentId: Record<string, number>
}

const source = {
  postId: '76994144',
  url: 'https://www.miyoushe.com/zzz/article/76994144',
  contentHash: 'BBCA160AD2B8E09440743C891D6FFDFF2A349AF015CC0CBA27253F15796AD923',
  bodyHash: 'F66CBC1CEE8AD1939433D7655899C56E7388E795F220478D0A1099788161B9C9',
  sourceVersion: '3.1' as const,
  targetVersion: '3.1' as const,
  locator: {
    kind: 'structured_text_span' as const,
    text: '●驱动盘可根据配队所选的支援位调整，若搭配千夏则选择[沧浪行歌]提供[帷幕]带来的暴击收益，搭配嘉音则选择泛用的[啄木鸟电音]提供稳定的暴击、攻击收益，2件套可根据需求选择河豚、折枝、啄木鸟；',
  },
}

const nekomataPotentialOne = { 'agent-nekomata': 1 } as const
const nekomataDirectionsBoundary =
  '保留原文在精确三人组与猫又潜能至少1级下给出的4+2分支；同篇潜能图补充5号位穿透、攻击与物伤，不改变其他槽位、副词条或评级。'
const nekomataImageSource: PlayerBuildSource = {
  id: 'miyoushe-76994144-potential-mainstat-image',
  url: source.url,
  sourceVersion: '3.1',
  checkedAt: '2026-09-15T00:00:00.000Z',
  contentHash: '1e42bdef351cdcbe704e211cb8aa217a332fe1d89f4ebb12f5de419ea89da6f8',
  verified: true,
  licenseBoundary:
    '同篇归档原图002-1e42bdef351cdcbe.png，潜能ON；5号位穿透率/攻击力/物理属性伤害。仅用于已有潜能条件分支，不推断穿透收益排名。',
}

const nangongSource: ReviewedTeamDiscDirection['source'] = {
  postId: '74153268',
  url: 'https://www.miyoushe.com/zzz/article/74153268',
  contentHash: 'A3F7837D281AF76D505AAB746429078E0F82ECBD9D6407DFD55C410A9DEDA961',
  bodyHash: '54b0e68e6c476c42ef5922f56f14d1aad8084a8a826c47019c0e91f216e127ba',
  sourceVersion: '2.7',
  targetVersion: '3.1',
  locator: {
    kind: 'structured_text_span',
    // Original body UTF-16 offsets 3294:3641; structured_content hash above.
    text: '◆驱动盘装配推荐\n●4件套选择【法厄同之歌】\n»2件套提供了异常掌控加成，4件套提供了异常精通和增伤加成\n（适合爱芮队伍使用）\n»这种情况下2件套可以选择选择：\n［自由蓝调］/［混沌爵士］提供异常精通加成\n\n●4件套也可以选择【静听嘉音】\n»4件套可以通过快速支援叠加增伤效果\n（适合其余异常队伍，需要搭配支援位使用，例如：雅南柚）\n»这种情况下2件套选择就一种：\n［法厄同之歌］提供了8%的异常掌控加成\n\n\n●驱动盘词条选择也非常简单了\n首先4号盘必定选择异常精通盘\n5号盘可选以太盘\n6号盘必定选择异常掌控盘\n副词条以异常精通和攻击百分比词条为主\n\n◆配队推荐\n●妄想天使体系\n①爱芮+南宫羽+千夏\n\n●其余异常体系\n①星见雅+南宫羽+浮波柚叶/妮可\n②爱丽丝/月城柳+南宫羽+浮波柚叶\n\n',
  },
}
const nangongBoundary =
  '复用2.7原帖明确的队伍类型配盘方向，仅作为带队伍条件的当前候选，不宣称当前最优；未匹配其他队伍不表示其不能使用，也不代表技能硬限制。静听嘉音分支需通过快速支援叠加效果，精确成员匹配不等于已完成实际操作或叠满。'

/**
 * Reviewed, source-local condition declarations.  New directions are data
 * entries here; matching below has no agent-specific branch.
 */
export const reviewedTeamDiscDirections: readonly ReviewedTeamDiscDirection[] = [
  ...reviewedImageDiscDirections,
  { ...reviewedEvelynDialynDiscDirection, retainBasePlans: true },
  {
    id: 'reviewed-qingyi-crit-team-king',
    agentId: 'agent-qingyi',
    exactMemberSets: [],
    teamCondition: 'direct-damage',
    potentialMinimumByAgentId: {},
    retainBasePlans: true,
    setPlan: {
      pattern: '4+2',
      primarySetIds: ['set-king-of-the-summit'],
      secondarySetIds: ['set-shockstar-disco', 'set-swing-jazz'],
      sourceText:
        '山大王 4 件 + 震星迪斯科 / 摇摆爵士 2 件（暴击输出队；自身暴击达到50%时提供完整暴伤增益）',
    },
    source: {
      postId: 'prydwen-qingyi',
      url: getReviewedAdditionalDiscSources('agent-qingyi')[0]!.url,
      contentHash: getReviewedAdditionalDiscSources('agent-qingyi')[0]!.contentHash,
      bodyHash: getReviewedAdditionalDiscSources('agent-qingyi')[0]!.contentHash,
      sourceVersion: '1.5',
      targetVersion: '3.1',
      locator: {
        kind: 'structured_text_span',
        text: '山大王4+震星/摇摆2；暴击输出团队方向，装备者50%暴击提供完整额外暴伤。',
      },
    },
    boundary:
      '按输出类型采用候选方向；不假定50%暴击已达到、同名效果叠加或增益常驻，震星等库存方案仍保留在单人备选。',
  },
  ...(['direct-damage', 'anomaly-damage'] as const).map(
    (teamCondition): ReviewedTeamDiscDirection => ({
      id: `miyoushe-76974843-rina-${teamCondition}`,
      agentId: 'agent-rina',
      exactMemberSets: [],
      teamCondition,
      potentialMinimumByAgentId: { 'agent-rina': 1 },
      mainStats: {
        '4': [teamCondition === 'direct-damage' ? 'crit_rate' : 'anomaly_proficiency'],
        '5': ['pen_ratio'],
        '6': ['energy_regen'],
      },
      subStatWeights:
        teamCondition === 'direct-damage'
          ? { crit_rate: 1, crit_dmg: 1, atk_percent: 1 }
          : { anomaly_proficiency: 1, atk_percent: 1 },
      setPlan: {
        pattern: '4+2',
        primarySetIds: ['set-moonlight-lullaby'],
        secondarySetIds: ['set-puffer-electro'],
        sourceText: '月光骑士颂 4 件 + 河豚电音 2 件（潜能已解锁；按主输出方向选择词条）',
      },
      source: {
        postId: '76974843',
        url: 'https://www.miyoushe.com/zzz/article/76974843',
        contentHash: '596543e5fe6974a2006ad1e81ceb1b23c923626fc6f33346793c8c9d3161e39a',
        bodyHash: '25785f506e60d0c6fd0867b626a24f1e815c0a0c57ae21ad3634715363c438ff',
        sourceVersion: '3.1',
        targetVersion: '3.1',
        locator: {
          kind: 'structured_text_span',
          text: '潜能影像解锁01获得全部机制补强；月光4河豚2，直伤队暴击、异常队精通，5穿透6回能。',
        },
      },
      boundary:
        '按队内明确输出类型采用潜能分支；混合输出与未知队型保留通用方向。副属性等权是候选策略，不是作者精确权重。',
    }),
  ),
  {
    id: 'miyoushe-74153268-nangong-aria-phaethons-melody',
    agentId: 'agent-nangong',
    teamCondition: 'aria',
    exactMemberSets: [['agent-aria', 'agent-nangong', 'agent-sunna']],
    potentialMinimumByAgentId: {},
    setPlan: {
      pattern: '4+2',
      primarySetIds: ['set-phaethons-melody'],
      secondarySetIds: ['set-freedom-blues', 'set-chaos-jazz'],
      sourceText:
        '法厄同之歌 4 件 + 自由蓝调 / 混沌爵士 2 件（原2.7攻略：适合爱芮队伍使用；按爱芮在队条件选择）',
    },
    source: nangongSource,
    boundary: nangongBoundary,
  },
  {
    id: 'miyoushe-74153268-nangong-anomaly-support-astral-voice',
    agentId: 'agent-nangong',
    teamCondition: 'other-anomaly-support',
    retainBasePlans: true,
    exactMemberSets: [
      ['agent-miyabi', 'agent-nangong', 'agent-yuzuha'],
      ['agent-miyabi', 'agent-nangong', 'agent-nicole'],
      ['agent-alice', 'agent-nangong', 'agent-yuzuha'],
      ['agent-yanagi', 'agent-nangong', 'agent-yuzuha'],
    ],
    potentialMinimumByAgentId: {},
    setPlan: {
      pattern: '4+2',
      primarySetIds: ['set-astral-voice'],
      secondarySetIds: ['set-phaethons-melody'],
      sourceText:
        '静听嘉音 4 件 + 法厄同之歌 2 件（原2.7攻略：其余异常队伍需搭配支援位，通过快速支援叠加增伤；按异常输出与支援在队条件选择）',
    },
    source: nangongSource,
    boundary: nangongBoundary,
  },
  {
    id: 'miyoushe-76994144-nekomata-sunna-white-water-ballad',
    agentId: 'agent-nekomata',
    exactMemberSets: [
      ['agent-nekomata', 'agent-norma', 'agent-sunna'],
      ['agent-nekomata', 'agent-dialyn', 'agent-sunna'],
    ],
    potentialMinimumByAgentId: nekomataPotentialOne,
    mainStats: { '5': ['physical_dmg', 'atk_percent', 'pen_ratio'] },
    additionalSources: [nekomataImageSource],
    setPlan: {
      pattern: '4+2',
      primarySetIds: ['set-white-water-ballad'],
      secondarySetIds: ['set-puffer-electro', 'set-branch-blade-song', 'set-woodpecker-electro'],
      sourceText: source.locator.text,
    },
    source,
    boundary: nekomataDirectionsBoundary,
  },
  {
    id: 'miyoushe-76994144-nekomata-astra-woodpecker-electro',
    agentId: 'agent-nekomata',
    exactMemberSets: [
      ['agent-nekomata', 'agent-norma', 'agent-astra'],
      ['agent-nekomata', 'agent-dialyn', 'agent-astra'],
    ],
    potentialMinimumByAgentId: nekomataPotentialOne,
    mainStats: { '5': ['physical_dmg', 'atk_percent', 'pen_ratio'] },
    additionalSources: [nekomataImageSource],
    setPlan: {
      pattern: '4+2',
      primarySetIds: ['set-woodpecker-electro'],
      // The source names Woodpecker as the four-piece choice in this branch,
      // so it cannot also be manufactured into its own two-piece alternative.
      secondarySetIds: ['set-puffer-electro', 'set-branch-blade-song'],
      sourceText: source.locator.text,
    },
    source,
    boundary: nekomataDirectionsBoundary,
  },
]

function sameMembers(left: readonly string[], right: readonly string[]) {
  if (left.length !== right.length) return false
  const sortedLeft = [...left].sort()
  const sortedRight = [...right].sort()
  return sortedLeft.every((member, index) => member === sortedRight[index])
}

function effectivePotential(agentId: string, context: ReviewedTeamDiscConditionContext) {
  return resolvePotentialImage(agentId, context.agentStateById?.[agentId]?.potentialImage) ?? 0
}

/**
 * Normalize the explicit condition input before it is placed in a Build Intent
 * fingerprint.  Missing potential uses the existing product default; explicit
 * zero remains zero.
 */
export function reviewedTeamPotentialByAgentId(context: ReviewedTeamDiscConditionContext) {
  return Object.fromEntries(
    [...new Set(context.memberIds ?? [])]
      .sort()
      .map((agentId) => [agentId, effectivePotential(agentId, context)]),
  )
}

/** Resolves only exact, source-declared team branches; it never expands a pair. */
export function resolveReviewedTeamDiscDirections(
  agentId: string,
  context: ReviewedTeamDiscConditionContext,
): AppliedReviewedTeamDiscDirection[] {
  const members = context.memberIds
  if (!members || new Set(members).size !== 3) return []
  return reviewedTeamDiscDirections.flatMap((direction) => {
    if (direction.agentId !== agentId) return []
    let exactMemberIds = direction.exactMemberSets.find((candidate) =>
      sameMembers(candidate, members),
    )
    if (
      members.includes(agentId) &&
      direction.requiredMemberIds?.every((id) => members.includes(id))
    ) {
      exactMemberIds = [...members] as [string, string, string]
    }
    if (members.includes(agentId) && direction.teamCondition) {
      const teammates = agentCatalog.filter(([id]) => id !== agentId && members.includes(id))
      const direct = teammates.some(([, , role]) => role === 'damage' || role === 'rupture')
      const anomaly = teammates.some(([, , role]) => role === 'anomaly')
      const matches =
        direction.teamCondition === 'aria'
          ? members.includes('agent-aria')
          : direction.teamCondition === 'direct-damage'
            ? direct && !anomaly
            : direction.teamCondition === 'anomaly-damage'
              ? anomaly && !direct
              : !members.includes('agent-aria') &&
                teammates.some(([, , role]) => role === 'anomaly') &&
                teammates.some(([, , role]) => role === 'support')
      if (matches) exactMemberIds = [...members] as [string, string, string]
    }
    if (!exactMemberIds) return []
    const effectivePotentialByAgentId = Object.fromEntries(
      Object.keys(direction.potentialMinimumByAgentId)
        .sort()
        .map((id) => [id, effectivePotential(id, context)]),
    )
    if (
      Object.entries(direction.potentialMinimumByAgentId).some(
        ([id, minimum]) => effectivePotentialByAgentId[id]! < minimum,
      )
    )
      return []
    return [
      {
        id: direction.id,
        agentId: direction.agentId,
        setPlan: {
          ...direction.setPlan,
          primarySetIds: [...direction.setPlan.primarySetIds],
          secondarySetIds: [...direction.setPlan.secondarySetIds],
        },
        source: direction.source,
        boundary: direction.boundary,
        mainStats: direction.mainStats,
        subStatWeights: direction.subStatWeights,
        additionalSources: direction.additionalSources,
        retainBasePlans: direction.retainBasePlans,
        exactMemberIds: [...exactMemberIds],
        potentialMinimumByAgentId: { ...direction.potentialMinimumByAgentId },
        effectivePotentialByAgentId,
      },
    ]
  })
}
