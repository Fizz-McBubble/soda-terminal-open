import { useLayoutEffect, useRef, useState, type RefObject } from 'react'

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
