import { scanReviewSnapshotSchema } from './scanImportStagingSchemas'
import type { ScanImportItem, ScanImportReviewPatch } from './scanImportStagingSchemas'

type Candidate = ScanImportItem['candidate']
const scalarFields = ['slot', 'level', 'rarity', 'mainStat', 'mainStatValue'] as const
const semanticSubStat = (value: Candidate['subStats'][number] | undefined) =>
  value ? { stat: value.stat, value: value.value, upgrades: value.upgrades } : null
const equal = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right)

/** OCR text and confidence are provenance, not editable candidate values. */
export function getScanCalibrationFields(before: Candidate, after: Candidate): string[] {
  const fields: string[] = []
  if (before.setId !== after.setId || before.setName !== after.setName) fields.push('setName')
  for (const field of scalarFields) if (before[field] !== after[field]) fields.push(field)
  if (before.subStats.length !== after.subStats.length) fields.push('subStats')
  else
    before.subStats.forEach((value, index) => {
      if (!equal(semanticSubStat(value), semanticSubStat(after.subStats[index])))
        fields.push(`subStats.${index}`)
    })
  return fields
}

export function isScanCalibrationField(field: string, candidate: Candidate) {
  return (
    field === 'setName' ||
    field === 'subStats' ||
    scalarFields.some((name) => name === field) ||
    (/^subStats\.[0-3]$/.test(field) && Number(field.slice(9)) < candidate.subStats.length)
  )
}

/** Apply only declared semantics, retaining original OCR metadata for existing rows. */
export function applyScanReviewFields(
  input: Pick<ScanImportItem, 'candidate' | 'lockState'>,
  patch: ScanImportReviewPatch,
  fields: string[],
) {
  const candidate = structuredClone(input.candidate)
  if (fields.includes('setName')) {
    candidate.setId = patch.candidate.setId
    candidate.setName = patch.candidate.setName
  }
  for (const field of scalarFields)
    if (fields.includes(field)) Object.assign(candidate, { [field]: patch.candidate[field] })
  const aggregate = fields.includes('subStats')
  const rows = aggregate ? patch.candidate.subStats : candidate.subStats
  candidate.subStats = rows.map((row, index) => {
    const before = input.candidate.subStats[index]
    const declared = aggregate || fields.includes(`subStats.${index}`)
    if (!declared) return row
    const value = patch.candidate.subStats[index]!
    const changed = !equal(semanticSubStat(before), semanticSubStat(value))
    return {
      ...semanticSubStat(value)!,
      rawText: before?.rawText ?? '',
      confidence:
        aggregate && !changed ? (before?.confidence ?? value.confidence) : ('high' as const),
    }
  })
  return {
    candidate,
    lockState: fields.includes('lockState') ? patch.lockState : input.lockState,
  }
}

export function validateScanReviewPatch(
  input: ScanImportItem,
  patch: ScanImportReviewPatch,
  rejectUndeclaredChanges = false,
) {
  const parsed = scanReviewSnapshotSchema.parse(patch)
  const fields = patch.fields
  if (!fields) return parsed
  if (
    fields.some(
      (field) => field !== 'lockState' && !isScanCalibrationField(field, parsed.candidate),
    )
  )
    throw new Error('包含未知或越界的复核字段。')
  const changed = getScanCalibrationFields(input.candidate, parsed.candidate)
  if (input.lockState !== parsed.lockState) changed.push('lockState')
  if (
    rejectUndeclaredChanges &&
    changed.some(
      (field) =>
        !fields.includes(field) && !(field.startsWith('subStats.') && fields.includes('subStats')),
    )
  )
    throw new Error('候选内容包含未声明的复核字段修改。')
  return parsed
}
