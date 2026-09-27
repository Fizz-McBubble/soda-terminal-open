import type { CandidateSetPlan } from './candidateSetPlans'
import type { PlayerBuildField, PlayerBuildSource } from './playerBuildSources'
import type { ReviewedTeamDiscDirection } from './reviewedTeamDiscConditions'
import { stableContentHash } from './types'

const checkedAt = '2026-09-14T00:00:00.000Z'
const nicoleCheckedAt = '2026-09-19T00:00:00.000Z'

const ellenSource: PlayerBuildSource = {
  id: 'prydwen-ellen-20260914-complete-disc-directions',
  url: 'https://www.prydwen.gg/zenless/characters/ellen',
  sourceVersion: '2.5',
  checkedAt,
  contentHash: stableContentHash({
    primary: 'set-woodpecker-electro',
    secondary: ['set-puffer-electro', 'set-polar-metal', 'set-branch-blade-song'],
    pufferRecommendedTeammate: 'agent-dialyn',
    checkedAt,
  }),
  verified: true,
  licenseBoundary:
    '复用同轮source-adoption.md作者复核：啄木鸟4+河豚/极地/折枝2为常规候选；河豚4围绕琉音的终结窗口。不把队友前提当作装备禁令，不假定增益常驻。保留build标签2.5；hash为核对字段摘要，非整页归档hash。',
}

const qingyiSource: PlayerBuildSource = {
  id: 'prydwen-qingyi-20260914-king-complete-direction',
  url: 'https://www.prydwen.gg/zenless/characters/qingyi',
  sourceVersion: '1.5',
  checkedAt,
  contentHash: stableContentHash({
    primary: 'set-king-of-the-summit',
    secondary: ['set-shockstar-disco', 'set-swing-jazz'],
    checkedAt,
  }),
  verified: true,
  licenseBoundary:
    '2026-09-14复核作者完整山大王4+震星/摇摆2分支；保留页面build标签1.5，3.1目录及锁定上游效果已交叉核对。hash为复核字段摘要，非整页归档hash。只增候选范围，不推导固定覆盖、评分或当前最优。',
}

const evelynHormoneSource: PlayerBuildSource = {
  id: 'miyoushe-61945825-evelyn-complete-disc-directions',
  url: 'https://www.miyoushe.com/zzz/article/61945825',
  sourceVersion: null,
  checkedAt,
  contentHash: '1CAC62718CAA0E5F1FAC2CDFA1B9F2C533BF43B84FC738CFC617EBBA27981B20',
  verified: true,
  licenseBoundary:
    '原图239036059明确激素4+河豚2、河豚4+折枝2。图上传2025-09-27，文章2025-10-31更新，标题1.5不作修订字段版本。正文UTF16 4027:4223，spanSha256=a4aed6e901c4fb2d9badbbb12dace96f2aa663d3fc789601c8de37f53a20a9f9。3.1基线复核后仅作有条件候选，不声称旧图当前最优，不分发原图。',
}

const evelynWoodpeckerSource: PlayerBuildSource = {
  id: 'miyoushe-61946271-evelyn-complete-woodpecker-direction',
  url: 'https://www.miyoushe.com/zzz/article/61946271',
  sourceVersion: '1.5',
  checkedAt,
  contentHash: 'E4FDFCE3CB621EC2B640D9463519CF5E99FB97D76C20093BB7044C6C8B4E07BF',
  verified: true,
  licenseBoundary:
    '原图220684507方案1明确啄木鸟4+折枝2及V1.5；文章2026-01-18更新不改变图内版本。op51独立叠层与失衡覆盖说明，unitRawSha256=8ab3d654b954b1387ac7978cf4f11793cd72dd1e8f3c58b1d0e36a6f06885c62。3.1基线仅采用完整候选与条件，不预设满层，不分发原图。',
}

const evelynDialynSource: PlayerBuildSource = {
  id: 'prydwen-evelyn-20260914-dialyn-puffer-condition',
  url: 'https://www.prydwen.gg/zenless/characters/evelyn',
  sourceVersion: '2.4',
  checkedAt,
  contentHash: stableContentHash({
    agentId: 'agent-evelyn',
    recommendedTeammate: 'agent-dialyn',
    primarySet: 'set-puffer-electro',
    checkedAt,
  }),
  verified: true,
  licenseBoundary:
    '2026-09-14复核作者琉音队河豚四件推荐情境，页面build标签2.4；不从该页面虚构副套，完整折枝二件由61945825原图单独支持。hash为复核字段摘要；琉音是推荐情境，不是盘套装备或游戏效果硬条件。',
}

