import type { ScanImportItem } from './scanImportStaging'
export function summarizeScanImportItems(items: ScanImportItem[]) {
  return {
    total: items.length,
    ready: items.filter((item) => item.state === 'ready').length,
    needsReview: items.filter((item) => item.state === 'needs_review').length,
    invalid: items.filter((item) => item.state === 'invalid').length,
    imported: items.filter((item) => item.state === 'imported').length,
    duplicate: items.filter((item) => item.duplicate).length,
    // Legacy R4 records retain their capture-time lock evidence, but lock state is no
    // longer a Soda product result or review/import gate.
    lockUnknown: 0,
  }
}
