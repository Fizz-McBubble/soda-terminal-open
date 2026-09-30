import { Download } from 'lucide-react'
import {
  getLegacyMigrationBackupFilename,
  type LegacyMigrationBackup,
} from '../accounts/migrationBackup'
export function AccountRecoveryBackupStep({
  migrationComplete,
  completion,
  legacyBackup,
  onExportBackup,
}: {
  migrationComplete: boolean
  completion: unknown
  legacyBackup: LegacyMigrationBackup | null
  onExportBackup: () => void
}) {
  const exportLegacyBackup = onExportBackup
  return (
    <li>
      <h3>1. 下载迁移前完整备份</h3>
      {migrationComplete && completion ? (
        <p className="form-message">已完成迁移；旧表仍完整保留，可作为原始回滚依据。</p>
      ) : (
        <>
          <p>包含旧仓库、鉴定历史、角色池、配装结果、扫描证据、模板与全部旧设置。</p>
          <button
            className="button button--primary"
            type="button"
            onClick={() => void exportLegacyBackup()}
          >
            <Download size={16} /> 生成并下载迁移前备份
          </button>
        </>
      )}
      {legacyBackup && (
        <p className="muted-note">
          {getLegacyMigrationBackupFilename(new Date(legacyBackup.exportedAt))} · 完整性校验已记录 ·
          正式盘 {legacyBackup.counts.driveDiscs} · 角色池设置{' '}
          {legacyBackup.data.settings.some((setting) => setting.key === 'assault-roster-v1')
            ? '已包含'
            : '未发现'}
        </p>
      )}
    </li>
  )
}