const nicolePrydwenSource: PlayerBuildSource = {
  id: 'prydwen-nicole-20260919-disc-directions',
  url: 'https://www.prydwen.gg/zenless/characters/nicole-demara',
  sourceVersion: '2.2',
  checkedAt: nicoleCheckedAt,
  contentHash: stableContentHash({
    pageLastUpdated: '09/September/2026',
    lastBuildUpdate: '2.2',
    lastReviewUpdate: '2.4',
    primary: ['set-moonlight-lullaby', 'set-astral-voice', 'set-swing-jazz'],
    recommendedSecondary: 'set-phaethons-melody',
    astralCoverage: 'quick-assist stacks may not remain fully active',
  }),
  verified: true,
  licenseBoundary:
    '2026-09-19复核页面构筑区；页面Last updated/Profile update为2026-09-09，Last build update为2.2，Last review update为2.4。sourceVersion保留构筑版本2.2，不伪装为3.1。仅采用盘套候选、优先级与适用说明，不默认静听嘉音满层或全程覆盖，不作DPS、最高伤害或自动写入结论。hash为核对字段摘要，非整页归档hash。',
}

const nicoleIcyVeinsSource: PlayerBuildSource = {
  id: 'icy-veins-nicole-20260919-disc-directions',
  url: 'https://www.icy-veins.com/zenless-zone-zero/nicole-demara-guide-best-builds',
  sourceVersion: '2.4',
  checkedAt: nicoleCheckedAt,
  contentHash: stableContentHash({
    rawLastUpdated: 'Nov 25, 2025 at 18:00',
    changelog: '25 Nov. 2025: Reviewed with 2.4',
    primary: 'set-moonlight-lullaby',
    nonStackingTeamSet: 'set-moonlight-lullaby',
    moonlightSecondary: ['set-swing-jazz', 'set-phaethons-melody'],
    astralSecondary: ['set-phaethons-melody', 'set-moonlight-lullaby', 'set-hormone-punk'],
  }),
  verified: true,
  licenseBoundary:
    '2026-09-19复核页面构筑区；页面原样显示Last updated on Nov 25, 2025 at 18:00且未标时区，changelog标注Reviewed with 2.4。sourceVersion保留2.4，不伪装为3.1。仅采用月光同名团队增益不叠加、两条副套来源偏好及静听嘉音叠层适用说明，不默认满层或全程覆盖，不作DPS、最高伤害或自动写入结论。hash为核对字段摘要，非整页归档hash。',
}

type AdditionalDiscDirection = {
  agentId: string
  text: string
  source: PlayerBuildSource
  additionalSources?: readonly PlayerBuildSource[]
  plan?: CandidateSetPlan
  mode?: 'append' | 'replace'
}

