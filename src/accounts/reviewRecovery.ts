import { z } from 'zod'
import { database, type SodaDatabase } from '../db/database'
import {
  confirmScanImportItem,
  reassessSavedScanImportItem,
  scanImportStagingBatchSchema,
  summarizeScanImportItems,
  type ScanImportAssessmentContext,
  type ScanImportStagingBatch,
} from '../domain/scanImportStaging'
import { contentHash } from '../evaluation/contentHash'
import { importFrozenRecoveryToAccount } from './frozenRecovery'
import { accountIdSchema, getScopedId } from './types'

export const reviewedRecoveryBatchId = 's4-recovery-2026-07-02'
export const reviewedRecoveryExpectedTotal = 298
export const reviewedRecoveryExpectedGroups = 14
export const reviewedRecoveryExpectedGroupedItems = 50
export const reviewedRecoveryExpectedAutoRecovered = 3
export const legacyAccountExpectedAgents = 20

const recoveryGroupSchema = z.object({
  groupId: z.string().min(1),
  sequences: z.array(z.number().int().positive()).min(1),
  candidateSetId: z.string().min(1),
  candidateSetName: z.string().min(1),
  representativePath: z.string().min(1),
  representativeDataUrl: z.string().startsWith('data:image/'),
  reason: z.string().min(1),
})

export const recoveryGroupsSchema = z.object({
  batchId: z.string().min(1),
  groups: z.array(recoveryGroupSchema),
})

export type RecoveryReviewGroup = z.infer<typeof recoveryGroupSchema>
export type RecoveryGroups = z.infer<typeof recoveryGroupsSchema>

function accountScope(accountId: string, id: string) {
  return {
    scopedId: getScopedId(accountId, id),
    accountId,
    sourceLegacyId: null,
    migratedAt: null,
  }
}

function hasManualEvidence(item: ScanImportStagingBatch['items'][number]) {
  return (
    item.confirmations.length > 0 ||
    Object.values(item.fields).some(
      (field) => field.rule === 'manual_review_confirmation' || field.source === 'user-review',
    )
  )
}

function isAutomaticRecovery(item: ScanImportStagingBatch['items'][number]) {
  return Object.values(item.fields).some(
    (field) =>
      field.rule === 's4_r7_card_art_cluster_recovery' || field.rule === 'user_provided_recovery',
  )
}

export function preflightReviewedRecovery(
  stagingInput: unknown,
  groupsInput: unknown,
  context: ScanImportAssessmentContext,
) {
  const stagingResult = scanImportStagingBatchSchema.safeParse(stagingInput)
  const groupsResult = recoveryGroupsSchema.safeParse(groupsInput)
  const errors: string[] = []
  if (!stagingResult.success)
    errors.push(stagingResult.error.issues[0]?.message ?? '恢复暂存格式不合法。')
  if (!groupsResult.success)
    errors.push(groupsResult.error.issues[0]?.message ?? '代表组格式不合法。')
  if (!stagingResult.success || !groupsResult.success) {
    return { success: false, errors, staging: undefined, groups: undefined, summary: null }
  }

  const staging = stagingResult.data
  const groups = groupsResult.data
  if (staging.batch.id !== reviewedRecoveryBatchId)
    errors.push(`恢复批次必须为 ${reviewedRecoveryBatchId}。`)
  if (groups.batchId !== staging.batch.id) errors.push('恢复暂存与代表组批次不一致。')
  if (
    staging.batch.total !== reviewedRecoveryExpectedTotal ||
    staging.items.length !== reviewedRecoveryExpectedTotal
  )
    errors.push(`恢复暂存必须包含 ${reviewedRecoveryExpectedTotal} 条。`)
  if (staging.batch.dataVersion !== context.dataVersion)
    errors.push(`恢复数据版本 ${staging.batch.dataVersion} 与当前 ${context.dataVersion} 不一致。`)
  if (groups.groups.length !== reviewedRecoveryExpectedGroups)
    errors.push(`恢复代表组必须为 ${reviewedRecoveryExpectedGroups} 组。`)

  const sequences = groups.groups.flatMap((group) => group.sequences)
  if (sequences.length !== reviewedRecoveryExpectedGroupedItems)
    errors.push(`代表组必须覆盖 ${reviewedRecoveryExpectedGroupedItems} 条待确认记录。`)
  if (new Set(sequences).size !== sequences.length) errors.push('代表组存在重复序号。')
  const knownSequences = new Set(staging.items.map((item) => item.sequence))
  if (sequences.some((sequence) => !knownSequences.has(sequence)))
    errors.push('代表组包含恢复暂存中不存在的序号。')

  const reassessedItems = staging.items.map((item) => reassessSavedScanImportItem(item, context))
  const summary = summarizeScanImportItems(reassessedItems)
  const groupedReviewSequences = new Set(
    reassessedItems.filter((item) => item.state === 'needs_review').map((item) => item.sequence),
  )
  if (
    groupedReviewSequences.size !== reviewedRecoveryExpectedGroupedItems ||
    sequences.some((sequence) => !groupedReviewSequences.has(sequence))
  )
    errors.push('代表组没有完整覆盖当前规则下的全部待复核记录。')

  const autoRecovered = staging.items.filter(isAutomaticRecovery).length
  if (autoRecovered !== reviewedRecoveryExpectedAutoRecovered)
    errors.push(`自动恢复证据应为 ${reviewedRecoveryExpectedAutoRecovered} 条。`)

  return {
    success: errors.length === 0,
    errors,
    staging,
    groups,
    summary,
    autoRecovered,
    domainReassessed: summary.ready - summarizeScanImportItems(staging.items).ready,
    contentHash: contentHash({ staging, groups }),
  }
}

