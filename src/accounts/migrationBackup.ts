import { z } from 'zod'
import { database, databaseSchemaVersion, type SodaDatabase } from '../db/database'
import { scanImportBatchMetaSchema, scanImportItemSchema } from '../domain/scanImportStaging'
import { buildProfileSchema, discEvaluationSchema, driveDiscSchema } from '../domain/schemas'
import { contentHash } from '../evaluation/contentHash'

export const legacyMigrationBackupFormat = 'soda-terminal-legacy-migration-backup'
export const legacyMigrationBackupVersion = 1

const settingSchema = z.object({ key: z.string().min(1), value: z.unknown() })

const legacyMigrationBackupCoreSchema = z.object({
  format: z.literal(legacyMigrationBackupFormat),
  formatVersion: z.literal(legacyMigrationBackupVersion),
  exportedAt: z.string().datetime(),
  databaseSchemaVersion: z.number().int().positive().max(databaseSchemaVersion),
  targetAccountId: z.literal('account-legacy-default'),
  counts: z.object({
    driveDiscs: z.number().int().nonnegative(),
    discEvaluations: z.number().int().nonnegative(),
    buildProfiles: z.number().int().nonnegative(),
    settings: z.number().int().nonnegative(),
    scanBatches: z.number().int().nonnegative(),
    scanItems: z.number().int().nonnegative(),
  }),
  data: z.object({
    driveDiscs: z.array(driveDiscSchema),
    discEvaluations: z.array(discEvaluationSchema),
    buildProfiles: z.array(buildProfileSchema),
    settings: z.array(settingSchema),
    scanBatches: z.array(scanImportBatchMetaSchema),
    scanItems: z.array(scanImportItemSchema),
  }),
})

export const legacyMigrationBackupSchema = legacyMigrationBackupCoreSchema.extend({
  contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
})

export type LegacyMigrationBackup = z.infer<typeof legacyMigrationBackupSchema>

function getCounts(data: LegacyMigrationBackup['data']): LegacyMigrationBackup['counts'] {
  return {
    driveDiscs: data.driveDiscs.length,
    discEvaluations: data.discEvaluations.length,
    buildProfiles: data.buildProfiles.length,
    settings: data.settings.length,
    scanBatches: data.scanBatches.length,
    scanItems: data.scanItems.length,
  }
}

export async function createLegacyMigrationBackup(
  db: SodaDatabase = database,
  now = new Date(),
): Promise<LegacyMigrationBackup> {
  const [driveDiscs, discEvaluations, buildProfiles, settings, scanBatches, scanItems] =
    await Promise.all([
      db.driveDiscs.toArray(),
      db.discEvaluations.toArray(),
      db.buildProfiles.toArray(),
      db.settings.toArray(),
      db.scanImportBatches.toArray(),
      db.scanImportItems.toArray(),
    ])
  const data = { driveDiscs, discEvaluations, buildProfiles, settings, scanBatches, scanItems }
  const core = legacyMigrationBackupCoreSchema.parse({
    format: legacyMigrationBackupFormat,
    formatVersion: legacyMigrationBackupVersion,
    exportedAt: now.toISOString(),
    databaseSchemaVersion,
    targetAccountId: 'account-legacy-default',
    counts: getCounts(data),
    data,
  })
  return legacyMigrationBackupSchema.parse({ ...core, contentHash: contentHash(core) })
}

export function preflightLegacyMigrationBackup(input: unknown) {
  const parsed = legacyMigrationBackupSchema.safeParse(input)
  if (!parsed.success) return { success: false, backup: undefined, errors: ['迁移前备份损坏。'] }
  const { contentHash: actualHash, ...core } = parsed.data
  const errors: string[] = []
  if (contentHash(core) !== actualHash) errors.push('迁移前备份内容 hash 不匹配。')
  if (JSON.stringify(getCounts(parsed.data.data)) !== JSON.stringify(parsed.data.counts)) {
    errors.push('迁移前备份声明数量与实际内容不一致。')
  }
  const discIds = new Set(parsed.data.data.driveDiscs.map((disc) => disc.id))
  const batchIds = new Set(parsed.data.data.scanBatches.map((batch) => batch.id))
  for (const evaluation of parsed.data.data.discEvaluations) {
    if (!discIds.has(evaluation.discId)) errors.push(`鉴定 ${evaluation.id} 缺少驱动盘引用。`)
  }
  for (const item of parsed.data.data.scanItems) {
    if (!batchIds.has(item.batchId)) errors.push(`扫描条目 ${item.id} 缺少批次引用。`)
  }
  return {
    success: errors.length === 0,
    backup: errors.length === 0 ? parsed.data : undefined,
    errors,
  }
}

export function getLegacyMigrationBackupFilename(date = new Date()) {
  return `soda-terminal-legacy-pre-migration-${date.toISOString().slice(0, 10)}.json`
}
