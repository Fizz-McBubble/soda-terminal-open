import { isReportId } from './diagnostics'

export const importReviewDiagnosticIdentityKey = 'soda.scanner.review-diagnostic-identity.v1'

/** One local source binding; the account/batch scope never enters a feedback payload. */
export function readImportReviewDiagnosticId(sourceKey: string): string | null {
  try {
    const stored = localStorage.getItem(importReviewDiagnosticIdentityKey)
    if (!stored || stored.length > 1280) return null
    const value = JSON.parse(stored)
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      Object.keys(value).length !== 3 ||
      value.schema !== 1 ||
      value.sourceKey !== sourceKey ||
      !isReportId(value.reportId)
    )
      return null
    return value.reportId
  } catch {
    return null
  }
}

export function saveImportReviewDiagnosticId(sourceKey: string, reportId: string) {
  if (!sourceKey || sourceKey.length > 1024 || !isReportId(reportId)) return
  try {
    localStorage.setItem(
      importReviewDiagnosticIdentityKey,
      JSON.stringify({ schema: 1, sourceKey, reportId }),
    )
  } catch {
    // The current card still works when browser storage is unavailable.
  }
}
