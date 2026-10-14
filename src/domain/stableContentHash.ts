/** Stable legacy content identity shared by public contracts and local data. */
export function stableContentHash(input: unknown) {
  const value = JSON.stringify(input)
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `fnv1a-${(hash >>> 0).toString(16)}`
}
