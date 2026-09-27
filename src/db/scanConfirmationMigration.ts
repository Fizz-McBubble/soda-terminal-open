import type { SodaDatabase } from './database'
import { migrateConfirmedScanImportItem } from '../domain/scanImportStaging'
import type {
  ScanImportAssessmentContext,
  ScanImportBatchMatch,
  ScanImportItem,
} from '../domain/scanImportStaging'

export type ScanConfirmationMigrationResult = {
  sourceConfirmed: number
  eligibleMappings: number
  migrated: number
  alreadyConfirmed: number
  alreadySatisfied: number
  rejectedAmbiguous: number
  rejectedAudit: number
  rejectedConflict: number
  rejectedInvalid: number
  skippedNoEvidence: number
  rejections: Array<{ sourceSequence: number; targetSequence: number; reason: string }>
}

function hasConfirmedFieldValue(
  confirmation: ScanImportItem['confirmations'][number],
  field: string,
) {
  const snapshot = confirmation.after
  if (field === 'setName') return Boolean(snapshot.candidate.setId && snapshot.candidate.setName)
  if (field === 'slot') return snapshot.candidate.slot !== null
  if (field === 'level') return snapshot.candidate.level !== null
  if (field === 'mainStat') return snapshot.candidate.mainStat !== null
  if (field === 'lockState') return snapshot.lockState !== 'unknown'
  const index = field.match(/^subStats\.(\d+)$/)?.[1]
  if (index === undefined) return false
  const subStat = snapshot.candidate.subStats[Number(index)]
  return Boolean(
    subStat && subStat.stat !== null && subStat.value !== null && subStat.upgrades !== null,
  )
}

export function getLegacyReviewFields(item: ScanImportItem) {
  return Object.keys(item.fields).filter((field) => {
    const evidence = item.fields[field]
    return Boolean(
      evidence &&
      (evidence.rule === 'manual_review_confirmation' ||
        evidence.rule === 'user_confirmed' ||
        evidence.source === 'user-review' ||
        evidence.evidence.some((entry) => entry.startsWith('manual-review='))),
    )
  })
}

function getAuditableScanConfirmation(item: ScanImportItem) {
  const confirmation = item.confirmations
    .filter((entry) => entry.source === 'user' || entry.source === 'legacy_migration')
    .toSorted((left, right) => right.confirmedAt.localeCompare(left.confirmedAt))[0]
  if (confirmation) return confirmation
  const fields = getLegacyReviewFields(item)
  if (!fields.length) return null
  const manualReviewAt = fields
    .flatMap((field) => item.fields[field]?.evidence ?? [])
    .find((entry) => entry.startsWith('manual-review='))
    ?.slice('manual-review='.length)
  return {
    contract: 'user_confirmed.v1' as const,
    confirmedAt: manualReviewAt ?? item.updatedAt,
    source: 'legacy_migration' as const,
    fields,
    before: null,
    after: { candidate: item.candidate, lockState: item.lockState },
  }
}

export async function migrateScanImportConfirmations(
  sourceBatchId: string,
  targetBatchId: string,
  matches: ScanImportBatchMatch[],
  context: ScanImportAssessmentContext,
  db: SodaDatabase,
): Promise<ScanConfirmationMigrationResult> {
  if (sourceBatchId === targetBatchId) throw new Error('来源批次和目标批次不能相同。')
  return db.transaction('rw', db.scanImportBatches, db.scanImportItems, async () => {
    const [sourceBatch, targetBatch, sourceItems, targetItems] = await Promise.all([
      db.scanImportBatches.get(sourceBatchId),
      db.scanImportBatches.get(targetBatchId),
      db.scanImportItems.where('batchId').equals(sourceBatchId).toArray(),
      db.scanImportItems.where('batchId').equals(targetBatchId).toArray(),
    ])
    if (!sourceBatch || !targetBatch) throw new Error('跨批次确认迁移所需的批次不存在。')
    if (targetItems.some((item) => item.state === 'imported'))
      throw new Error('目标批次已有正式导入记录，不能修改其人工确认。')

    const sourceBySequence = new Map(sourceItems.map((item) => [item.sequence, item]))
    const targetBySequence = new Map(targetItems.map((item) => [item.sequence, item]))
    const sourceCounts = new Map<number, number>()
    const targetCounts = new Map<number, number>()
    for (const match of matches) {
      sourceCounts.set(match.sourceSequence, (sourceCounts.get(match.sourceSequence) ?? 0) + 1)
      targetCounts.set(match.targetSequence, (targetCounts.get(match.targetSequence) ?? 0) + 1)
    }

    let sourceConfirmed = 0
    let eligibleMappings = 0
    let migrated = 0
    let alreadyConfirmed = 0
    let alreadySatisfied = 0
    let rejectedAmbiguous = 0
    let rejectedAudit = 0
    let rejectedConflict = 0
    let rejectedInvalid = 0
    let skippedNoEvidence = 0
    const rejections: ScanConfirmationMigrationResult['rejections'] = []
    const updates: ScanImportItem[] = []
    for (const match of matches) {
      const source = sourceBySequence.get(match.sourceSequence)
      const target = targetBySequence.get(match.targetSequence)
      if (!source || !target) continue
      const confirmation = getAuditableScanConfirmation(source)
      if (!confirmation) {
        skippedNoEvidence += 1
        continue
      }
      sourceConfirmed += 1
      const confirmedFields = confirmation.fields.filter((field) =>
        hasConfirmedFieldValue(confirmation, field),
      )
      if (!confirmedFields.length && target.state === 'ready') {
        alreadySatisfied += 1
        continue
      }
      const unique =
        sourceCounts.get(match.sourceSequence) === 1 && targetCounts.get(match.targetSequence) === 1
      const eligible =
        !match.ambiguousEntity &&
        unique &&
        match.matchConfidence >= 0.9 &&
        ['exact_candidate', 'detail_visual'].includes(match.matchMethod)
      if (!eligible) {
        rejectedAmbiguous += 1
        rejections.push({
          sourceSequence: source.sequence,
          targetSequence: target.sequence,
          reason: '映射不唯一、置信不足或存在实体歧义。',
        })
        continue
      }
      eligibleMappings += 1
      if (target.confirmations.length) {
        alreadyConfirmed += 1
        continue
      }
      try {
        updates.push(
          migrateConfirmedScanImportItem(
            target,
            source,
            { ...confirmation, fields: confirmedFields },
            match,
            context,
          ),
        )
        migrated += 1
      } catch (error) {
        const reason = error instanceof Error ? error.message : '确认迁移失败。'
        if (reason.includes('冲突')) rejectedConflict += 1
        else if (reason.includes('领域问题')) rejectedInvalid += 1
        else rejectedAudit += 1
        rejections.push({
          sourceSequence: source.sequence,
          targetSequence: target.sequence,
          reason,
        })
      }
    }
    if (updates.length) {
      await db.scanImportItems.bulkPut(updates)
      await db.scanImportBatches.put({ ...targetBatch, updatedAt: new Date().toISOString() })
    }
    return {
      sourceConfirmed,
      eligibleMappings,
      migrated,
      alreadyConfirmed,
      alreadySatisfied,
      rejectedAmbiguous,
      rejectedAudit,
      rejectedConflict,
      rejectedInvalid,
      skippedNoEvidence,
      rejections,
    }
  })
}
