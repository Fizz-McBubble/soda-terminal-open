import type { WarehouseActionProjection } from './warehouseActionContract'

export const browserWarehouseGraphContract = 'soda-browser-warehouse-graph/v1' as const

type BrowserWarehouseGraph = {
  contract: typeof browserWarehouseGraphContract
  cells: Int32Array<ArrayBuffer>
  root: number
  shapes: string[][]
  strings: string[]
  numbers: Float64Array<ArrayBuffer>
}

const undefinedRef = -1
const nullRef = -2
const falseRef = -3
const trueRef = -4
const holeRef = -5
const negativeZeroRef = -6
const stringRef = -7
const numberRef = -8
const arrayLayout = -1
const invalidGraph = () => new Error('驱动盘分析回传格式无效，请重新分析。')

export function isBrowserWarehouseGraph(value: unknown): value is BrowserWarehouseGraph {
  return (
    typeof value === 'object' &&
    value !== null &&
    'contract' in value &&
    value.contract === browserWarehouseGraphContract
  )
}

/** Pack plain result records once, preserving shared references in postorder. */
export function packBrowserWarehouseGraph(
  projection: WarehouseActionProjection,
): BrowserWarehouseGraph {
  let cells = new Int32Array(4096)
  let used = 0
  let nextNode = 0
  const objectRefs = new WeakMap<object, number>()
  const shapes: string[][] = []
  const shapeRefs = new Map<string, number>()
  const strings: string[] = []
  const stringRefs = new Map<string, number>()
  const numbers: number[] = []
  const numberRefs = new Map<number, number>()

  function intern<T>(value: T, refs: Map<T, number>, table: T[], first: number) {
    const existing = refs.get(value)
    if (existing !== undefined) return existing
    const ref = first - 2 * table.length
    table.push(value)
    refs.set(value, ref)
    return ref
  }

  function appendRecord(layout: number, refs: number[]) {
    const required = used + refs.length + (layout === arrayLayout ? 2 : 1)
    if (required > cells.length) {
      const expanded = new Int32Array(Math.max(cells.length * 2, required))
      expanded.set(cells)
      cells = expanded
    }
    cells[used++] = layout
    if (layout === arrayLayout) cells[used++] = refs.length
    cells.set(refs, used)
    used += refs.length
    return nextNode++
  }

  function encode(value: unknown): number {
    if (value === undefined) return undefinedRef
    if (value === null) return nullRef
    if (typeof value === 'boolean') return value ? trueRef : falseRef
    if (typeof value === 'string') return intern(value, stringRefs, strings, stringRef)
    if (typeof value === 'number')
      return Object.is(value, -0) ? negativeZeroRef : intern(value, numberRefs, numbers, numberRef)
    if (typeof value !== 'object') throw invalidGraph()

    const existing = objectRefs.get(value)
    if (existing !== undefined) {
      if (existing === -1) throw invalidGraph()
      return existing
    }
    objectRefs.set(value, -1)
    let ref: number
    if (Array.isArray(value)) {
      const refs = new Array<number>(value.length)
      for (let index = 0; index < refs.length; index += 1)
        refs[index] = Object.hasOwn(value, index) ? encode(value[index]) : holeRef
      ref = appendRecord(arrayLayout, refs)
    } else {
      const record = value as Record<string, unknown>
      const prototype: unknown = Object.getPrototypeOf(record)
      if (prototype !== null && prototype !== Object.prototype) throw invalidGraph()
      const keys = Object.keys(record)
      const signature = keys.some((key) => key.includes('\u0000'))
        ? JSON.stringify(keys)
        : '\u0000' + keys.length + '\u0000' + keys.join('\u0000')
      let layout = shapeRefs.get(signature)
      if (layout === undefined) {
        layout = shapes.length
        shapes.push(keys)
        shapeRefs.set(signature, layout)
      }
      ref = appendRecord(layout, keys.map((key) => encode(record[key])))
    }
    objectRefs.set(value, ref)
    return ref
  }

  const root = encode(projection)
  return {
    contract: browserWarehouseGraphContract,
    cells: cells.slice(0, used),
    root,
    shapes,
    strings,
    numbers: Float64Array.from(numbers),
  }
}

export function unpackBrowserWarehouseGraph(
  graph: BrowserWarehouseGraph,
): WarehouseActionProjection {
  const { cells, root, shapes, strings, numbers } = graph
  if (
    !ArrayBuffer.isView(cells) ||
    Object.prototype.toString.call(cells) !== '[object Int32Array]' ||
    !ArrayBuffer.isView(numbers) ||
    Object.prototype.toString.call(numbers) !== '[object Float64Array]' ||
    !Array.isArray(strings) ||
    strings.some((value) => typeof value !== 'string') ||
    !Array.isArray(shapes) ||
    shapes.some(
      (keys) =>
        !Array.isArray(keys) ||
        keys.some((key) => typeof key !== 'string') ||
        new Set(keys).size !== keys.length,
    ) ||
    !Number.isSafeInteger(root) ||
    root < 0
  )
    throw invalidGraph()

  const objects: object[] = []
  const valueOf = (ref: number) => {
    if (ref >= 0) {
      if (ref >= objects.length) throw invalidGraph()
      return objects[ref]
    }
    if (ref === undefinedRef) return undefined
    if (ref === nullRef) return null
    if (ref === falseRef) return false
    if (ref === trueRef) return true
    if (ref === negativeZeroRef) return -0
    if (ref === holeRef) throw invalidGraph()
    const text = ref % 2 !== 0
    const index = ((text ? stringRef : numberRef) - ref) / 2
    const values = text ? strings : numbers
    if (index < 0 || index >= values.length) throw invalidGraph()
    return values[index]
  }

  let cursor = 0
  while (cursor < cells.length) {
    const layout = cells[cursor++]!
    if (layout === arrayLayout) {
      if (cursor === cells.length) throw invalidGraph()
      const length = cells[cursor++]!
      if (length < 0 || length > cells.length - cursor) throw invalidGraph()
      const array = new Array<unknown>(length)
      for (let index = 0; index < length; index += 1) {
        const ref = cells[cursor++]!
        if (ref !== holeRef) array[index] = valueOf(ref)
      }
      objects.push(array)
    } else {
      const keys = shapes[layout]
      if (!keys || keys.length > cells.length - cursor) throw invalidGraph()
      const record: Record<string, unknown> = {}
      for (const key of keys) {
        const value = valueOf(cells[cursor++]!)
        if (key === '__proto__')
          Object.defineProperty(record, key, {
            value,
            enumerable: true,
            writable: true,
            configurable: true,
          })
        else record[key] = value
      }
      objects.push(record)
    }
  }

  const projection = objects[root] as WarehouseActionProjection | undefined
  if (
    root !== objects.length - 1 ||
    !projection ||
    !Array.isArray(projection.actions) ||
    typeof projection.runId !== 'string' ||
    typeof projection.accountId !== 'string' ||
    typeof projection.fingerprint !== 'string' ||
    projection.sideEffect !== 'read_only'
  )
    throw invalidGraph()
  return projection
}