export async function persistReviewedRecoveryToAccount(
  accountId: string,
  stagingInput: unknown,
  groupsInput: unknown,
  context: ScanImportAssessmentContext,
  db: SodaDatabase = database,
) {
  accountIdSchema.parse(accountId)
  const preflight = preflightReviewedRecovery(stagingInput, groupsInput, context)
  if (!preflight.success || !preflight.staging || !preflight.groups)
    throw new Error(preflight.errors[0] ?? '恢复暂存预检失败。')

  const batchId = preflight.staging.batch.id
  return db.transaction(
    'rw',
    [db.accounts, db.accountScanImportBatches, db.accountScanImportItems],
    async () => {
      if (!(await db.accounts.get(accountId))) throw new Error('目标账号不存在。')
      const [existingBatch, existingItems] = await Promise.all([
        db.accountScanImportBatches.where('[accountId+id]').equals([accountId, batchId]).first(),
        db.accountScanImportItems
          .where('[accountId+batchId]')
          .equals([accountId, batchId])
          .toArray(),
      ])
      if (
        existingItems.some((item) => item.state === 'imported') ||
        existingBatch?.importHistory?.some((event) => event.action === 'imported') ||
        existingBatch?.replacedDiscs?.length
      )
        throw new Error('该账号恢复批次已经导入，不能重新覆盖暂存。')

      const existingBySource = new Map(existingItems.map((item) => [item.sourceIdentity, item]))
      const items = preflight.staging.items.map((item) => {
        const existing = existingBySource.get(item.sourceIdentity)
        const source = existing && hasManualEvidence(existing) ? existing : item
        return {
          ...reassessSavedScanImportItem(source, context),
          ...accountScope(accountId, item.id),
        }
      })
      const batch = {
        ...existingBatch,
        ...preflight.staging.batch,
        importHistory: existingBatch?.importHistory ?? preflight.staging.batch.importHistory,
        ...accountScope(accountId, batchId),
      }

      await db.accountScanImportItems
        .where('[accountId+batchId]')
        .equals([accountId, batchId])
        .delete()
      await db.accountScanImportBatches.put(batch)
      await db.accountScanImportItems.bulkAdd(items)

      return {
        accountId,
        batch,
        items,
        groups: preflight.groups.groups,
        summary: summarizeScanImportItems(items),
        autoRecovered: preflight.autoRecovered,
        domainReassessed: preflight.domainReassessed,
        contentHash: preflight.contentHash,
      }
    },
  )
}

