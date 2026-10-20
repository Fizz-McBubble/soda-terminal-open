import { sampleDiscs } from '../evaluation/fixtures'
import type { DriveDisc } from '../domain/schemas'
import type { CandidateWarehouseConstraint } from './candidateWarehouseConstraints'

/** One physical, legal-slot 4+2 inventory for the source-qualified recipe tests. */
export function candidateFourPieceInventory(
  constraint: CandidateWarehouseConstraint,
  primary: string,
  secondary: string,
  idPrefix = primary,
): DriveDisc[] {
  const mains: DriveDisc['mainStat'][] = [
    'hp_flat',
    'atk_flat',
    'def_flat',
    ...(['4', '5', '6'] as const).map((slot) => constraint.mainStats[slot]![0]!),
  ]
  const candidateLines = [
    ['crit_rate', 2.4],
    ['crit_dmg', 4.8],
    ['atk_percent', 3],
    ['hp_percent', 3],
    ['def_percent', 4.8],
    ['pen', 9],
    ['anomaly_proficiency', 9],
    ['atk_flat', 19],
    ['hp_flat', 112],
    ['def_flat', 15],
  ] as const
  return mains.map((mainStat, index) => {
    const subStats = candidateLines
      .filter(([stat]) => stat !== mainStat)
      .slice(0, 4)
      .map(([stat, step], lineIndex) => {
        const upgrades = lineIndex === 0 ? 2 : 1
        return { stat, value: step * (upgrades + 1), upgrades }
      })
    return {
      ...sampleDiscs.treasureCandidate,
      id: `${idPrefix}-${index + 1}`,
      slot: (index + 1) as DriveDisc['slot'],
      setId: index < 4 ? primary : secondary,
      mainStat,
      subStats,
    }
  })
}

export function legalSubStats(mainStat: DriveDisc['mainStat']) {
  return (
    [
      ['crit_rate', 2.4],
      ['crit_dmg', 4.8],
      ['atk_percent', 3],
      ['hp_percent', 3],
      ['def_percent', 4.8],
      ['pen', 9],
      ['anomaly_proficiency', 9],
      ['atk_flat', 19],
      ['hp_flat', 112],
      ['def_flat', 15],
    ] as const
  )
    .filter(([stat]) => stat !== mainStat)
    .slice(0, 4)
    .map(([stat, step], index) => {
      const upgrades = index === 0 ? 2 : 1
      return { stat, value: step * (upgrades + 1), upgrades }
    })
}
