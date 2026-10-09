import { useRef } from 'react'
import { FileJson, Upload } from 'lucide-react'
import { StatusBanner } from '../components/ui/StatusBanner'
import type { assessScannerAssistantInput } from '../scanner/assistant'

export function ScannerFallbackJsonSection({
  selectedJson,
  assessment,
  targetReady,
  busy = false,
  onInspectJson,
  onHandOffFallbackJson,
}: {
  selectedJson: File | null
  assessment: ReturnType<typeof assessScannerAssistantInput>
  targetReady: boolean
  busy?: boolean
  onInspectJson: (file: File | undefined) => void
  onHandOffFallbackJson: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <section
      className="scanner-web__fallback-trigger"
      aria-labelledby="scanner-json-recovery-heading"
    >
      <FileJson aria-hidden="true" size={18} />
      <span>
        <strong id="scanner-json-recovery-heading">已有扫描结果文件？</strong>
        <small>检查 JSON 后再确认导入</small>
      </span>
      <button
        className="button button--quiet scanner-web__file-picker"
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        <Upload aria-hidden="true" size={18} />
        <span>选择 JSON 文件</span>
      </button>
      <input
        className="visually-hidden"
        tabIndex={-1}
        aria-hidden="true"
        aria-label="选择扫描结果文件（JSON）"
        ref={inputRef}
        accept="application/json,.json"
        type="file"
        onChange={(event) => void onInspectJson(event.target.files?.[0])}
      />
      {assessment.state !== 'idle' ? (
        <StatusBanner
          tone={
            assessment.state === 'blocked' ? 'error' : assessment.canHandOff ? 'success' : 'info'
          }
          title={assessment.title}
        >
          <p>{assessment.message}</p>
        </StatusBanner>
      ) : null}
      {assessment.canHandOff && selectedJson ? (
        <div className="scanner-web__json-handoff">
          <button
            className="button button--quiet"
            type="button"
            disabled={!targetReady || busy}
            onClick={onHandOffFallbackJson}
          >
            继续检查并导入
          </button>
          <small>继续检查“{selectedJson.name}”，无需重新选择文件。</small>
        </div>
      ) : null}
    </section>
  )
}
