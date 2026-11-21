import raw from './data/reviewed-phoenix-build-guidance.3.3.json'
import severianRaw from './data/reviewed-severian-build-guidance.3.3.json'
import { stableContentHash } from '../domain/stableContentHash'

export { raw as phoenixBuildGuidanceData33, severianRaw as severianBuildGuidanceData33 }

export const sourceSha256 = '237C5B060657DB1FD8ABABE6CD26FB275C325D74A67EDA481BDE6732C7D93DFE'
export const severianSourceSha256 =
  '89F3A03B90FCA880851352D6D686E6BBE658411D7B4CDF6B78D2A14A97FF5974'
export const providerManifestSha256 =
  '4D30F529D6E0568A130EBE4D79557B30D9C65D2219E77461763DF1C4B42CB029'
const reviewedContentHash = 'fnv1a-8b50487a'
const severianReviewedContentHash = 'fnv1a-bc9ec239'
export const phoenixBuildGuidanceSource33 = Object.freeze({
  gameVersion: '3.3',
  sourceSha256,
  providerManifestSha256,
})
export const severianBuildGuidanceSource33 = Object.freeze({
  gameVersion: '3.3',
  sourceSha256: severianSourceSha256,
  providerManifestSha256,
})
export type SourceSelection = {
  gameVersion: string
  sourceSha256: string
  providerManifestSha256: string
}
export function sourceIsReviewed(input: SourceSelection) {
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

export function severianSourceIsReviewed(input: SourceSelection) {
  return (
    input.gameVersion === '3.3' &&
    input.sourceSha256.toUpperCase() === severianSourceSha256 &&
    input.providerManifestSha256.toUpperCase() === providerManifestSha256 &&
    severianRaw.source.sha256 === severianSourceSha256 &&
    severianRaw.source.providerManifestSha256 === providerManifestSha256 &&
    severianRaw.source.providerLiveVersion === '3.3' &&
    stableContentHash(severianRaw) === severianReviewedContentHash
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
  severianInGame33: {
    id: severianRaw.id,
    url: severianRaw.source.url,
    sourceVersion: '3.3',
    checkedAt: severianRaw.source.checkedAt,
    contentHash: severianSourceSha256,
    verified: true,
    licenseBoundary:
      '锁定游戏内推荐的最小结构化事实与原件SHA；不分发原文或媒体，不作为全队DPS或Formal证明。',
  },
})

export const conditions = [
  '游戏内slot4/slot2表示4件/2件套；part4/part5/part6按属性合法性映射，不作物理盘位。',
  '泛用成型采用Owner复核M1、Lv60、基础技能11、核心7及S音擎P1；A级队友按A6，均非账户观测。',
  '初始异常掌控255门槛仅在对应静态装备分支满足；瞬时增益不计入初始掌控。',
  'M1队伍异常暴伤需目标处于灼蚀；自身燔焰效率需燃烧攻击造成伤害，不默认全程覆盖。',
  'M2自身对灼蚀目标增伤及自身灼烧延长单列，不推算精确抽取收益或全队DPS。',
  '追加能力要求其他异常或同阵营队友；没有精确来源三人及邦布时不补默认队伍。',
]
export const severianConditions = [
  '游戏内slot4/slot2表示4件/2件套；part4/part5/part6按属性合法性映射，不作物理盘位。',
  '泛用成型采用Owner复核M1、Lv60、基础技能11、核心7及S音擎P1；A级队友按A6，均非账户观测。',
  '追加能力暴击率超过80%的暴击伤害转化至多按超出15%计（95%封顶），需激活治安铁腕。',
  'M1普通攻击、冲刺攻击、闪避反击与支援攻击无视目标12%风属性抗性；流息获取按招式触发，不默认全程满层。',
  'M2苍风影猎与终结技无视防御及强化特殊技后普攻增伤单列，不推算精确抽取收益或全队DPS。',
  '追加能力要求其他支援、击破或同阵营队友；没有精确来源三人及邦布时不补默认队伍。',
]
export const mainStatLines = [
  '4号位：异常精通；攻击力百分比为合法替代。',
  '5号位：火属性伤害；攻击力百分比为合法替代。',
  '6号位：异常掌控',
]
export const severianMainStatLines = [
  '4号位：暴击率或暴击伤害；攻击力百分比为合法替代。',
  '5号位：穿透率或风属性伤害；攻击力百分比为合法替代。',
  '6号位：攻击力百分比',
]
export const progressionDirections = [
  '第一优先：核心技与普攻；第二优先：特殊技与连携技；第三优先：支援技与闪避；组内并列。',
  '泛用成型选择M1；M2保留为不同投资分支，不声明精确提升。',
  '无潜能条目，不补潜能6；实际账户等级、影画和技能由玩家数据决定。',
]
export const severianProgressionDirections = [
  '第一优先：核心技与普攻；第二优先：连携技、特殊技与支援技；第三优先：闪避；组内并列。',
  '泛用成型选择M1；M2保留为不同投资分支，不声明精确提升。',
  '无潜能条目，不补潜能6；实际账户等级、影画和技能由玩家数据决定。',
]

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

export function getSeverianFormedReference33(
  selection: SourceSelection = severianBuildGuidanceSource33,
) {
  if (!severianSourceIsReviewed(selection)) return null
  return {
    ...severianRaw.formedReference,
    agentId: severianRaw.agentId,
    gameVersion: '3.3' as const,
    mindscape: 1 as const,
    potential: null,
    source: { ...gameData33BuildSources.severianInGame33 },
    conditions: [...severianConditions],
    sourceContentHash: severianReviewedContentHash,
  }
}

export function getSeverianMindscapeBranch33(
  level: number,
  selection: SourceSelection = severianBuildGuidanceSource33,
) {
  if (!severianSourceIsReviewed(selection)) return null
  const branch = severianRaw.mindscapeBranches.find((entry) => entry.level === level)
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
