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
  return mains.map((mainStat, index) => ({
    ...sampleDiscs.treasureCandidate,
    id: `${idPrefix}-${index + 1}`,
    slot: (index + 1) as DriveDisc['slot'],
    setId: index < 4 ? primary : secondary,
    mainStat,
  }))
}
