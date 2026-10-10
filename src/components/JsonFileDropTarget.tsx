import { useRef, useState, type ComponentPropsWithRef, type DragEvent } from 'react'

type Props = Omit<
  ComponentPropsWithRef<'section'>,
  'onDrop' | 'onDragEnter' | 'onDragLeave' | 'onDragOver'
> & {
  disabled?: boolean
  onFile: (file: File) => void | Promise<void>
  onRejected: (message: string) => void
}

/** A drop only selects a local file; the existing review still owns any account write. */
export function JsonFileDropTarget({ disabled = false, onFile, onRejected, ...props }: Props) {
  const depth = useRef(0)
  const [dragging, setDragging] = useState(false)
  const hasFiles = (event: DragEvent<HTMLElement>) =>
    Array.from(event.dataTransfer.types).includes('Files') || event.dataTransfer.files.length > 0

  return (
    <section
      {...props}
      data-file-dragging={dragging && !disabled ? true : undefined}
      onDragEnter={(event) => {
        event.preventDefault()
        if (disabled || !hasFiles(event)) return
        depth.current += 1
        setDragging(true)
      }}
      onDragLeave={(event) => {
        event.preventDefault()
        depth.current = Math.max(0, depth.current - 1)
        if (!depth.current) setDragging(false)
      }}
      onDragOver={(event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = !disabled && hasFiles(event) ? 'copy' : 'none'
      }}
      onDrop={(event) => {
        event.preventDefault()
        event.stopPropagation()
        depth.current = 0
        setDragging(false)
        if (disabled) return
        const files = Array.from(event.dataTransfer.files)
        if (files.length !== 1) {
          onRejected('请一次拖入一个 JSON 文件。')
          return
        }
        const file = files[0]
        if (!/\.json$/i.test(file.name) && file.type !== 'application/json') {
          onRejected('请选择 JSON 文件；拖入后会先检查，不会直接写入账户。')
          return
        }
        void onFile(file)
      }}
    />
  )
}
