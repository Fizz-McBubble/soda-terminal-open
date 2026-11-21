import { database, type SodaDatabase } from '../db/databaseCore'
import { contentHash } from '../application/contentHash'

const prefix = 'backup-restore-recovery-v1-'
export const restoreRecoveryLimit = 10
export type RestoreRecovery = {
  key: string
  createdAt: string
  scope: string
  backup: unknown
  backupHash: string
}

export type RestoreRecoveryDamageReason =
  | 'record_invalid'
  | 'key_mismatch'
  | 'scope_invalid'
  | 'created_at_invalid'
  | 'backup_missing'
  | 'backup_hash_mismatch'
  | 'record_not_json_safe'

export type RestoreRecoverySafetyIssue =
  | 'undefined_value'
  | 'non_finite_number'
  | 'negative_zero'
  | 'bigint'
  | 'unsupported_value'
  | 'cycle'
  | 'sparse_array'
  | 'map'
  | 'set'
  | 'blob'
  | 'array_buffer'
  | 'typed_array'
  | 'date'
  | 'regexp'
  | 'non_plain_object'

export type RestoreRecoveryInventoryEntry =
  | {
      status: 'valid'
      recovery: RestoreRecovery
      recordHash: string
      exportable: true
      safetyIssue: null
    }
  | {
      status: 'damaged'
      key: string
      scope: string | null
      createdAt: string | null
      rawValue: unknown
      recordHash: string | null
      exportable: boolean
      reason: RestoreRecoveryDamageReason
      safetyIssue: RestoreRecoverySafetyIssue | null
    }

function jsonSafetyIssue(
  value: unknown,
  ancestors = new Set<object>(),
  omitObjectUndefined = false,
): RestoreRecoverySafetyIssue | null {
  if (value === undefined) return 'undefined_value'
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return null
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 'non_finite_number'
    if (Object.is(value, -0)) return 'negative_zero'
    return null
  }
  if (typeof value === 'bigint') return 'bigint'
  if (typeof value !== 'object') return 'unsupported_value'
  if (ancestors.has(value)) return 'cycle'
  if (Array.isArray(value)) {
    if (Object.keys(value).length !== value.length) return 'sparse_array'
    ancestors.add(value)
    for (const child of value) {
      if (child === undefined) return 'undefined_value'
      const issue = jsonSafetyIssue(child, ancestors, omitObjectUndefined)
      if (issue) return issue
    }
    ancestors.delete(value)
    return null
  }
  if (ArrayBuffer.isView(value)) return 'typed_array'
  const tag = Object.prototype.toString.call(value)
  if (tag === '[object Map]') return 'map'
  if (tag === '[object Set]') return 'set'
  if (tag === '[object Blob]' || tag === '[object File]') return 'blob'
  if (tag === '[object ArrayBuffer]' || tag === '[object SharedArrayBuffer]') return 'array_buffer'
  if (tag === '[object Date]') return 'date'
  if (tag === '[object RegExp]') return 'regexp'
  if (Object.getPrototypeOf(value) !== Object.prototype) return 'non_plain_object'
  ancestors.add(value)
  for (const key of Object.keys(value)) {
    const child = (value as Record<string, unknown>)[key]
    // Project backup schemas use explicit optional undefined as canonical omission.
    if (omitObjectUndefined && child === undefined) continue
    const issue = jsonSafetyIssue(child, ancestors, omitObjectUndefined)
    if (issue) return issue
  }
  ancestors.delete(value)
  return null
}

function classifyRestoreRecovery(row: {
  key: string
  value: unknown
}): RestoreRecoveryInventoryEntry {
  const value = row.value
  const candidate =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Partial<RestoreRecovery>)
      : null
  const scope = typeof candidate?.scope === 'string' ? candidate.scope : null
  const createdAt =
    typeof candidate?.createdAt === 'string' && Number.isFinite(Date.parse(candidate.createdAt))
      ? candidate.createdAt
      : null
  const safetyIssue = jsonSafetyIssue(value)
  const damaged = (
    reason: RestoreRecoveryDamageReason,
    recordHash: string | null,
    issue: RestoreRecoverySafetyIssue | null = null,
  ): RestoreRecoveryInventoryEntry => ({
    status: 'damaged',
    key: row.key,
    scope,
    createdAt,
    rawValue: value,
    recordHash,
    exportable: recordHash !== null,
    reason,
    safetyIssue: issue,
  })
  if (safetyIssue) return damaged('record_not_json_safe', null, safetyIssue)
  const recordHash = contentHash(value)
  if (!candidate)
    return {
      status: 'damaged',
      key: row.key,
      scope,
      createdAt,
      rawValue: value,
      recordHash,
      exportable: true,
      reason: 'record_invalid',
      safetyIssue: null,
    }
  if (candidate.key !== row.key) return damaged('key_mismatch', recordHash)
  if (scope === null) return damaged('scope_invalid', recordHash)
  if (!createdAt) return damaged('created_at_invalid', recordHash)
  if (candidate.backup === undefined) return damaged('backup_missing', recordHash)
  if (candidate.backupHash !== contentHash(candidate.backup))
    return damaged('backup_hash_mismatch', recordHash)
  return {
    status: 'valid',
    recovery: candidate as RestoreRecovery,
    recordHash,
    exportable: true,
    safetyIssue: null,
  }
}