export async function getReviewedRecoveryStatus(
  accountId: string,
  groupsInput: unknown,
  db: SodaDatabase = database,
) {
  accountIdSchema.parse(accountId)
  const groups = recoveryGroupsSchema.parse(groupsInput)
  const items = await db.accountScanImportItems
    .where('[accountId+batchId]')
    .equals([accountId, groups.batchId])
    .toArray()
  const confirmedGroupIds = groups.groups
    .filter((group) => {
      const sequenceSet = new Set(group.sequences)
      const members = items.filter((item) => sequenceSet.has(item.sequence))
      return (
        members.length === group.sequences.length &&
        members.every(
          (item) =>
            (item.state === 'ready' || item.state === 'imported') &&
            item.confirmations.some((confirmation) => confirmation.source === 'user'),
        )
      )
    })
    .map((group) => group.groupId)
  return {
    items,
    summary: summarizeScanImportItems(items),
    confirmedGroupIds,
    pendingGroups: groups.groups.filter((group) => !confirmedGroupIds.includes(group.groupId)),
  }
}

export async function getAccountMigrationCompletionState(
  accountId: string,
  groupsInput: unknown,
  db: SodaDatabase = database,
) {
  accountIdSchema.parse(accountId)
  const [account, rosterRecord, warehouseCount, recovery, batch] = await Promise.all([
    db.accounts.get(accountId),
    db.accountRosters.get(accountId),
    db.accountDriveDiscs.where('accountId').equals(accountId).count(),
    getReviewedRecoveryStatus(accountId, groupsInput, db),
    db.accountScanImportBatches
      .where('[accountId+id]')
      .equals([accountId, reviewedRecoveryBatchId])
      .first(),
  ])
  const agentCount = rosterRecord?.roster.agents.filter((agent) => agent.owned).length ?? 0
  const importedAudit = batch?.importHistory.filter((event) => event.action === 'imported').at(-1)
  const auditedImportCount = importedAudit
    ? importedAudit.importedCount + importedAudit.skippedCount
    : 0
  const reviewComplete =
    recovery.confirmedGroupIds.length === reviewedRecoveryExpectedGroups &&
    recovery.pendingGroups.length === 0
  const importComplete =
    warehouseCount === reviewedRecoveryExpectedTotal &&
    recovery.summary.imported === reviewedRecoveryExpectedTotal &&
    auditedImportCount === reviewedRecoveryExpectedTotal
  const differences: string[] = []
  if (!account) differences.push('目标账号不存在。')
  if (agentCount !== legacyAccountExpectedAgents)
    differences.push(`代理人实际 ${agentCount}，目标 ${legacyAccountExpectedAgents}。`)
  if (warehouseCount !== reviewedRecoveryExpectedTotal)
    differences.push(`正式盘实际 ${warehouseCount}，目标 ${reviewedRecoveryExpectedTotal}。`)
  if (!reviewComplete)
    differences.push(
      `代表组已确认 ${recovery.confirmedGroupIds.length}/${reviewedRecoveryExpectedGroups}。`,
    )
  if (recovery.summary.imported !== reviewedRecoveryExpectedTotal)
    differences.push(
      `恢复批次已导入 ${recovery.summary.imported}/${reviewedRecoveryExpectedTotal}。`,
    )
  if (auditedImportCount !== reviewedRecoveryExpectedTotal)
    differences.push(`导入审计记录 ${auditedImportCount}/${reviewedRecoveryExpectedTotal}。`)

  return {
    account: account ?? null,
    agentCount,
    warehouseCount,
    recovery,
    batch: batch ?? null,
    importedAt: importedAudit?.at ?? null,
    auditedImportCount,
    reviewComplete,
    importComplete,
    complete:
      Boolean(account) &&
      agentCount === legacyAccountExpectedAgents &&
      reviewComplete &&
      importComplete,
    differences,
  }
}

