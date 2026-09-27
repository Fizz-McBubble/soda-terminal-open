import './planning-dialog.css'
import { useEffect, useEffectEvent, useId, useRef, type ReactNode } from 'react'

export function PlanningDialog({
  title,
  description,
  onCancel,
  children,
}: {
  title: string
  description: string
  onCancel: () => void
  children: ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const cancel = useEffectEvent(onCancel)
  const titleId = useId()
  const descriptionId = useId()
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null
    const modal = dialog.current
    if (modal && !modal.open) {
      if (typeof modal.showModal === 'function') modal.showModal()
      else modal.setAttribute('open', '')
    }
    if (modal && !modal.contains(document.activeElement)) {
      modal.querySelector<HTMLElement>('button:not(:disabled), input:not(:disabled)')?.focus()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (modal?.dataset.selectMenuOpen === 'true' || modal?.querySelector('[role="listbox"]'))
          return
        event.preventDefault()
        cancel()
        return
      }
      if (event.key !== 'Tab') return
      const controls = dialog.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (!controls?.length) return
      const first = controls[0]!
      const last = controls[controls.length - 1]!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      trigger?.focus()
    }
  }, [])
  return (
    <dialog
      ref={dialog}
      className="planning-dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault()
        if (
          event.currentTarget.dataset.selectMenuOpen === 'true' ||
          event.currentTarget.querySelector('[role="listbox"]')
        )
          return
        onCancel()
      }}
    >
      <div className="planning-dialog__body">
        <h2 id={titleId}>{title}</h2>
        <p id={descriptionId}>{description}</p>
        {children}
      </div>
    </dialog>
  )
}
