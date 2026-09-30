import { database, type SodaDatabase } from './databaseCore'
import { reconcileAccountReplacementDiscs } from './discReplacementFacts'
import { getLegacyReviewFields } from './scanConfirmationMigration'
import {
  migrateScanImportConfirmations as migrateScanImportConfirmationsInternal,
  type ScanConfirmationMigrationResult,
} from './scanConfirmationMigration'
import { preflightDriveDiscImport } from '../domain/discImport'
import {
  confirmScanImportItem,
  createStandardImportFromStaging,
  isLegacyScanImportBatch,
  reassessSavedScanImportItem,
  refreshScanBatchManifestPayloadHash,
  resolveScanBatchManifest,
  scanImportStagingBatchSchema,
  summarizeScanImportItems,
  type ScanImportAssessmentContext,
  type ScanImportBatchMatch,
  type ScanImportBatchMeta,
  type ScanImportReviewPatch,
  type ScanImportStagingBatch,
} from '../domain/scanImportStaging'
import type { AccountScanImportItem } from '../accounts/types'
import type { AccountPlanningDraft } from '../accounts/types'

export async function persistScanImportStaging(
  input: unknown,
  context: ScanImportAssessmentContext,
  db: SodaDatabase = database,
): Promise<ScanImportStagingBatch> {
  const parsed = scanImportStagingBatchSchema.parse(input)
  if (parsed.batch.dataVersion !== context.dataVersion)
    throw new Error(
      `扫描批次数据版本 ${parsed.batch.dataVersion} 与当前 ${context.dataVersion} 不一致。`,
    )
  if (parsed.batch.total !== parsed.items.length)
    throw new Error('扫描批次声明数量与暂存项数量不一致。')
  if (new Set(parsed.items.map((item) => item.sourceIdentity)).size !== parsed.items.length)
    throw new Error('扫描批次包含重复的原始证据身份。')
  if (parsed.items.some((item) => item.batchId !== parsed.batch.id))
    throw new Error('扫描暂存项批次 ID 不一致。')

  const [existingBatch, existingItems] = await Promise.all([
    db.scanImportBatches.get(parsed.batch.id),
    db.scanImportItems.where('batchId').equals(parsed.batch.id).toArray(),
  ])
  if (existingItems.some((item) => item.state === 'imported'))
    throw new Error('该扫描批次仍有正式导入记录，请先撤销后再重新载入。')
  const existingBySource = new Map(existingItems.map((item) => [item.sourceIdentity, item]))
  const items = parsed.items.map((item) => {
    const existing = existingBySource.get(item.sourceIdentity)
    const hasManualEvidence = Boolean(
      existing && (existing.confirmations.length || getLegacyReviewFields(existing).length),
    )
    return reassessSavedScanImportItem(hasManualEvidence ? existing! : item, context)
  })
  const batch = {
    ...parsed.batch,
    importHistory: existingBatch?.importHistory ?? parsed.batch.importHistory,
  }
  await db.transaction('rw', db.scanImportBatches, db.scanImportItems, async () => {
    await db.scanImportItems.where('batchId').equals(parsed.batch.id).delete()
    await db.scanImportBatches.put(batch)
    await db.scanImportItems.bulkAdd(items)
  })
  return { ...parsed, batch, items }
}

export type ScanImportBatchCatalogEntry = {
  batch: ScanImportBatchMeta
  summary: ReturnType<typeof summarizeScanImportItems>
  lifecycle: 'imported' | 'rolled_back' | 'previously_imported' | 'not_imported' | 'unknown'
}

