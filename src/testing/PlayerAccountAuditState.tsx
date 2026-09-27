/**
 * Development-only, in-memory audit surface. It intentionally has no database
 * imports so an isolated browser can review the player-facing hierarchy
 * without observing or changing a local account.
 */
export default function PlayerAccountAuditState() {
  return (
    <div className="page-stack data-center-page player-account-audit-state">
      <header className="workflow-header">
        <div>
          <h1>玩家账户数据中心</h1>
          <p>查看当前账户的数据状态，并在需要时安全处理备份。</p>
        </div>
      </header>

      <section aria-labelledby="audit-account-heading" className="data-center-account">
        <article
          className="panel data-center-account-card"
          data-testid="player-account-audit-summary"
        >
          <div className="panel__header">
            <div>
              <span className="eyebrow">当前玩家账户</span>
              <h2 id="audit-account-heading">波子汽水</h2>
            </div>
            <span className="status-pill">只读审计状态</span>
          </div>

          <section className="data-center-account-stats" aria-labelledby="audit-status-heading">
            <h3 id="audit-status-heading">账户数据状态</h3>
            <dl>
              <div>
                <dt>驱动盘</dt>
                <dd>343</dd>
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
            <div className="data-center-repreflight-action data-center-repreflight-action--readonly">
              <p className="safe-note">所有待复核项已处理。下一步请重新预检。</p>
              <button
                className="button button--primary"
                type="button"
                disabled
                aria-describedby="audit-repreflight-note audit-readonly-note"
              >
                重新预检（不导入）
              </button>
              <p id="audit-repreflight-note" className="muted-note">
                这一步只检查当前账户的复核结果，不会导入。导入仍需在预检通过后单独确认。
              </p>
              <p id="audit-readonly-note" role="status" aria-live="polite" className="form-message">
                此页面为只读审计状态，所有操作不可用，且未写入任何本地数据。
              </p>
            </div>
          </section>
        </article>

        <article className="panel data-center-account-tools">
          <h2>切换玩家账户</h2>
          <label>
            玩家账户
            <select disabled value="波子汽水">
              <option>波子汽水 · 343 驱动盘 · 待复核 0</option>
            </select>
          </label>
        </article>

        <details className="panel data-center-restore">
          <summary>
            <strong>数据安全</strong>
            <span>备份、恢复与高级信息</span>
          </summary>
          <p className="danger-note">
            恢复会替换对应范围，不会与现有数据合并；失败时原数据保持不变。
          </p>
          <p className="muted-note">只读审计状态不提供备份、恢复或文件选择操作。</p>
        </details>
      </section>
    </div>
  )
}
