import { driveDiscData } from '../data/gameData'
import {
  assessScanImportItem,
  createScanBatchManifest,
  type ScanImportItem,
} from '../domain/scanImportStaging'

export const context = {
  driveDiscSets: driveDiscData!.driveDiscSets,
  rules: driveDiscData!.rules,
  dataVersion: driveDiscData!.dataVersion,
}
export const now = '2026-10-09T00:00:00.000Z'

export function fixture() {
  const set = context.driveDiscSets[0]!
  const main = context.rules.mainStatBaseByRarity.S.find((rule) => rule.stat === 'hp_flat')!
  // Both hp_flat and atk_flat become mains in this suite's scalar-edit cases.
  const subStats = context.rules.subStatStepsByRarity.S.filter(
    (rule) => rule.stat !== 'hp_flat' && rule.stat !== 'atk_flat',
  )
    .slice(0, 3)
    .map((rule, index) => ({
      stat: rule.stat,
      value: rule.baseValue,
      upgrades: 0,
      rawText: `original row ${index}`,
      confidence: 'low' as const,
    }))
  const candidate: ScanImportItem['candidate'] = {
    setId: set.id,
    setName: set.name,
    slot: 1,
    level: 0,
    rarity: 'S',
    mainStat: 'hp_flat',
    mainStatValue: Math.floor(main.baseValue),
    subStats,
  }
  const item: ScanImportItem = {
    id: 'manual-item',
    batchId: 'manual-batch',
    sequence: 1,
    sourceIdentity: 'synthetic-source',
    fingerprint: 'synthetic-fingerprint',
    duplicate: false,
    lockState: 'unknown',
    state: 'needs_review',
    candidate: { ...candidate, rarity: null, mainStatValue: null },
    fields: Object.fromEntries(
      ['rarity', 'mainStatValue', 'subStats', 'subStats.0'].map((field) => [
        field,
        {
          rawText: `original ${field}`,
          normalizedValue: null,
          confidence: 'low' as const,
          evidence: ['original-evidence'],
          source: 'synthetic-ocr',
          rule: 'synthetic-rule',
        },
      ]),
    ),
    confirmations: [],
    issues: [],
    updatedAt: now,
    evidence: {
      detailPath: 'synthetic/detail',
      cardPath: 'synthetic/card',
      visualDetailHash: 'synthetic-hash',
      rawText: { detailPanel: 'original OCR' },
    },
  }
  const assessed = assessScanImportItem(item, context)
  const batch = {
    id: item.batchId,
    source: 'synthetic',
    createdAt: now,
    updatedAt: now,
    dataVersion: context.dataVersion,
    recognitionVersion: 'paddle-synthetic',
    sourceReport: 'synthetic-report',
    total: 1,
    importHistory: [],
    reviewState: {
      revision: 0,
      preflight: 'stale' as const,
      preflightRevision: null,
      armedRevision: null,
    },
  }
  return {
    candidate,
    item: assessed,
    input: {
      format: 'soda-terminal-scan-staging',
      formatVersion: 1,
      batch: {
        ...batch,
        manifest: createScanBatchManifest(batch, [assessed], {
          expectedTotal: 1,
          gameVersion: 'synthetic',
          scanConfigIdentity: 'synthetic',
        }),
      },
      items: [assessed],
    },
  }
}
