import { useRef, type Ref } from 'react'
import { FileUp } from 'lucide-react'
import './json-file-picker.css'

export function JsonFilePicker({
  onFile,
  disabled = false,
  checking = false,
  buttonRef,
  inputLabel = '选择本机文件（JSON）',
}: {
  onFile: (file: File) => void | Promise<void>
  disabled?: boolean
  checking?: boolean
  buttonRef?: Ref<HTMLButtonElement>
  inputLabel?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="soda-json-file-picker"
        disabled={disabled}
        title={
          checking
            ? '正在检查，可重新选择一个 JSON 文件'
            : '点击选择或直接拖入一个 JSON 文件；检查后再确认写入账户'
        }
        onClick={() => inputRef.current?.click()}
      >
        <FileUp size={18} aria-hidden="true" />
        {checking ? '正在检查…' : '选择或拖入 JSON'}
      </button>
      <input
        ref={inputRef}
        hidden
        type="file"
        accept=".json,application/json"
        aria-label={inputLabel}
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void onFile(file)
        }}
      />
    </>
  )
}
