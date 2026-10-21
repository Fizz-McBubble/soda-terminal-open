import LZString from 'lz-string'
/** Lossless shared JSON nodes. Build-time deduplication; runtime only decodes a selected row. */
export type TeamIndexNode = [0, string | number | boolean | null] | [1 | 2, number[]]
export function createTeamIndexPayloadWriter() {
  const nodes: TeamIndexNode[] = []
  const ids = new Map<string, number>()
  const add = (value: unknown): number => {
    let node: TeamIndexNode
    if (Array.isArray(value)) node = [1, value.map(add)]
    else if (value !== null && typeof value === 'object') {
      node = [
        2,
        Object.entries(value)
          .filter(([, v]) => v !== undefined)
          .flatMap(([key, v]) => [add(key), add(v)]),
      ]
    } else if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'boolean' ||
      (typeof value === 'number' && Number.isFinite(value))
    )
      node = [0, value]
    else throw new Error('榜单包含不可序列化的值。')
    const key = JSON.stringify(node)
    const prior = ids.get(key)
    if (prior !== undefined) return prior
    const id = nodes.length
    nodes.push(node)
    ids.set(key, id)
    return id
  }
  return { nodes, add }
}

export function createTeamIndexPayloadReader(nodes: readonly TeamIndexNode[]) {
  // Children always precede their parent. Reject cycles and unsafe object keys.
  for (const [id, node] of nodes.entries()) {
    if (!Array.isArray(node) || node.length !== 2 || ![0, 1, 2].includes(node[0]))
      throw new Error('榜单详情节点无效。')
    if (
      node[0] === 0 &&
      node[1] !== null &&
      typeof node[1] !== 'string' &&
      typeof node[1] !== 'boolean' &&
      !(typeof node[1] === 'number' && Number.isFinite(node[1]))
    )
      throw new Error('榜单详情值无效。')
    if (
      node[0] !== 0 &&
      (!Array.isArray(node[1]) ||
        node[1].some((child) => !Number.isInteger(child) || child < 0 || child >= id) ||
        (node[0] === 2 && node[1].length % 2 !== 0))
    )
      throw new Error('榜单详情引用无效。')
  }
  const read = (id: number): unknown => {
    const node = nodes[id]
    if (!node) throw new Error('榜单详情缺失。')
    if (node[0] === 0) return node[1]
    if (node[0] === 1) return node[1].map(read)
    const object: Record<string, unknown> = {}
    for (let n = 0; n < node[1].length; n += 2) {
      const key = read(node[1][n]!)
      if (typeof key !== 'string' || ['__proto__', 'constructor', 'prototype'].includes(key))
        throw new Error('榜单详情字段无效。')
      object[key] = read(node[1][n + 1]!)
    }
    return object
  }
  return read
}

/** Versioned lossless transport; uses the existing pinned codec. */
export function packTeamIndexNodes(nodes: readonly TeamIndexNode[]) {
  return LZString.compressToBase64(JSON.stringify(nodes))
}
export function unpackTeamIndexNodes(data: string): TeamIndexNode[] {
  return JSON.parse(LZString.decompressFromBase64(data)) as TeamIndexNode[]
}
