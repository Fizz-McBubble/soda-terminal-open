import { registerHooks } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
// Extension resolution only: no source transformation, mocks or import replacements.
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === '@soda/visual-asset-manifest')
      return next(
        new URL('../../src/assets/visualAssetManifestLocal.ts', import.meta.url).href,
        context,
      )
    if (
      specifier.startsWith('.') &&
      context.parentURL &&
      !/\.(?:[cm]?js|tsx?|json)$/.test(specifier)
    ) {
      const candidate = new URL(specifier + '.ts', context.parentURL)
      if (existsSync(fileURLToPath(candidate))) return next(candidate.href, context)
    }
    return next(specifier, context)
  },
  load(url, context, next) {
    if (url.endsWith('.json')) {
      const value = JSON.parse(readFileSync(fileURLToPath(url), 'utf8'))
      return {
        format: 'module',
        shortCircuit: true,
        source: `export default ${JSON.stringify(value)};`,
      }
    }
    return next(url, context)
  },
})
