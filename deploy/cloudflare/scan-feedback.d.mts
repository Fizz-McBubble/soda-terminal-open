import type { ScanDiagnosticReport } from '../../src/scanner/diagnostics'

/** Type bridge for the existing browser/server diagnostic protocol parity check. */
export function sanitizeScanFeedbackPayload(
  payload: unknown,
  expectedRelease?: string,
): { status: 400 | 409 | 413 } | { ok: true; record: ScanDiagnosticReport }
