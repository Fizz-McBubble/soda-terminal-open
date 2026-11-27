import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { Plugin } from 'vite'

const dataFiles = new Map([
  [
    'current31TeamIntrinsicIndex.ts',
    ['current31-team-intrinsic-index.v1.json', 'box-startup-intrinsic.v1.json'],
  ],
  ['teamGenericRanking.ts', ['generic-team-ranking.v1.json', 'box-startup-generic.v1.json']],
  [
    'preparedBoxFormationRanking.ts',
    ['box-default-formation-ranks.3.3.json', 'box-startup-prepared.v1.json'],
  ],
])

const packedPreparedId = '\0soda-box-startup-prepared'

/** Encode repeated template fields once, keeping formation, rank and Bangboo references intact. */
export function packPreparedTemplates({
  templates,
  ...metadata
}: { templates: unknown[] } & Record<string, unknown>) {
  const first = templates[0]
  if (!first || typeof first !== 'object' || Array.isArray(first)) return null
  const keys = Object.keys(first)
  const rows = templates as Record<string, unknown>[]
  if (rows.some((row) => !row || JSON.stringify(Object.keys(row)) !== JSON.stringify(keys)))
    return null

  const columns = keys.map((key) => {
    const direct = rows.map((row) => row[key])
    const values: unknown[] = []
    const byValue = new Map<string, number>()
    const ordinals = direct.map((value) => {
      const identity = JSON.stringify(value)
      const previous = byValue.get(identity)
      if (previous !== undefined) return previous
      const ordinal = values.length
      byValue.set(identity, ordinal)
      values.push(value)
      return ordinal
    })
    if (values.length === 1) return { values }
    return values.length < rows.length / 2 ? { values, ordinals } : { values: direct }
  })

  const data = JSON.stringify({ metadata, keys, columns, rowCount: rows.length })
  return `const { metadata, keys, columns, rowCount } = JSON.parse(${JSON.stringify(data)});
const templates = Array.from({ length: rowCount }, (_, row) =>
  Object.fromEntries(keys.map((key, index) => {
    const { values, ordinals } = columns[index];
    return [key, values[ordinals ? ordinals[row] : values.length === 1 ? 0 : row]];
  }))
);
export default { ...metadata, templates };`
}

export function boxStartupIndexAliases(): Plugin {
  let packedPreparedModule: string | null = null
  return {
    name: 'soda-box-startup-index-aliases',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!importer) return null
      const filename = importer.replaceAll('\\', '/').split('/').at(-1)
      const pair = filename ? dataFiles.get(filename) : undefined
      if (!pair || source !== '../gameDataPacks/generated/' + pair[0]) return null
      const file = resolve(dirname(importer), '../gameDataPacks/generated', pair[1]!)
      if (pair[1] !== 'box-startup-prepared.v1.json') return file
      this.addWatchFile(file)
      packedPreparedModule = packPreparedTemplates(JSON.parse(readFileSync(file, 'utf8')))
      return packedPreparedModule ? packedPreparedId : file
    },
    load(id) {
      return id === packedPreparedId ? packedPreparedModule : null
    },
  }
}
