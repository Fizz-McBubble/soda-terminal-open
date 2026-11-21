import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

// These public downloads are also build-time release facts. Bind their exact
// bytes as modules so Vite dev does not serve raw JSON as JavaScript.
export function scannerReleaseManifests() {
  const prefix = '\0soda-scanner-release:'
  const names = ['scanner-runtime-release.v1.json', 'scanner-installer-release.v1.json']
  let root
  return {
    name: 'soda-scanner-release-manifests',
    enforce: 'pre',
    configResolved(config) {
      root = config.root
    },
    resolveId(source, importer) {
      if (source.startsWith(prefix) && names.some((name) => source === `${prefix}${name}.js`))
        return source
      if (!importer || !names.some((name) => source.endsWith(`/${name}`))) return null
      const file = resolve(dirname(importer), source)
      const name = names.find((name) => file === resolve(root, 'public/downloads', name))
      return name ? `${prefix}${name}.js` : null
    },
    load(id) {
      if (!id.startsWith(prefix)) return null
      const name = id.slice(prefix.length, -3)
      if (!names.includes(name)) return null
      const file = resolve(root, 'public/downloads', name)
      this.addWatchFile(file)
      return `export default ${JSON.stringify(JSON.parse(readFileSync(file, 'utf8')))};`
    },
  }
}
