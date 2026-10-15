import type { BackupPreview } from './types'

export function AccountRestorePreview({
  preview,
  restoring,
  onChange,
}: {
  preview: BackupPreview
  restoring: boolean
  onChange: (preview: BackupPreview) => void
}) {
  return (
    <>
      <p>
        {preview.identity === 'same_name_different_id' ? (
          '同名账户身份不同，将作为独立账户恢复，现有同名账户不会被合并或覆盖。'
        ) : (
          <>
            将恢复“{preview.accountName}”在 {new Date(preview.exportedAt).toLocaleString()}{' '}
            导出的资料。若备份对应的账户已存在，其资料将被完整替换；其他账户不受影响。
            替换前会自动保存完整恢复副本，可在账户与备份下载。
            {preview.archived ? '此账户保持归档，不会设为当前账户。' : null}
          </>
        )}
      </p>
      {preview.identity === 'same_name_different_id' && (
        <label>
          恢复后的本地显示名称
          <input
            value={preview.restoreDisplayName ?? ''}
            disabled={restoring}
            onChange={(event) => onChange({ ...preview, restoreDisplayName: event.target.value })}
          />
        </label>
      )}
      <dl className="restore-facts">
        {preview.replacementNotice ? (
          <div>
            <dt>目标账户</dt>
            <dd>{preview.replacementNotice}</dd>
          </div>
        ) : null}
        <div>
          <dt>文件</dt>
          <dd>{preview.fileName}</dd>
        </div>
        <div>
          <dt>备份内容</dt>
          <dd>{preview.scope}</dd>
        </div>
      </dl>
    </>
  )
}
