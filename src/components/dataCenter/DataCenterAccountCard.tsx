import { Link } from 'react-router-dom'
import type { AccountState } from './dataCenterTypes'

export function DataCenterAccountCard({
  embedded,
  accountState,
  switchingAccountName,
  activatingAccountId,
  activationError,
  repreflightFeedback,
  onActivateLocalAccount,
  onPreviewRepreflight,
}: {
  embedded: boolean
  accountState: AccountState
  switchingAccountName: string | null
  activatingAccountId: string | null
  activationError: string | null
  repreflightFeedback: 'idle' | 'loading' | 'success' | 'error'
  onActivateLocalAccount: (accountId: string) => Promise<void>
  onPreviewRepreflight: () => void
}) {
  return (
    <article className="panel data-center-account-card" data-testid="data-center-account-summary">
      <div className="panel__header">
        <div>
          <span className="eyebrow">当前玩家账户</span>
          <h2 id="data-center-account-heading">
            {switchingAccountName
              ? `正在切换到 ${switchingAccountName}…`
              : (accountState?.active?.displayName ?? '尚未选择账号')}
          </h2>
        </div>
        <span className="status-pill">本地数据</span>
      </div>
      {switchingAccountName ? (
        <p role="status" aria-live="polite" className="form-message">
          正在切换到 {switchingAccountName}…
        </p>
      ) : accountState?.active ? (
        <>
          {embedded ? (
            <section className="data-center-account-stats" aria-labelledby="account-status-heading">
              <h3 id="account-status-heading">本地资产范围</h3>
              <dl>
                <div>
                  <dt>代理人</dt>
                  <dd>{accountState.agents}</dd>
                </div>
                <div>
                  <dt>驱动盘</dt>
                  <dd>{accountState.discs}</dd>
                </div>
                <div>
                  <dt>最近备份</dt>
                  <dd>
                    {accountState.lastBackup
                      ? new Date(accountState.lastBackup).toLocaleDateString()
                      : '尚未备份'}
                  </dd>
                </div>
              </dl>
              <p className="safe-note">切换账户不会合并数据。</p>
            </section>
          ) : (
            <section className="data-center-account-stats" aria-labelledby="account-status-heading">
              <h3 id="account-status-heading">账户数据状态</h3>
              <dl>
                <div>
                  <dt>驱动盘</dt>
                  <dd>{accountState.discs}</dd>
                </div>
                <div>
                  <dt>待复核</dt>
                  <dd>0</dd>
                </div>
                <div>
                  <dt>预检</dt>
                  <dd>待执行</dd>
                </div>
              </dl>
              <div className="data-center-repreflight-action">
                <p className="safe-note">所有待复核项已处理。下一步请重新预检。</p>
                <button
                  className="button button--primary"
                  type="button"
                  disabled={repreflightFeedback === 'loading'}
                  aria-describedby="repreflight-note"
                  onClick={onPreviewRepreflight}
                >
                  {repreflightFeedback === 'loading' ? '正在重新预检…' : '重新预检（不导入）'}
                </button>
                <p id="repreflight-note" className="muted-note">
                  这一步只检查当前账户的复核结果，不会导入。导入仍需在预检通过后单独确认。
                </p>
              </div>
              <Link className="button button--quiet" to="/system/data/import-discs">
                导入驱动盘
              </Link>
              <Link className="button button--quiet" to="/system/scanner">
                扫描与导入
              </Link>
              {repreflightFeedback === 'loading' && (
                <p role="status" aria-live="polite" className="form-message">
                  正在准备重新预检；尚未导入数据。
                </p>
              )}
              {repreflightFeedback === 'success' && (
                <p role="status" aria-live="polite" className="form-message">
                  预检入口已准备好。本节点未执行预检，也未导入数据。
                </p>
              )}
              {repreflightFeedback === 'error' && (
                <p role="alert" className="danger-note">
                  尚未选择玩家账户，无法准备预检。
                </p>
              )}
            </section>
          )}
        </>
      ) : accountState?.accounts.length ? (
        <section
          aria-labelledby="local-account-activation-heading"
          className="data-center-local-activation"
          data-testid="local-account-activation"
        >
          <h3 id="local-account-activation-heading">选择本机玩家账户继续</h3>
          <p className="muted-note">
            请选择要继续使用的本机玩家账户。设为当前账户只会更新当前选择，不会修改账户数据。
          </p>
          <ul className="data-center-local-account-list">
            {accountState.accounts.map((account) => (
              <li key={account.id}>
                <article className="data-center-local-account-card">
                  <div>
                    <h4>{account.displayName}</h4>
                    {account.duplicateTotal > 1 && (
                      <p className="muted-note">
                        同名本机账户 {account.duplicateOrdinal} / {account.duplicateTotal}
                      </p>
                    )}
                  </div>
                  <dl aria-label={`${account.displayName} 的本机数据摘要`}>
                    <div>
                      <dt>正式驱动盘</dt>
                      <dd>{account.discs}</dd>
                    </div>
                    <div>
                      <dt>代理人</dt>
                      <dd>{account.agents}</dd>
                    </div>
                  </dl>
                  <button
                    aria-label={`设为当前账户：${account.displayName}，${account.discs} 张正式驱动盘，${account.agents} 位代理人`}
                    className="button button--primary"
                    disabled={activatingAccountId !== null}
                    type="button"
                    onClick={() => void onActivateLocalAccount(account.id)}
                  >
                    {activatingAccountId === account.id ? '正在设为当前账户…' : '设为当前账户'}
                  </button>
                </article>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="danger-note">尚未选择玩家账户。可新建账户，或检查备份文件。</p>
      )}
      {activationError && (
        <p role="alert" className="danger-note">
          未切换，账户数据未改动。{activationError} 请重试。
        </p>
      )}
    </article>
  )
}
