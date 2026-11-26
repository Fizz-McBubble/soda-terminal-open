const marker = '$t'

/** Lossless wire-only sharing of repeated provenance and condition text. */
type TextOccurrence = { strings: string[]; children: TextOccurrence[]; count: number }

function countEvidenceTexts(evidence: readonly unknown[]) {
  const counts = new Map<string, number>()
  const seen = new WeakMap<object, TextOccurrence>()
  const postorder: TextOccurrence[] = []
  const visit = (value: object): TextOccurrence => {
    const previous = seen.get(value)
    if (previous) return previous
    const array = Array.isArray(value)
    if (!array && Object.hasOwn(value, marker)) throw new Error('驱动盘分析证据格式无效。')
    const node: TextOccurrence = { strings: [], children: [], count: 0 }
    const children = array ? value : Object.values(value)
    for (const child of children) {
      if (typeof child === 'string') {
        node.strings.push(child)
        if (!counts.has(child)) counts.set(child, 0)
      } else if (child && typeof child === 'object') {
        node.children.push(visit(child))
      }
    }
    seen.set(value, node)
    postorder.push(node)
    return node
  }
  for (const item of evidence) {
    if (typeof item === 'string') counts.set(item, (counts.get(item) ?? 0) + 1)
    else if (item && typeof item === 'object') visit(item).count += 1
  }
  for (let index = postorder.length - 1; index >= 0; index -= 1) {
    const { strings, children, count } = postorder[index]!
    for (const text of strings) counts.set(text, counts.get(text)! + count)
    for (const child of children) child.count += count
  }
  return counts
}

export function warehouseEvidenceTextCodec(evidence: readonly unknown[]) {
  const counts = countEvidenceTexts(evidence)
  const encoder = new TextEncoder()
  const bytes = (value: unknown) => encoder.encode(JSON.stringify(value)).byteLength
  const texts: string[] = []
  for (const [value, count] of counts) {
    if (count <= 1) continue
    // Charge both the actual indexed marker and its dictionary entry. Even a
    // frequently repeated short string stays literal unless the wire shrinks.
    const literalBytes = bytes(value)
    const referenceBytes = bytes({ [marker]: texts.length })
    if (count * (literalBytes - referenceBytes) > literalBytes + 1) texts.push(value)
  }
  const indexes = new Map(texts.map((value, index) => [value, index]))
  // Count every occurrence above. Cache only within one complete encode pass;
  // later calls must observe mutations to the input and get independent output.
  const createEncoder = () => {
    const encoded = new WeakMap<object, unknown>()
    const references = texts.map((_, index) => ({ [marker]: index }))
    const encode = (value: unknown): unknown => {
      if (typeof value === 'string') {
        const index = indexes.get(value)
        return index === undefined ? value : references[index]
      }
      if (!value || typeof value !== 'object') return value
      if (encoded.has(value)) return encoded.get(value)
      const result = Array.isArray(value)
        ? value.map(encode)
        : Object.fromEntries(Object.entries(value).map(([key, child]) => [key, encode(child)]))
      encoded.set(value, result)
      return result
    }
    return encode
  }
  return {
    texts,
    encode: (value: unknown) => createEncoder()(value),
    encodeAll: (values: readonly unknown[]) => values.map(createEncoder()),
  }
}

export function restoreWarehouseEvidenceTextReference(
  record: Record<string, unknown>,
  texts: readonly string[],
): string | Record<string, unknown> {
  if (!Object.hasOwn(record, marker)) return record
  const index = record[marker]
  if (
    Object.keys(record).length !== 1 ||
    typeof index !== 'number' ||
    !Number.isInteger(index) ||
    typeof texts[index] !== 'string'
  )
    throw new Error('驱动盘分析证据资料无效，请重新分析。')
  return texts[index]
}

export function restoreWarehouseEvidenceText(value: unknown, texts: readonly string[]): unknown {
  if (Array.isArray(value)) return value.map((child) => restoreWarehouseEvidenceText(child, texts))
  if (!value || typeof value !== 'object') return value
  const decoded = restoreWarehouseEvidenceTextReference(value as Record<string, unknown>, texts)
  if (typeof decoded === 'string') return decoded
  return Object.fromEntries(
    Object.entries(decoded).map(([key, child]) => [
      key,
      restoreWarehouseEvidenceText(child, texts),
    ]),
  )
}
