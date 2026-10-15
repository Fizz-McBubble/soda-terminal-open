import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { driveDiscData } from '../data/gameData'
import { sampleDiscs } from '../evaluation/fixtures'
import {
  createScanBatchManifest,
  resolveScanBatchManifest,
  type ScanImportItem,
  type ScanImportReviewPatch,
} from '../domain/scanImportStaging'
import { getScanCalibrationFields } from '../domain/scanManualCalibration'
import {
  SodaDatabase,
  importReadyAccountScanStaging,
  reviewAccountScanImportItem,
  stageAccountPaddleScanImport,
} from './database'

import { context, fixture } from './scanManualCalibration.testFixture'

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

  it('retains a conflicting slot 5 review and its evidence until a legal main is calibrated', async () => {
    const { item, candidate } = await seed()
    const formalBefore = await db.accountDriveDiscs.toArray()
    const illegal = {
      ...candidate,
      slot: 5 as const,
      mainStat: 'atk_percent' as const,
      mainStatValue: 7.5,
      subStats: [
        {
          stat: 'atk_percent' as const,
          value: 3,
          upgrades: 0,
          rawText: 'ATK 3%',
          confidence: 'high' as const,
        },
        {
          stat: 'crit_rate' as const,
          value: 2.4,
          upgrades: 0,
          rawText: 'CR 2.4%',
          confidence: 'high' as const,
        },
        {
          stat: 'crit_dmg' as const,
          value: 4.8,
          upgrades: 0,
          rawText: 'CD 4.8%',
          confidence: 'high' as const,
        },
      ],
    }
    const invalid = await save({
      candidate: illegal,
      lockState: item.lockState,
      fields: getScanCalibrationFields(item.candidate, illegal),
    })
    expect(invalid.state).toBe('invalid')
    expect(invalid.issues).toContainEqual(
      expect.objectContaining({
        field: 'subStats.0.stat',
        code: 'main_sub_stat_conflict',
        severity: 'invalid',
      }),
    )
    expect(invalid.evidence).toEqual(item.evidence)
    expect(invalid.confirmations.at(-1)!.before!.candidate).toEqual(item.candidate)
    expect(invalid.confirmations.at(-1)!.after.candidate).toEqual(invalid.candidate)
    expect(await db.accountDriveDiscs.toArray()).toEqual(formalBefore)
    expect((await db.accountScanImportItems.toArray())[0]!.state).toBe('invalid')
    const corrected = await save(
      {
        candidate: { ...invalid.candidate, mainStat: 'fire_dmg' },
        lockState: item.lockState,
        fields: ['mainStat'],
      },
      1,
    )
    expect(corrected.state).toBe('ready')
    expect(corrected.candidate.subStats).toEqual(invalid.candidate.subStats)
    expect(corrected.confirmations).toHaveLength(2)
    expect(corrected.confirmations.at(-1)!.before!.candidate).toEqual(invalid.candidate)
    expect(corrected.evidence).toEqual(item.evidence)
    expect(await db.accountDriveDiscs.toArray()).toEqual(formalBefore)
  })

  it('rechecks a saved ready conflict before account bulkAdd and retains the review batch', async () => {
    const source = fixture()
    const item: ScanImportItem = {
      ...source.item,
      state: 'ready',
      issues: [],
      candidate: {
        ...source.candidate,
        slot: 5,
        mainStat: 'atk_percent',
        mainStatValue: 7.5,
        subStats: [
          { stat: 'atk_percent', value: 3, upgrades: 0, rawText: 'ATK 3%', confidence: 'high' },
          { stat: 'crit_rate', value: 2.4, upgrades: 0, rawText: 'CR 2.4%', confidence: 'high' },
          { stat: 'crit_dmg', value: 4.8, upgrades: 0, rawText: 'CD 4.8%', confidence: 'high' },
        ],
      },
    }
    const input = {
      ...source.input,
      items: [item],
      batch: {
        ...source.input.batch,
        manifest: createScanBatchManifest(source.input.batch, [item], {
          expectedTotal: 1,
          gameVersion: 'synthetic',
          scanConfigIdentity: 'synthetic',
        }),
      },
    }
    await db.settings.put({ key: 'active-account-id', value: 'b' })
    await stageAccountPaddleScanImport('b', input, db)
    const batch = (await db.accountScanImportBatches.toArray())[0]!
    // Simulate a ready/armed record persisted before the validity rule existed.
    await db.accountScanImportBatches.put({
      ...batch,
      reviewState: { revision: 0, preflight: 'complete', preflightRevision: 0, armedRevision: 0 },
    })
    const discsBefore = await db.accountDriveDiscs.toArray()
    const itemsBefore = await db.accountScanImportItems.toArray()
    const batchesBefore = await db.accountScanImportBatches.toArray()
    await expect(
      importReadyAccountScanStaging(
        'b',
        item.batchId,
        {
          ...context,
          gameDataVersion: driveDiscData!.gameVersion,
        },
        db,
      ),
    ).rejects.toThrow('正式导入复检未达到')
    expect(await db.accountDriveDiscs.toArray()).toEqual(discsBefore)
    expect(await db.accountScanImportItems.toArray()).toEqual(itemsBefore)
    expect(await db.accountScanImportBatches.toArray()).toEqual(batchesBefore)
  })

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
