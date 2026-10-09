import { afterEach, describe, expect, it, vi } from 'vitest'
import { sanitizeScanFeedbackPayload } from '../../deploy/cloudflare/scan-feedback.mjs'
import type { ScanImportItem } from '../domain/scanImportStaging'
import { createImportReviewDiagnostic, summarizeImportReview } from './importReviewDiagnostic'
import { connectingSnapshot } from './runtimeSnapshots'
import {
  importReviewDiagnosticIdentityKey,
  readImportReviewDiagnosticId,
  saveImportReviewDiagnosticId,
} from './importReviewDiagnosticIdentity'

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

const reportId = '10f44460-1234-4123-8123-abc123abc123'
function item(sequence: number, codes: string[], state: ScanImportItem['state'] = 'needs_review') {
  return {
    sequence,
    state,
    issues: codes.map((code) => ({ code, message: 'private OCR text', field: 'private field' })),
    candidate: { setName: 'private disc name', subStats: [{ value: 123.4 }] },
    evidence: { detailPath: "soda-source-ref:63a1a370606acdfda3551a659b051a85" },
    accountId: 'private-account',
  } as unknown as ScanImportItem
}

describe('import review diagnostics', () => {
  it('restores a fallback identity only for the same local account and batch', () => {
    const scope = JSON.stringify(['private-account', 'batch-one'])
    saveImportReviewDiagnosticId(scope, reportId)
    expect(readImportReviewDiagnosticId(scope)).toBe(reportId)
    expect(readImportReviewDiagnosticId(JSON.stringify(['other-account', 'batch-one']))).toBeNull()
    expect(
      readImportReviewDiagnosticId(JSON.stringify(['private-account', 'batch-two'])),
    ).toBeNull()
    expect(
      JSON.stringify(createImportReviewDiagnostic([item(1, ['missing_set'])], reportId)),
    ).not.toMatch(/private-account|batch-one/)
  })

  it('ignores corrupted identity storage and still permits in-memory diagnostics when storage is denied', () => {
    localStorage.setItem(
      importReviewDiagnosticIdentityKey,
      JSON.stringify({ schema: 1, sourceKey: 'source', reportId, unexpected: true }),
    )
    expect(readImportReviewDiagnosticId('source')).toBeNull()
    localStorage.setItem(importReviewDiagnosticIdentityKey, 'invalid-json')
    expect(readImportReviewDiagnosticId('source')).toBeNull()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('disabled')
    })
    expect(() => saveImportReviewDiagnosticId('source', reportId)).not.toThrow()
  })
  it('counts affected records once and groups missing names, terms, invalid values and unknown issues', () => {
    const items = [
      item(8, ['missing_set', 'missing_sub_stat', 'missing_sub_stat']),
      item(2, ['missing_main_stat', 'missing_main_stat_value']),
      item(5, ['sub_stat_value_mismatch'], 'invalid'),
      item(6, ['unrecognized-private-code']),
      item(7, [], 'ready'),
    ]
    expect(summarizeImportReview(items)).toMatchObject({
      first: 2,
      counts: {
        reviewRequired: 4,
        unresolvedSet: 1,
        unresolvedMainStat: 1,
        unresolvedSubStat: 1,
        invalidValue: 1,
        otherReview: 1,
      },
    })
    const report = createImportReviewDiagnostic(items, reportId)
    expect(report).toMatchObject({
      code: 'scan_import_review_required',
      outcome: 'failed',
      stage: 'import',
      versions: {},
      counts: { processed: 5, total: 5, reviewRequired: 4 },
      evidence: { diagnosticSource: 'import_preflight', itemIndex: 2 },
    })
    expect(JSON.stringify(report)).not.toMatch(/private|123\.4|screenshot/)
    expect(sanitizeScanFeedbackPayload(report)).toEqual({ ok: true, record: report })
  })

  it('keeps matched scanner versions and completion counts separate from import issues', () => {
    const report = createImportReviewDiagnostic([item(11, ['missing_set'])], reportId, {
      ...connectingSnapshot,
      state: 'completed',
      diagnostics: {
        reportId,
        code: 'none',
        outcome: 'completed',
        stage: 'result',
        versions: { helper: '2.3.9', ocr: 'PP-OCRv6' },
        counts: { processed: 50, total: 50, failed: 0 },
        durationMs: 12000,
        environment: { width: 2560, height: 1440 },
        evidence: { itemIndex: 50 },
      },
    })
    expect(report).toMatchObject({
      reportId,
      outcome: 'failed',
      stage: 'import',
      versions: { helper: '2.3.9', ocr: 'PP-OCRv6' },
      counts: { processed: 50, total: 50, failed: 0, reviewRequired: 1 },
      evidence: { diagnosticSource: 'import_preflight', itemIndex: 11 },
    })
    expect(sanitizeScanFeedbackPayload(report)).toEqual({ ok: true, record: report })
  })

  it('also counts invalid-only and duplicate-only results and never fabricates missing detail', () => {
    const report = createImportReviewDiagnostic(
      [item(3, ['illegal_main_stat'], 'invalid'), { ...item(9, [], 'ready'), duplicate: true }],
      reportId,
    )
    expect(report.counts).toMatchObject({ reviewRequired: 2, invalidValue: 1, otherReview: 1 })
    expect(report.durationMs).toBeNull()
    expect(report.environment).not.toHaveProperty('width')
  })
})
