import { restoreWarehouseEvidenceTextReference } from './publicWarehouseEvidenceTextTransport'

const marker = '$o'
const encoder = new TextEncoder()
const size = (value: unknown) => encoder.encode(JSON.stringify(value)).byteLength

/** Share repeated object field names on the wire without dropping any values. */
export function warehouseObjectCodec(input: readonly unknown[]) {
  const counts = new Map<string, number>()
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) return value.forEach(visit)
    if (!value || typeof value !== 'object') return
    if (Object.hasOwn(value, marker)) throw new Error('驱动盘分析对象格式无效。')
    const entries = Object.entries(value)
    if (entries.every(([, child]) => child !== undefined)) {
      const key = JSON.stringify(entries.map(([name]) => name))
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    entries.forEach(([, child]) => visit(child))
  }
  input.forEach(visit)
  const shapes: string[][] = []
  const indexes = new Map<string, number>()
  for (const [key, count] of counts) {
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
    const encode = (value: unknown): unknown => {
      if (!value || typeof value !== 'object') return value
      if (encoded.has(value)) return encoded.get(value)
      if (Array.isArray(value)) {
        const result = value.map(encode)
        encoded.set(value, result)
        return result
      }
      const entries = Object.entries(value)
      const index = entries.every(([, child]) => child !== undefined)
        ? indexes.get(JSON.stringify(entries.map(([name]) => name)))
        : undefined
      const result =
        index === undefined
          ? Object.fromEntries(entries.map(([name, child]) => [name, encode(child)]))
          : { [marker]: [index, entries.map(([, child]) => encode(child))] }
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
