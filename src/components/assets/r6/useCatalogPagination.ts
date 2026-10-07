import { useState, type KeyboardEvent, type RefObject } from 'react'

export const CATALOG_PAGE_SIZE = 120

export function useCatalogPagination<T extends { stableId: string }>(
  rows: T[],
  filterKey: string,
  selectedId: string | undefined,
  gridRef: RefObject<HTMLDivElement | null>,
  fallbackColumns: number,
) {
  const [state, setState] = useState(() => ({
    key: filterKey,
    page: Math.max(
      0,
      Math.floor(rows.findIndex((row) => row.stableId === selectedId) / CATALOG_PAGE_SIZE),
    ),
  }))
  if (state.key !== filterKey) setState({ key: filterKey, page: 0 })
  const pages = Math.max(1, Math.ceil(rows.length / CATALOG_PAGE_SIZE))
  const page = Math.min(pages - 1, state.key === filterKey ? state.page : 0)
  const start = page * CATALOG_PAGE_SIZE
  const change = (next: number) => setState({ key: filterKey, page: next })
  const reveal = (index: number, key = filterKey) =>
    setState({ key, page: Math.max(0, Math.floor(index / CATALOG_PAGE_SIZE)) })
  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(event.key)) return
    const cards = [...(gridRef.current?.querySelectorAll<HTMLButtonElement>('.object-card') ?? [])]
    const current = cards.indexOf(document.activeElement as HTMLButtonElement)
    if (current < 0) return
    const tracks = gridRef.current
      ? getComputedStyle(gridRef.current).gridTemplateColumns.trim()
      : ''
    const columns = tracks && tracks !== 'none' ? tracks.split(/\s+/).length : fallbackColumns
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns }[event.key]!
    const next = Math.max(0, Math.min(rows.length - 1, start + current + step))
    const nextPage = Math.floor(next / CATALOG_PAGE_SIZE)
    const focus = () => {
      const nextCards = gridRef.current?.querySelectorAll<HTMLButtonElement>('.object-card')
      nextCards?.[next % CATALOG_PAGE_SIZE]?.focus()
    }
    if (nextPage === page) focus()
    else {
      change(nextPage)
      window.requestAnimationFrame(focus)
    }
    event.preventDefault()
  }
  return {
    visible: rows.slice(start, start + CATALOG_PAGE_SIZE),
    page,
    pages,
    start,
    change,
    reveal,
    move,
  }
}