export async function listScanImportBatches(
  db: SodaDatabase = database,
): Promise<ScanImportBatchCatalogEntry[]> {
  const batches = await db.scanImportBatches.toArray()
  const entries = await Promise.all(
    batches.map(async (batch) => {
      const items = await db.scanImportItems.where('batchId').equals(batch.id).toArray()
      const summary = summarizeScanImportItems(items)
      const history = batch.importHistory ?? []
      const latestEvent = history.at(-1)
      const lifecycle = summary.imported
        ? 'imported'
        : latestEvent?.action === 'rolled_back'
          ? 'rolled_back'
          : history.some((event) => event.action === 'imported')
            ? 'previously_imported'
            : batch.updatedAt !== batch.createdAt
              ? 'unknown'
              : 'not_imported'
      return { batch, summary, lifecycle } satisfies ScanImportBatchCatalogEntry
    }),
  )
  return entries.toSorted((left, right) =>
    right.batch.createdAt.localeCompare(left.batch.createdAt),
  )
}

export type { ScanConfirmationMigrationResult } from './scanConfirmationMigration'

export async function migrateScanImportConfirmations(
  sourceBatchId: string,
  targetBatchId: string,
  matches: ScanImportBatchMatch[],
  context: ScanImportAssessmentContext,
  db: SodaDatabase = database,
): Promise<ScanConfirmationMigrationResult> {
  return migrateScanImportConfirmationsInternal(sourceBatchId, targetBatchId, matches, context, db)
}

export async function reviewScanImportItem(
  itemId: string,
  patch: ScanImportReviewPatch,
  context: ScanImportAssessmentContext,
  db: SodaDatabase = database,
  expectedRevision?: number,
) {
  return db.transaction('rw', db.scanImportBatches, db.scanImportItems, async () => {
    const current = await db.scanImportItems.get(itemId)
    if (!current) throw new Error('待复核记录不存在。')
    if (current.state === 'imported') throw new Error('已导入记录不可再次修改。')
    const batch = await db.scanImportBatches.get(current.batchId)
    if (!batch) throw new Error('扫描暂存批次不存在。')
    if (expectedRevision !== undefined && batch.reviewState.revision !== expectedRevision)
      throw new Error('复核草稿已被其他页面更新，请重读后重新确认。')
    if ((batch.manifest || isLegacyScanImportBatch(batch)) && !patch.fields?.length)
      throw new Error('完整复核批次必须明确记录本次确认的待复核字段。')
    if (patch.fields?.length) {
      const reviewableFields = new Set(
        current.issues.map((issue) =>
          issue.field === 'setId' ? 'setName' : issue.field.replace(/\.(stat|value|upgrades)$/, ''),
        ),
      )
      if (patch.fields.some((field) => !reviewableFields.has(field)))
        throw new Error('手动修正只能写入当前待复核字段。')
    }
    const next = confirmScanImportItem(current, patch, context)
    let nextManifest = batch.manifest
    if (batch.manifest || isLegacyScanImportBatch(batch)) {
      const currentItems = await db.scanImportItems.where('batchId').equals(batch.id).toArray()
      const { manifest } = resolveScanBatchManifest(batch, currentItems, { allowLegacy343: true })
      const nextItems = currentItems.map((item) => (item.id === next.id ? next : item))
      nextManifest = refreshScanBatchManifestPayloadHash({ ...batch, manifest }, nextItems)
    }
    await db.scanImportItems.put(next)
    await db.scanImportBatches.put({
      ...batch,
      manifest: nextManifest,
      updatedAt: new Date().toISOString(),
      reviewState: {
        revision: batch.reviewState.revision + 1,
        preflight: 'stale',
        preflightRevision: null,
        armedRevision: null,
      },
    })
    return next
  })
}

function assertActiveAccountScope(accountId: string, db: SodaDatabase) {
  return db.settings.get('active-account-id').then((setting) => {
    if (setting?.value !== accountId) throw new Error('当前活动账号已变化，请返回账号范围后重试。')
  })
}

export {
  stageAccountPaddleScanImport,
  discardInvalidAccountScanStaging,
  repairCompletedAccountScanStaging,
  reviewAccountScanImportItem,
  preflightAccountScanReviewBatch,
  armAccountScanReviewImport,
  importReadyAccountScanStaging,
  replaceReadyAccountScanStaging,
} from './accountScanImport'

