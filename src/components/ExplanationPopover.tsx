import { useLayoutEffect, useId, useRef, useState, type ReactNode } from 'react'
import './ExplanationPopover.css'

/** Native top-layer disclosure: outside click, Escape and focus return stay browser-owned. */
export function ExplanationPopover({
  label,
  title = label,
  children,
  className = '',
}: {
  label: string
  title?: string
  children: ReactNode
  className?: string
}) {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  useLayoutEffect(() => {
    if (!open) return
    const position = () => {
      const anchor = trigger.current?.getBoundingClientRect()
      const content = panel.current
      if (!anchor || !content) return
      const gap = 12
      const bounds = content.getBoundingClientRect()
      const below = window.innerHeight - anchor.bottom - gap
      const above = anchor.top - gap
      const top =
        below >= bounds.height || below >= above
          ? anchor.bottom + 6
          : anchor.top - bounds.height - 6
      content.style.left = `${Math.max(gap, Math.min(anchor.right - bounds.width, window.innerWidth - bounds.width - gap))}px`
      content.style.top = `${Math.max(gap, Math.min(top, window.innerHeight - bounds.height - gap))}px`
      content.style.visibility = 'visible'
    }
    position()
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    const observer = new ResizeObserver(position)
    if (panel.current) observer.observe(panel.current)
    return () => {
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', position, true)
      observer.disconnect()
    }
  }, [open])

  return (
    <span className={`explanation ${className}`}>
      <button
        className="explanation__trigger"
        type="button"
        ref={trigger}
        popoverTarget={id}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span aria-hidden="true">{open ? '▾' : '▸'}</span> {label}
      </button>
      <div
        id={id}
        ref={panel}
        popover="auto"
        role="dialog"
        aria-label={title}
        className="explanation-popover"
        onToggle={(event) => {
          const shown = event.newState === 'open'
          setOpen(shown)
        }}
      >
        <header className="explanation-popover__header">
          <strong>{title}</strong>
          <button type="button" popoverTarget={id} popoverTargetAction="hide" aria-label="关闭说明">
            ×
          </button>
        </header>
        <div className="explanation-popover__body">{children}</div>
      </div>
    </span>
  )
}
