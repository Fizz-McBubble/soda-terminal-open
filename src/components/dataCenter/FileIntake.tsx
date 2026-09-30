import { useRef, type DragEvent, type KeyboardEvent, type RefObject } from 'react'
import { CheckCircle2, FileJson2, ShieldAlert, Upload } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  type FilePhase,
  type FileState,
  formatFileSize,
  primaryActionLabel,
  recognitionPhase,
} from './dataCenterTypes'

export function FileIntake({
  state,
  disabled,
  onFile,
  onStateChange,
  onPrimaryAction,
  onReset,
  triggerRef,
}: {
  state: FileState
  disabled: boolean
  onFile: (file: File) => Promise<void>
  onStateChange: (phase: FilePhase) => void
  onPrimaryAction: () => Promise<void>
  onReset: () => void
  triggerRef?: RefObject<HTMLDivElement | null>
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)
  const isReading = state.phase === 'reading' || state.phase === 'recognized'
  const openPicker = () => inputRef.current?.click()

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled || isReading) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    openPicker()
  }

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    if (disabled || isReading) return
    dragDepth.current += 1
    onStateChange('drag-over')
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    dragDepth.current -= 1
    if (dragDepth.current <= 0) {
      dragDepth.current = 0
      onStateChange(state.recognition ? recognitionPhase(state.recognition) : 'idle')
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    dragDepth.current = 0
    if (disabled || isReading) return
    const file = event.dataTransfer.files[0]
    if (file) void onFile(file)
  }

  return (
    <section className="data-center-file-flow" aria-live="polite" data-state={state.phase}>
      <div
        ref={triggerRef}
        aria-disabled={disabled || isReading}
        className="data-center-dropzone"
        onClick={() => {
          if (!disabled && !isReading) openPicker()
        }}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={disabled ? -1 : 0}
      >
        <input
          ref={inputRef}
          accept="application/json,.json"
          aria-label="选择 soda-terminal-backup JSON 或扫描数据"
          disabled={disabled || isReading}
          hidden
          type="file"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void onFile(file)
            event.target.value = ''
          }}
        />
        {state.phase === 'drag-over' ? <Upload size={28} /> : <FileJson2 size={28} />}
        <strong>
          {state.phase === 'drag-over'
            ? '松开后识别文件'
            : state.phase === 'reading'
              ? '正在识别文件'
              : state.phase === 'recognized'
                ? '文件已识别，正在预检'
                : '选择文件或拖到这里'}
        </strong>
        <span>
          {state.fileName
            ? `${state.fileName} · ${formatFileSize(state.fileSize)}`
            : '支持扫描数据和 Soda Terminal 备份；系统会先识别，不会立即写入'}
        </span>
      </div>

      {state.recognition && state.phase !== 'success' && (
        <div className={`data-center-preflight ${state.phase === 'error' ? 'is-error' : ''}`}>
          <div className="data-center-preflight__title">
            {state.phase === 'error' ? <ShieldAlert size={22} /> : <CheckCircle2 size={22} />}
            <div>
              <span>{state.phase === 'error' ? '无法继续' : '文件已识别'}</span>
              <h3>{state.phase === 'error' ? state.recognition.label : '预检通过，尚未写入'}</h3>
              {state.phase !== 'error' && <p>{state.recognition.label}</p>}
            </div>
          </div>
          {state.recognition.kind !== 'unknown' && (
            <dl className="data-center-counts">
              <div>
                <dt>目标账号</dt>
                <dd>{state.recognition.targetAccountName ?? '全部账号'}</dd>
              </div>
              <div>
                <dt>总数</dt>
                <dd>{state.recognition.counts.total}</dd>
              </div>
              <div>
                <dt>新增</dt>
                <dd>{state.recognition.counts.add}</dd>
              </div>
              <div>
                <dt>跳过</dt>
                <dd>{state.recognition.counts.skip}</dd>
              </div>
              <div>
                <dt>需确认</dt>
                <dd>{state.recognition.counts.confirm}</dd>
              </div>
              <div>
                <dt>失败</dt>
                <dd>{state.recognition.counts.failed}</dd>
              </div>
            </dl>
          )}
          <p className={state.recognition.preservesOriginal ? 'safe-note' : 'danger-note'}>
            {state.recognition.preservesOriginal
              ? '原数据会保留；只有确认后的有效内容才会写入。'
              : `${state.recognition.replacementScope ?? '本地数据将被完整替换'}，不会合并。`}
          </p>
          {state.recognition.errors.slice(0, 3).map((error) => (
            <p key={error} className="danger-note">
              {error}
            </p>
          ))}
          {state.recognition.risks.slice(0, 2).map((risk) => (
            <p key={risk} className="muted-note">
              {risk}
            </p>
          ))}
          <div className="data-center-actions">
            {state.phase === 'error' ? (
              <button className="button button--primary" type="button" onClick={onReset}>
                重新选择文件
              </button>
            ) : (
              <button
                className="button button--primary"
                disabled={disabled || isReading}
                type="button"
                onClick={() => void onPrimaryAction()}
              >
                {primaryActionLabel(state.recognition)}
              </button>
            )}
          </div>
        </div>
      )}

      {state.phase === 'success' && state.success && (
        <div className="data-center-success">
          <CheckCircle2 size={24} />
          <div>
            <h3>{state.success.title}</h3>
            <p>{state.success.detail}</p>
            {state.success.batchId ? (
              <Link
                className="button button--primary"
                to={`/assets/discs?importBatch=${encodeURIComponent(state.success.batchId)}`}
              >
                查看本次导入
              </Link>
            ) : (
              <button className="button button--primary" type="button" onClick={onReset}>
                返回账号概览
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
