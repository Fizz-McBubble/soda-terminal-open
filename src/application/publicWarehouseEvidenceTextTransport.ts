const marker = '$t'

/** Lossless wire-only sharing of repeated provenance and condition text. */
export function warehouseEvidenceTextCodec(evidence: readonly unknown[]) {
  const counts = new Map<string, number>()
  const visit = (value: unknown): void => {
    if (typeof value === 'string') {
      if (value.length >= 32) counts.set(value, (counts.get(value) ?? 0) + 1)
    } else if (Array.isArray(value)) value.forEach(visit)
    else if (value && typeof value === 'object') {
      if (Object.hasOwn(value, marker)) throw new Error('驱动盘分析证据格式无效。')
      Object.values(value).forEach(visit)
    }
  }
  evidence.forEach(visit)
  const texts = [...counts].filter(([, count]) => count > 1).map(([value]) => value)
  const indexes = new Map(texts.map((value, index) => [value, index]))
  const encode = (value: unknown): unknown => {
    if (typeof value === 'string' && indexes.has(value)) return { [marker]: indexes.get(value)! }
    if (Array.isArray(value)) return value.map(encode)
    if (value && typeof value === 'object')
      return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, encode(child)]))
    return value
  }
  return { texts, encode }
}

export function restoreWarehouseEvidenceText(value: unknown, texts: readonly string[]): unknown {
  if (Array.isArray(value)) return value.map((child) => restoreWarehouseEvidenceText(child, texts))
  if (!value || typeof value !== 'object') return value
  if (Object.hasOwn(value, marker)) {
    const index = (value as Record<string, unknown>)[marker]
    if (
      Object.keys(value).length !== 1 ||
      typeof index !== 'number' ||
      !Number.isInteger(index) ||
      typeof texts[index] !== 'string'
    )
      throw new Error('驱动盘分析证据资料无效，请重新分析。')
    return texts[index]
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, restoreWarehouseEvidenceText(child, texts)]),
  )
}
