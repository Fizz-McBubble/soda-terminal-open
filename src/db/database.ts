import { database, type SodaDatabase } from './databaseCore'
import { preflightDriveDiscImport, type DriveDiscImportPreflight } from '../domain/discImport'
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

export * from './databaseScanImportStaging'
export * from './databaseScanImportActions'