function remapKnownDiscIds(value: unknown, replacements: Map<string, string>): unknown {
  if (typeof value === 'string') return replacements.get(value) ?? value
  if (Array.isArray(value)) return value.map((item) => remapKnownDiscIds(item, replacements))
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, remapKnownDiscIds(item, replacements)]),
  )
}

export async function repairAccountPlanningDraftReferencesFromScanHistory(
  accountId: string,
  context: ScanImportAssessmentContext & { gameDataVersion: string; now?: string },
  confirmation: 'repair_stale_scan_references',
  db: SodaDatabase = database,
) {
  if (confirmation !== 'repair_stale_scan_references')
    throw new Error('必须明确确认修复当前账户的历史扫描方案引用。')
  return db.transaction(
    'rw',
    [
      db.settings,
      db.accountDriveDiscs,
      db.accountPlanningDrafts,
      db.accountScanImportBatches,
      db.accountScanImportItems,
    ],
    async () => {
      await assertActiveAccountScope(accountId, db)
      const [currentDiscs, drafts, batches, items] = await Promise.all([
        db.accountDriveDiscs.where('accountId').equals(accountId).toArray(),
        db.accountPlanningDrafts.where('accountId').equals(accountId).toArray(),
        db.accountScanImportBatches.where('accountId').equals(accountId).toArray(),
        db.accountScanImportItems.where('accountId').equals(accountId).toArray(),
      ])
      const currentIds = new Set(currentDiscs.map((disc) => disc.id))
      const missingBefore = drafts
        .flatMap((draft) => draft.warehouseRefs)
        .filter((id) => !currentIds.has(id))
      const itemsByBatch = new Map<string, AccountScanImportItem[]>()
      for (const item of items) {
        const group = itemsByBatch.get(item.batchId) ?? []
        group.push(item)
        itemsByBatch.set(item.batchId, group)
      }
      const replacements = new Map<string, string>()
      for (const batch of batches) {
        const batchItems = itemsByBatch.get(batch.id) ?? []
        if (batchItems.length !== batch.total) continue
        const readyItems = batchItems.map((item) => ({
          ...item,
          state: 'ready' as const,
          duplicate: false,
        }))
        const historical = preflightDriveDiscImport(
          createStandardImportFromStaging(batch, readyItems),
          {
            driveDiscSets: context.driveDiscSets,
            driveDiscSetIdentities: context.driveDiscSetIdentities,
            driveDiscRules: context.rules,
            gameDataVersion: context.gameDataVersion,
            existingDiscs: [],
            now: batch.createdAt,
            batchId: batch.id,
          },
        )
        if (historical.readyDiscs.length !== batch.total) continue
        const reconciled = reconcileAccountReplacementDiscs(historical.readyDiscs, currentDiscs)
        historical.readyDiscs.forEach((disc, index) => {
          const currentId = reconciled.discs[index]?.id
          if (currentId && currentIds.has(currentId)) replacements.set(disc.id, currentId)
        })
      }
      const repairedAt = context.now ?? new Date().toISOString()
      let draftsUpdated = 0
      let referencesUpdated = 0
      const repairedDrafts = drafts.map((draft) => {
        const repaired = remapKnownDiscIds(draft, replacements) as AccountPlanningDraft
        const changedReferences = draft.warehouseRefs.filter(
          (id, index) => repaired.warehouseRefs[index] !== id,
        ).length
        if (!changedReferences) return draft
        draftsUpdated += 1
        referencesUpdated += changedReferences
        return { ...repaired, revision: draft.revision + 1, updatedAt: repairedAt }
      })
      if (draftsUpdated) await db.accountPlanningDrafts.bulkPut(repairedDrafts)
      const missingAfter = repairedDrafts
        .flatMap((draft) => draft.warehouseRefs)
        .filter((id) => !currentIds.has(id)).length
      return {
        draftsUpdated,
        referencesUpdated,
        missingBefore: missingBefore.length,
        missingAfter,
      }
    },
  )
}
