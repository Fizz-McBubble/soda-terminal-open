import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const policyContract = 'installed-prepared-and-functional-consumer-policy/v1'
const defaultRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const policyIdentityRelative = 'src/calculation/currentPlanningConsumerPolicyIdentity32.ts'
const policyClosureRelative = 'src/calculation/currentPlanningConsumerPolicySourceClosure.v1.json'
const policyGeneratedRelative =
  'src/calculation/generated/currentPlanningConsumerPolicyIdentity32.v1.json'

function normalizedId(id) {
  return id.replaceAll('\\', '/').split('?', 1)[0]
}

/** Stable legacy identity shared with src/domain/stableContentHash.ts. */
export function stableContentHash(input) {
  const value = JSON.stringify(input)
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `fnv1a-${(hash >>> 0).toString(16)}`
}

function inside(root, filename) {
  const path = relative(root, filename)
  return path && path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path)
}

function parseClosure(source) {
  const document = JSON.parse(source)
  if (document.contract !== policyContract || !Array.isArray(document.selectors)) {
    throw new Error('community_policy_closure_shape_invalid')
  }
  const selectors = document.selectors.map((selector) => {
    if (
      typeof selector !== 'string' ||
      !selector.startsWith('.') ||
      /[*?[\]{}()!\\]/u.test(selector) ||
      !/\.(?:ts|json)$/u.test(selector)
    ) {
      throw new Error('community_policy_closure_selector_invalid')
    }
    return selector
  })
  if (!selectors.length || new Set(selectors).size !== selectors.length) {
    throw new Error('community_policy_closure_selectors_missing_or_duplicated')
  }
  return selectors
}

export function currentPlanningConsumerPolicySourceIdentity({
  root = defaultRoot,
  readSource = (filename) => readFileSync(filename, 'utf8'),
} = {}) {
  const absoluteRoot = resolve(root)
  const identityPath = resolve(absoluteRoot, policyIdentityRelative)
  const selectors = parseClosure(readSource(resolve(absoluteRoot, policyClosureRelative)))
  const sources = selectors.map((selector) => {
    const sourcePath = resolve(dirname(identityPath), selector)
    if (!inside(absoluteRoot, sourcePath)) {
      throw new Error(`community_policy_source_outside_candidate:${selector}`)
    }
    const relativePath = relative(dirname(identityPath), sourcePath).split(sep).join('/')
    const key = relativePath.startsWith('.') ? relativePath : `./${relativePath}`
    return { key, sourcePath }
  })
  if (new Set(sources.map(({ key }) => key)).size !== sources.length) {
    throw new Error('community_policy_duplicate_canonical_source')
  }

  const sourceHashes = {}
  for (const { key, sourcePath } of sources.sort((left, right) =>
    left.key.localeCompare(right.key),
  )) {
    sourceHashes[key] = stableContentHash(readSource(sourcePath).replaceAll('\r\n', '\n'))
  }
  return Object.freeze({
    identity: Object.freeze({
      contract: policyContract,
      sourceHashes: Object.freeze(sourceHashes),
    }),
    sourceFiles: Object.freeze(sources.map(({ sourcePath }) => sourcePath)),
  })
}

export function currentPlanningConsumerPolicyGeneratedPath(root = defaultRoot) {
  return resolve(root, policyGeneratedRelative)
}

function sameIdentity(left, right) {
  if (left?.contract !== right?.contract || !left?.sourceHashes || !right?.sourceHashes)
    return false
  const leftKeys = Object.keys(left.sourceHashes).sort()
  const rightKeys = Object.keys(right.sourceHashes).sort()
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] && left.sourceHashes[key] === right.sourceHashes[key],
    )
  )
}

export function assertCurrentPlanningConsumerPolicyIdentity({
  root = defaultRoot,
  readSource = (filename) => readFileSync(filename, 'utf8'),
} = {}) {
  const generatedPath = currentPlanningConsumerPolicyGeneratedPath(root)
  const generated = JSON.parse(readSource(generatedPath))
  const { identity } = currentPlanningConsumerPolicySourceIdentity({ root, readSource })
  if (!sameIdentity(generated, identity)) {
    const expectedKeys = Object.keys(identity.sourceHashes)
    const generatedKeys = new Set(Object.keys(generated.sourceHashes ?? {}))
    const changed = expectedKeys.filter(
      (key) => generated.sourceHashes?.[key] !== identity.sourceHashes[key],
    )
    const added = expectedKeys.filter((key) => !generatedKeys.has(key))
    const removed = [...generatedKeys].filter((key) => !(key in identity.sourceHashes)).sort()
    throw new Error(
      'current_planning_consumer_policy_identity_stale:' +
        JSON.stringify({ changed, added, removed }),
    )
  }
  return identity
}

export function writeCurrentPlanningConsumerPolicyIdentity({
  root = defaultRoot,
  writeSource = (filename, source) => {
    mkdirSync(dirname(filename), { recursive: true })
    writeFileSync(filename, source)
  },
} = {}) {
  const { identity } = currentPlanningConsumerPolicySourceIdentity({ root })
  writeSource(
    currentPlanningConsumerPolicyGeneratedPath(root),
    `${JSON.stringify(identity, null, 2)}\n`,
  )
  return identity
}

export function communityConsumerPolicySourceHashes({
  readSource = (filename) => readFileSync(filename, 'utf8'),
} = {}) {
  let root = defaultRoot
  const virtualIdentityId = '\0soda-current-planning-consumer-policy-identity'
  return {
    name: 'soda-community-consumer-policy-source-hashes',
    enforce: 'pre',
    apply(_config, environment) {
      return environment.isSsrBuild !== true
    },
    applyToEnvironment(environment) {
      return environment.config.consumer === 'client'
    },
    configResolved(config) {
      root = resolve(config.root)
    },
    resolveId(source, importer) {
      const candidate =
        source.startsWith('.') && importer
          ? resolve(dirname(importer), source)
          : resolve(root, source)
      return normalizedId(candidate) ===
        normalizedId(currentPlanningConsumerPolicyGeneratedPath(root))
        ? virtualIdentityId
        : null
    },
    load(id) {
      if (normalizedId(id) !== virtualIdentityId) return null
      const { sourceFiles } = currentPlanningConsumerPolicySourceIdentity({ root, readSource })
      for (const sourceFile of sourceFiles) this.addWatchFile(sourceFile)
      const identity = assertCurrentPlanningConsumerPolicyIdentity({ root, readSource })
      return { code: `export default ${JSON.stringify(identity)}`, map: null }
    },
  }
}
