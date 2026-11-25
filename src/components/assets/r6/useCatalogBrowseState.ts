import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import type { CatalogKind } from './types'

// Browsing context belongs to the account and catalogue, never to its asset data.
const contexts = new Map<string, Record<string, unknown>>()
const scrolls = new Map<string, number>()

export function clearCatalogBrowseContexts() {
  contexts.clear()
  scrolls.clear()
}

export function useCatalogBrowseState<T>(key: string | undefined, field: string, initial: T) {
  const [value, setValue] = useState<T>(() =>
    key && contexts.get(key)?.[field] !== undefined ? (contexts.get(key)![field] as T) : initial,
  )
  useLayoutEffect(() => {
    if (key) contexts.set(key, { ...contexts.get(key), [field]: value })
  }, [key, field, value])
  return [value, setValue] as const
}

export function useCatalogBrowseScroll(
  key: string | undefined,
  ref: RefObject<HTMLElement | null>,
) {
  const initial = useRef(key ? (scrolls.get(key) ?? 0) : 0)
  useLayoutEffect(() => {
    const element = ref.current
    if (!key || !element) return
    element.scrollTop = initial.current
    const remember = () => scrolls.set(key, element.scrollTop)
    element.addEventListener('scroll', remember, { passive: true })
    return () => {
      remember()
      element.removeEventListener('scroll', remember)
    }
  }, [key, ref])
}

export function useCatalogBrowseSizing(
  kind: CatalogKind,
  splitRef: RefObject<HTMLDivElement | null>,
  gridRef: RefObject<HTMLDivElement | null>,
) {
  useLayoutEffect(() => {
    const split = splitRef.current
    if (!split) return
    const resize = () => {
      // Keep the catalog grid within the visible workspace; no asset data changes here.
      const frame = split.closest<HTMLElement>('.f5v-page-frame')
      const page = split.closest<HTMLElement>('.f5v-page-content')
      const zoom = frame ? frame.getBoundingClientRect().width / frame.offsetWidth : 1
      const bottom = Math.min(
        window.innerHeight,
        frame?.getBoundingClientRect().bottom ?? window.innerHeight,
      )
      const available = Math.max(
        280,
        (bottom - split.getBoundingClientRect().top) / zoom -
          (frame?.scrollTop ?? 0) -
          (page?.scrollTop ?? 0) -
          8,
      )
      split.style.setProperty(
        kind === 'discs' ? '--disc-browse-height' : '--catalog-browse-height',
        `${available}px`,
      )
      const shell = split.closest<HTMLElement>('.r6-golden')
      const catalog = split.querySelector<HTMLElement>('.catalog')
      if (shell && catalog) shell.style.setProperty('--asset-nav-width', `${catalog.offsetWidth}px`)
      if (kind === 'agents' && gridRef.current) {
        const grid = gridRef.current
        const filters = grid.parentElement?.querySelector<HTMLElement>('.filterbar--agents')
        if (filters) {
          const style = window.getComputedStyle(grid)
          const tracks = style.gridTemplateColumns.split(/\s+/).map(Number.parseFloat)
          const gap = Number.parseFloat(style.columnGap) || 0
          if (tracks.length >= 8 && Number.isFinite(tracks[0]) && Number.isFinite(tracks[1])) {
            filters.style.gridTemplateColumns = `repeat(4, ${tracks[0]! + tracks[1]! + gap}px)`
            filters.style.columnGap = `${gap}px`
            filters.style.marginLeft = style.paddingLeft
          } else {
            filters.style.removeProperty('grid-template-columns')
            filters.style.removeProperty('column-gap')
            filters.style.removeProperty('margin-left')
          }
        }
      }
    }
    resize()
    let resizeFrame = 0
    const scheduleResize = () => {
      window.cancelAnimationFrame(resizeFrame)
      resizeFrame = window.requestAnimationFrame(resize)
    }
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleResize)
    observer?.observe(split.parentElement!)
    if (gridRef.current) observer?.observe(gridRef.current)
    window.addEventListener('resize', scheduleResize)
    return () => {
      observer?.disconnect()
      window.cancelAnimationFrame(resizeFrame)
      window.removeEventListener('resize', scheduleResize)
      split.closest<HTMLElement>('.r6-golden')?.style.removeProperty('--asset-nav-width')
    }
  }, [kind, splitRef, gridRef])
}
