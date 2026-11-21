import type { DriveDisc } from '../domain/schemas'
import { getCandidateWarehouseConstraint } from '../gameDataPacks/candidateWarehouseConstraints'
import { getCurrentDriveDiscRecommendation } from '../gameDataPacks/currentDriveDiscRecommendationCatalog'
import type { PlayerBuildSource } from '../gameDataPacks/playerBuildSources'
import { retentionPlayerText } from './retentionPlayerText'
import { evaluationRules } from '../evaluation/rules'
import type {
  Profile,
  QualityEvidence,
  QualityPolicy,
  RetentionBranchSetPlan,
} from './absoluteDiscRetentionContract'

export type RetentionSourceLink = {
  label: string
  url: string
  sourceVersion: string | null
}

export type WarehouseRetentionSetIdentity = {
  id: string
  name: string | null
}

export type WarehouseRetentionBranchSetPlan = {
  pattern: RetentionBranchSetPlan['pattern']
  primarySets: WarehouseRetentionSetIdentity[]
  secondarySets: WarehouseRetentionSetIdentity[]
  purpose?: RetentionBranchSetPlan['purpose']
  sourceText?: string
  conditionDetails: string[]
}

export type WarehouseRetentionGuidance = {
  profileLabel?: string | null
  profileDimensions?: string[]
  currentSet?: WarehouseRetentionSetIdentity
  branchSetPlan?: WarehouseRetentionBranchSetPlan
  mainStats: string[]
  subStats: string[]
  matchedStats: string[]
  minorStats: string[]
  unusedStats: string[]
  minimumLines: number | null
  minimumCoreLines: number | null
  twoPieceEffect: string | null
  fourPieceEffect: string | null
  sources: RetentionSourceLink[]
}

export type RetentionProfileSemantics = {
  label: string | null
  dimensions: string[]
}

export type RetentionDiscSetRelationship =
  | 'primary'
  | 'secondary'
  | 'potential'
  | 'conditional'
  | 'mismatch'
  | 'unknown'

/**
 * setFit/twoPieceFit establish effect utility only. A primary or secondary
 * relationship additionally requires the current set in a named complete plan.
 */
export function retentionDiscSetRelationship(
  setId: string | undefined,
  use: Pick<
    QualityEvidence,
    'setFit' | 'recommendationSetFit' | 'twoPieceFit' | 'fourPieceFit' | 'branchSetPlan'
  >,
): RetentionDiscSetRelationship {
  if (!setId) return 'unknown'
  if (
    use.setFit === 'incompatible' ||
    (use.twoPieceFit === 'incompatible' && use.fourPieceFit === 'incompatible')
  )
    return 'mismatch'
  const plan = use.branchSetPlan
  if (plan?.primarySetIds.includes(setId)) {
    if (
      (plan.pattern === '4+2' || plan.pattern === '4+unconfirmed') &&
      use.fourPieceFit === 'incompatible'
    )
      return 'potential'
    if (plan.pattern === '2+2+2' && use.twoPieceFit === 'incompatible') return 'potential'
    return 'primary'
  }
  if (plan?.secondarySetIds.includes(setId) && use.twoPieceFit !== 'incompatible')
    return 'secondary'
  if (use.setFit === 'conditional') return 'conditional'
  return 'potential'
}

/** Only an exact recommended main or secondary set relation supports player-facing use. */
export function retentionUseMatchesRecommendedSet(
  setId: string | undefined,
  use: Pick<
    QualityEvidence,
    'mainFit' | 'setFit' | 'recommendationSetFit' | 'twoPieceFit' | 'fourPieceFit' | 'branchSetPlan'
  >,
) {
  if (use.mainFit === 'incompatible' || use.recommendationSetFit === 'incompatible') return false
  const relationship = retentionDiscSetRelationship(setId, use)
  return relationship === 'primary' || relationship === 'secondary'
}

function semanticText(value: string) {
  return value.trim().replace(/[。；;]+$/u, '')
}

function semanticCondition(value: string) {
  const normalized = semanticText(value)
  const purposes: Record<string, string> = {
    '来源构筑用途：recommended': '推荐构筑',
    '来源构筑用途：transition': '过渡构筑',
    '来源构筑用途：conditional': '条件构筑',
    '来源构筑用途：historical': '历史用途',
  }
  return purposes[normalized] ?? normalized.replace(/^来源主词替代用途：/u, '替代主词：')
}

function compactCondition(value: string) {
  return (
    retentionPlayerText(semanticCondition(value))
      .replace(/(?:[\w-]+\/)*[\w.-]+\.(?:png|jpe?g|webp)\s*[:：]?\s*/giu, '')
      .split(/[；;。]/u)
      .map((part) => part.trim())
      .find(Boolean)
      ?.slice(0, 32) ?? ''
  )
}

