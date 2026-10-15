import { afterEach, describe, expect, it, vi } from 'vitest'
import { sanitizeScanFeedbackPayload } from '../../deploy/cloudflare/scan-feedback.mjs'
import type { ScanImportItem } from '../domain/scanImportStaging'
import { createImportReviewDiagnostic, summarizeImportReview } from './importReviewDiagnostic'
import { connectingSnapshot } from './runtimeSnapshots'
import { sanitizeScanDiagnostic } from './diagnostics'
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

  it('counts explicit missing components and exact parser tokens once per blocked disc', () => {
    const blocked = item(1, ['missing_main_stat', 'missing_sub_stat'])
    blocked.candidate = {
      ...blocked.candidate,
      mainStat: null,
      mainStatValue: null,
      subStats: [
        { stat: null, value: null, upgrades: null, rawText: 'private', confidence: 'low' },
        { stat: null, value: null, upgrades: null, rawText: 'private', confidence: 'low' },
        {
          stat: 'hp_flat' as const,
          value: 112,
          upgrades: 0,
          rawText: 'private',
          confidence: 'high',
        },
      ],
    }
    const tokens = [
      'diagnostic=stat_domain_ambiguous',
      'diagnostic=substat_domain_incomplete',
      'root=parser_root_unknown',
    ]
    blocked.fields = Object.fromEntries(
      ['mainStat', 'subStats.0'].map((field) => [
        field,
        {
          rawText: 'private OCR',
          normalizedValue: 'private-value',
          confidence: 'low',
          evidence: [...tokens, ...tokens, 'diagnostic=private', 'prefix root=parser_root_unknown'],
          rule: 'private-rule',
          source: 'private-source',
        },
      ]),
    )
    const report = createImportReviewDiagnostic([blocked, { ...blocked, state: 'ready' }], reportId)
    expect(report.counts).toMatchObject({
      mainNameMissing: 1,
      mainValueMissing: 1,
      subNameMissing: 1,
      subValueMissing: 1,
      subUpgradesMissing: 1,
      subInternalGap: 1,
      parserAmbiguous: 1,
      parserIncomplete: 1,
      parserUnknown: 1,
    })
    expect(sanitizeScanDiagnostic(report)).toEqual(report)
    expect(sanitizeScanFeedbackPayload(report)).toEqual({ ok: true, record: report })
    expect(new TextEncoder().encode(JSON.stringify(report)).length).toBeLessThanOrEqual(4096)
    expect(JSON.stringify(report)).not.toMatch(/private|112|stat_domain|parser_root/)
    const contaminated = {
      ...report,
      rawText: 'private OCR',
      accountId: 'private-account',
      counts: { ...report.counts, privatePath: "soda-source-ref:11722a25453694ffb98f9398fd5716d7", unknownReason: 1 },
      evidence: { ...report.evidence, rawText: 'private OCR', token: tokens[0] },
    }
    expect(sanitizeScanDiagnostic(contaminated)).toEqual(report)
    expect(sanitizeScanFeedbackPayload(contaminated)).toEqual({ status: 400 })
  })

  it('keeps unknown fields unknown and never treats legal short rows or unrecognized tail as an internal gap', () => {
    const legal = item(1, ['missing_set'])
    legal.candidate = {
      ...legal.candidate,
      level: 0,
      mainStat: 'hp_flat' as const,
      mainStatValue: 550,
      subStats: Array.from({ length: 3 }, () => ({
        stat: 'hp_flat' as const,
        value: 112,
        upgrades: 0,
        rawText: 'private',
        confidence: 'high' as const,
      })),
    }
    const tail = {
      ...legal,
      sequence: 2,
      candidate: {
        ...legal.candidate,
        subStats: [
          ...legal.candidate.subStats,
          {
            stat: null,
            value: null,
            upgrades: null,
            rawText: 'private unrecognized tail',
            confidence: 'low' as const,
          },
        ],
      },
    }
    const unknown = item(3, ['missing_sub_stat'])
    unknown.fields = {
      other: {
        rawText: 'private',
        normalizedValue: null,
        confidence: 'low',
        rule: 'private',
        source: 'private',
        evidence: ['root=parser_root_unknown private', 'diagnostic=stat_domain_ambiguous_extra'],
      },
    }
    const counts = summarizeImportReview([legal, tail, unknown]).counts
    expect(counts).toMatchObject({ subNameMissing: 1, subValueMissing: 1, subUpgradesMissing: 1 })
    for (const key of [
      'mainNameMissing',
      'mainValueMissing',
      'subInternalGap',
      'parserAmbiguous',
      'parserIncomplete',
      'parserUnknown',
    ])
      expect(counts).not.toHaveProperty(key)
  })

  it('preserves all new bounded counters through both sanitizers', () => {
    const report = createImportReviewDiagnostic([], reportId)
    const keys = [
      'mainNameMissing',
      'mainValueMissing',
      'subNameMissing',
      'subValueMissing',
      'subUpgradesMissing',
      'subInternalGap',
      'parserAmbiguous',
      'parserIncomplete',
      'parserUnknown',
    ]
    const full = {
      ...report,
      counts: { ...report.counts, ...Object.fromEntries(keys.map((key) => [key, 200000])) },
    }
    expect(sanitizeScanDiagnostic(full)).toEqual(full)
    expect(sanitizeScanFeedbackPayload(full)).toEqual({ ok: true, record: full })
    for (const invalid of [-1, 1.5, 200001, '1']) {
      const bad = { ...full, counts: { ...full.counts, parserUnknown: invalid } }
      expect(sanitizeScanDiagnostic(bad)?.counts).not.toHaveProperty('parserUnknown')
      expect(sanitizeScanFeedbackPayload(bad)).toEqual({ status: 400 })
    }
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