// Stored outside account tables so a complete vault replacement cannot erase undo inputs.
// Call inside the replacement transaction: failed writes roll back the receipt as well.
export async function saveRestoreRecovery(backup: unknown, scope: string, db: SodaDatabase) {
  const saved = await db.settings.filter((row) => row.key.startsWith(prefix)).count()
  if (saved >= restoreRecoveryLimit) {
    const state =
      saved === restoreRecoveryLimit ? '已达 10 份配额' : `已超过 10 份上限（${saved} 份）`
    throw new Error(
      `恢复前副本${state}。损坏记录同样占额，系统不会自动清理；请先在“账户与备份”下载并保管需要的副本，再按原记录指纹移除。当前账户、活动账户和其他副本不会自动改动。`,
    )
  }
  // Internal callers pass project backups whose optional undefined fields are part of
  // the existing JSON export contract. Normalize those omissions before storage so the
  // inventory never presents a lossy in-memory record as a downloadable recovery.
  const safetyIssue = jsonSafetyIssue(backup, new Set(), true)
  if (safetyIssue)
    throw new Error(
      '恢复前备份包含无法以 JSON 无损保存的内容，未创建副本，恢复未执行。请先导出可安全保存的数据后再重试。',
    )
  const recoveryBackup = JSON.parse(JSON.stringify(backup)) as unknown
  const normalizedSafetyIssue = jsonSafetyIssue(recoveryBackup)
  if (normalizedSafetyIssue)
    throw new Error('恢复前备份标准化后仍包含无法安全导出的值，未创建副本。')
  const key = `${prefix}${crypto.randomUUID()}`
  const recovery: RestoreRecovery = {
    key,
    createdAt: new Date().toISOString(),
    scope,
    backup: recoveryBackup,
    backupHash: contentHash(recoveryBackup),
  }
  await db.settings.add({ key, value: recovery })
}

export async function readRestoreRecoveryInventory(
  db: SodaDatabase = database,
): Promise<RestoreRecoveryInventoryEntry[]> {
  const rows = await db.settings.filter((row) => row.key.startsWith(prefix)).toArray()
  return rows.map(classifyRestoreRecovery).sort((left, right) => {
    const leftDate = left.status === 'valid' ? left.recovery.createdAt : left.createdAt
    const rightDate = right.status === 'valid' ? right.recovery.createdAt : right.createdAt
    return (rightDate ?? '').localeCompare(leftDate ?? '')
  })
}

export async function readRestoreRecoveries(db: SodaDatabase = database) {
  return (await readRestoreRecoveryInventory(db)).flatMap((entry) =>
    entry.status === 'valid' ? [entry.recovery] : [],
  )
}

export async function removeSavedRestoreRecovery(
  key: string,
  backupHash: string,
  confirmation: 'downloaded_and_keep_external_copy',
  db: SodaDatabase = database,
) {
  if (confirmation !== 'downloaded_and_keep_external_copy' || !key.startsWith(prefix))
    throw new Error('请明确确认已下载并保管此恢复副本。')
  await db.transaction('rw', db.settings, async () => {
    const row = await db.settings.get(key)
    if (!row) throw new Error('恢复副本已变化，未移除。')
    const entry = classifyRestoreRecovery(row)
    if (entry.status !== 'valid' || entry.recovery.backupHash !== backupHash)
      throw new Error('恢复副本已变化，未移除。')
    await db.settings.delete(key)
  })
}

export async function removeDamagedRestoreRecovery(
  key: string,
  recordHash: string,
  confirmation: 'downloaded_and_keep_external_copy',
  db: SodaDatabase = database,
) {
  if (confirmation !== 'downloaded_and_keep_external_copy' || !key.startsWith(prefix))
    throw new Error('请明确确认已下载并保管此恢复副本的原始记录。')
  await db.transaction('rw', db.settings, async () => {
    const row = await db.settings.get(key)
    if (!row) throw new Error('恢复副本原记录已变化，未移除。')
    const entry = classifyRestoreRecovery(row)
    if (entry.status !== 'damaged')
      throw new Error('恢复副本已变为可识别记录，请重新检查后再操作。')
    if (!entry.exportable || entry.recordHash === null)
      throw new Error('恢复副本包含无法安全导出的值，不能确认保管或移除。')
    if (entry.recordHash !== recordHash) throw new Error('恢复副本原记录已变化，未移除。')
    await db.settings.delete(key)
  })
}
