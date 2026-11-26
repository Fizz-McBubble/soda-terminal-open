import { restoreWarehouseEvidenceTextReference } from './publicWarehouseEvidenceTextTransport'

const marker = '$o'
const encoder = new TextEncoder()
const size = (value: unknown) => encoder.encode(JSON.stringify(value)).byteLength

type ShapeOccurrence = { key?: string; children: ShapeOccurrence[]; count: number }

function countObjectShapes(input: readonly unknown[]) {
  const counts = new Map<string, number>()
  const seen = new WeakMap<object, ShapeOccurrence>()
  const postorder: ShapeOccurrence[] = []
  const visit = (value: object): ShapeOccurrence => {
    const previous = seen.get(value)
    if (previous) return previous
    const array = Array.isArray(value)
    if (!array && Object.hasOwn(value, marker)) throw new Error('驱动盘分析对象格式无效。')
    const node: ShapeOccurrence = { children: [], count: 0 }
    const children = array ? value : Object.values(value)
    if (!array && !children.includes(undefined)) {
      node.key = JSON.stringify(Object.keys(value))
      // Preserve the first-occurrence order of the v3 shape table.
      if (!counts.has(node.key)) counts.set(node.key, 0)
    }
    for (const child of children) {
      if (child && typeof child === 'object') node.children.push(visit(child))
    }
    seen.set(value, node)
    postorder.push(node)
    return node
  }
  for (const value of input) {
    if (value && typeof value === 'object') visit(value).count += 1
  }
  // A shared branch still contributes once per path in the serialized payload.
  // Walk parents before their descendants to propagate each count once.
  for (let index = postorder.length - 1; index >= 0; index -= 1) {
    const { key, children, count } = postorder[index]!
    if (key !== undefined) counts.set(key, counts.get(key)! + count)
    for (const child of children) child.count += count
  }
  return counts
}

/** Share repeated object field names on the wire without dropping any values. */
export function warehouseObjectCodec(input: readonly unknown[]) {
  const shapes: string[][] = []
  const indexes = new Map<string, number>()
  for (const [key, count] of countObjectShapes(input)) {
    const keys: string[] = JSON.parse(key)
    const objectOverhead = size(Object.fromEntries(keys.map((name) => [name, null])))
    const packedOverhead = size({ [marker]: [shapes.length, keys.map(() => null)] })
    if (count * (objectOverhead - packedOverhead) <= size(keys) + 1) continue
    indexes.set(key, shapes.length)
    shapes.push(keys)
  }
  // Reuse repeated references within one encode pass only. A later call gets
  // a fresh cache, and restores continue to reconstruct independent values.
  const createEncoder = () => {
    const encoded = new WeakMap<object, unknown>()
    const keyCache = new Map<string, number | undefined>()
    const encode = (value: unknown): unknown => {
      if (!value || typeof value !== 'object') return value
      if (encoded.has(value)) return encoded.get(value)
      if (Array.isArray(value)) {
        const result = value.map(encode)
        encoded.set(value, result)
        return result
      }
      const keys = Object.keys(value)
      const record = value as Record<string, unknown>
      let hasUndefined = false
      for (let i = 0; i < keys.length; i += 1) {
        if (record[keys[i]!] === undefined) {
          hasUndefined = true
          break
        }
      }
      let index: number | undefined
      if (!hasUndefined) {
        const fastKey = keys.some((key) => key.includes('\u0000'))
          ? JSON.stringify(keys)
          : `\u0000${keys.join('\u0000')}`
        if (keyCache.has(fastKey)) {
          index = keyCache.get(fastKey)
        } else {
          index = indexes.get(JSON.stringify(keys))
          keyCache.set(fastKey, index)
        }
      }
      let result: unknown
      if (index === undefined) {
        result = Object.fromEntries(keys.map((name) => [name, encode(record[name])]))
      } else {
        const values = new Array<unknown>(keys.length)
        for (let i = 0; i < keys.length; i += 1) {
          values[i] = encode(record[keys[i]!])
        }
        result = { [marker]: [index, values] }
      }
      encoded.set(value, result)
      return result
    }
    return encode
  }
  return {
    shapes,
    encode: (value: unknown) => createEncoder()(value),
    encodeAll: (values: readonly unknown[]) => values.map(createEncoder()),
  }
}

export function createWarehouseObjectReader(
  shapes: readonly string[][],
  texts?: readonly string[],
) {
  const approvedShapes = new Map<number, readonly string[]>()
  const readText = (record: Record<string, unknown>) =>
    texts ? restoreWarehouseEvidenceTextReference(record, texts) : record
  const decode = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(decode)
    if (!value || typeof value !== 'object') return value
    const record = value as Record<string, unknown>
    if (!Object.hasOwn(record, marker)) {
      const reference = readText(record)
      return typeof reference === 'string'
        ? reference
        : Object.fromEntries(Object.entries(reference).map(([key, child]) => [key, decode(child)]))
    }
    const reference = record[marker]
    if (
      Object.keys(record).length !== 1 ||
      !Array.isArray(reference) ||
      reference.length !== 2 ||
      !Number.isInteger(reference[0]) ||
      !Array.isArray(reference[1])
    )
      throw new Error('驱动盘分析对象资料无效，请重新分析。')
    const [shapeId, values] = reference
    let keys = approvedShapes.get(shapeId)
    if (!keys) {
      const shape = shapes[shapeId]
      if (
        !Array.isArray(shape) ||
        !shape.every((key) => typeof key === 'string') ||
        new Set(shape).size !== shape.length
      )
        throw new Error('驱动盘分析对象资料无效，请重新分析。')
      keys = shape
      approvedShapes.set(shapeId, keys)
    }
    if (keys.length !== values.length) throw new Error('驱动盘分析对象资料无效，请重新分析。')
    return readText(Object.fromEntries(keys.map((key, index) => [key, decode(values[index])])))
  }
  return decode
}

export function restoreWarehouseObjects(value: unknown, shapes: readonly string[][]): unknown {
  return createWarehouseObjectReader(shapes)(value)
}
