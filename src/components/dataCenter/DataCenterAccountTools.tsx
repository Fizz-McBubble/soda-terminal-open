import type { KeyboardEvent, RefObject } from 'react'
import type { AccountState, FilePhase, FileState } from './dataCenterTypes'
import { FileIntake } from './FileIntake'

export function DataCenterAccountTools({
  accountState,
  busy,
  switchingAccountName,
  creatingAccount,
  restoringAccount,
  createValue,
  fileState,
  createActionTriggerRef,
  restoreActionTriggerRef,
  restoreTriggerRef,
  onSelectAccount,
  onExportAccount,
  onToggleCreatingAccount,
  onToggleRestoringAccount,
  onSetCreateValue,
  onSaveNewAccount,
  onCloseInlineAction,
  onHandleInlineActionKeys,
  onInspectFile,
  onSetFilePhase,
  onExecuteRecognition,
  onResetFileState,
}: {
  accountState: AccountState
  busy: boolean
  switchingAccountName: string | null
  creatingAccount: boolean
  restoringAccount: boolean
  createValue: string
  fileState: FileState
  createActionTriggerRef: RefObject<HTMLButtonElement | null>
  restoreActionTriggerRef: RefObject<HTMLButtonElement | null>
  restoreTriggerRef: RefObject<HTMLDivElement | null>
  onSelectAccount: (accountId: string) => Promise<void>
  onExportAccount: (accountId: string) => Promise<void>
  onToggleCreatingAccount: () => void
  onToggleRestoringAccount: () => void
  onSetCreateValue: (value: string) => void
  onSaveNewAccount: () => Promise<void>
  onCloseInlineAction: (action: 'create' | 'restore') => void
  onHandleInlineActionKeys: (
    event: KeyboardEvent<HTMLElement>,
    action: 'create' | 'restore',
  ) => void
  onInspectFile: (file: File) => Promise<void>
  onSetFilePhase: (phase: FilePhase) => void
  onExecuteRecognition: () => Promise<void>
  onResetFileState: () => void
}) {
  return (
    <article className="panel data-center-account-tools">
      <div className="account-backup-r1__account-main">
        <header className="account-backup-r1__section-heading">
          <div>
            <h2 id="account-directory-heading">账户</h2>
            <p>{accountState?.accounts.length ?? 0} 个本机账户</p>
          </div>
        </header>
        {accountState?.accounts.length ? (
          <ul
            aria-labelledby="account-directory-heading"
            className="account-backup-r1__account-list"
          >
            {accountState.accounts.map((account) => {
              const isCurrent = account.id === accountState.active?.id
              return (
                <li key={account.id}>
                  <article
                    aria-current={isCurrent ? 'true' : undefined}
                    className={`account-backup-r1__account-option ${isCurrent ? 'is-current' : ''}`}
                  >
                    <div className="account-backup-r1__account-option-heading">
                      <strong>{account.displayName}</strong>
                      <small>{isCurrent ? '当前账户' : '本机账户'}</small>
                    </div>
                    <dl className="account-backup-r1__account-option-counts">
                      <div>
                        <dt>代理人</dt>
                        <dd>{account.agents}</dd>
                      </div>
                      <div>
                        <dt>驱动盘</dt>
                        <dd>{account.discs}</dd>
                      </div>
                    </dl>
                    <dl className="account-backup-r1__account-option-dates">
                      <div>
                        <dt>创建</dt>
                        <dd>{new Date(account.createdAt).toLocaleDateString()}</dd>
                      </div>
                      <div>
                        <dt>最近扫描</dt>
                        <dd>
                          {account.latestScanAt
                            ? new Date(account.latestScanAt).toLocaleDateString()
                            : '暂无'}
                        </dd>
                      </div>
                    </dl>
                    <div className="account-backup-r1__account-option-actions">
                      {!isCurrent && (
                        <button
                          aria-label={`切换到账户：${account.displayName}，${account.agents} 位代理人，${account.discs} 张驱动盘`}
                          className="button button--quiet"
                          disabled={switchingAccountName !== null}
                          type="button"
                          onClick={() => void onSelectAccount(account.id)}
                        >
                          切换
                        </button>
                      )}
                      <button
                        className="button button--quiet"
                        disabled={busy}
                        type="button"
                        onClick={() => void onExportAccount(account.id)}
                      >
                        备份
                      </button>
                      <button
                        aria-label={`删除账户：${account.displayName}`}
                        className="button button--danger"
                        disabled
                        type="button"
                      >
                        删除
                      </button>
                    </div>
                  </article>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="account-backup-r1__empty-account">
            尚无本机账户。新建账户只建立独立数据空间。
          </p>
        )}
      </div>

      <aside aria-label="账户操作" className="account-backup-r1__action-column">
        <div className="account-backup-r1__primary-actions">
          <button
            ref={createActionTriggerRef}
            aria-controls="account-create-panel"
            aria-expanded={creatingAccount}
            className="button button--primary account-backup-r1__create-trigger"
            disabled={busy}
            type="button"
            onClick={onToggleCreatingAccount}
          >
            {creatingAccount ? '取消新建' : '＋ 新建账户'}
          </button>
          <button
            ref={restoreActionTriggerRef}
            aria-controls="account-restore-panel"
            aria-expanded={restoringAccount}
            className="button button--quiet"
            disabled={busy}
            type="button"
            onClick={onToggleRestoringAccount}
          >
            {restoringAccount ? '取消恢复' : '恢复账户'}
          </button>
        </div>
        {creatingAccount && (
          <section
            id="account-create-panel"
            aria-label="新建账户"
            className="account-backup-r1__action-panel account-backup-r1__create"
            onKeyDown={(event) => onHandleInlineActionKeys(event, 'create')}
          >
            <label>
              新账户名称
              <input
                autoFocus
                maxLength={40}
                placeholder="例如：第二套存档"
                value={createValue}
                onChange={(event) => onSetCreateValue(event.target.value)}
              />
            </label>
            <div className="account-backup-r1__create-actions">
              <button
                className="button button--primary"
                disabled={busy || !createValue.trim()}
                type="button"
                onClick={() => void onSaveNewAccount()}
              >
                创建并切换
              </button>
              <button
                className="button button--quiet"
                disabled={busy}
                type="button"
                onClick={() => onCloseInlineAction('create')}
              >
                取消
              </button>
            </div>
          </section>
        )}
        {restoringAccount && (
          <section
            id="account-restore-panel"
            aria-label="恢复账户"
            className="account-backup-r1__action-panel"
            onKeyDown={(event) => onHandleInlineActionKeys(event, 'restore')}
          >
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
        )}
      </aside>
    </article>
  )
}
