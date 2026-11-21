import { createHash } from 'node:crypto'

export const sourcePackageFileLimit = 25 * 1024 * 1024
export const sourceMaterializationRecipeFile = 'SOURCE-INPUT-RECIPES.json'
export const sourceMaterializationTargets = Object.freeze([
  Object.freeze({
    target: 'src/gameDataPacks/generated/team-system-ranking.v1.json',
    chunkSizeBytes: 24 * 1024 * 1024,
  }),
])

const targetByPath = new Map(
  sourceMaterializationTargets.map((definition) => [definition.target, definition]),
)
const hashPattern = /^[a-f0-9]{64}$/u

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

export function materializationChunkPath(target, index) {
  const definition = targetByPath.get(target)
  if (!definition) throw new Error(`source_materialization_target_unsupported:${target}`)
  if (!Number.isInteger(index) || index < 0)
    throw new Error('source_materialization_chunk_index_invalid')
  return `${definition.target}.part-${String(index).padStart(3, '0')}`
}

export function splitSourceMaterializationInput(bytes, target) {
  const definition = targetByPath.get(target)
  if (!definition) throw new Error(`source_materialization_target_unsupported:${target}`)
  const value = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes)
  const chunks = []
  for (let offset = 0; offset < value.length; offset += definition.chunkSizeBytes) {
    const chunk = value.subarray(offset, Math.min(offset + definition.chunkSizeBytes, value.length))
    chunks.push({
      path: materializationChunkPath(target, chunks.length),
      bytes: chunk.length,
      sha256: sha256(chunk),
    })
  }
  return {
    target,
    targetBytes: value.length,
    targetSha256: sha256(value),
    chunkSizeBytes: definition.chunkSizeBytes,
    chunks,
  }
}

export function sourceMaterializationRecipeDocument(files) {
  return {
    schemaVersion: 1,
    mode: 'ordered-byte-concatenation',
    files,
  }
}

function exactKeys(value, expected) {
  return (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join('|') === [...expected].sort().join('|')
  )
}

export function parseSourceMaterializationRecipeDocument(bytes) {
  let document
  try {
    document = JSON.parse(Buffer.isBuffer(bytes) ? bytes.toString('utf8') : String(bytes))
  } catch {
    throw new Error('source_materialization_recipe_invalid_json')
  }
  if (
    !exactKeys(document, ['schemaVersion', 'mode', 'files']) ||
    document.schemaVersion !== 1 ||
    document.mode !== 'ordered-byte-concatenation' ||
    !Array.isArray(document.files) ||
    document.files.length !== sourceMaterializationTargets.length
  )
    throw new Error('source_materialization_recipe_invalid')

  const seenTargets = new Set()
  const recipes = document.files.map((recipe) => {
    if (!exactKeys(recipe, ['target', 'targetBytes', 'targetSha256', 'chunkSizeBytes', 'chunks']))
      throw new Error('source_materialization_recipe_invalid')
    const definition = targetByPath.get(recipe.target)
    if (!definition || seenTargets.has(recipe.target))
      throw new Error(`source_materialization_target_unsupported:${recipe.target}`)
    seenTargets.add(recipe.target)
    if (
      !Number.isInteger(recipe.targetBytes) ||
      recipe.targetBytes <= 0 ||
      typeof recipe.targetSha256 !== 'string' ||
      !hashPattern.test(recipe.targetSha256) ||
      recipe.chunkSizeBytes !== definition.chunkSizeBytes ||
      recipe.chunkSizeBytes <= 0 ||
      recipe.chunkSizeBytes > sourcePackageFileLimit ||
      !Array.isArray(recipe.chunks) ||
      !recipe.chunks.length
    )
      throw new Error(`source_materialization_recipe_invalid:${recipe.target}`)

    let bytes = 0
    const chunks = recipe.chunks.map((chunk, index) => {
      const expectedPath = materializationChunkPath(recipe.target, index)
      if (
        !exactKeys(chunk, ['path', 'bytes', 'sha256']) ||
        typeof chunk.path !== 'string' ||
        !chunk.path.startsWith(`${recipe.target}.part-`) ||
        !/\.part-\d{3}$/u.test(chunk.path) ||
        !Number.isInteger(chunk.bytes) ||
        chunk.bytes <= 0 ||
        chunk.bytes > sourcePackageFileLimit ||
        typeof chunk.sha256 !== 'string' ||
        !hashPattern.test(chunk.sha256)
      )
        throw new Error(`source_materialization_recipe_invalid:${recipe.target}`)
      if (chunk.path !== expectedPath)
        throw new Error(`source_materialization_recipe_chunk_order:${recipe.target}`)
      const expectedBytes = Math.min(recipe.chunkSizeBytes, recipe.targetBytes - bytes)
      if (chunk.bytes !== expectedBytes)
        throw new Error(`source_materialization_recipe_chunk_order:${recipe.target}`)
      bytes += chunk.bytes
      return {
        path: chunk.path,
        bytes: chunk.bytes,
        sha256: chunk.sha256,
      }
    })
    if (bytes !== recipe.targetBytes)
      throw new Error(`source_materialization_recipe_size_mismatch:${recipe.target}`)
    return {
      target: recipe.target,
      targetBytes: recipe.targetBytes,
      targetSha256: recipe.targetSha256,
      chunkSizeBytes: recipe.chunkSizeBytes,
      chunks,
    }
  })
  if (seenTargets.size !== sourceMaterializationTargets.length)
    throw new Error('source_materialization_recipe_missing_target')
  return recipes
}
