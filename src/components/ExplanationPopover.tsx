import { useLayoutEffect, useId, useRef, useState, type ReactNode } from 'react'
import { fitFloatingLayer, getEffectiveZoom } from './floatingLayerGeometry'
import './ExplanationPopover.css'

/** Native top-layer disclosure: outside click, Escape and focus return stay browser-owned. */
export function ExplanationPopover({
  label,
  title = label,
  children,
  className = '',
  align = 'end',
  closeLabel = '关闭说明',
}: {
  label: string
  title?: string
  children: ReactNode
  className?: string
  align?: 'start' | 'end'
  closeLabel?: string
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
      const scale = getEffectiveZoom(content)
      content.style.maxWidth = `${Math.max(1, window.innerWidth - 24) / scale}px`
      const bounds = content.getBoundingClientRect()
      const position = fitFloatingLayer({
        anchor,
        width: bounds.width,
        height:
          content.scrollHeight * scale + Math.max(0, bounds.height - content.clientHeight * scale),
        scale,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        align,
      })
      content.style.left = `${position.left}px`
      content.style.top = `${position.top}px`
      content.style.maxHeight = `${position.maxHeight}px`
      content.style.visibility = 'visible'
    }
    position()
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    const observer = new ResizeObserver(position)
    if (panel.current) observer.observe(panel.current)
    if (trigger.current) observer.observe(trigger.current)
    return () => {
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', position, true)
      observer.disconnect()
    }
  }, [open, align])

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
          <button
            type="button"
            popoverTarget={id}
            popoverTargetAction="hide"
            aria-label={closeLabel}
          >
            ×
          </button>
        </header>
        <div className="explanation-popover__body">{children}</div>
      </div>
    </span>
  )
}