const directions: readonly AdditionalDiscDirection[] = [
  {
    agentId: 'agent-ellen',
    text: '啄木鸟电音 4 件 + 河豚电音 / 极地重金属 / 折枝剑歌 2 件（常规候选：按普攻、闪避反击和强化特殊技暴击的实际叠层选择，不预设满层常驻）',
    source: ellenSource,
  },
  {
    agentId: 'agent-qingyi',
    text: '山大王 4 件 + 震星迪斯科 / 摇摆爵士 2 件（团队暴击收益候选：击破角色发动强化特殊技或连携技后提供15秒团队暴伤增益；暴击率达到50%时由15%提高到30%，未达到仍有基础15%；同名效果不叠加，按实际循环覆盖）',
    source: qingyiSource,
  },
  {
    agentId: 'agent-evelyn',
    text: '激素朋克 4 件 + 河豚电音 2 件（可选：入场或切入后10秒攻击增益，20秒触发间隔；需让主要输出落在窗口内，不按全程生效比较）',
    source: evelynHormoneSource,
  },
  {
    agentId: 'agent-evelyn',
    text: '啄木鸟电音 4 件 + 折枝剑歌 2 件（可选：普攻、闪避反击、强化特殊技暴击各自叠层并独立持续6秒；长失衡与能量限制会影响层数，不按满层常驻比较；原图V1.5）',
    source: evelynWoodpeckerSource,
  },
  {
    agentId: 'agent-nicole',
    mode: 'replace',
    text: '月光骑士颂 4 件 + 摇摆爵士 / 法厄同之歌 2 件（当前主要方向；同队已有月光骑士颂四件时同名团队增益不叠加，不采用重复配置；Icy Veins偏好摇摆二件补充回能，Prydwen首推法厄同二件）',
    source: nicoleIcyVeinsSource,
    additionalSources: [nicolePrydwenSource],
    plan: {
      pattern: '4+2',
      primarySetIds: ['set-moonlight-lullaby'],
      secondarySetIds: ['set-swing-jazz', 'set-phaethons-melody'],
      priority: 0,
      purpose: 'recommended',
      condition: {
        sourceId: nicoleIcyVeinsSource.id,
        sourceUrl: nicoleIcyVeinsSource.url,
        sourceTextVerified: true,
        rule: { kind: 'teammate_not_four_piece', setId: 'set-moonlight-lullaby' },
      },
    },
  },
  {
    agentId: 'agent-nicole',
    mode: 'replace',
    text: '静听嘉音 4 件 + 法厄同之歌 / 月光骑士颂 / 激素朋克 2 件（条件候选：快速支援叠层可提供最高24%增益，但队伍与循环可能无法全程维持或满层；法厄同为两源共同首选，月光为Icy Veins特定队伍替代，激素为共同候选）',
    source: nicoleIcyVeinsSource,
    plan: {
      pattern: '4+2',
      primarySetIds: ['set-astral-voice'],
      secondarySetIds: ['set-phaethons-melody', 'set-moonlight-lullaby', 'set-hormone-punk'],
      priority: 20,
      purpose: 'conditional',
    },
  },
  {
    agentId: 'agent-nicole',
    mode: 'replace',
    text: '摇摆爵士 4 件 + 法厄同之歌 2 件（库存过渡：连携技或终结技后的12秒团队增益窗口；仅在主要方向暂时无法成套时采用）',
    source: nicolePrydwenSource,
    plan: {
      pattern: '4+2',
      primarySetIds: ['set-swing-jazz'],
      secondarySetIds: ['set-phaethons-melody'],
      priority: 100,
      purpose: 'transition',
    },
  },
]

/** Source refs for the added generic branches; existing field evidence stays separate. */
export function getReviewedAdditionalDiscSources(agentId: string): PlayerBuildSource[] {
  return [
    ...new Map(
      directions
        .filter((direction) => direction.agentId === agentId)
        .flatMap(({ source, additionalSources = [] }) => [source, ...additionalSources])
        .map((source) => [source.id, source] as const),
    ).values(),
  ]
}

/** Typed branches preserve adopted ranking, purpose and source conditions past text parsing. */
export function getReviewedAdditionalDiscPlans(agentId: string): CandidateSetPlan[] {
  return directions.flatMap((direction) => {
    if (direction.agentId !== agentId || !direction.plan) return []
    return [{ ...direction.plan, sourceText: direction.text }]
  })
}

// This is the exact legacy Qingyi projection reviewed in the source packet. A
// different ID pool must not be guessed into these roles or silently discarded.
const qingyiLegacyIds = ['set-shockstar-disco', 'set-swing-jazz', 'set-woodpecker-electro']
const qingyiLegacyDirections = ['震星迪斯科 4 件 + 摇摆爵士 / 啄木鸟电音 2 件（保留原有击破方向）']
const ellenLegacyIds = [
  'set-puffer-electro',
  'set-woodpecker-electro',
  'set-polar-metal',
  'set-branch-blade-song',
]
const ellenLegacyDirections = [
  '河豚电音 4 件 + 啄木鸟电音 / 极地重金属 / 折枝剑歌 2 件（琉音在队时的推荐方向：利用终结技后的攻击窗口，不推定全程覆盖）',
]

