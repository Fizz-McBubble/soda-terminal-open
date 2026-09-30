import type { RefObject } from 'react'
import { Download, ShieldAlert } from 'lucide-react'
import type { AccountState, FilePhase, FileState } from './dataCenterTypes'
import { FileIntake } from './FileIntake'

export function DataCenterBackupPanels({
  accountState,
  busy,
  fileState,
  restoreTriggerRef,
  onExportAccount,
  onExportVault,
  onInspectFile,
  onSetFilePhase,
  onExecuteRecognition,
  onResetFileState,
}: {
  accountState: AccountState
  busy: boolean
  fileState: FileState
  restoreTriggerRef: RefObject<HTMLDivElement | null>
  onExportAccount: () => Promise<void>
  onExportVault: () => Promise<void>
  onInspectFile: (file: File) => Promise<void>
  onSetFilePhase: (phase: FilePhase) => void
  onExecuteRecognition: () => Promise<void>
  onResetFileState: () => void
}) {
  return (
    <>
      <section className="panel data-center-restore" aria-labelledby="account-backup-heading">
        <header className="account-backup-r1__section-heading">
          <div>
            <h2 id="account-backup-heading">当前账户备份与恢复</h2>
            <p>
              {accountState?.active
                ? `操作范围：${accountState.active.displayName}`
                : '请先选择或创建账户；恢复文件仍可先检查。'}
            </p>
          </div>
        </header>
        <div className="data-center-actions">
          <button
            className="button button--primary"
            disabled={busy || !accountState?.active}
            type="button"
            onClick={() => void onExportAccount()}
          >
            <Download size={17} /> 导出当前账户
          </button>
        </div>
        <p className="account-backup-r1__trust">
          <ShieldAlert size={17} />
          检查文件不会写入。恢复前会再次确认覆盖或独立副本；取消或失败时原数据保持不变。
        </p>
        <FileIntake
          state={fileState}
          disabled={busy}
          onFile={onInspectFile}
          onStateChange={onSetFilePhase}
          onPrimaryAction={onExecuteRecognition}
          onReset={onResetFileState}
          triggerRef={restoreTriggerRef}
        />
      </section>

      <section className="panel account-backup-r1__safety" aria-labelledby="account-safety-heading">
        <div>
          <h2 id="account-safety-heading">全部账户与安全</h2>
          <p>导出本机全部账户；不会切换账户或改写资产。</p>
        </div>
        <div className="data-center-actions">
          <button
            className="button button--quiet"
            disabled={busy}
            type="button"
            onClick={() => void onExportVault()}
          >
            备份全部账户
          </button>
          <button className="button button--quiet" disabled type="button">
            删除账户（尚未开放）
          </button>
        </div>
      </section>
    </>
  )
}
