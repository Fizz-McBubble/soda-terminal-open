export function AssetQuickReadRecovery({
  mode,
  restoreLabel,
  notice,
  hasRecovery,
  disabled,
  armed,
  restoring,
  onArm,
  onCancel,
  onRestore,
}: {
  mode: 'legacy' | 'current'
  restoreLabel: '恢复本次导入' | '恢复上次资产快读导入'
  notice: string
  hasRecovery: boolean
  disabled: boolean
  armed: boolean
  restoring: boolean
  onArm: () => void
  onCancel: () => void
  onRestore: () => Promise<void>
}) {
  const actions = hasRecovery ? (
    <>
      <button type="button" className="button button--quiet" disabled={disabled} onClick={onArm}>
        {restoreLabel}
      </button>
      {armed && (
        <div>
          <p>将恢复到本次导入前的代理人和盘库。导入后若有其他修改，会停止恢复，避免覆盖。</p>
          <div className="asset-quick-read__actions">
            <button
              type="button"
              className="button"
              disabled={disabled}
              onClick={() => void onRestore()}
            >
              {restoring ? '恢复中…' : '确认恢复到导入前'}
            </button>
            <button
              type="button"
              className="button button--quiet"
              disabled={restoring}
              onClick={onCancel}
            >
              取消恢复
            </button>
          </div>
        </div>
      )}
    </>
  ) : null
  if (mode === 'current') return actions
  return (
    <div className="asset-quick-read__recovery">
      <p>{notice}</p>
      {actions}
    </div>
  )
}
