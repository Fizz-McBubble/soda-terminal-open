import { ShieldAlert, Upload } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { DriveDiscImportPreflight } from '../../domain/discImport'

export function DriveDiscImportPanel({
  discImportPreflight,
  discImportResult,
  importingDiscs,
  onInspectFile,
  onConfirmDiscImport,
}: {
  discImportPreflight: DriveDiscImportPreflight | null
  discImportResult: DriveDiscImportPreflight | null
  importingDiscs: boolean
  onInspectFile: (file: File | undefined) => void
  onConfirmDiscImport: () => void
}) {
  return (
    <article className="panel">
      <div className="panel__header">
        <div>
          <span className="eyebrow">导入</span>
          <h2>导入驱动盘仓库</h2>
        </div>
      </div>
      <p>
        支持 Soda Terminal 标准导入 JSON 和 ZZZ-Scanner 风格
        <code>scan_data.json</code>。导入前只做预检，不会立即写入仓库。
      </p>
      <label className="file-picker">
        <Upload size={20} />
        <span>选择驱动盘 JSON</span>
        <input
          accept="application/json,.json"
          type="file"
          onChange={(event) => void onInspectFile(event.target.files?.[0])}
        />
      </label>
      {discImportPreflight && (
        <div
          className={
            discImportPreflight.summary.failed > 0
              ? 'preflight-card preflight-card--error'
              : 'preflight-card preflight-card--ready'
          }
        >
          <h3>
            {discImportResult
              ? '导入完成'
              : discImportPreflight.summary.ready > 0
                ? '预检通过，尚未写入'
                : '预检未通过'}
          </h3>
          <p>
            来源 {discImportPreflight.sourceAdapter} · 批次 {discImportPreflight.batchId}
          </p>
          {!discImportResult && discImportPreflight.summary.failed > 0 && (
            <p className="muted-note">预检阶段不会写入仓库；当前失败不会改变原仓库。</p>
          )}
          <dl className="count-comparison">
            <div>
              <dt>项目</dt>
              <dd>数量</dd>
            </div>
            <div>
              <dt>总数</dt>
              <dd>{discImportPreflight.summary.total}</dd>
            </div>
            <div>
              <dt>可导入</dt>
              <dd>{discImportPreflight.summary.ready}</dd>
            </div>
            <div>
              <dt>重复跳过</dt>
              <dd>{discImportPreflight.summary.skipped}</dd>
            </div>
            <div>
              <dt>失败</dt>
              <dd>{discImportPreflight.summary.failed}</dd>
            </div>
          </dl>
          <p className="danger-note">
            <ShieldAlert size={17} />
            去重基于盘面指纹；完全同盘面但实际不同实体的驱动盘可能会被视为重复。
          </p>
          {discImportPreflight.items.some((item) => item.issues.length > 0) && (
            <ul className="preflight-errors">
              {discImportPreflight.items
                .filter((item) => item.issues.length > 0)
                .slice(0, 4)
                .map((item) => (
                  <li key={`${item.index}-${item.status}`}>
                    第 {item.index + 1} 条：{item.issues[0]?.message}
                  </li>
                ))}
            </ul>
          )}
          {!discImportResult && discImportPreflight.summary.ready > 0 && (
            <button
              className="button button--primary"
              disabled={importingDiscs}
              type="button"
              onClick={onConfirmDiscImport}
            >
              {importingDiscs ? '正在导入…' : '确认导入可用驱动盘'}
            </button>
          )}
          {discImportResult && (
            <Link
              className="button button--primary"
              to={`/assets/discs?importBatch=${encodeURIComponent(discImportResult.batchId)}`}
            >
              去仓库查看本次导入
            </Link>
          )}
        </div>
      )}
    </article>
  )
}
