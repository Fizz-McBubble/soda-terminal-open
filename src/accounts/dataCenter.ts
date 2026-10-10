import type { SodaDatabase } from '../db/database'
import { database } from '../db/database'
import { preflightDriveDiscImport, type DriveDiscImportPreflight } from '../domain/discImport'
import {
  reassessSavedScanImportItem,
  scanImportStagingBatchSchema,
  summarizeScanImportItems,
  type ScanImportAssessmentContext,
  type ScanImportStagingBatch,
} from '../domain/scanImportStaging'
import type { DriveDiscDataManifest, DriveDiscSet } from '../domain/schemas'
import { preflightVaultBackupAgainstDatabase, type AccountBackupPreflight } from './backup'
import { recognizeAccountBackupFile } from './accountBackupRecognition'
import { preflightBackup, type BackupPreflight } from '../domain/backup'
import { accountIdSchema, getScopedId } from './types'

export type DataCenterFileKind =
  | 'scan_data'
  | 'scan_staging'
  | 'account_backup'
  | 'vault_backup'
  | 'legacy_backup'
  | 'unknown'

type DataCenterCounts = {
  total: number
  add: number
  skip: number
  confirm: number
  failed: number
}

type BaseRecognition = {
  kind: DataCenterFileKind
  label: string
  targetAccountId: string | null
  targetAccountName: string | null
  counts: DataCenterCounts
  preservesOriginal: boolean
  replacementScope: string | null
  errors: string[]
  risks: string[]
  input: unknown
}

export type DataCenterFileRecognition = BaseRecognition &
  (
    | { kind: 'scan_data'; scanPreflight: DriveDiscImportPreflight }
    | { kind: 'scan_staging'; staging: ScanImportStagingBatch }
    | { kind: 'account_backup'; backupPreflight: AccountBackupPreflight }
    | {
        kind: 'vault_backup'
        vaultPreflight: Awaited<ReturnType<typeof preflightVaultBackupAgainstDatabase>>
      }
    | { kind: 'legacy_backup'; legacyPreflight: BackupPreflight }
    | { kind: 'unknown' }
  )

type RecognitionContext = {
  accountId: string | null
  accountName: string | null
  driveDiscSets: DriveDiscSet[]
  rules: DriveDiscDataManifest['rules']
  gameDataVersion: string
}

type ScanDataImportContext = Omit<RecognitionContext, 'accountId' | 'accountName'> & {
  now?: string
}

const emptyCounts = { total: 0, add: 0, skip: 0, confirm: 0, failed: 0 }

function topLevelFormat(input: unknown) {
  if (!input || typeof input !== 'object') return null
  return typeof (input as Record<string, unknown>).format === 'string'
    ? (input as Record<string, unknown>).format
    : null
}

