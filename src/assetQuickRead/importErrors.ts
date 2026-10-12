export type AssetQuickReadImportCode =
  | 'import_review_required'
  | 'import_recovery_limit_reached'
  | 'import_snapshot_reused'

/** The local explanation stays in the UI; diagnostics contain only this fixed code. */
export class AssetQuickReadImportError extends Error {
  readonly diagnosticCode: AssetQuickReadImportCode
  constructor(diagnosticCode: AssetQuickReadImportCode, message: string) {
    super(message)
    this.diagnosticCode = diagnosticCode
  }
}