function branchQualifier(profile: Profile, includeBaseOrdinal: boolean) {
  const branch = profile.id.slice(profile.id.indexOf(':') + 1)
  const base = /^base-(\d+)/u.exec(branch)
  if (base && includeBaseOrdinal) return `常规构筑 ${Number(base[1]) + 1}`

  const tokens = new Set(branch.split('-'))
  const labels = [
    ...(tokens.has('m2plus') ? ['二影以上'] : []),
    ...(tokens.has('experimental') ? ['实验队'] : []),
    ...(tokens.has('anomaly') ? ['异常方向'] : []),
    ...(tokens.has('direct') ? ['直伤方向'] : []),
  ]
  if (labels.length) return labels.join(' · ')

  return compactCondition(profile.conditionEvidence?.[0]?.detail ?? '')
}

function setIdentity(setId: string): WarehouseRetentionSetIdentity {
  return {
    id: setId,
    name: getCurrentDriveDiscRecommendation(setId)?.name ?? null,
  }
}

function branchSetPlanGuidance(profile: Profile): WarehouseRetentionBranchSetPlan | undefined {
  const plan = profile.branchSetPlan
  if (!plan) return undefined
  return {
    pattern: plan.pattern,
    primarySets: plan.primarySetIds.map(setIdentity),
    secondarySets: plan.secondarySetIds.map(setIdentity),
    ...(plan.purpose ? { purpose: plan.purpose } : {}),
    ...(plan.sourceText ? { sourceText: plan.sourceText } : {}),
    conditionDetails: (profile.conditionEvidence ?? []).map((entry) => entry.detail),
  }
}

function planSetNames(sets: readonly WarehouseRetentionSetIdentity[]) {
  const names = sets.flatMap((set) => (set.name ? [set.name] : []))
  return names.join(' / ')
}

function statLabel(stat: string) {
  return evaluationRules.stats[stat as keyof typeof evaluationRules.stats]?.label ?? '未知词条'
}

/**
 * Player-facing branch semantics derived only from captured profile facts.
 * The stable profile ID remains available for joins but is never used as a label.
 */
export function retentionProfileSemantics(
  profile: Profile | undefined,
  use?: Pick<QualityEvidence, 'functionDetail'>,
): RetentionProfileSemantics {
  if (!profile) return { label: null, dimensions: [] }
  const conditions = [
    ...new Set(
      (profile.conditionEvidence ?? [])
        .filter((entry) => entry.detail.trim())
        .map((entry) => semanticCondition(entry.detail)),
    ),
  ]
  const fourPieceSetNames = [
    ...new Set(
      (profile.branchSetPlan?.primarySetIds ?? Object.keys(profile.fourPieceUses ?? {}))
        .map((setId) => getCurrentDriveDiscRecommendation(setId)?.name)
        .filter((name): name is string => Boolean(name)),
    ),
  ]
  const branchSetPlan = branchSetPlanGuidance(profile)
  const planLabel =
    branchSetPlan?.pattern === '4+2' || branchSetPlan?.pattern === '4+unconfirmed'
      ? [
          planSetNames(branchSetPlan.primarySets)
            ? `${planSetNames(branchSetPlan.primarySets)}四件套`
            : '',
          planSetNames(branchSetPlan.secondarySets)
            ? `${planSetNames(branchSetPlan.secondarySets)}二件套`
            : '',
        ]
          .filter(Boolean)
          .join(' + ') || null
      : branchSetPlan?.pattern === '2+2+2'
        ? `${planSetNames(branchSetPlan.primarySets)}各二件套`
        : null
  const baseLabel =
    planLabel ??
    (fourPieceSetNames.length ? `${fourPieceSetNames.join(' / ')}四件套` : (conditions[0] ?? null))
  const hasBranchFacts =
    Boolean(baseLabel) ||
    profile.goal === 'crit_damage' ||
    profile.goal === 'anomaly_damage' ||
    profile.goal === 'functional' ||
    Boolean(profile.coreStats?.length) ||
    Object.values(profile.mainStatsBySlot).some((rows) =>
      Object.values(rows).some((fit) => fit === 'valid' || fit === 'conditional'),
    )
  const qualifier = hasBranchFacts ? branchQualifier(profile, !branchSetPlan) : ''
  const label = baseLabel
    ? qualifier && qualifier !== baseLabel
      ? `${baseLabel} · ${qualifier}`
      : baseLabel
    : qualifier || null
  const goalLabels = {
    crit_damage: '暴击直伤方向',
    anomaly_damage: '异常伤害方向',
    functional: '功能触发方向',
    unknown: null,
  } as const
  const validMainStats = Object.entries(profile.mainStatsBySlot).flatMap(([slot, rows]) => {
    const labels = Object.entries(rows)
      .filter(([, fit]) => fit === 'valid')
      .map(([stat]) => statLabel(stat))
    return labels.length ? [`${slot}号位：${labels.join(' / ')}`] : []
  })
  const dimensions = [
    ...(goalLabels[profile.goal ?? 'unknown'] ? [goalLabels[profile.goal ?? 'unknown']!] : []),
    ...(profile.availability === 'conditional' ? ['来源条件构筑'] : []),
    ...(profile.mainAvailability === 'conditional' ? ['替代主词方向'] : []),
    ...(branchSetPlan?.pattern === '4+2' || branchSetPlan?.pattern === '4+unconfirmed'
      ? [
          `四件套：${planSetNames(branchSetPlan.primarySets)}`,
          `二件套：${planSetNames(branchSetPlan.secondarySets)}`,
        ]
      : []),
    ...(branchSetPlan?.pattern === '2+2+2'
      ? [`二件套组合：${planSetNames(branchSetPlan.primarySets)}`]
      : []),
    ...(!branchSetPlan && fourPieceSetNames.length
      ? [`四件套：${fourPieceSetNames.join(' / ')}`]
      : []),
    ...(conditions.length ? [`条件：${conditions.join('；')}`] : []),
    ...(validMainStats.length ? [`有效主词：${validMainStats.join('；')}`] : []),
    ...(profile.coreStats?.length
      ? [`核心词条：${profile.coreStats.map(statLabel).join(' / ')}`]
      : []),
    ...(use?.functionDetail ? [`功能：${semanticText(use.functionDetail)}`] : []),
  ]
  return { label, dimensions: [...new Set(dimensions)] }
}

