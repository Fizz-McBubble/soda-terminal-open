import { registerHooks } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { assertCurrentPlanningConsumerPolicyIdentity } from '../../build/communityConsumerPolicySourceHashes.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const policyUrl = new URL(
  '../../src/calculation/generated/currentPlanningConsumerPolicyIdentity32.v1.json',
  import.meta.url,
).href

// Node reads the generated policy data through the same source check as the browser build.
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
      const value =
        url === policyUrl
          ? assertCurrentPlanningConsumerPolicyIdentity({ root })
          : JSON.parse(readFileSync(fileURLToPath(url), 'utf8'))
      return {
        format: 'module',
        shortCircuit: true,
        source: `export default ${JSON.stringify(value)};`,
      }
    }
    return next(url, context)
  },
})
