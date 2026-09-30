import type { DataCenterFileRecognition } from '../../accounts/dataCenter'
import type { AccountBackup } from '../../accounts/backup'

export const lastFullBackupPreference = 'data-center-last-full-backup-v1'

export type FilePhase =
  | 'idle'
  | 'drag-over'
  | 'reading'
  | 'recognized'
  | 'needs-confirmation'
  | 'ready'
  | 'error'
  | 'success'

export type FileState = {
  phase: FilePhase
  fileName: string | null
  fileSize: number | null
  recognition: DataCenterFileRecognition | null
  success: { title: string; detail: string; batchId?: string } | null
}

export const idleFileState: FileState = {
  phase: 'idle',
  fileName: null,
  fileSize: null,
  recognition: null,
  success: null,
}

export type PlayerDataSummary = {
  agents: number
  wEngines: number
  discs: number
  evaluations: number
  scanBatches: number
  scanItems: number
  optimizationResults: number
  preferences: number
}

export type AccountSummaryItem = {
  id: string
  displayName: string
  createdAt: string | number | Date
  discs: number
  agents: number
  wEngines: number
  evaluations: number
  scanBatches: number
  latestScanAt: string | null
  scanItems: number
  optimizationResults: number
  preferences: number
  duplicateOrdinal: number
  duplicateTotal: number
}

export type AccountState = {
  active: { id: string; displayName: string } | null
  accounts: AccountSummaryItem[]
  agents: number
  wEngines: number
  discs: number
  lastBackup: string | null
} | null

export function rosterSummary(
  roster: AccountBackup['data']['roster'],
): Pick<PlayerDataSummary, 'agents' | 'wEngines'> {
  return {
    agents: roster?.agents.filter((item) => item.owned).length ?? 0,
    wEngines: roster?.wEngines?.length ?? 0,
  }
}

export function backupSummary(backup: AccountBackup): PlayerDataSummary {
  return {
    ...rosterSummary(backup.data.roster),
    discs: backup.counts.driveDiscs,
    evaluations: backup.counts.discEvaluations,
    scanBatches: backup.counts.scanBatches,
    scanItems: backup.counts.scanItems,
    optimizationResults: backup.counts.optimizationResults,
    preferences: backup.counts.preferences,
  }
}

export function downloadJson(value: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function formatFileSize(size: number | null) {
  if (size === null) return ''
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

export function recognitionPhase(recognition: DataCenterFileRecognition): FilePhase {
  if (recognition.kind === 'unknown' || recognition.errors.length > 0) return 'error'
  if (
    recognition.kind === 'account_backup' ||
    recognition.kind === 'vault_backup' ||
    recognition.kind === 'legacy_backup' ||
    recognition.counts.confirm > 0
  )
    return 'needs-confirmation'
  return 'ready'
}

export function primaryActionLabel(recognition: DataCenterFileRecognition) {
  if (recognition.kind === 'scan_staging' && recognition.counts.confirm > 0)
    return `确认 ${recognition.counts.confirm} 条问题`
  if (recognition.kind === 'scan_data') return `导入 ${recognition.counts.add} 张驱动盘`
  if (recognition.kind === 'scan_staging') return `导入 ${recognition.counts.add} 张驱动盘`
  if (
    recognition.kind === 'account_backup' ||
    recognition.kind === 'vault_backup' ||
    recognition.kind === 'legacy_backup'
  )
    return '确认以备份完整替换本地数据'
  return '重新选择文件'
}
