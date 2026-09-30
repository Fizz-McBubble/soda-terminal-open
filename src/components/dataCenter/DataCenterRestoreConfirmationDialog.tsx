import type { KeyboardEvent, RefObject } from 'react'
import type { AccountBackup } from '../../accounts/backup'
import type { AccountSummaryItem, PlayerDataSummary } from './dataCenterTypes'
import { ScopeSummary } from './ScopeSummary'

export function DataCenterRestoreConfirmationDialog({
  restoreConfirmation,
  pendingBackup,
  backupScope,
  matchingLocalAccount,
  sameNameLocalAccounts,
  restoreDisplayName,
  onRestoreDisplayNameChange,
  onCancel,
  onConfirm,
  restoreDialogRef,
  restoreCancelRef,
  handleRestoreDialogKeys,
}: {
  restoreConfirmation: 'replace' | 'independent'
  pendingBackup: AccountBackup
  backupScope: PlayerDataSummary
  matchingLocalAccount?: AccountSummaryItem | PlayerDataSummary
  sameNameLocalAccounts: AccountSummaryItem[]
  restoreDisplayName: string
  onRestoreDisplayNameChange: (value: string) => void
  onCancel: () => void
  onConfirm: () => Promise<void>
  restoreDialogRef: RefObject<HTMLDivElement | null>
  restoreCancelRef: RefObject<HTMLButtonElement | null>
  handleRestoreDialogKeys: (event: KeyboardEvent<HTMLDivElement>) => void
}) {
  return (
    <div
      ref={restoreDialogRef}
      aria-describedby="account-restore-confirmation-detail"
      aria-labelledby="account-restore-confirmation-title"
      aria-modal="true"
      className="data-center-confirmation"
      onKeyDown={handleRestoreDialogKeys}
      role="dialog"
    >
      <section className="panel">
        <h2 id="account-restore-confirmation-title">
          {restoreConfirmation === 'independent'
            ? '作为独立玩家账户恢复'
            : `完整替换“${pendingBackup.account.displayName}”的数据？`}
        </h2>
        <p id="account-restore-confirmation-detail">
          {restoreConfirmation === 'independent'
            ? '发现同名账号，但不是同一账号。不会自动合并或覆盖。'
            : '将完整替换当前目标账号的以下范围。'}
        </p>
        {restoreConfirmation === 'independent' ? (
          <section aria-label="同名账户识别" className="data-center-identity-cards">
            <article>
              <span className="eyebrow">备份账户</span>
              <h3>{pendingBackup.account.displayName}</h3>
              <p>备份日期：{new Date(pendingBackup.exportedAt).toLocaleDateString()}</p>
              <p>
                {backupScope.discs} 张驱动盘 / {backupScope.agents} 位代理人
              </p>
              <details>
                <summary>高级信息</summary>
                <p>识别码：…{pendingBackup.account.id.slice(-6)}</p>
              </details>
            </article>
            {sameNameLocalAccounts.map((account) => (
              <article key={account.id}>
                <span className="eyebrow">本机同名账户</span>
                <h3>{account.displayName}</h3>
                <p>创建日期：{new Date(account.createdAt).toLocaleDateString()}</p>
                <p>
                  {account.discs} 张驱动盘 / {account.agents} 位代理人
                </p>
                <details>
                  <summary>高级信息</summary>
                  <p>识别码：…{account.id.slice(-6)}</p>
                </details>
              </article>
            ))}
            <label>
              恢复后的本地显示名称
              <input
                value={restoreDisplayName}
                onChange={(event) => onRestoreDisplayNameChange(event.target.value)}
              />
            </label>
            <p className="safe-note">不会合并到现有同名账户，也不会替换它的数据。</p>
          </section>
        ) : (
          <section aria-label="恢复范围对照" className="data-center-restore-comparison">
            <ScopeSummary title="备份" summary={backupScope} />
            <ScopeSummary
              title="当前本机"
              summary={
                matchingLocalAccount ?? {
                  agents: 0,
                  wEngines: 0,
                  discs: 0,
                  evaluations: 0,
                  scanBatches: 0,
                  scanItems: 0,
                  optimizationResults: 0,
                  preferences: 0,
                }
              }
            />
          </section>
        )}
        {restoreConfirmation === 'replace' && (
          <section className="data-center-confirmation-boundaries">
            <h3>不会覆盖</h3>
            <p>其他玩家账户、旧单账号数据和游戏数据包。</p>
            <h3>恢复后</h3>
            <p>目标账户会成为当前账户。恢复失败时，此账号仍保持恢复前的数据。</p>
          </section>
        )}
        <div className="data-center-actions">
          <button
            ref={restoreCancelRef}
            className="button button--quiet"
            type="button"
            onClick={onCancel}
          >
            取消
          </button>
          <button className="button button--primary" type="button" onClick={() => void onConfirm()}>
            {restoreConfirmation === 'independent' ? '作为独立账号恢复' : '完整替换此账号'}
          </button>
        </div>
      </section>
    </div>
  )
}
