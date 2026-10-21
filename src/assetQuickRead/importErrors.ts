export type AssetQuickReadImportCode =
  | 'import_review_required'
  | 'import_recovery_limit_reached'
  | 'import_snapshot_reused'
  | 'import_snapshot_invalid'
  | 'import_snapshot_update_required'
  | 'import_data_unavailable'
  | 'import_preflight_failed'
  | 'import_identity_conflict'
  | 'import_snapshot_stale'
  | 'import_scope_changed'
  | 'import_account_changed'
  | 'import_conservation_failed'
  | 'import_restore_unavailable'
  | 'import_restore_conflict'
  | 'import_restore_conservation_failed'

/** The local explanation stays in the UI; diagnostics contain only this fixed code. */
export class AssetQuickReadImportError extends Error {
  readonly diagnosticCode: AssetQuickReadImportCode
  constructor(diagnosticCode: AssetQuickReadImportCode, message: string) {
    super(message)
    this.diagnosticCode = diagnosticCode
  }
}
