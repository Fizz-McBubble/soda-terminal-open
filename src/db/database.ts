import { database, type SodaDatabase } from './databaseCore'
import { reconcileAccountReplacementDiscs } from './discReplacementFacts'
import { getLegacyReviewFields } from './scanConfirmationMigration'
import {
  migrateScanImportConfirmations as migrateScanImportConfirmationsInternal,
  type ScanConfirmationMigrationResult,
} from './scanConfirmationMigration'
import {
  buildScanImportRollbackPreview,
  type ScanImportRollbackPreview,
  type ScanImportRollbackResult,
} from './scanImportRollback'
import { preflightDriveDiscImport, type DriveDiscImportPreflight } from '../domain/discImport'
import {
  assessScanImportItem,
  confirmScanImportItem,
  createStandardImportFromStaging,
  isLegacyScanImportBatch,
  legacyScanImportExpectedTotal,
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
import { createDiscEvaluation, getDriveDiscVersion } from '../domain/discEvaluations'
import {
  buildProfileSchema,
  driveDiscSchema,
  type BuildProfile,
  type DriveDisc,
} from '../domain/schemas'
import { addDiscTag, normalizeDiscTags, removeDiscTag } from '../domain/discTags'
import {
  copyTemplate,
  getBuiltInTemplates,
  getNextTemplateVersion,
  validateTemplateReferences,
} from '../domain/templates'
import { replaceRuntimeProfiles } from '../evaluation/rules'
import { evaluateDisc } from '../evaluation/evaluateDisc'
import type { EvaluationSnapshot } from '../evaluation/types'
import type { AccountScanImportItem } from '../accounts/types'
import type { AccountPlanningDraft } from '../accounts/types'

export type DatabaseMetadata = {
  schemaVersion: number
  gameVersion: string | null
  initializedAt: string
}

export { database, databaseSchemaVersion, SodaDatabase } from './databaseCore'
export type { Setting } from './databaseCore'

export class DiscNotFoundError extends Error {
  constructor() {
    super('目标档案不存在，可能已在其他页面被删除。')
    this.name = 'DiscNotFoundError'
  }
}

export async function initializeDatabase(metadata: Omit<DatabaseMetadata, 'initializedAt'>) {
  await database.open()
  await ensureBuiltInTemplates()
  const { ensureBundledGameDataPacks } = await import('../gameDataPacks/repository')
  await ensureBundledGameDataPacks()
  await database.settings.put({
    key: 'app-metadata',
    value: { ...metadata, initializedAt: new Date().toISOString() } satisfies DatabaseMetadata,
  })
}

async function syncRuntimeTemplates() {
  replaceRuntimeProfiles(await database.buildProfiles.toArray())
}

export async function ensureBuiltInTemplates() {
  const builtIns = getBuiltInTemplates()
  await database.transaction('rw', database.buildProfiles, async () => {
    for (const builtIn of builtIns) {
      const existing = await database.buildProfiles.get(builtIn.id)
      if (!existing || existing.isDefault) await database.buildProfiles.put(builtIn)
    }
  })
  await syncRuntimeTemplates()
  return builtIns
}

export async function restoreBuiltInTemplates() {
  const builtIns = getBuiltInTemplates()
  await database.transaction('rw', database.buildProfiles, async () => {
    await database.buildProfiles.bulkPut(builtIns)
  })
  await syncRuntimeTemplates()
  return builtIns.length
}

export async function createUserTemplate(sourceId: string, name: string) {
  const copied = await database.transaction('rw', database.buildProfiles, async () => {
    const source = await database.buildProfiles.get(sourceId)
    if (!source || source.archived) throw new Error('来源模板不存在。')
    const duplicate = await database.buildProfiles
      .where('agentId')
      .equals(source.agentId)
      .filter((profile) => !profile.archived && profile.name.trim() === name.trim())
      .first()
    if (duplicate) throw new Error('同一代理人下已存在同名模板。')
    const next = copyTemplate(source, name.trim())
    await database.buildProfiles.add(next)
    return next
  })
  await syncRuntimeTemplates()
  return copied
}

export async function saveUserTemplate(input: BuildProfile) {
  const updated = await database.transaction('rw', database.buildProfiles, async () => {
    const existing = await database.buildProfiles.get(input.id)
    if (!existing || existing.archived) throw new Error('模板不存在。')
    if (existing.isDefault) throw new Error('默认模板只读，请先复制。')
    const duplicate = await database.buildProfiles
      .where('agentId')
      .equals(input.agentId)
      .filter(
        (profile) =>
          profile.id !== input.id && !profile.archived && profile.name.trim() === input.name.trim(),
      )
      .first()
    if (duplicate) throw new Error('同一代理人下已存在同名模板。')
    const next = validateTemplateReferences(
      buildProfileSchema.parse({
        ...input,
        id: existing.id,
        isDefault: false,
        sourceTemplateId: existing.sourceTemplateId,
        version: getNextTemplateVersion(existing.version),
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString(),
      }),
    )
    await database.buildProfiles.put(next)
    return next
  })
  await syncRuntimeTemplates()
  return updated
}

export async function deleteUserTemplate(templateId: string) {
  await database.transaction('rw', database.buildProfiles, async () => {
    const existing = await database.buildProfiles.get(templateId)
    if (!existing) throw new Error('模板不存在。')
    if (existing.isDefault) throw new Error('默认模板不可删除。')
    await database.buildProfiles.put({
      ...existing,
      archived: true,
      updatedAt: new Date().toISOString(),
    })
  })
  await syncRuntimeTemplates()
}

export async function archiveDiscWithEvaluation(
  disc: DriveDisc,
  snapshot: EvaluationSnapshot,
  previousSnapshot?: EvaluationSnapshot | null,
) {
  const archivedDisc: DriveDisc = {
    ...disc,
    discVersion: getDriveDiscVersion(disc),
    updatedAt: new Date().toISOString(),
  }

  await database.transaction('rw', database.driveDiscs, database.discEvaluations, async () => {
    await database.driveDiscs.put(archivedDisc)
    if (previousSnapshot) {
      await database.discEvaluations.put(
        createDiscEvaluation({ ...previousSnapshot.input, id: disc.id }, previousSnapshot),
      )
    }
    await database.discEvaluations.put(createDiscEvaluation(archivedDisc, snapshot))
  })

  return archivedDisc
}

export async function updateArchivedDisc(disc: DriveDisc) {
  return database.transaction('rw', database.driveDiscs, async () => {
    const existing = await database.driveDiscs.get(disc.id)
    if (!existing) throw new DiscNotFoundError()

    const updated = driveDiscSchema.parse({
      ...disc,
      id: existing.id,
      createdAt: existing.createdAt,
      discVersion: getDriveDiscVersion(disc),
      updatedAt: new Date().toISOString(),
    })
    await database.driveDiscs.put(updated)
    return updated
  })
}

export async function deleteArchivedDisc(discId: string) {
  return database.transaction('rw', database.driveDiscs, database.discEvaluations, async () => {
    const disc = await database.driveDiscs.get(discId)
    if (!disc) throw new DiscNotFoundError()
    const evaluationCount = await database.discEvaluations.where('discId').equals(discId).count()

    await database.driveDiscs.delete(discId)
    await database.discEvaluations.where('discId').equals(discId).delete()
    return { disc, evaluationCount }
  })
}

export type BulkArchiveResult = {
  requestedCount: number
  successCount: number
  missingCount: number
}

export type BulkEvaluationResult = {
  requestedCount: number
  successCount: number
  skippedCount: number
  failedCount: number
  profileId: string
}

function uniqueIds(discIds: string[]) {
  return [...new Set(discIds)]
}

export async function updateArchivedDiscFlags(
  discIds: string[],
  changes: Partial<Pick<DriveDisc, 'locked' | 'favorite'>>,
): Promise<BulkArchiveResult> {
  const ids = uniqueIds(discIds)
  return database.transaction('rw', database.driveDiscs, async () => {
    const existing = (await database.driveDiscs.bulkGet(ids)).filter((disc): disc is DriveDisc =>
      Boolean(disc),
    )
    const updatedAt = new Date().toISOString()
    for (const disc of existing) {
      await database.driveDiscs.put({ ...disc, ...changes, updatedAt })
    }
    return {
      requestedCount: ids.length,
      successCount: existing.length,
      missingCount: ids.length - existing.length,
    }
  })
}

export async function updateArchivedDiscTags(discId: string, tags: string[]) {
  return database.transaction('rw', database.driveDiscs, async () => {
    const disc = await database.driveDiscs.get(discId)
    if (!disc) throw new DiscNotFoundError()
    const updated = driveDiscSchema.parse({
      ...disc,
      tags: normalizeDiscTags(tags),
      updatedAt: new Date().toISOString(),
    })
    await database.driveDiscs.put(updated)
    return updated
  })
}

export async function updateArchivedDiscTagsBulk(
  discIds: string[],
  operation: { type: 'add' | 'remove'; tag: string },
): Promise<BulkArchiveResult> {
  const ids = uniqueIds(discIds)
  return database.transaction('rw', database.driveDiscs, async () => {
    const existing = (await database.driveDiscs.bulkGet(ids)).filter((disc): disc is DriveDisc =>
      Boolean(disc),
    )
    const updatedAt = new Date().toISOString()
    for (const disc of existing) {
      const tags =
        operation.type === 'add'
          ? addDiscTag(disc.tags ?? [], operation.tag)
          : removeDiscTag(disc.tags ?? [], operation.tag)
      await database.driveDiscs.put(driveDiscSchema.parse({ ...disc, tags, updatedAt }))
    }
    return {
      requestedCount: ids.length,
      successCount: existing.length,
      missingCount: ids.length - existing.length,
    }
  })
}

export async function deleteArchivedDiscs(discIds: string[]): Promise<BulkArchiveResult> {
  const ids = uniqueIds(discIds)
  return database.transaction('rw', database.driveDiscs, database.discEvaluations, async () => {
    const existing = (await database.driveDiscs.bulkGet(ids)).filter((disc): disc is DriveDisc =>
      Boolean(disc),
    )
    const existingIds = existing.map((disc) => disc.id)
    if (existingIds.length) {
      await database.driveDiscs.bulkDelete(existingIds)
      await database.discEvaluations.where('discId').anyOf(existingIds).delete()
    }
    return {
      requestedCount: ids.length,
      successCount: existingIds.length,
      missingCount: ids.length - existingIds.length,
    }
  })
}

export async function bulkEvaluateArchivedDiscs(
  discIds: string[],
  profileId: string,
): Promise<BulkEvaluationResult> {
  const ids = uniqueIds(discIds)
  return database.transaction(
    'rw',
    database.driveDiscs,
    database.discEvaluations,
    database.buildProfiles,
    async () => {
      const profile = await database.buildProfiles.get(profileId)
      if (!profile || profile.archived) throw new Error('代理人模板不存在或已停用。')

      const discs = await database.driveDiscs.bulkGet(ids)
      let successCount = 0
      let failedCount = 0
      let skippedCount = 0

      for (const disc of discs) {
        if (!disc) {
          skippedCount += 1
          continue
        }

        try {
          const versionedDisc = { ...disc, discVersion: getDriveDiscVersion(disc) }
          const snapshot = evaluateDisc(versionedDisc, { profile })
          await database.driveDiscs.put(versionedDisc)
          await database.discEvaluations.put(
            createDiscEvaluation(versionedDisc, snapshot, 'automatic'),
          )
          successCount += 1
        } catch {
          failedCount += 1
        }
      }

      return {
        requestedCount: ids.length,
        successCount,
        skippedCount,
        failedCount,
        profileId,
      }
    },
  )
}

export async function importDriveDiscsFromJson(
  input: unknown,
  context: {
    gameDataVersion: string
    driveDiscSets: Parameters<typeof preflightDriveDiscImport>[1]['driveDiscSets']
    driveDiscRules?: Parameters<typeof preflightDriveDiscImport>[1]['driveDiscRules']
    now?: string
    batchId?: string
  },
  db: SodaDatabase = database,
  beforeCommit?: () => void,
): Promise<DriveDiscImportPreflight> {
  return db.transaction('rw', db.driveDiscs, async () => {
    const preflight = preflightDriveDiscImport(input, {
      ...context,
      existingDiscs: await db.driveDiscs.toArray(),
    })
    if (preflight.readyDiscs.length) await db.driveDiscs.bulkAdd(preflight.readyDiscs)
    beforeCommit?.()
    return preflight
  })
}

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

export async function preflightScanReviewBatch(
  batchId: string,
  context: ScanImportAssessmentContext,
  db: SodaDatabase = database,
) {
  return db.transaction('rw', db.scanImportBatches, db.scanImportItems, async () => {
    let batch = await db.scanImportBatches.get(batchId)
    if (!batch) throw new Error('扫描暂存批次不存在。')
    const result = await reassessScanImportBatch(batchId, context, db)
    batch = (await db.scanImportBatches.get(batchId)) ?? batch
    const items = await db.scanImportItems.where('batchId').equals(batchId).toArray()
    let expectedTotal: number | null
    try {
      expectedTotal = resolveScanBatchManifest(batch, items, {
        allowLegacy343: true,
      }).manifest.expectedTotal
    } catch {
      // A partial legacy declaration remains reviewable but can never complete preflight.
      expectedTotal = null
    }
    const complete =
      expectedTotal !== null &&
      items.length === expectedTotal &&
      new Set(items.map((i) => i.sourceIdentity)).size === expectedTotal &&
      result.ready === expectedTotal &&
      !result.needsReview &&
      !result.invalid &&
      !items.some((i) => i.duplicate || !i.evidence.detailPath || !i.evidence.visualDetailHash)
    await db.scanImportBatches.put({
      ...batch,
      updatedAt: new Date().toISOString(),
      reviewState: {
        ...batch.reviewState,
        preflight: complete ? 'complete' : 'stale',
        preflightRevision: complete ? batch.reviewState.revision : null,
        armedRevision: null,
      },
    })
    return { ...result, complete }
  })
}

export async function armScanReviewImport(batchId: string, db: SodaDatabase = database) {
  const batch = await db.scanImportBatches.get(batchId)
  const items = await db.scanImportItems.where('batchId').equals(batchId).toArray()
  if (!batch) throw new Error('扫描暂存批次不存在。')
  let expectedTotal: number
  try {
    expectedTotal = resolveScanBatchManifest(batch, items, {
      allowLegacy343: true,
    }).manifest.expectedTotal
  } catch {
    if (batch.total === legacyScanImportExpectedTotal)
      throw new Error(`必须先完成当前草稿的 ${batch.total} 条重新预检。`)
    throw new Error('扫描批次 manifest 无效，不能进入导入确认。')
  }
  if (
    items.length !== expectedTotal ||
    items.some((item) => !item.evidence.detailPath || !item.evidence.visualDetailHash) ||
    batch.reviewState.preflight !== 'complete' ||
    batch.reviewState.preflightRevision !== batch.reviewState.revision
  )
    throw new Error(`必须先完成当前草稿的 ${expectedTotal} 条重新预检。`)
  await db.scanImportBatches.put({
    ...batch,
    reviewState: { ...batch.reviewState, armedRevision: batch.reviewState.revision },
    updatedAt: new Date().toISOString(),
  })
}

export async function reviewScanImportGroup(
  batchId: string,
  sequences: number[],
  setId: string,
  context: ScanImportAssessmentContext,
  db: SodaDatabase = database,
) {
  return db.transaction('rw', db.scanImportBatches, db.scanImportItems, async () => {
    const batch = await db.scanImportBatches.get(batchId)
    if (!batch) throw new Error('恢复批次不存在。')
    const set = context.driveDiscSets.find((candidate) => candidate.id === setId)
    if (!set || set.evidenceOnly) throw new Error('请选择可核验的正式套装。')
    const sequenceSet = new Set(sequences)
    const items = (await db.scanImportItems.where('batchId').equals(batchId).toArray()).filter(
      (item) => sequenceSet.has(item.sequence),
    )
    if (items.length !== sequenceSet.size) throw new Error('恢复组记录不完整，未写入任何修改。')
    if (items.some((item) => item.state === 'imported'))
      throw new Error('恢复组包含已导入记录，不能修改。')
    const updates = items.map((item) =>
      confirmScanImportItem(
        item,
        {
          candidate: { ...item.candidate, setId: set.id, setName: set.name },
          lockState: item.lockState,
        },
        context,
      ),
    )
    await db.scanImportItems.bulkPut(updates)
    await db.scanImportBatches.put({ ...batch, updatedAt: new Date().toISOString() })
    return {
      updated: updates.length,
      ready: updates.filter((item) => item.state === 'ready').length,
      needsReview: updates.filter((item) => item.state === 'needs_review').length,
    }
  })
}

export async function reassessScanImportBatch(
  batchId: string,
  context: ScanImportAssessmentContext,
  db: SodaDatabase = database,
) {
  return db.transaction('rw', db.scanImportBatches, db.scanImportItems, async () => {
    const batch = await db.scanImportBatches.get(batchId)
    if (!batch) throw new Error('扫描暂存批次不存在。')
    const items = await db.scanImportItems.where('batchId').equals(batchId).toArray()
    const nextItems = items.map((item) =>
      item.state === 'imported' ? item : reassessSavedScanImportItem(item, context),
    )
    const updates = nextItems.filter(
      (next, index) => JSON.stringify(next) !== JSON.stringify(items[index]),
    )
    if (updates.length) {
      let manifest = batch.manifest
      if (batch.manifest || isLegacyScanImportBatch(batch)) {
        const resolved = resolveScanBatchManifest(batch, items, { allowLegacy343: true })
        manifest = refreshScanBatchManifestPayloadHash(
          { ...batch, manifest: resolved.manifest },
          nextItems,
        )
      }
      await db.scanImportItems.bulkPut(updates)
      await db.scanImportBatches.put({
        ...batch,
        manifest,
        updatedAt: new Date().toISOString(),
      })
    }
    const currentItems = updates.length ? nextItems : items
    return {
      updated: updates.length,
      ready: currentItems.filter((item) => item.state === 'ready').length,
      needsReview: currentItems.filter((item) => item.state === 'needs_review').length,
      invalid: currentItems.filter((item) => item.state === 'invalid').length,
    }
  })
}

export async function importReadyScanStaging(
  batchId: string,
  context: ScanImportAssessmentContext & { gameDataVersion: string; now?: string },
  db: SodaDatabase = database,
  beforeCommit?: () => void,
) {
  return db.transaction('rw', db.driveDiscs, db.scanImportBatches, db.scanImportItems, async () => {
    const batch = await db.scanImportBatches.get(batchId)
    if (!batch) throw new Error('扫描暂存批次不存在。')
    if (
      batch.total === legacyScanImportExpectedTotal &&
      (batch.reviewState.preflight !== 'complete' ||
        batch.reviewState.preflightRevision !== batch.reviewState.revision ||
        batch.reviewState.armedRevision !== batch.reviewState.revision)
    )
      throw new Error('扫描复核尚未完成独立重新预检与导入确认。')
    const readyItems = await db.scanImportItems
      .where('[batchId+state]')
      .equals([batchId, 'ready'])
      .sortBy('sequence')
    if (!readyItems.length) throw new Error('当前没有可直接导入的记录。')
    const standardInput = createStandardImportFromStaging(batch, readyItems)
    const preflight = preflightDriveDiscImport(standardInput, {
      driveDiscSets: context.driveDiscSets,
      driveDiscSetIdentities: context.driveDiscSetIdentities,
      driveDiscRules: context.rules,
      gameDataVersion: context.gameDataVersion,
      existingDiscs: await db.driveDiscs.toArray(),
      now: context.now,
      batchId,
    })
    if (preflight.summary.failed) throw new Error('ready 集合复检失败，事务已回滚。')
    if (preflight.readyDiscs.length) await db.driveDiscs.bulkAdd(preflight.readyDiscs)

    for (const result of preflight.items) {
      const source = readyItems[result.index]
      if (!source) continue
      if (result.status === 'ready') {
        await db.scanImportItems.put({
          ...source,
          state: 'imported',
          updatedAt: new Date().toISOString(),
        })
      } else if (result.status === 'skipped') {
        await db.scanImportItems.put(
          assessScanImportItem(
            {
              ...source,
              duplicate: true,
              updatedAt: new Date().toISOString(),
            },
            context,
          ),
        )
      }
    }
    const importedAt = new Date().toISOString()
    await db.scanImportBatches.put({
      ...batch,
      updatedAt: importedAt,
      importHistory: [
        ...(batch.importHistory ?? []),
        {
          action: 'imported',
          at: importedAt,
          importedCount: preflight.summary.ready,
          skippedCount: preflight.summary.skipped,
        },
      ],
    })
    beforeCommit?.()
    return preflight
  })
}

export type { ScanImportRollbackPreview, ScanImportRollbackResult } from './scanImportRollback'

export async function previewScanImportRollback(
  batchId: string,
  db: SodaDatabase = database,
): Promise<ScanImportRollbackPreview> {
  return db.transaction(
    'r',
    db.driveDiscs,
    db.discEvaluations,
    db.scanImportBatches,
    db.scanImportItems,
    () => buildScanImportRollbackPreview(batchId, db),
  )
}

export async function getLatestScanImportRollbackPreview(
  db: SodaDatabase = database,
): Promise<ScanImportRollbackPreview | null> {
  return db.transaction(
    'r',
    db.driveDiscs,
    db.discEvaluations,
    db.scanImportBatches,
    db.scanImportItems,
    async () => {
      const importedItems = await db.scanImportItems
        .where('state')
        .equals('imported')
        .sortBy('updatedAt')
      const candidateBatchIds = [...new Set(importedItems.reverse().map((item) => item.batchId))]
      for (const batchId of candidateBatchIds)
        if (await db.scanImportBatches.get(batchId))
          return buildScanImportRollbackPreview(batchId, db)
      return null
    },
  )
}

export async function rollbackScanImportBatch(
  batchId: string,
  db: SodaDatabase = database,
  beforeCommit?: () => void,
): Promise<ScanImportRollbackResult> {
  return db.transaction(
    'rw',
    db.driveDiscs,
    db.discEvaluations,
    db.scanImportBatches,
    db.scanImportItems,
    async () => {
      const preview = await buildScanImportRollbackPreview(batchId, db)
      if (!preview.canRollback) throw new Error(preview.blockingReason ?? '该批次不可撤销。')
      const targetDiscs = (await db.driveDiscs.toArray()).filter(
        (disc) =>
          disc.importBatchId === batchId &&
          disc.importSource?.adapter === 'soda-terminal-scan-staging',
      )
      const targetIds = targetDiscs.map((disc) => disc.id)
      const targetSources = new Set(targetDiscs.map((disc) => disc.importSource?.sourceId))
      const importedItems = await db.scanImportItems
        .where('[batchId+state]')
        .equals([batchId, 'imported'])
        .toArray()
      if (importedItems.some((item) => !targetSources.has(item.sourceIdentity)))
        throw new Error('撤销前身份复核失败，事务已回滚。')
      if (targetIds.length) {
        await db.discEvaluations.where('discId').anyOf(targetIds).delete()
        await db.driveDiscs.bulkDelete(targetIds)
      }
      const updatedAt = new Date().toISOString()
      await db.scanImportItems.bulkPut(
        importedItems.map((item) => ({ ...item, state: 'ready' as const, updatedAt })),
      )
      const batch = await db.scanImportBatches.get(batchId)
      if (!batch) throw new Error('撤销过程中批次消失，事务已回滚。')
      await db.scanImportBatches.put({
        ...batch,
        updatedAt,
        importHistory: [
          ...(batch.importHistory ?? []),
          {
            action: 'rolled_back',
            at: updatedAt,
            importedCount: importedItems.length,
            skippedCount: preview.duplicateSkippedCount,
          },
        ],
      })
      beforeCommit?.()
      return { ...preview, restoredStagingItemCount: importedItems.length }
    },
  )
}
