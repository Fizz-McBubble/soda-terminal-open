import { Download, ShieldAlert, Upload } from 'lucide-react'
import type { BackupPreflight } from '../../domain/backup'
import { releaseInfo } from '../../releaseInfo'

export function BackupAndRestorePanels({
  localCounts,
  preflight,
  restoring,
  onExportData,
  onInspectFile,
  onConfirmRestore,
}: {
  localCounts:
    | {
        driveDiscs: number
        discEvaluations: number
        buildProfiles: number
        settings: number
      }
    | undefined
  preflight: BackupPreflight | null
  restoring: boolean
  onExportData: () => void
  onInspectFile: (file: File | undefined) => void
  onConfirmRestore: () => void
}) {
  return (
    <>
      <article className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">备份</span>
            <h2>导出完整备份</h2>
          </div>
        </div>
        <p>包含档案、评价历史、模板与必要设置，不包含临时草稿或设备信息。</p>
        <p className="muted-note">{releaseInfo.privacy}</p>
        <button className="button button--primary" type="button" onClick={onExportData}>
          <Download size={17} /> 导出 JSON
        </button>
      </article>
      <article className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">恢复</span>
            <h2>预检备份文件</h2>
          </div>
        </div>
        <label className="file-picker">
          <Upload size={20} />
          <span>选择 soda-terminal-backup JSON</span>
          <input
            accept="application/json,.json"
            type="file"
            onChange={(event) => onInspectFile(event.target.files?.[0])}
          />
        </label>
        {preflight && (
          <div
            className={
              preflight.success
                ? 'preflight-card preflight-card--ready'
                : 'preflight-card preflight-card--error'
            }
          >
            <h3>{preflight.success ? '预检通过，尚未写入' : '预检未通过'}</h3>
            {preflight.errors.map((error) => (
              <p key={error}>{error}</p>
            ))}
            {preflight.backup && (
              <>
                <p>
                  格式 v{preflight.backup.formatVersion} · 数据库 schema v
                  {preflight.backup.databaseSchemaVersion} · 游戏数据{' '}
                  {preflight.backup.gameDataVersion}
                </p>
                <dl className="count-comparison">
                  <div>
                    <dt>项目</dt>
                    <dd>当前 / 备份</dd>
                  </div>
                  <div>
                    <dt>驱动盘</dt>
                    <dd>
                      {localCounts?.driveDiscs ?? 0} / {preflight.backup.counts.driveDiscs}
                    </dd>
                  </div>
                  <div>
                    <dt>评价</dt>
                    <dd>
                      {localCounts?.discEvaluations ?? 0} /{' '}
                      {preflight.backup.counts.discEvaluations}
                    </dd>
                  </div>
                  <div>
                    <dt>模板</dt>
                    <dd>
                      {localCounts?.buildProfiles ?? 0} / {preflight.backup.counts.buildProfiles}
                    </dd>
                  </div>
                </dl>
                <p className="danger-note">
                  <ShieldAlert size={17} /> 完整恢复不可合并：现有本地数据将以备份为准被替换。
                </p>
                <button
                  className="button button--danger"
                  disabled={restoring}
                  type="button"
                  onClick={onConfirmRestore}
                >
                  {restoring ? '正在恢复…' : '确认以备份完整替换本地数据'}
                </button>
              </>
            )}
          </div>
        )}
      </article>
    </>
  )
}
