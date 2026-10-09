import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { driveDiscData } from '../data/gameData'
import { sampleDiscs } from '../evaluation/fixtures'
import {
  assessScanImportItem,
  createScanBatchManifest,
  resolveScanBatchManifest,
  type ScanImportItem,
  type ScanImportReviewPatch,
} from '../domain/scanImportStaging'
import { getScanCalibrationFields } from '../domain/scanManualCalibration'
import { SodaDatabase, reviewAccountScanImportItem, stageAccountPaddleScanImport } from './database'

const context = {
  driveDiscSets: driveDiscData!.driveDiscSets,
  rules: driveDiscData!.rules,
  dataVersion: driveDiscData!.dataVersion,
}
const now = '2026-10-09T00:00:00.000Z'

function fixture() {
  const set = context.driveDiscSets[0]!
  const main = context.rules.mainStatBaseByRarity.S.find((rule) => rule.stat === 'hp_flat')!
  const subStats = context.rules.subStatStepsByRarity.S.slice(0, 3).map((rule, index) => ({
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

describe('bounded manual scan calibration', () => {
  let db: SodaDatabase
  beforeEach(async () => {
    db = new SodaDatabase(`manual-calibration-${crypto.randomUUID()}`)
    await db.open()
    await db.settings.put({ key: 'active-account-id', value: 'a' })
    await db.accountDriveDiscs.put({
      ...sampleDiscs.potentialCandidate,
      accountId: 'a',
      scopedId: `a:${sampleDiscs.potentialCandidate.id}`,
      sourceLegacyId: null,
      migratedAt: null,
    })
  })
  afterEach(async () => {
    db.close()
    await Dexie.delete(db.name)
  })

  async function seed() {
    const source = fixture()
    await stageAccountPaddleScanImport('a', source.input, db)
    return source
  }
  const save = (patch: ScanImportReviewPatch, revision: number | undefined = 0) =>
    reviewAccountScanImportItem(
      'a',
      'manual-batch',
      'manual-item',
      patch,
      context,
      db,
      revision,
      'manual_calibration',
    )

  it('audits rarity/value corrections while retaining untouched OCR, confidence and identities', async () => {
    const { item, candidate } = await seed()
    const before = (await db.accountScanImportItems.toArray())[0]!
    const batch = (await db.accountScanImportBatches.toArray())[0]!
    const formal = await db.accountDriveDiscs.toArray()
    await db.accountScanImportBatches.put({
      ...batch,
      reviewState: {
        revision: 0,
        preflight: 'complete',
        preflightRevision: 0,
        armedRevision: 0,
      },
    })
    const next = await save({
      candidate,
      lockState: item.lockState,
      fields: ['rarity', 'mainStatValue'],
    })
    expect(next.state).toBe('ready')
    expect(next.candidate.subStats).toEqual(before.candidate.subStats)
    expect(next.evidence).toEqual(before.evidence)
    expect(next).toMatchObject({
      id: before.id,
      sourceIdentity: before.sourceIdentity,
      fingerprint: before.fingerprint,
      duplicate: before.duplicate,
      lockState: before.lockState,
      scopedId: before.scopedId,
      accountId: before.accountId,
    })
    for (const field of ['rarity', 'mainStatValue']) {
      expect(next.fields[field]).toMatchObject({
        rawText: before.fields[field]!.rawText,
        rule: 'user_confirmed',
        source: 'user-review',
        confidence: 'high',
      })
      expect(next.fields[field]!.evidence).toContain('original-evidence')
    }
    expect(next.confirmations.at(-1)).toMatchObject({
      fields: ['rarity', 'mainStatValue'],
      before: { candidate: before.candidate, lockState: before.lockState },
      after: { candidate: next.candidate, lockState: next.lockState },
    })
    const afterBatch = (await db.accountScanImportBatches.toArray())[0]!
    expect(afterBatch.reviewState).toEqual({
      revision: 1,
      preflight: 'stale',
      preflightRevision: null,
      armedRevision: null,
    })
    expect(afterBatch.manifest!.sourceHash).toBe(batch.manifest!.sourceHash)
    expect(afterBatch.manifest!.payloadHash).not.toBe(batch.manifest!.payloadHash)
    expect(() => resolveScanBatchManifest(afterBatch, [next])).not.toThrow()
    expect(await db.accountDriveDiscs.toArray()).toEqual(formal)
  })

  it('only confirms changed rows in aggregate corrections and retains original row text', async () => {
    const { item, candidate } = await seed()
    const modified = {
      ...candidate,
      subStats: [
        {
          ...candidate.subStats[0]!,
          upgrades: 1,
          value: candidate.subStats[0]!.value! * 2,
          rawText: 'untrusted replacement',
          confidence: 'high' as const,
        },
        ...candidate.subStats.slice(1),
      ],
    }
    const next = await save({
      candidate: modified,
      lockState: item.lockState,
      fields: ['rarity', 'mainStatValue', 'subStats'],
    })
    expect(next.state).toBe('ready')
    expect(next.candidate.subStats[0]).toMatchObject({
      confidence: 'high',
      rawText: 'original row 0',
    })
    expect(next.candidate.subStats.slice(1)).toEqual(item.candidate.subStats.slice(1))
    expect(next.fields.subStats).toMatchObject({
      rawText: 'original subStats',
      source: 'user-review',
    })
    expect(next.confirmations.at(-1)!.before!.candidate.subStats).toEqual(item.candidate.subStats)
  })

  it('rejects missing/stale revisions, switched accounts and switched active result batches', async () => {
    const { item, candidate } = await seed()
    const patch = { candidate, lockState: item.lockState, fields: ['rarity', 'mainStatValue'] }
    await expect(
      reviewAccountScanImportItem(
        'a',
        'manual-batch',
        'manual-item',
        patch,
        context,
        db,
        undefined,
        'manual_calibration',
      ),
    ).rejects.toThrow('复核版本')
    await expect(save(patch, 1)).rejects.toThrow('其他页面更新')
    await db.settings.put({ key: 'active-account-id', value: 'b' })
    await expect(save(patch)).rejects.toThrow('活动账号已变化')
    await db.settings.put({ key: 'active-account-id', value: 'a' })
    await db.settings.put({ key: 'scanner-active-result-batch:a', value: 'new-batch' })
    await expect(save(patch)).rejects.toThrow('扫描批次已变化')
    expect((await db.accountScanImportBatches.toArray())[0]!.reviewState.revision).toBe(0)
  })

  it('rejects unknown fields, locks and undeclared semantic mutations in either review mode', async () => {
    const { item, candidate } = await seed()
    for (const field of ['lockState', 'fingerprint', 'evidence', 'subStats.4'])
      await expect(
        save({ candidate: item.candidate, lockState: item.lockState, fields: [field] }),
      ).rejects.toThrow('待复核字段')
    await expect(
      save({ candidate, lockState: true, fields: ['rarity', 'mainStatValue'] }),
    ).rejects.toThrow('锁定证据')
    await expect(
      save({ candidate, lockState: item.lockState, fields: ['rarity'] }),
    ).rejects.toThrow('未声明')
    await expect(
      reviewAccountScanImportItem(
        'a',
        'manual-batch',
        'manual-item',
        { candidate, lockState: item.lockState, fields: ['rarity'] },
        context,
        db,
        0,
      ),
    ).rejects.toThrow('未声明')
    expect((await db.accountScanImportItems.toArray())[0]!.candidate).toEqual(item.candidate)
  })

  it('rejects schema-invalid candidates and preserves domain-invalid results for further correction', async () => {
    const { item, candidate } = await seed()
    await expect(
      save({
        candidate: { ...candidate, level: 16 },
        lockState: item.lockState,
        fields: ['rarity', 'mainStatValue', 'level'],
      }),
    ).rejects.toThrow()
    const invalid = await save({
      candidate: { ...candidate, mainStatValue: 1 },
      lockState: item.lockState,
      fields: ['rarity', 'mainStatValue'],
    })
    expect(invalid.state).toBe('invalid')
    expect(invalid.issues).toContainEqual(
      expect.objectContaining({ code: 'main_stat_value_mismatch' }),
    )
    const corrected = await save(
      { candidate, lockState: item.lockState, fields: ['mainStatValue'] },
      1,
    )
    expect(corrected.state).toBe('ready')
    await expect(
      save({ candidate, lockState: item.lockState, fields: ['rarity'] }, 2),
    ).rejects.toThrow('识别失败或待复核')
  })

  it('rolls back candidate and audit when the atomic manifest update fails', async () => {
    const { item, candidate } = await seed()
    const before = await db.accountScanImportItems.toArray()
    const batchBefore = await db.accountScanImportBatches.toArray()
    const put = vi
      .spyOn(db.accountScanImportBatches, 'put')
      .mockRejectedValueOnce(new Error('synthetic failure'))
    await expect(
      save({ candidate, lockState: item.lockState, fields: ['rarity', 'mainStatValue'] }),
    ).rejects.toThrow('synthetic failure')
    put.mockRestore()
    expect(await db.accountScanImportItems.toArray()).toEqual(before)
    expect(await db.accountScanImportBatches.toArray()).toEqual(batchBefore)
  })

  it('returns semantic field names and ignores OCR metadata', () => {
    const { candidate } = fixture()
    const copy = structuredClone(candidate)
    copy.subStats[0]!.rawText = 'metadata noise'
    copy.subStats[0]!.confidence = 'high'
    expect(getScanCalibrationFields(candidate, copy)).toEqual([])
    copy.setId = 'another-set'
    copy.slot = 2
    copy.level = 1
    copy.rarity = 'A'
    copy.mainStat = 'atk_flat'
    copy.mainStatValue = 100
    copy.subStats[1]!.upgrades = 1
    expect(getScanCalibrationFields(candidate, copy)).toEqual([
      'setName',
      'slot',
      'level',
      'rarity',
      'mainStat',
      'mainStatValue',
      'subStats.1',
    ])
    copy.subStats.pop()
    expect(getScanCalibrationFields(candidate, copy)).toContain('subStats')
  })

  it('audits all editable scalar fields and an individual row without adopting metadata noise', async () => {
    const { item, candidate } = await seed()
    const set = context.driveDiscSets[1]!
    const main = context.rules.mainStatBaseByRarity.S.find((rule) => rule.stat === 'atk_flat')!
    const edited = {
      ...candidate,
      setId: set.id,
      setName: set.name,
      slot: 2 as const,
      level: 1,
      mainStat: 'atk_flat' as const,
      mainStatValue: Math.round(main.baseValue * 1.2),
      subStats: candidate.subStats.map((row, index) => ({
        ...row,
        rawText: 'metadata noise',
        confidence: 'high' as const,
        ...(index === 0 ? { upgrades: 1, value: row.value! * 2 } : {}),
      })),
    }
    const fields = getScanCalibrationFields(item.candidate, edited)
    expect(fields).toEqual([
      'setName',
      'slot',
      'level',
      'rarity',
      'mainStat',
      'mainStatValue',
      'subStats.0',
    ])
    const next = await save({ candidate: edited, lockState: item.lockState, fields })
    expect(next.state).toBe('ready')
    for (const field of fields) {
      expect(next.fields[field]).toMatchObject({ source: 'user-review', rule: 'user_confirmed' })
      expect(next.fields[field]!.rawText).toBe(item.fields[field]?.rawText ?? '')
    }
    expect(next.candidate.subStats.slice(1)).toEqual(item.candidate.subStats.slice(1))
    expect(next.candidate.subStats[0]!.rawText).toBe(item.candidate.subStats[0]!.rawText)
    expect(next.confirmations.at(-1)!.fields).toEqual(fields)
  })
})
