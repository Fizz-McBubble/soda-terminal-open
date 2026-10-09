import {
  createScanBatchManifest,
  type ScanImportItem,
  type ScanImportStagingBatch,
} from '../domain/scanImportStaging'
import { createReadyScannerStaging } from './scannerAssistantPageTestSupport'
import { createScannerRuntimeSnapshot } from './scannerAssistantTestFixture'

/** Synthetic acceptance sample: no original OCR, account identifiers or capture paths. */
export function createCalibrationTestFixture() {
  const source = createReadyScannerStaging(3)
  const at = '2026-10-09T12:00:00.000Z'
  const answers = source.items.map((item, index) => ({
    ...structuredClone(item.candidate),
    subStats: item.candidate.subStats.map((row, n) => ({
      ...row,
      value: n === 0 ? 14.4 : n === 1 ? 3 * (index + 1) : n === 3 ? 9 * (3 - index) : row.value,
      upgrades: n === 0 ? 2 : n === 1 ? index : n === 3 ? 2 - index : row.upgrades,
      rawText: '',
      confidence: 'high' as const,
    })),
  }))
  const items: ScanImportItem[] = answers.map((answer, index) => ({
    id: `calibration-sample-item-${index + 1}`,
    batchId: 'calibration-sample-batch',
    sourceIdentity: `calibration-sample-source-${index + 1}`,
    sequence: index + 1,
    state: 'ready',
    duplicate: false,
    fingerprint: `calibration-sample-fingerprint-${index + 1}`,
    lockState: 'unknown',
    candidate: structuredClone(answer),
    fields: {},
    confirmations: [],
    issues: [],
    evidence: {
      detailPath: `synthetic/detail-${index + 1}.svg`,
      cardPath: `synthetic/card-${index + 1}.svg`,
      visualDetailHash: `sha256:${String(index + 1).repeat(64)}`,
      rawText: {},
    },
    updatedAt: at,
  }))
  items[0].candidate.setId = null
  items[0].candidate.setName = null
  items[0].candidate.subStats[0].stat = null
  items[0].candidate.subStats[0].value = null
  items[0].candidate.subStats[0].upgrades = null
  items[1].candidate.mainStatValue = 999
  const batch = {
    id: 'calibration-sample-batch',
    source: 'synthetic-local-sample',
    createdAt: at,
    updatedAt: at,
    dataVersion: source.batch.dataVersion,
    recognitionVersion: 'paddleocr-synthetic-sample',
    sourceReport: 'synthetic-local-sample',
    total: 3,
    importHistory: [],
    reviewState: {
      revision: 0,
      preflight: 'stale' as const,
      preflightRevision: null,
      armedRevision: null,
    },
  }
  const staging: ScanImportStagingBatch = {
    format: source.format,
    formatVersion: source.formatVersion,
    items,
    batch: {
      ...batch,
      manifest: createScanBatchManifest(batch, items, {
        expectedTotal: 3,
        gameVersion: '3.1',
        scanConfigIdentity: 'synthetic-local-sample',
        viewport: '1920x1080',
      }),
    },
  }
  const snapshot = {
    ...createScannerRuntimeSnapshot('completed'),
    summary: {
      reliable: 1,
      needsReview: 2,
      unreadable: 0,
      uniqueRecords: 3,
      resultStatus: 'needs_review',
      resultFileHandle: 'calibration-sample-result.json',
    },
  }
  return { staging, snapshot, answers }
}
