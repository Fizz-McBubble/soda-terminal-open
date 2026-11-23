import { useRef, useState } from 'react'
import { warehouseActionFeedback } from '../../application/warehouseMatchFeedback'
import { usePageOperationScope } from '../../components/usePageOperationScope'

/** Explicit confirmation of the adjacent source condition; never changes equipment. */
export function DevelopmentDirectionAction({
  directionId,
  onSelect,
}: {
  directionId: string
  onSelect: (directionId: string) => void | Promise<void>
}) {
  const running = useRef(false)
  const captureScope = usePageOperationScope(directionId)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <div>
      <button
        type="button"
        className="button button--quiet"
        disabled={pending}
        onClick={async () => {
          if (running.current) return
          const isCurrent = captureScope()
          running.current = true
          setPending(true)
          setError(null)
          try {
            await onSelect(directionId)
          } catch (failure) {
            if (isCurrent()) setError(warehouseActionFeedback(failure).summary)
          } finally {
            running.current = false
            if (isCurrent()) setPending(false)
          }
        }}
      >
        {pending ? '正在搭配…' : '确认条件并按此方向搭配'}
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  )
}
