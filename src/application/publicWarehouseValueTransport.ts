const marker = '$v'

type PackedNode =
  | { kind: 'primitive'; value: unknown; key: string; bytes: number }
  | { kind: 'array'; items: PackedNode[]; key: string; bytes: number }
  | { kind: 'object'; keys: string[]; values: PackedNode[]; key: string; bytes: number }

const textEncoder = new TextEncoder()
const byteLen = (text: string) => textEncoder.encode(text).byteLength

/**
 * Lossless wire-only deduplication of repeated packed objects and arrays (v4).
 * Uses bottom-up structural IDs so encoding is O(N) without re-stringifying subtrees,
 * and sharedValues are emitted in topological order (entry i only references < i).
 */
export function warehouseValueCodec(input: readonly unknown[]) {
  const keyToId = new Map<string, number>()
  const nodesById: PackedNode[] = []
  const counts: number[] = []
  const seenObjects = new WeakMap<object, number>()

  const register = (node: PackedNode): number => {
    const existing = keyToId.get(node.key)
    if (existing !== undefined) return existing
    const id = nodesById.length
    keyToId.set(node.key, id)
    nodesById.push(node)
    counts.push(0)
    return id
  }

  const build = (value: unknown): number => {
    if (value === null || typeof value !== 'object') {
      const json = JSON.stringify(value)
      return register({
        kind: 'primitive',
        value,
        key: `p:${typeof value}:${json}`,
        bytes: json ? byteLen(json) : 4,
      })
    }
    const cached = seenObjects.get(value)
    if (cached !== undefined) return cached
    if (Array.isArray(value)) {
      const childIds: number[] = new Array(value.length)
      const items: PackedNode[] = new Array(value.length)
      let bytes = 2
      for (let i = 0; i < value.length; i += 1) {
        const cid = build(value[i])
        childIds[i] = cid
        items[i] = nodesById[cid]!
        bytes += items[i]!.bytes + (i > 0 ? 1 : 0)
      }
      const id = register({
        kind: 'array',
        items,
        key: `a:[${childIds.join(',')}]`,
        bytes,
      })
      seenObjects.set(value, id)
      return id
    }
    if (Object.hasOwn(value, marker)) throw new Error('驱动盘分析共享值格式无效。')
    const record = value as Record<string, unknown>
    const rawKeys = Object.keys(record)
    const keys: string[] = []
    const values: PackedNode[] = []
    const parts: string[] = []
    let bytes = 2
    for (let i = 0; i < rawKeys.length; i += 1) {
      const k = rawKeys[i]!
      const child = record[k]
      if (child === undefined) continue
      const cid = build(child)
      keys.push(k)
      values.push(nodesById[cid]!)
      parts.push(`${JSON.stringify(k)}:${cid}`)
      bytes += byteLen(JSON.stringify(k)) + 1 + nodesById[cid]!.bytes + (keys.length > 1 ? 1 : 0)
    }
    const id = register({
      kind: 'object',
      keys,
      values,
      key: `o:{${parts.join(',')}}`,
      bytes,
    })
    seenObjects.set(value, id)
    return id
  }

  const rootIds = input.map(build)

  // Propagate exact occurrence counts top-down in reverse topological order.
  // Each unique structural ID is visited at most once regardless of reference sharing.
  for (const id of rootIds) counts[id] = (counts[id] ?? 0) + 1
  for (let id = nodesById.length - 1; id >= 0; id -= 1) {
    const c = counts[id]!
    if (c === 0) continue
    const node = nodesById[id]!
    if (node.kind === 'array') {
      for (const child of node.items) {
        const cid = keyToId.get(child.key)!
        counts[cid] = (counts[cid] ?? 0) + c
      }
    } else if (node.kind === 'object') {
      for (const child of node.values) {
        const cid = keyToId.get(child.key)!
        counts[cid] = (counts[cid] ?? 0) + c
      }
    }
  }

  // Decide which composite nodes shrink wire bytes when promoted to sharedValues.
  // Skip tiny `$t` / `$o` wrapper objects whose serialized form is already smaller than `{"$v":N}`.
  const sharedIndexById = new Map<number, number>()
  const sharedValues: unknown[] = []
  const refObjects: Record<string, number>[] = []

  const materialize = (id: number, allowSelfRef: boolean): unknown => {
    if (allowSelfRef) {
      const refIdx = sharedIndexById.get(id)
      if (refIdx !== undefined) return refObjects[refIdx]
    }
    const node = nodesById[id]!
    if (node.kind === 'primitive') return node.value
    if (node.kind === 'array') {
      const out = new Array<unknown>(node.items.length)
      for (let i = 0; i < node.items.length; i += 1) {
        out[i] = materialize(keyToId.get(node.items[i]!.key)!, true)
      }
      return out
    }
    return Object.fromEntries(
      node.keys.map((key, index) => [
        key,
        materialize(keyToId.get(node.values[index]!.key)!, true),
      ]),
    )
  }

  for (let id = 0; id < nodesById.length; id += 1) {
    const node = nodesById[id]!
    if (node.kind === 'primitive') continue
    const c = counts[id]!
    if (c <= 1) continue
    // Do not intern the top-level action rows themselves unless truly repeated;
    // also skip `$t` references and tiny arrays/objects that cannot beat `{"$v":N}`.
    if (node.kind === 'object' && node.keys.length === 1 && node.keys[0] === '$t') continue
    const refBytes = 7 + String(sharedValues.length).length // {"\$v":N}
    if (node.bytes <= refBytes + 2) continue
    const materialized = materialize(id, false)
    const entryBytes = byteLen(JSON.stringify(materialized))
    if (c * (entryBytes - refBytes) > entryBytes + 1) {
      const sharedIdx = sharedValues.length
      sharedValues.push(materialized)
      refObjects.push({ [marker]: sharedIdx })
      sharedIndexById.set(id, sharedIdx)
    }
  }

  return {
    sharedValues,
    packed: rootIds.map((id) => materialize(id, true)),
  }
}

