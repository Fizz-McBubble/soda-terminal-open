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
  showIndicator = true,
}: {
  label: string
  title?: string
  children: ReactNode
  className?: string
  align?: 'start' | 'end'
  closeLabel?: string
  showIndicator?: boolean
}) {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  useLayoutEffect(() => {
    if (!open) return
    const position = () => {
      const anchor = trigger.current?.getBoundingClientRect()
      const content = panel.current
      if (!anchor || !content) return
      const scale = getEffectiveZoom(content)
      content.style.maxWidth = `${Math.max(1, window.innerWidth - 24) / scale}px`
      // Fit the rendered CSS-capped card, not its potentially much taller content.
      // Temporarily removing the fitted cap must not reset a reader's scroll position.
      const bodyScrollTop = body.current?.scrollTop ?? 0
      const bodyScrollLeft = body.current?.scrollLeft ?? 0
      content.style.maxHeight = ''
      const bounds = content.getBoundingClientRect()
      const position = fitFloatingLayer({
        anchor,
        width: bounds.width,
        height: bounds.height,
        scale,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        align,
      })
      content.style.left = `${position.left}px`
      content.style.top = `${position.top}px`
      content.style.maxHeight = `${position.maxHeight}px`
      content.style.visibility = 'visible'
      if (body.current) {
        body.current.scrollTop = bodyScrollTop
        body.current.scrollLeft = bodyScrollLeft
      }
    }
    const repositionOnPageScroll = (event: Event) => {
      if (event.target instanceof Node && panel.current?.contains(event.target)) return
      position()
    }
    position()
    window.addEventListener('resize', position)
    window.addEventListener('scroll', repositionOnPageScroll, true)
    panel.current?.addEventListener('toggle', position, true)
    const observer = new ResizeObserver(position)
    if (panel.current) observer.observe(panel.current)
    if (trigger.current) observer.observe(trigger.current)
    // The card/body can stay capped while a nested disclosure changes intrinsic height.
    if (body.current) {
      observer.observe(body.current)
      Array.from(body.current.children).forEach((child) => observer.observe(child))
    }
    const currentPanel = panel.current
    return () => {
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', repositionOnPageScroll, true)
      currentPanel?.removeEventListener('toggle', position, true)
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
        {showIndicator ? <span aria-hidden="true">{open ? '▾' : '▸'}</span> : null}
        <span className="explanation__label">{label}</span>
      </button>
      <div
        id={id}
        ref={panel}
        popover="auto"
        role="dialog"
        aria-label={title}
        className="explanation-popover"
        onToggle={(event) => {
          if (event.target !== event.currentTarget) return
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
        <div ref={body} className="explanation-popover__body">
          {children}
        </div>
      </div>
    </span>
  )
}
