import { useId, useLayoutEffect, useRef, useState } from 'react'
import { getEffectiveZoom } from '../../components/floatingLayerGeometry'
import type { DiscFact } from './types'
import { DevelopmentDiscCard } from './DevelopmentDiscCard'

export function DiscStatComparisonDisclosure(props: {
  before: DiscFact
  after: DiscFact
  baselineLabel: string
}) {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  useLayoutEffect(() => {
    if (!open) return
    const buttonBounds = trigger.current?.getBoundingClientRect()
    if (buttonBounds && window.innerHeight - buttonBounds.bottom < 140) {
      trigger.current?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' })
    }
    const position = () => {
      const card = trigger.current?.closest('.comparison-disc-result')
      const anchor = card?.getBoundingClientRect()
      const button = trigger.current?.getBoundingClientRect()
      const layer = panel.current
      if (!anchor || !button || !layer) return
      const scale = getEffectiveZoom(layer)
      const topInViewport = button.bottom + 6
      const availableHeight = Math.max(0, window.innerHeight - topInViewport - 12)
      layer.style.left = `${anchor.left / scale}px`
      layer.style.top = `${topInViewport / scale}px`
      layer.style.width = `${anchor.width / scale}px`
      layer.style.maxHeight = `${availableHeight / scale}px`
      layer.style.overflowY = 'auto'
    }
    position()
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    const observer = new ResizeObserver(position)
    const card = trigger.current?.closest('.comparison-disc-result')
    if (card) observer.observe(card)
    return () => {
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', position, true)
      observer.disconnect()
    }
  }, [open])

  return (
    <span className="disc-comparison-popover">
      <button
        ref={trigger}
        className="explanation__trigger button button--quiet"
        type="button"
        popoverTarget={id}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`对比${props.after.slot}号位原盘`}
      >
        {open ? '收起原盘' : '对比原盘'}
      </button>
      <div
        id={id}
        ref={panel}
        popover="auto"
        role="dialog"
        aria-label={`${props.baselineLabel} · ${props.after.slot}号位`}
        className="disc-comparison-layer"
        onToggle={(event) => setOpen(event.newState === 'open')}
      >
        <DevelopmentDiscCard disc={props.before} />
      </div>
    </span>
  )
}
