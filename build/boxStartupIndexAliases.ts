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

export function boxStartupIndexAliases(): Plugin {
  return {
    name: 'soda-box-startup-index-aliases',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!importer) return null
      const filename = importer.replaceAll('\\', '/').split('/').at(-1)
      const pair = filename ? dataFiles.get(filename) : undefined
      if (!pair || source !== '../gameDataPacks/generated/' + pair[0]) return null
      return resolve(dirname(importer), '../gameDataPacks/generated', pair[1]!)
    },
  }
}