/** Append source-complete candidates at the existing field boundary, without touching stats. */
export function correctReviewedAdditionalDiscField(
  agentId: string,
  field: PlayerBuildField,
): PlayerBuildField {
  const additions = directions.filter((direction) => direction.agentId === agentId)
  if (
    field.path !== 'build.drive_disc_sets' ||
    field.status !== 'candidate' ||
    !field.source?.verified ||
    !additions.length ||
    !Array.isArray(field.value) ||
    !field.value.every((item): item is string => typeof item === 'string')
  )
    return field

  const original = field.value as string[]
  const mode = additions.some((direction) => direction.mode === 'replace') ? 'replace' : 'append'
  let existing = mode === 'replace' ? [] : original
  if (existing.length && existing.every((item) => item.startsWith('set-'))) {
    const legacyIds = agentId === 'agent-ellen' ? ellenLegacyIds : qingyiLegacyIds
    if (
      !['agent-qingyi', 'agent-ellen'].includes(agentId) ||
      new Set(existing).size !== legacyIds.length ||
      !legacyIds.every((id) => existing.includes(id))
    )
      return field
    existing = agentId === 'agent-ellen' ? ellenLegacyDirections : qingyiLegacyDirections
  }
  const value = [...new Set([...existing, ...additions.map(({ text }) => text)])]
  if (value.length === original.length && value.every((text, index) => text === original[index]))
    return field

  const sources = [
    ...(mode === 'append' ? [field.source] : []),
    ...getReviewedAdditionalDiscSources(agentId),
  ].filter((source): source is PlayerBuildSource => source !== null)
  return {
    ...field,
    value,
    source: {
      ...additions[0]!.source,
      id: `reviewed-additional-disc-directions-${agentId}-${mode === 'replace' ? '20260919' : '20260914'}`,
      sourceVersion: null,
      contentHash: stableContentHash({ value, sources }),
      verified: sources.every((source) => source.verified),
      licenseBoundary: sources
        .map(
          (source) =>
            `${source.id} (${source.url}; version=${source.sourceVersion ?? '未标注'}; hash=${source.contentHash}): ${source.licenseBoundary}`,
        )
        .join('\n'),
    },
    reason:
      mode === 'replace'
        ? '以本轮已核当前来源替换自动求解字段；旧来源仍保留在历史档案。来源适用说明不代表增益常驻、满层、DPS或正式最优。'
        : '保留既有完整盘套方向，追加已核来源的可选4+2；触发窗口与完整收益条件不代表常驻数值，也不是装备硬性限制。',
  }
}

type AdditionalTeamDiscDirection = Omit<ReviewedTeamDiscDirection, 'source'> & {
  requiredMemberIds: readonly string[]
  source: Omit<ReviewedTeamDiscDirection['source'], 'sourceVersion'> & {
    sourceVersion: string | null
  }
  additionalSources: PlayerBuildSource[]
}

/** Feed this declaration into the existing team-condition consumer; never the generic field. */
export const reviewedEvelynDialynDiscDirection: AdditionalTeamDiscDirection = {
  id: 'reviewed-evelyn-dialyn-puffer-branch-blade',
  agentId: 'agent-evelyn',
  exactMemberSets: [],
  requiredMemberIds: ['agent-dialyn'],
  potentialMinimumByAgentId: {},
  setPlan: {
    pattern: '4+2',
    primarySetIds: ['set-puffer-electro'],
    secondarySetIds: ['set-branch-blade-song'],
    sourceText:
      '河豚电音 4 件 + 折枝剑歌 2 件（琉音在队时的推荐方向：发动终结技后利用12秒攻击增益窗口；队友条件不证明终结频率或增益全程覆盖）',
  } satisfies CandidateSetPlan,
  source: {
    postId: '61945825',
    url: evelynHormoneSource.url,
    contentHash: evelynHormoneSource.contentHash,
    bodyHash: '85bd56f01b2bb6d006348e5eb629dbb67ef37ed23f339fa32ad0b2f61dbc8544',
    sourceVersion: null,
    targetVersion: '3.1',
    locator: {
      kind: 'structured_text_span',
      text: '或者选用[河豚电音]提升穿透及失衡期攻击收益',
    },
  },
  additionalSources: [evelynHormoneSource, evelynDialynSource],
  boundary:
    '琉音是当前作者的推荐情境，不是盘套装备硬限制。完整副套来自已归档修订图；在3.1基线中只补候选方案，不自动启用数值效果，不把终结后增益视为常驻。保留伊芙琳其他4+2与原有2+2+2。',
}
