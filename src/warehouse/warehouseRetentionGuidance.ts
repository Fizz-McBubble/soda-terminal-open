import type { DriveDisc } from '../domain/schemas'
import { getCandidateWarehouseConstraint } from '../gameDataPacks/candidateWarehouseConstraints'
import { getCurrentDriveDiscRecommendation } from '../gameDataPacks/currentDriveDiscRecommendationCatalog'
import type { PlayerBuildSource } from '../gameDataPacks/playerBuildSources'
import type { Profile, QualityEvidence, QualityPolicy } from './absoluteDiscRetentionContract'

export type RetentionSourceLink = {
  label: string
  url: string
  sourceVersion: string | null
}

export type WarehouseRetentionGuidance = {
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
  const weighted = Object.entries(profile.weights).filter(
    ([stat, weight]) => weight > 0 && stat !== disc.mainStat,
  )
  const matched = use.contributors.filter((entry) => entry.points > 0).map((entry) => entry.stat)
  return {
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
