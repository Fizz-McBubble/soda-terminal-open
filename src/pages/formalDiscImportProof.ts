export function hasCompletedFormalImportProof(input: {
  expectedTotal: number | null
  itemCount: number
  importedCount: number
  formalDiscCount: number
  auditImportedCount?: number
  auditSkippedCount?: number
}) {
  return (
    input.expectedTotal !== null &&
    input.expectedTotal > 0 &&
    input.itemCount === input.expectedTotal &&
    input.importedCount === input.expectedTotal &&
    input.formalDiscCount === input.expectedTotal &&
    input.auditImportedCount === input.expectedTotal &&
    input.auditSkippedCount === 0
  )
}