export async function recognizeDataCenterFile(
  input: unknown,
  context: RecognitionContext,
  db: SodaDatabase = database,
): Promise<DataCenterFileRecognition> {
  const format = topLevelFormat(input)
  if (format === 'soda-terminal-account-backup') {
    return recognizeAccountBackupFile(input, db)
  }
  if (format === 'soda-terminal-vault-backup') {
    const vaultPreflight = await preflightVaultBackupAgainstDatabase(input, db)
    const total =
      vaultPreflight.backup?.accounts.reduce((sum, backup) => sum + backup.counts.driveDiscs, 0) ??
      0
    return {
      kind: 'vault_backup',
      label: '全部账号备份',
      targetAccountId: null,
      targetAccountName: null,
      counts: { ...emptyCounts, total, add: total, failed: vaultPreflight.errors.length },
      preservesOriginal: false,
      replacementScope: vaultPreflight.backup
        ? `完整替换本地 ${vaultPreflight.backup.accounts.length} 个账号`
        : null,
      errors: vaultPreflight.errors,
      risks: [...vaultPreflight.risks, ...vaultPreflight.conflicts],
      input,
      vaultPreflight,
    }
  }
  if (format === 'soda-terminal-backup') {
    const legacyPreflight = preflightBackup(input)
    const total = legacyPreflight.backup?.counts.driveDiscs ?? 0
    return {
      kind: 'legacy_backup',
      label: '旧版完整备份',
      targetAccountId: context.accountId,
      targetAccountName: context.accountName,
      counts: { ...emptyCounts, total, add: total, failed: legacyPreflight.errors.length },
      preservesOriginal: false,
      replacementScope: '完整替换旧版单账号数据，不会与现有内容合并',
      errors: legacyPreflight.errors,
      risks: legacyPreflight.risks,
      input,
      legacyPreflight,
    }
  }

  const stagingResult = scanImportStagingBatchSchema.safeParse(input)
  if (stagingResult.success) {
    const assessmentContext: ScanImportAssessmentContext = {
      driveDiscSets: context.driveDiscSets,
      rules: context.rules,
      dataVersion: context.gameDataVersion,
    }
    const items = stagingResult.data.items.map((item) =>
      reassessSavedScanImportItem(item, assessmentContext),
    )
    const summary = summarizeScanImportItems(items)
    const staging = { ...stagingResult.data, items }
    return {
      kind: 'scan_staging',
      label: '扫描数据',
      targetAccountId: context.accountId,
      targetAccountName: context.accountName,
      counts: {
        total: summary.total,
        add: summary.ready,
        skip: summary.duplicate,
        confirm: summary.needsReview,
        failed: summary.invalid,
      },
      preservesOriginal: true,
      replacementScope: null,
      errors: [],
      risks: summary.needsReview ? ['需要确认的记录不会写入正式仓库。'] : [],
      input,
      staging,
    }
  }

  const existingDiscs = context.accountId
    ? await db.accountDriveDiscs.where('accountId').equals(context.accountId).toArray()
    : []
  const scanPreflight = preflightDriveDiscImport(input, {
    driveDiscSets: context.driveDiscSets,
    driveDiscRules: context.rules,
    gameDataVersion: context.gameDataVersion,
    existingDiscs,
  })
  if (scanPreflight.sourceAdapter !== 'unknown') {
    return {
      kind: 'scan_data',
      label: '扫描数据',
      targetAccountId: context.accountId,
      targetAccountName: context.accountName,
      counts: {
        total: scanPreflight.summary.total,
        add: scanPreflight.summary.ready,
        skip: scanPreflight.summary.skipped,
        confirm: 0,
        failed: scanPreflight.summary.failed,
      },
      preservesOriginal: true,
      replacementScope: null,
      errors: scanPreflight.items.flatMap((item) => item.issues.map((issue) => issue.message)),
      risks: ['盘面完全相同的不同实体可能被指纹识别为重复；请在确认前核对数量。'],
      input,
      scanPreflight,
    }
  }

  return {
    kind: 'unknown',
    label: '无法识别',
    targetAccountId: context.accountId,
    targetAccountName: context.accountName,
    counts: { ...emptyCounts, failed: 1 },
    preservesOriginal: true,
    replacementScope: null,
    errors: ['这不是可识别的扫描数据或 Soda Terminal 备份。'],
    risks: [],
    input,
  }
}

export async function importDriveDiscsToAccount(
  accountId: string,
  input: unknown,
  context: ScanDataImportContext,
  db: SodaDatabase = database,
  beforeCommit?: () => void,
) {
  accountIdSchema.parse(accountId)
  if (!(await db.accounts.get(accountId))) throw new Error('目标账号不存在。')
  return db.transaction('rw', db.accountDriveDiscs, async () => {
    const preflight = preflightDriveDiscImport(input, {
      driveDiscSets: context.driveDiscSets,
      driveDiscRules: context.rules,
      gameDataVersion: context.gameDataVersion,
      existingDiscs: await db.accountDriveDiscs.where('accountId').equals(accountId).toArray(),
      now: context.now,
    })
    // Revalidate at the write boundary too: UI preflight is not a transaction
    // contract and callers must not silently import the valid subset of a bad file.
    if (preflight.sourceAdapter === 'unknown' || preflight.summary.failed > 0) {
      throw new Error('文件仍有无法识别或校验失败的记录；请修正后重新预检，未写入任何驱动盘。')
    }
    if (preflight.readyDiscs.length) {
      await db.accountDriveDiscs.bulkAdd(
        preflight.readyDiscs.map((disc) => ({
          ...disc,
          scopedId: getScopedId(accountId, disc.id),
          accountId,
          sourceLegacyId: null,
          migratedAt: null,
        })),
      )
    }
    beforeCommit?.()
    return preflight
  })
}

/** Rechecks the account selected during file recognition at the import boundary. */
export async function importRecognizedScanDataToActiveAccount(
  recognition: Extract<DataCenterFileRecognition, { kind: 'scan_data' }>,
  activeAccountId: string | null | undefined,
  context: ScanDataImportContext,
  db: SodaDatabase = database,
) {
  if (!activeAccountId) throw new Error('请先选择目标账号。')
  if (recognition.targetAccountId !== activeAccountId)
    throw new Error('当前账号已变化，请重新选择文件，核对目标账号与导入数量后再导入。')
  return importDriveDiscsToAccount(activeAccountId, recognition.input, context, db)
}
