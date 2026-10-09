/** CSS zoom changes fixed-position coordinates as well as element dimensions. */
export function getEffectiveZoom(element: Element | null): number {
  let scale = 1
  for (let parent = element; parent; parent = parent.parentElement) {
    const value = window.getComputedStyle(parent).zoom
    const zoom = Number.parseFloat(value)
    if (Number.isFinite(zoom) && zoom > 0) scale *= value.endsWith('%') ? zoom / 100 : zoom
  }
  return scale
}

/** Input rectangles are viewport pixels; returned dimensions are CSS pixels before zoom. */
export function fitFloatingLayer({
  anchor,
  width,
  height,
  scale,
  viewportWidth,
  viewportHeight,
  align = 'start',
  minimumHeight = height,
}: {
  anchor: Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>
  width: number
  height: number
  scale: number
  viewportWidth: number
  viewportHeight: number
  align?: 'start' | 'end'
  minimumHeight?: number
}) {
  const gap = 12
  const offset = 6
  const boundedWidth = Math.min(width, Math.max(1, viewportWidth - gap * 2))
  const below = Math.max(0, viewportHeight - anchor.bottom - gap - offset)
  const above = Math.max(0, anchor.top - gap - offset)
  const openAbove = below < Math.min(height, minimumHeight) && above > below
  const boundedHeight = Math.min(
    height,
    Math.max(1, viewportHeight - gap * 2),
    Math.max(1, openAbove ? above : below),
  )
  const left = align === 'start' ? anchor.left : anchor.right - boundedWidth
  const top = openAbove ? anchor.top - boundedHeight - offset : anchor.bottom + offset
  return {
    left: Math.max(gap, Math.min(left, viewportWidth - boundedWidth - gap)) / scale,
    top: Math.max(gap, Math.min(top, viewportHeight - boundedHeight - gap)) / scale,
    width: boundedWidth / scale,
    maxHeight: boundedHeight / scale,
  }
}