function deepClone(value: unknown): unknown {
  if (Array.isArray(value)) {
    const out = new Array<unknown>(value.length)
    for (let i = 0; i < value.length; i += 1) out[i] = deepClone(value[i])
    return out
  }
  if (!value || typeof value !== 'object') return value
  const record = value as Record<string, unknown>
  return Object.fromEntries(Object.entries(record).map(([key, child]) => [key, deepClone(child)]))
}

/** Expand v4 `$v` references into fresh independent objects before object/text restoration. */
export function createWarehouseValueExpander(sharedValues: readonly unknown[]) {
  if (!Array.isArray(sharedValues)) throw new Error('驱动盘分析共享值资料无效，请重新分析。')
  const expandedTable: unknown[] = new Array(sharedValues.length)

  const expand = (value: unknown, maxAllowedIndex: number): unknown => {
    if (Array.isArray(value)) {
      const out = new Array<unknown>(value.length)
      for (let i = 0; i < value.length; i += 1) out[i] = expand(value[i], maxAllowedIndex)
      return out
    }
    if (!value || typeof value !== 'object') return value
    const record = value as Record<string, unknown>
    if (Object.hasOwn(record, marker)) {
      const idx = record[marker]
      if (
        Object.keys(record).length !== 1 ||
        typeof idx !== 'number' ||
        !Number.isInteger(idx) ||
        idx < 0 ||
        idx >= maxAllowedIndex
      )
        throw new Error('驱动盘分析共享值资料无效，请重新分析。')
      return deepClone(expandedTable[idx])
    }
    return Object.fromEntries(
      Object.entries(record).map(([key, child]) => [key, expand(child, maxAllowedIndex)]),
    )
  }

  for (let i = 0; i < sharedValues.length; i += 1) {
    // Topological guarantee: entry i may only reference entries < i (no cycles).
    expandedTable[i] = expand(sharedValues[i], i)
  }

  return (value: unknown) => expand(value, sharedValues.length)
}
