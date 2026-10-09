import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import Dexie from 'dexie'
import { database } from '../db/database'
import { createScanBatchManifest, scanImportStagingBatchSchema } from '../domain/scanImportStaging'
import type { vi } from 'vitest'

export const scannerContentStyles = readFileSync(
  resolve(process.cwd(), 'src/styles/f5-golden-scanner-content-base.css'),
  'utf8',
)

export async function resetScannerPageTestDatabase() {
  database.close()
  await Dexie.delete(database.name)
  await database.open()
  sessionStorage.clear()
  localStorage.clear()
}

export async function cleanupScannerPageTestDatabase() {
  database.close()
  await Dexie.delete(database.name)
}

export function createReadyScannerStaging(total = 1) {
  // Synthetic records keep page regressions independent of private account recovery samples.
  const at = '2026-07-31T10:00:00.000Z'
  const source = scanImportStagingBatchSchema.parse({
    format: 'soda-terminal-scan-staging',
    formatVersion: 1,
    batch: {
      id: 'scanner-synthetic-page-test',
      source: 'synthetic-page-test',
      createdAt: at,
      updatedAt: at,
      dataVersion: 'zzz-drive-disc-3.2',
      recognitionVersion: 'paddleocr-pp-ocrv6-small',
      sourceReport: 'test-fixture://scanner-page/summary',
      total: 1,
    },
    items: [
      {
        id: 'scanner-synthetic-item',
        batchId: 'scanner-synthetic-page-test',
        sequence: 1,
        sourceIdentity: 'scanner-synthetic-source',
        state: 'ready',
        duplicate: false,
        fingerprint: 'scanner-synthetic-fingerprint',
        lockState: 'unknown',
        candidate: {
          setId: 'set-wuthering-salon',
          setName: '呼啸沙龙',
          slot: 2,
          level: 15,
          rarity: 'S',
          mainStat: 'atk_flat',
          mainStatValue: 316,
          subStats: [
            {
              stat: 'crit_dmg',
              value: 9.6,
              upgrades: 1,
              rawText: '暴击伤害 9.6%',
              confidence: 'high',
            },
            {
              stat: 'atk_percent',
              value: 3,
              upgrades: 0,
              rawText: '攻击力 3%',
              confidence: 'high',
            },
            {
              stat: 'crit_rate',
              value: 4.8,
              upgrades: 1,
              rawText: '暴击率 4.8%',
              confidence: 'high',
            },
            { stat: 'pen', value: 27, upgrades: 2, rawText: '穿透值 27', confidence: 'high' },
          ],
        },
        fields: {},
        issues: [],
        evidence: {
          detailPath: 'test-fixture://scanner-page/detail',
          cardPath: 'test-fixture://scanner-page/card',
          visualDetailHash: 'sha256:synthetic-page-detail',
          rawText: {},
        },
        updatedAt: at,
      },
    ],
  })
  const ready = source.items.find((item) => item.state === 'ready')!
  const batch = {
    ...source.batch,
    id: `scanner-inline-ready-${total}`,
    total,
    recognitionVersion: 'paddleocr-pp-ocrv6-small',
  }
  const items = Array.from({ length: total }, (_, index) => ({
    ...ready,
    id: `scanner-inline-ready-item-${index + 1}`,
    batchId: batch.id,
    sequence: index + 1,
    sourceIdentity: `scanner-inline-ready-source-${index + 1}`,
    fingerprint: `scanner-inline-ready-fingerprint-${index + 1}`,
  }))
  return {
    format: source.format,
    formatVersion: source.formatVersion,
    batch: {
      ...batch,
      manifest: createScanBatchManifest(batch, items, {
        expectedTotal: total,
        gameVersion: '3.1',
        scanConfigIdentity: 'viewport-1920x1080-disc-page',
        viewport: '1920x1080',
      }),
    },
    items,
  }
}

export function createScannerRuntimeCommands(fn: typeof vi.fn) {
  return {
    openHelper: fn(async () => undefined),
    retryConnection: fn(async () => undefined),
    startScan: fn(async () => undefined),
    safeStop: fn(async () => undefined),
    revokePairing: fn(async () => undefined),
    requestResultFile: fn(async () => ({
      resultFileHandle: 'local-staging.json',
      resultStatus: 'needs_review' as const,
      accountWriteEnabled: false as const,
    })),
    requestResultStaging: fn(async () => ({})),
    requestResultEvidence: fn(async () => ({
      availability: 'available' as const,
      detailSrc: '/opaque/detail',
      cardSrc: '/opaque/card',
      visualDetailHash: 'sha256:test',
      revoke: fn(),
    })),
  }
}

export function assertScannerEvidenceStyles(expect: typeof import('vitest').expect) {
  const evidenceRowRule = scannerContentStyles.match(
    /\.scanner-account-evidence > div \{([\s\S]*?)\n\}/,
  )?.[1]
  expect(evidenceRowRule).toContain('display: grid !important;')
  expect(evidenceRowRule).toContain('gap: 4px !important;')
  expect(evidenceRowRule).toContain('min-width: 0;')
  const evidenceValueRule = scannerContentStyles.match(
    /\.scanner-account-evidence strong \{([\s\S]*?)\n\}/,
  )?.[1]
  expect(evidenceValueRule).toContain('margin: 0;')
  expect(evidenceValueRule).toContain('font-size: 0.875rem !important;')
  expect(evidenceValueRule).toContain('font-weight: 750 !important;')
  expect(evidenceValueRule).toContain('line-height: 1.4 !important;')
}
