import type { ScanImportItem } from '../domain/scanImportStaging'
import { browserDiagnostic, diagnosticFromSnapshot, sanitizeScanDiagnostic } from './diagnostics'
import type { ScannerAssistantSnapshot } from './runtime'

const reviewCategories = [
  { key: 'unresolvedSet', label: '套装名称未确认', codes: ['missing_set', 'evidence_only_set'] },
  {
    key: 'unresolvedMainStat',
    label: '主词条信息不完整',
    codes: ['missing_main_stat', 'missing_main_stat_value'],
  },
  {
    key: 'unresolvedSubStat',
    label: '副词条信息不完整',
    codes: ['missing_sub_stat', 'sub_stat_count'],
  },
  {
    key: 'invalidValue',
    label: '词条或等级校验未通过',
    codes: [
      'illegal_main_stat',
      'main_stat_value_mismatch',
      'level_out_of_range',
      'duplicate_sub_stat',
      'sub_stat_value_mismatch',
    ],
  },
] as const

/** Count affected records only. Never include OCR text, values, paths or account identifiers. */
export function summarizeImportReview(items: ScanImportItem[]) {
  const blocked = items.filter(
    (item) => item.state === 'needs_review' || item.state === 'invalid' || item.duplicate,
  )
  const counts: Record<string, number> = { reviewRequired: blocked.length }
  const categories: { key: string; label: string; count: number }[] = reviewCategories.map(
    ({ key, label, codes }) => {
      const count = blocked.filter((item) =>
        item.issues.some((issue) => (codes as readonly string[]).includes(issue.code)),
      ).length
      counts[key] = count
      return { key, label, count }
    },
  )
  const knownCodes = new Set<string>(reviewCategories.flatMap(({ codes }) => [...codes]))
  counts.otherReview = blocked.filter(
    (item) => !item.issues.length || item.issues.some((issue) => !knownCodes.has(issue.code)),
  ).length
  categories.push({ key: 'otherReview', label: '其他检查问题', count: counts.otherReview })
  const first = blocked.reduce<number | undefined>(
    (sequence, item) =>
      sequence === undefined ? item.sequence : Math.min(sequence, item.sequence),
    undefined,
  )
  return { counts, categories: categories.filter(({ count }) => count > 0), first }
}

export function createImportReviewDiagnostic(
  items: ScanImportItem[],
  reportId: string,
  snapshot?: ScannerAssistantSnapshot,
) {
  const review = summarizeImportReview(items)
  const native = snapshot ? diagnosticFromSnapshot(snapshot, reportId) : null
  return sanitizeScanDiagnostic({
    ...native,
    schema: 1,
    reportId: native?.reportId ?? reportId,
    release: import.meta.env.VITE_SODA_RELEASE_ID || 'local-development',
    outcome: 'failed',
    stage: 'import',
    code: 'scan_import_review_required',
    versions: native?.versions ?? {},
    counts: {
      ...(native?.counts ?? { processed: items.length, total: items.length }),
      ...review.counts,
    },
    durationMs: native?.durationMs ?? null,
    environment: native?.environment ?? browserDiagnostic(navigator.userAgent),
    evidence: {
      diagnosticSource: 'import_preflight',
      ...(review.first === undefined ? {} : { itemIndex: review.first }),
    },
  })!
}
