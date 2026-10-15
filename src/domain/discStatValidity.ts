import type { StatKey } from './schemas'

/** Known main/substat identities cannot coexist on the same disc. Unknown OCR rows
 * remain available for review and are not inferred from values or text. */
export function mainSubStatConflictIndices(
  mainStat: StatKey | null | undefined,
  subStats: readonly { stat: StatKey | null | undefined }[],
): number[] {
  if (!mainStat) return []
  return subStats.flatMap((row, index) => (row.stat === mainStat ? [index] : []))
}