function sourceLink(source: PlayerBuildSource): RetentionSourceLink | null {
  if (!source.verified) return null
  try {
    const url = new URL(source.url)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    const labels: Record<string, string> = {
      'wiki.biligame.com': 'BWIKI 构筑资料',
      'www.prydwen.gg': 'Prydwen 构筑攻略',
      'zzz.gachabase.net': 'Gachabase 正式服资料',
      'mobalytics.gg': 'Mobalytics 构筑攻略',
      'www.hoyolab.com': 'HoYoLAB 攻略',
      'www.miyoushe.com': '米游社攻略',
      'www.bilibili.com': '哔哩哔哩攻略',
      'github.com': '上游机制资料',
    }
    return {
      label: labels[url.hostname] ?? url.hostname,
      url: url.href,
      sourceVersion: source.sourceVersion,
    }
  } catch {
    return null
  }
}

/** Project the exact scored branch; never merge another build's stat preferences. */
export function retentionUseGuidance(
  disc: DriveDisc,
  use: QualityEvidence,
  profile: Profile | undefined,
  policy: QualityPolicy,
): WarehouseRetentionGuidance | undefined {
  if (!profile) return undefined
  const constraint = getCandidateWarehouseConstraint(profile.agentId)
  const sources = [
    ...(constraint?.sources ?? []),
    ...(constraint?.mainStatAlternatives ?? []).map((entry) => entry.source),
  ]
    .filter((source) => profile.sourceIds.some((id) => id.startsWith(`${source.id}:`)))
    .map(sourceLink)
    .filter((source): source is RetentionSourceLink => source !== null)
  const set = getCurrentDriveDiscRecommendation(disc.setId)
  const threshold = policy.investment?.meaningfulWeightFrom ?? 0.5
  const semantics = retentionProfileSemantics(profile, use)
  const branchSetPlan = branchSetPlanGuidance(profile)
  const weighted = Object.entries(profile.weights).filter(
    ([stat, weight]) => weight > 0 && stat !== disc.mainStat,
  )
  const matched = use.contributors.filter((entry) => entry.points > 0).map((entry) => entry.stat)
  return {
    profileLabel: semantics.label,
    profileDimensions: semantics.dimensions,
    currentSet: {
      id: disc.setId,
      name: set?.name ?? null,
    },
    ...(branchSetPlan ? { branchSetPlan } : {}),
    mainStats:
      disc.slot <= 3
        ? [disc.mainStat]
        : Object.entries(profile.mainStatsBySlot[String(disc.slot)] ?? {})
            .filter(([, fit]) => fit === 'valid')
            .map(([stat]) => stat),
    subStats: weighted.filter(([, weight]) => weight >= threshold).map(([stat]) => stat),
    matchedStats: matched,
    minorStats: weighted.filter(([, weight]) => weight < threshold).map(([stat]) => stat),
    unusedStats: disc.subStats
      .filter((entry) => !matched.includes(entry.stat))
      .map((entry) => entry.stat),
    minimumLines:
      use.investment.minimumLines ??
      (disc.slot <= 3
        ? policy.investment?.leftSlotMinimumLines
        : policy.investment?.rightSlotMinimumLines) ??
      null,
    minimumCoreLines:
      use.investment.minimumCoreLines ?? policy.investment?.minimumCoreLines ?? null,
    twoPieceEffect: set?.twoPieceEffect ?? null,
    fourPieceEffect: set?.fourPieceEffect ?? null,
    sources: [...new Map(sources.map((source) => [source.url, source])).values()],
  }
}
