import { database, type SodaDatabase } from '../db/database'
import { preflightDriveDiscImport } from '../domain/discImport'
import {
  createStandardImportFromStaging,
  scanImportStagingBatchSchema,
  summarizeScanImportItems,
  type ScanImportAssessmentContext,
  type ScanImportStagingBatch,
} from '../domain/scanImportStaging'
import { contentHash } from '../evaluation/contentHash'
import { accountIdSchema, getScopedId } from './types'

export const frozenRecoveryBatchId = 's4-rescan-2026-06-29-102433'
export const frozenRecoveryExpectedTotal = 298

type FrozenRecoveryOptions = {
  expectedBatchId?: string
  expectedTotal?: number
}

export function preflightFrozenAccountRecovery(
  input: unknown,
  options: FrozenRecoveryOptions = {},
) {
  const expectedBatchId = options.expectedBatchId ?? frozenRecoveryBatchId
  const expectedTotal = options.expectedTotal ?? frozenRecoveryExpectedTotal
  const parsed = scanImportStagingBatchSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      batch: undefined,
      errors: [parsed.error.issues[0]?.message ?? '冻结暂存文件 schema 不合法。'],
      summary: null,
      contentHash: null,
    }
  }
  const summary = summarizeScanImportItems(parsed.data.items)
  const errors: string[] = []
  if (parsed.data.batch.id !== expectedBatchId) {
    errors.push(`批次 ID 不匹配：需要 ${expectedBatchId}。`)
  }
  if (summary.total !== expectedTotal) errors.push(`冻结暂存总数必须为 ${expectedTotal}。`)
  if (
    summary.ready !== expectedTotal ||
    summary.needsReview ||
    summary.invalid ||
    summary.imported
  ) {
    errors.push(
      `冻结暂存必须为 ${expectedTotal}/${expectedTotal} ready；当前为 ${summary.ready} ready、${summary.needsReview} 待复核、${summary.invalid} 无效、${summary.imported} 已导入。`,
    )
  }
  return {
    success: errors.length === 0,
    batch: errors.length === 0 ? parsed.data : undefined,
    errors,
    summary,
    contentHash: contentHash(parsed.data),
  }
}

function accountScope(accountId: string, id: string) {
  return {
    scopedId: getScopedId(accountId, id),
    accountId,
    sourceLegacyId: null,
    migratedAt: null,
  }
}

export async function importFrozenRecoveryToAccount(
  accountId: string,
  input: unknown,
  context: ScanImportAssessmentContext & { gameDataVersion: string; now?: string },
  db: SodaDatabase = database,
  options: FrozenRecoveryOptions = {},
  beforeCommit?: () => void,
) {
  accountIdSchema.parse(accountId)
  const frozen = preflightFrozenAccountRecovery(input, options)
  if (!frozen.success || !frozen.batch) throw new Error(frozen.errors[0] ?? '冻结暂存预检失败。')

  const expectedTotal = options.expectedTotal ?? frozenRecoveryExpectedTotal
  return db.transaction(
    'rw',
    [db.accounts, db.accountDriveDiscs, db.accountScanImportBatches, db.accountScanImportItems],
    async () => {
      if (!(await db.accounts.get(accountId))) throw new Error('目标账号不存在。')
      const batchId = frozen.batch!.batch.id
      const [existingBatch, existingItems, existingScoped] = await Promise.all([
        db.accountScanImportBatches.where('[accountId+id]').equals([accountId, batchId]).first(),
        db.accountScanImportItems
          .where('[accountId+batchId]')
          .equals([accountId, batchId])
          .toArray(),
        db.accountDriveDiscs.where('accountId').equals(accountId).toArray(),
      ])
      if (
        existingItems.some((item) => item.state === 'imported') ||
        existingBatch?.importHistory?.some((event) => event.action === 'imported') ||
        existingBatch?.replacedDiscs?.length
      )
        throw new Error('该账号恢复批次已经导入，不能重新覆盖暂存。')

      const standardInput = createStandardImportFromStaging(
        frozen.batch!.batch,
        frozen.batch!.items,
      )
      const importPreflight = preflightDriveDiscImport(standardInput, {
        driveDiscSets: context.driveDiscSets,
        driveDiscRules: context.rules,
        gameDataVersion: context.gameDataVersion,
        existingDiscs: existingScoped,
        now: context.now,
        batchId,
      })
      if (importPreflight.summary.failed) throw new Error('冻结暂存领域复检失败，未写入账号仓库。')
      if (importPreflight.summary.ready + importPreflight.summary.skipped !== expectedTotal)
        throw new Error('冻结暂存导入数量无法完整解释，未写入账号仓库。')
      const projectedTotal = existingScoped.length + importPreflight.summary.ready
      if (projectedTotal !== expectedTotal)
        throw new Error(`导入后预计 ${projectedTotal} 张，不等于目标 ${expectedTotal} 张。`)

      const importedAt = context.now ?? new Date().toISOString()
      if (importPreflight.readyDiscs.length) {
        await db.accountDriveDiscs.bulkAdd(
          importPreflight.readyDiscs.map((disc) => ({
            ...disc,
            ...accountScope(accountId, disc.id),
          })),
        )
      }
      const resultByIndex = new Map(importPreflight.items.map((item) => [item.index, item]))
      await db.accountScanImportItems.bulkPut(
        frozen.batch!.items.map((item, index) => {
          const result = resultByIndex.get(index)
          return {
            ...item,
            ...accountScope(accountId, item.id),
            state:
              result?.status === 'ready' || result?.status === 'skipped' ? 'imported' : item.state,
            duplicate: result?.status === 'skipped' ? true : item.duplicate,
            updatedAt: importedAt,
          }
        }),
      )
      await db.accountScanImportBatches.put({
        ...existingBatch,
        ...frozen.batch!.batch,
        ...accountScope(accountId, frozen.batch!.batch.id),
        updatedAt: importedAt,
        importHistory: [
          ...(existingBatch?.importHistory ?? frozen.batch!.batch.importHistory ?? []),
          {
            action: 'imported',
            at: importedAt,
            importedCount: importPreflight.summary.ready,
            skippedCount: importPreflight.summary.skipped,
          },
        ],
      })
      const finalDiscs = await db.accountDriveDiscs.where('accountId').equals(accountId).toArray()
      if (finalDiscs.length !== expectedTotal) {
        throw new Error('账号正式仓库数量校验失败，事务已回滚。')
      }
      beforeCommit?.()
      return {
        accountId,
        batchId,
        total: finalDiscs.length,
        imported: importPreflight.summary.ready,
        skipped: importPreflight.summary.skipped,
        warehouseHash: contentHash(
          finalDiscs
            .map((disc) => ({ id: disc.id, importFingerprint: disc.importFingerprint ?? null }))
            .sort((left, right) => left.id.localeCompare(right.id)),
        ),
        frozenHash: frozen.contentHash,
      }
    },
  )
}

export function parseFrozenRecoveryText(text: string): ScanImportStagingBatch {
  return scanImportStagingBatchSchema.parse(JSON.parse(text))
}
