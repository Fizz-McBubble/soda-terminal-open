import type { DiscFact } from '../features/agentDevelopmentGolden/types'
import { getCandidateStatLabels } from '../application/publicCandidateLabels'
import type { AccountDiscChoice } from '../optimizer/optimizeAccountBuilds'
import type { DriveDisc, DriveDiscDataManifest, StatKey } from '../domain/schemas'
import { scoringDiscRecordIssue } from '../domain/discScoringInput'
import { formatDiscStatValue as formatDiscStatValueWithRules } from './publicDiscFacts'

/**
 * Player-facing disc facts have one implementation; each build only binds its allowed sources: the
 * value rules and set-name resolution plus the reviewed preferred sub-stat keys for one agent.
 */
export type DiscFactPresentationSources = {
  rules: DriveDiscDataManifest['rules'] | null | undefined
  displayDriveDiscSet: (setId: string) => string
  /** Null means the agent has no published/reviewed direction at all. */
  preferredStatKeysFor: (agentId: string) => string[] | null
}

export function createDiscFactPresentation(sources: DiscFactPresentationSources) {
  const preferredKeys = new Map<string, Set<string> | null>()

  function effectiveStatsFor(agentId: string) {
    if (!preferredKeys.has(agentId)) {
      const keys = sources.preferredStatKeysFor(agentId)
      preferredKeys.set(agentId, keys ? new Set(keys) : null)
    }
    return preferredKeys.get(agentId) ?? null
  }

  function formatDiscStatValue(stat: StatKey, value: number, prefix = '') {
    return formatDiscStatValueWithRules(stat, value, prefix, sources.rules ?? undefined)
  }

  function discGradeFor(score: number | undefined): DiscFact['grade'] {
    if (score === undefined || !Number.isFinite(score)) return '未评定'
    if (score >= 75) return 'A+'
    if (score >= 50) return 'A'
    return 'B+'
  }

  /**
   * The caller supplies the already-authoritative allocation choice and the context-specific
   * main-stat value; this adapter never scores or allocates.
   */
  function presentDiscFactFromChoice({
    agentId,
    choice,
    disc,
    set,
    mainValue,
  }: {
    agentId: string
    choice: AccountDiscChoice | null
    disc: DriveDisc
    set: string
    mainValue: string
  }): DiscFact {
    const eligible = scoringDiscRecordIssue(disc, sources.rules) === null
    const reviewed = eligible ? effectiveStatsFor(agentId) : null
    const score = eligible && choice && Number.isFinite(choice.score) ? choice.score : undefined
    const effectiveStats = new Set(
      disc.subStats
        .filter((stat) => (reviewed ? reviewed.has(stat.stat) : false))
        .map((stat) => stat.stat),
    )
    const effectiveEnhancements = disc.subStats
      .filter((stat) => effectiveStats.has(stat.stat))
      .reduce((total, stat) => total + stat.upgrades + 1, 0)
    return {
      id: disc.id,
      recordedStatKeys: [disc.mainStat, ...disc.subStats.map((sub) => sub.stat)],
      label: `实体盘 ${disc.slot}号位`,
      slot: disc.slot,
      set,
      image: null,
      visual: {
        entityType: 'drive_disc_set',
        entityId: disc.setId,
        name: set,
      },
      level: disc.level,
      main: getCandidateStatLabels([disc.mainStat], '主词条')[0] ?? '主词条待补',
      mainValue,
      subs: Array.from({ length: 4 }, (_, index) => {
        const subStat = disc.subStats[index]
        return subStat
          ? {
              name: getCandidateStatLabels([subStat.stat], '副词条')[0] ?? '副词条待补',
              value: formatDiscStatValue(subStat.stat, subStat.value),
              // The initial sub-stat line is not a game enhancement. Keep its value,
              // but show only actual +N upgrade hits to match the in-game panel.
              hits: subStat.upgrades,
              effective: reviewed ? effectiveStats.has(subStat.stat) : false,
            }
          : { name: '未录入', value: '—', hits: 0, effective: false }
      }),
      effective: reviewed ? `${effectiveEnhancements} 次命中` : '尚未评定',
      grade: discGradeFor(score),
      score: score === undefined ? undefined : Math.round(score * 10) / 10,
    }
  }

  return {
    formatDiscStatValue,
    discGradeFor,
    displayDriveDiscSet: sources.displayDriveDiscSet,
    presentDiscFactFromChoice,
  }
}