export async function confirmAccountRecoveryGroup(
  accountId: string,
  group: RecoveryReviewGroup,
  setId: string,
  context: ScanImportAssessmentContext,
  db: SodaDatabase = database,
  confirmedAt = new Date().toISOString(),
) {
  accountIdSchema.parse(accountId)
  const set = context.driveDiscSets.find((candidate) => candidate.id === setId)
  if (!set || set.evidenceOnly) throw new Error('请选择可核验的正式套装。')
  return db.transaction(
    'rw',
    [db.accountScanImportBatches, db.accountScanImportItems],
    async () => {
      const batch = await db.accountScanImportBatches
        .where('[accountId+id]')
        .equals([accountId, reviewedRecoveryBatchId])
        .first()
      if (!batch) throw new Error('账号恢复批次不存在。')
      const sequenceSet = new Set(group.sequences)
      const batchItems = await db.accountScanImportItems
        .where('[accountId+batchId]')
        .equals([accountId, reviewedRecoveryBatchId])
        .toArray()
      const items = batchItems.filter((item) => sequenceSet.has(item.sequence))
      if (items.length !== sequenceSet.size) throw new Error('恢复组记录不完整，未写入任何修改。')
      if (items.some((item) => item.state === 'imported'))
        throw new Error('恢复组包含已导入记录，不能修改。')
      const alreadyConfirmed = items.every(
        (item) =>
          item.state === 'ready' &&
          item.confirmations.some(
            (confirmation) =>
              confirmation.source === 'user' && confirmation.after.candidate.setId === setId,
          ),
      )
      if (!alreadyConfirmed) {
        const updates = items.map((item) => ({
          ...confirmScanImportItem(
            item,
            {
              candidate: { ...item.candidate, setId: set.id, setName: set.name },
              lockState: item.lockState,
            },
            context,
            confirmedAt,
          ),
          ...accountScope(accountId, item.id),
        }))
        if (updates.some((item) => item.state !== 'ready'))
          throw new Error('代表组确认后仍有领域问题，未写入任何修改。')
        await db.accountScanImportItems.bulkPut(updates)
        await db.accountScanImportBatches.put({ ...batch, updatedAt: confirmedAt })
      }
      const currentItems = alreadyConfirmed
        ? batchItems
        : await db.accountScanImportItems
            .where('[accountId+batchId]')
            .equals([accountId, reviewedRecoveryBatchId])
            .toArray()
      return {
        alreadyConfirmed,
        updated: alreadyConfirmed ? 0 : items.length,
        summary: summarizeScanImportItems(currentItems),
      }
    },
  )
}

export async function importReviewedRecoveryToAccount(
  accountId: string,
  context: ScanImportAssessmentContext & { gameDataVersion: string; now?: string },
  db: SodaDatabase = database,
  beforeCommit?: () => void,
) {
  accountIdSchema.parse(accountId)
  const [batch, items, discs] = await Promise.all([
    db.accountScanImportBatches
      .where('[accountId+id]')
      .equals([accountId, reviewedRecoveryBatchId])
      .first(),
    db.accountScanImportItems
      .where('[accountId+batchId]')
      .equals([accountId, reviewedRecoveryBatchId])
      .toArray(),
    db.accountDriveDiscs.where('accountId').equals(accountId).toArray(),
  ])
  if (!batch) throw new Error('请先载入账号恢复暂存。')
  const summary = summarizeScanImportItems(items)
  if (
    summary.imported === reviewedRecoveryExpectedTotal &&
    discs.length === reviewedRecoveryExpectedTotal
  ) {
    return {
      status: 'already_imported' as const,
      accountId,
      batchId: batch.id,
      total: discs.length,
      imported: 0,
      skipped: reviewedRecoveryExpectedTotal,
      warehouseHash: contentHash(
        discs
          .map((disc) => ({ id: disc.id, importFingerprint: disc.importFingerprint ?? null }))
          .sort((left, right) => left.id.localeCompare(right.id)),
      ),
      frozenHash: contentHash({ batch, items }),
    }
  }
  if (
    summary.total !== reviewedRecoveryExpectedTotal ||
    summary.ready !== reviewedRecoveryExpectedTotal ||
    summary.needsReview ||
    summary.invalid ||
    summary.imported
  )
    throw new Error(
      `必须达到 298 ready / 0 待复核后才能导入；当前 ${summary.ready} ready / ${summary.needsReview} 待复核。`,
    )
  const result = await importFrozenRecoveryToAccount(
    accountId,
    { format: 'soda-terminal-scan-staging', formatVersion: 1, batch, items },
    context,
    db,
    { expectedBatchId: reviewedRecoveryBatchId, expectedTotal: reviewedRecoveryExpectedTotal },
    beforeCommit,
  )
  return { status: 'imported' as const, ...result }
}
