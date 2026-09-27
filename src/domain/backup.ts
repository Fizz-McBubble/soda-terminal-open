import { z } from 'zod'
import {
  buildProfileSchema,
  discEvaluationSchema,
  driveDiscSchema,
  type BuildProfile,
  type DiscEvaluation,
  type DriveDisc,
} from './schemas'
import { database, databaseSchemaVersion, type Setting, type SodaDatabase } from '../db/database'
import { gameData } from '../data/gameData'
import { replaceRuntimeProfiles } from '../evaluation/rules'
import { validateTemplateReferences } from './templates'

export const backupFormat = 'soda-terminal-backup'
export const backupFormatVersion = 1
const backedUpSettingKeys = new Set(['app-metadata'])

const settingSchema = z.object({ key: z.string().min(1), value: z.unknown() })

export const sodaTerminalBackupSchema = z.object({
  format: z.literal(backupFormat),
  formatVersion: z.number().int().positive().max(backupFormatVersion),
  exportedAt: z.string().datetime(),
  databaseSchemaVersion: z.number().int().positive().max(databaseSchemaVersion),
  gameDataVersion: z.string().min(1),
  counts: z.object({
    driveDiscs: z.number().int().nonnegative(),
    discEvaluations: z.number().int().nonnegative(),
    buildProfiles: z.number().int().nonnegative(),
    settings: z.number().int().nonnegative(),
  }),
  data: z.object({
    driveDiscs: z.array(driveDiscSchema),
    discEvaluations: z.array(discEvaluationSchema),
    buildProfiles: z.array(buildProfileSchema),
    settings: z.array(settingSchema),
  }),
})

export type SodaTerminalBackup = z.infer<typeof sodaTerminalBackupSchema>

export type BackupPreflight = {
  success: boolean
  backup?: SodaTerminalBackup
  errors: string[]
  risks: string[]
}

function duplicateIds(items: Array<{ id: string }>) {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const item of items) {
    if (seen.has(item.id)) duplicates.add(item.id)
    seen.add(item.id)
  }
  return [...duplicates]
}

export function preflightBackup(input: unknown): BackupPreflight {
  const parsed = sodaTerminalBackupSchema.safeParse(input)
  if (!parsed.success) {
    const tooNew =
      typeof input === 'object' &&
      input !== null &&
      'formatVersion' in input &&
      Number((input as { formatVersion: unknown }).formatVersion) > backupFormatVersion
    return {
      success: false,
      errors: [
        tooNew
          ? '备份格式版本过新，当前应用无法安全恢复。'
          : (parsed.error.issues[0]?.message ?? '备份文件损坏。'),
      ],
      risks: [],
    }
  }

  const backup = parsed.data
  const errors: string[] = []
  for (const template of backup.data.buildProfiles) {
    try {
      validateTemplateReferences(template)
    } catch (error) {
      errors.push(error instanceof Error ? error.message : '模板引用非法。')
    }
  }
  const collections = [
    ['驱动盘', backup.data.driveDiscs],
    ['评价历史', backup.data.discEvaluations],
    ['模板', backup.data.buildProfiles],
  ] as const
  for (const [label, items] of collections) {
    const duplicates = duplicateIds(items)
    if (duplicates.length) errors.push(`${label}存在重复 ID：${duplicates.join('、')}`)
  }
  const duplicateSettingKeys = duplicateIds(
    backup.data.settings.map((setting) => ({ id: setting.key })),
  )
  if (duplicateSettingKeys.length) {
    errors.push(`设置存在重复 key：${duplicateSettingKeys.join('、')}`)
  }
  const unsupportedSetting = backup.data.settings.find(
    (setting) => !backedUpSettingKeys.has(setting.key),
  )
  if (unsupportedSetting) errors.push(`备份包含不允许恢复的设置：${unsupportedSetting.key}`)
  const templateNames = new Set<string>()
  for (const template of backup.data.buildProfiles.filter((item) => !item.archived)) {
    const key = `${template.agentId}\u0000${template.name.trim().toLocaleLowerCase()}`
    if (templateNames.has(key)) errors.push(`同一代理人下存在重复模板名称：${template.name}`)
    templateNames.add(key)
  }

  const discIds = new Set(backup.data.driveDiscs.map((disc) => disc.id))
  const templateIds = new Set(backup.data.buildProfiles.map((profile) => profile.id))
  for (const evaluation of backup.data.discEvaluations) {
    if (!discIds.has(evaluation.discId)) errors.push(`评价 ${evaluation.id} 找不到所属驱动盘。`)
    if (evaluation.templateId !== 'generic' && !templateIds.has(evaluation.templateId)) {
      errors.push(`评价 ${evaluation.id} 找不到模板 ${evaluation.templateId}。`)
    }
  }
  const actualCounts = {
    driveDiscs: backup.data.driveDiscs.length,
    discEvaluations: backup.data.discEvaluations.length,
    buildProfiles: backup.data.buildProfiles.length,
    settings: backup.data.settings.length,
  }
  if (JSON.stringify(actualCounts) !== JSON.stringify(backup.counts)) {
    errors.push('备份声明数量与实际内容不一致。')
  }

  return {
    success: errors.length === 0,
    backup: errors.length === 0 ? backup : undefined,
    errors,
    risks: ['完整恢复会替换当前本地档案、评价、模板和必要设置。'],
  }
}

export async function createBackup(db: SodaDatabase = database): Promise<SodaTerminalBackup> {
  const [driveDiscs, discEvaluations, buildProfiles, settings] = await Promise.all([
    db.driveDiscs.toArray(),
    db.discEvaluations.toArray(),
    db.buildProfiles.toArray(),
    db.settings.filter((setting) => backedUpSettingKeys.has(setting.key)).toArray(),
  ])
  return sodaTerminalBackupSchema.parse({
    format: backupFormat,
    formatVersion: backupFormatVersion,
    exportedAt: new Date().toISOString(),
    databaseSchemaVersion,
    gameDataVersion: gameData?.gameVersion ?? 'unknown',
    counts: {
      driveDiscs: driveDiscs.length,
      discEvaluations: discEvaluations.length,
      buildProfiles: buildProfiles.length,
      settings: settings.length,
    },
    data: { driveDiscs, discEvaluations, buildProfiles, settings },
  })
}

export async function restoreBackup(
  backup: SodaTerminalBackup,
  db: SodaDatabase = database,
  beforeCommit?: () => void,
) {
  const checked = preflightBackup(backup)
  if (!checked.success || !checked.backup) throw new Error(checked.errors[0] ?? '备份预检失败。')
  const data = checked.backup.data
  await db.transaction(
    'rw',
    db.driveDiscs,
    db.discEvaluations,
    db.buildProfiles,
    db.settings,
    async () => {
      await Promise.all([
        db.driveDiscs.clear(),
        db.discEvaluations.clear(),
        db.buildProfiles.clear(),
        db.settings.clear(),
      ])
      await db.driveDiscs.bulkAdd(data.driveDiscs as DriveDisc[])
      await db.discEvaluations.bulkAdd(data.discEvaluations as DiscEvaluation[])
      await db.buildProfiles.bulkAdd(data.buildProfiles as BuildProfile[])
      await db.settings.bulkAdd(data.settings as Setting[])
      beforeCommit?.()
    },
  )
  if (db === database) replaceRuntimeProfiles(await db.buildProfiles.toArray())
  return checked.backup.counts
}

export function getBackupFilename(date = new Date()) {
  return `soda-terminal-backup-${date.toISOString().slice(0, 10)}-v${backupFormatVersion}.json`
}
