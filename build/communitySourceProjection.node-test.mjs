import assert from 'node:assert/strict'
import { agentMechanicCalculationIdentity } from '../src/calculation/agentMechanicCalculationIdentity.ts'
import test from 'node:test'
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { build, loadConfigFromFile } from 'vite'
import { stableContentHash } from '../src/domain/stableContentHash.ts'
import ts from 'typescript'
import {
  communityConsumerPolicySourceHashes,
  currentPlanningConsumerPolicySourceIdentity,
} from './communityConsumerPolicySourceHashes.mjs'
import {
  hasPrivateCommunityLocator,
  projectCommunitySourceText,
} from './communitySourceProjection.mjs'

test('artifact locator scan distinguishes a ternary regex boundary from private paths', () => {
  const code =
    'const check=(a,n,r,i)=>a===`/development`?n!==`local`||!r' +
    ':/^\\/development\\/[^/]+\\/loadouts$/.test(a)?!i:true'
  assert.equal(hasPrivateCommunityLocator(code, 'bundle.js'), false)
  const path = ['F:', 'maintainer', 'private.json'].join('/')
  assert.equal(
    hasPrivateCommunityLocator(`${code};const secret=${JSON.stringify(path)}`, 'bundle.js'),
    true,
  )
  assert.equal(hasPrivateCommunityLocator(`${code};/* ${path} */`, 'bundle.js'), true)
  assert.equal(
    hasPrivateCommunityLocator(`const bad = ; ${JSON.stringify(path)}`, 'bundle.js'),
    true,
  )
  assert.equal(hasPrivateCommunityLocator(path, 'data.json'), true)
})

test('public HTTPS sources remain intact while maintainer paths are projected', () => {
  const source = JSON.stringify({
    remoteUrl: 'https://fastcdn.hoyoverse.com/content-v2/nap/image.png',
    sourcePath: ['F:', 'maintainer', 'research', 'source.json'].join('/'),
    unixPath: ['', 'home', 'maintainer', 'research', 'source.json'].join('/'),
  })
  const projected = JSON.parse(projectCommunitySourceText(source, 'catalog.json'))
  assert.equal(projected.remoteUrl, 'https://fastcdn.hoyoverse.com/content-v2/nap/image.png')
  assert.match(projected.sourcePath, /^soda-source-ref:[a-f0-9]{32}$/u)
  assert.match(projected.unixPath, /^soda-source-ref:[a-f0-9]{32}$/u)
  assert.equal(hasPrivateCommunityLocator(projected.remoteUrl), false)
  assert.equal(hasPrivateCommunityLocator(JSON.stringify(projected)), false)
})

test('minified ternary syntax is not mistaken for a drive path', () => {
  assert.equal(hasPrivateCommunityLocator('const x=c?o:/时使用/.test(text)'), false)
  assert.equal(
    hasPrivateCommunityLocator(
      `const sourcePath="${['F:', 'maintainer', 'source.json'].join('/')}"`,
    ),
    true,
  )
})

test('mapped-stat identity survives moving the upstream checkout between drives', () => {
  const suffix = 'libs/zzz/stats/src/mappedStats/char/maps/Yixuan.ts'
  const project = (prefix) =>
    JSON.parse(
      projectCommunitySourceText(
        JSON.stringify({
          mappedStatsPath: `${prefix}/${suffix}`,
          mappedStatsSha256: 'retained-byte-pin',
          allStatPath: `${prefix}/libs/zzz/stats/src/allStat_gen.json`,
          unrelatedPath: `${prefix}/private/notes.json`,
        }),
        'catalog.json',
      ),
    )
  for (const prefix of [
    ['..', 'outputs', '3.2-update', 'upstream'].join('/'),
    ['F:', 'derived', 'upstream'].join('/'),
    ['E:', 'scratch', 'source'].join('\\'),
  ]) {
    const projected = project(prefix)
    assert.equal(projected.mappedStatsPath, suffix)
    assert.equal(projected.allStatPath, 'libs/zzz/stats/src/allStat_gen.json')
    assert.equal(projected.mappedStatsSha256, 'retained-byte-pin')
    assert.match(projected.unrelatedPath, /^soda-source-ref:[a-f0-9]{32}$/u)
    assert.equal(hasPrivateCommunityLocator(JSON.stringify(projected)), false)
  }
  const forged = JSON.parse(
    projectCommunitySourceText(
      JSON.stringify({ mappedStatsPath: ['F:', 'private', 'Yixuan.ts'].join('/') }),
      'catalog.json',
    ),
  )
  assert.match(forged.mappedStatsPath, /^soda-source-ref:[a-f0-9]{32}$/u)
})

test('private locators in generated and inline comments are omitted without changing code', () => {
  const locator = (separator) => ['docs', 'audits', 'private-review'].join(separator)
  const source = [
    `/* Generated from ${locator('\\')}\\profiles.ndjson. */`,
    'export function value() {',
    `  return /* source: ${locator('/')}/input.json */ 42`,
    '}',
    '// Public implementation note remains available.',
    'export const count = 3',
    '',
  ].join('\n')
  const projected = projectCommunitySourceText(source, 'profiles.ts')
  assert.doesNotMatch(projected, /docs[\\/]audits[\\/]/u)
  assert.match(projected, /Public implementation note remains available/u)
  const emit = (code) =>
    ts.transpileModule(code, { compilerOptions: { removeComments: true } }).outputText
  assert.equal(emit(projected), emit(source))
  assert.equal(projectCommunitySourceText(projected, 'profiles.ts'), projected)
  const newline = `export function value() { return /* ${locator('/')}\n */ 42 }`
  assert.equal(emit(projectCommunitySourceText(newline, 'newline.ts')), emit(newline))
})

test('the actual reviewed Bangboo source projection preserves every lineup and its bound hash', async () => {
  const filename = new URL(
    '../src/gameDataPacks/generated/current31-reviewed-bangboo-source-atoms.ts',
    import.meta.url,
  )
  const projected = projectCommunitySourceText(readFileSync(filename, 'utf8'), filename.pathname)
  const javascript = ts.transpileModule(projected, {
    compilerOptions: { module: ts.ModuleKind.ESNext },
  }).outputText
  const { current31ReviewedBangbooSourceAtoms: atoms } = await import(
    `data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`
  )
  const { contentHash, runtimeContentHash, ...content } = atoms
  const serialized = JSON.stringify(content)
  let hash = 2166136261
  for (let i = 0; i < serialized.length; i++) {
    hash ^= serialized.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  assert.equal(contentHash, '2C062BFF6E30688B7F76BF5A4AF5BFF0CFDAA7BE8BD2005FE3F5A4890582D93D')
  assert.equal(runtimeContentHash, 'fnv1a-ea59dd18')
  assert.equal(`fnv1a-${(hash >>> 0).toString(16)}`, 'fnv1a-b999d7d6')
  assert.equal(atoms.sourceCensus.path, 'soda-source-ref:db1f4aee049727cb508b6cba3a4a9e46')
  assert.equal(atoms.atoms.length, 14)
  assert(
    atoms.atoms.some(
      (row) =>
        JSON.stringify(row.lineup) ===
        JSON.stringify(['agent-nicole', 'agent-billy', 'agent-anby', 'bangboo-amillion']),
    ),
  )
  assert.equal(hasPrivateCommunityLocator(projected), false)
})

function normalizedSourceHash(source) {
  let hash = 2166136261
  const normalized = source.replaceAll('\r\n', '\n')
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16)
}

test('safe JSON retains exact formatting and policy-source identity through repeated projection', () => {
  const source = '{\r\n  "rule": {"value": 3, "url": "https://example.com/source"}\r\n}\r\n'
  const projected = projectCommunitySourceText(source, 'rule.json')
  assert.equal(projected, source)
  assert.equal(projectCommunitySourceText(projected, 'rule.json'), source)
  assert.equal(normalizedSourceHash(projected), normalizedSourceHash(source))
  const changed = source.replace('"value": 3', '"value": 4')
  assert.notEqual(
    normalizedSourceHash(projectCommunitySourceText(changed, 'rule.json')),
    normalizedSourceHash(source),
  )
})

test('3.3 mixed mechanic identity survives real public projection and still binds source bytes and parameters', () => {
  const records = [
    ...JSON.parse(
      readFileSync(
        new URL(
          '../src/gameDataPacks/generated/current-agent-mechanic-catalog.v1.json',
          import.meta.url,
        ),
        'utf8',
      ),
    ).items,
    JSON.parse(
      readFileSync(
        new URL('../src/gameDataPacks/data/phoenix-event-contract.3.3.json', import.meta.url),
        'utf8',
      ),
    ),
  ]
  const original = JSON.stringify(records)
  const publicText = projectCommunitySourceText(original, 'mixed.json')
  const publicRecords = JSON.parse(publicText)
  assert.equal(projectCommunitySourceText(publicText, 'mixed.json'), publicText)
  assert.equal(hasPrivateCommunityLocator(publicText), false)
  // Public exports are already redacted. Exercise redaction on an independent
  // real-data clone with one explicitly synthetic private retrieval hint.
  const privateRecords = structuredClone(records)
  privateRecords.at(-1).source.statsPath = ['C:', 'synthetic-private-fixture', 'stats.json'].join(
    '/',
  )
  const redactedRecords = JSON.parse(
    projectCommunitySourceText(JSON.stringify(privateRecords), 'mixed.json'),
  )
  assert.notDeepEqual(
    redactedRecords,
    privateRecords,
    'The real-data clone with a synthetic locator must exercise locator redaction',
  )
  assert.match(redactedRecords.at(-1).source.statsPath, /^soda-source-ref:[a-f0-9]{32}$/u)
  assert.equal(hasPrivateCommunityLocator(JSON.stringify(redactedRecords)), false)
  const identity = (rows) => rows.map(agentMechanicCalculationIdentity)
  assert.deepEqual(identity(privateRecords), identity(records))
  assert.deepEqual(identity(redactedRecords), identity(records))
  assert.deepEqual(identity(publicRecords), identity(records))
  assert.equal(JSON.stringify(records), original)
  const changedSource = structuredClone(publicRecords)
  changedSource.at(-1).source.formulaSha256 = 'F'.repeat(64)
  assert.notDeepEqual(identity(changedSource), identity(records))
  const changedParameters = structuredClone(publicRecords)
  changedParameters.at(-1).baseStats.atk = 999999
  assert.notDeepEqual(identity(changedParameters), identity(records))
  const changedProvenance = structuredClone(publicRecords)
  changedProvenance.at(-1).source.commit = 'different-source-commit'
  assert.notDeepEqual(identity(changedProvenance), identity(records))
})

test('production compilation retains every installed consumer-policy source hash', async () => {
  const { identityUrl, paths, expected } = policySourceContract()
  assert(paths.length > 0)
  const scratch = mkdtempSync(join(tmpdir(), 'soda-compiled-policy-'))
  const entry = join(scratch, 'entry.mjs')
  writeFileSync(entry, "export { currentPlanningConsumerPolicyIdentity32 } from 'policy-source';\n")
  await build({
    root: fileURLToPath(new URL('..', import.meta.url)),
    configFile: false,
    logLevel: 'silent',
    resolve: { alias: { 'policy-source': fileURLToPath(identityUrl) } },
    build: {
      outDir: join(scratch, 'dist'),
      reportCompressedSize: false,
      lib: { entry, formats: ['es'], fileName: () => 'policy.mjs' },
    },
  })
  const { currentPlanningConsumerPolicyIdentity32: installed } = await import(
    pathToFileURL(join(scratch, 'dist/policy.mjs'))
  )
  assert.deepEqual(installed.sourceHashes, expected)
})

test('the installed consumer-policy closure keeps identity through repeated public projection', () => {
  const root = fileURLToPath(new URL('..', import.meta.url))
  const sourceFiles = currentPlanningConsumerPolicySourceIdentity({ root }).sourceFiles
  assert(sourceFiles.length > 0)
  let installedSources = 0
  let redactedSources = 0
  for (const filename of sourceFiles) {
    const source = readFileSync(filename, 'utf8')
    installedSources++
    const projected = projectCommunitySourceText(source, filename)
    const sourceHash = normalizedSourceHash(source)
    const projectedHash = normalizedSourceHash(projected)
    if (!hasPrivateCommunityLocator(source)) assert.equal(projectedHash, sourceHash, filename)
    if (projectedHash !== sourceHash) {
      assert(hasPrivateCommunityLocator(source), 'only private locators may change identity')
      redactedSources++
    }
    const repeated = projectCommunitySourceText(projected, filename)
    assert.equal(normalizedSourceHash(repeated), projectedHash, filename)
  }
  assert(installedSources > 0, 'the installed consumer-policy closure must not be empty')
  assert.equal(
    installedSources,
    sourceFiles.length,
    'every declared policy input must be installed',
  )
  console.info({ installedSources, redactedSources })
})

function policySourceContract() {
  const identityUrl = new URL(
    '../src/calculation/currentPlanningConsumerPolicyIdentity32.ts',
    import.meta.url,
  )
  const root = fileURLToPath(new URL('..', import.meta.url))
  const identity = currentPlanningConsumerPolicySourceIdentity({ root }).identity
  const paths = Object.keys(identity.sourceHashes).sort((left, right) => left.localeCompare(right))
  assert(paths.length > 0)
  return {
    identityUrl,
    paths,
    expected: identity.sourceHashes,
  }
}

async function compilePolicySource(plugin) {
  const { identityUrl } = policySourceContract()
  const scratch = mkdtempSync(join(tmpdir(), 'soda-compiled-policy-plugin-'))
  const entry = join(scratch, 'entry.mjs')
  const outDir = join(scratch, 'dist')
  writeFileSync(entry, "export { currentPlanningConsumerPolicyIdentity32 } from 'policy-source';\n")
  const result = await build({
    root: fileURLToPath(new URL('..', import.meta.url)),
    configFile: false,
    cacheDir: join(scratch, 'vite-cache'),
    logLevel: 'silent',
    plugins: plugin ? [plugin] : [],
    resolve: { alias: { 'policy-source': fileURLToPath(identityUrl) } },
    build: {
      outDir,
      reportCompressedSize: false,
      lib: { entry, formats: ['es'], fileName: () => 'policy.mjs' },
    },
  })
  const filename = join(outDir, 'policy.mjs')
  const { currentPlanningConsumerPolicyIdentity32 } = await import(pathToFileURL(filename))
  const bundles = Array.isArray(result) ? result : [result]
  const outputs = bundles.flatMap((bundle) =>
    Array.isArray(bundle.output) ? bundle.output : [bundle.output],
  )
  const modules = outputs.filter(Boolean).flatMap((output) => Object.keys(output.modules ?? {}))
  return {
    installed: currentPlanningConsumerPolicyIdentity32,
    compiled: readFileSync(filename, 'utf8'),
    modules,
  }
}

test('build-only plugin compiles exactly the installed source hashes and removes raw inputs', async () => {
  const { paths, expected } = policySourceContract()
  const plugin = communityConsumerPolicySourceHashes({
    readSource: (filename) =>
      readFileSync(filename, 'utf8').replaceAll('\r\n', '\n').replaceAll('\n', '\r\n'),
  })
  const { installed, compiled, modules } = await compilePolicySource(plugin)
  assert.deepEqual(installed.sourceHashes, expected)
  assert.deepEqual(Object.keys(installed.sourceHashes), Object.keys(expected))
  assert.equal(Object.keys(installed.sourceHashes).length, paths.length)
  assert.doesNotMatch(compiled, /import\.meta\.glob/u)
  assert.equal(
    modules.some((id) => id.includes('?raw')),
    false,
    'raw policy source modules must not enter the runtime graph',
  )
  assert.equal(plugin.apply({}, { command: 'serve', mode: 'test' }), true)
  assert.equal(plugin.apply({}, { command: 'build', mode: 'test', isSsrBuild: true }), false)
  assert.equal(plugin.apply({}, { command: 'build', mode: 'test', isSsrBuild: false }), true)
  assert.equal(plugin.applyToEnvironment({ config: { consumer: 'server' } }), false)
  assert.equal(plugin.applyToEnvironment({ config: { consumer: 'client' } }), true)
})

test('compiled policy identity preserves canonical source-closure keys', async () => {
  const original = await compilePolicySource()
  const projected = await compilePolicySource(communityConsumerPolicySourceHashes())
  assert.equal(typeof original.installed.sourceHashes['./dynamic/objectiveEvidence.ts'], 'string')
  assert.equal(
    original.installed.sourceHashes['../calculation/dynamic/objectiveEvidence.ts'],
    undefined,
  )
  assert.deepEqual(projected.installed, original.installed)
  assert.equal(stableContentHash(projected.installed), stableContentHash(original.installed))
  assert.equal(
    projected.modules.some((id) => id.includes('?raw')),
    false,
  )
})

test('a build-time change to one installed policy source invalidates only its hash', async () => {
  const { identityUrl, paths, expected } = policySourceContract()
  const changedPath = paths.find((path) => path.endsWith('/reviewedTemplatePreparedEvents32.ts'))
  assert(changedPath)
  const changedUrl = new URL(changedPath, identityUrl)
  const changedSource = `${readFileSync(changedUrl, 'utf8')}\n// isolated source-byte invalidation\n`
  const plugin = communityConsumerPolicySourceHashes({
    readSource: (filename) =>
      filename === fileURLToPath(changedUrl) ? changedSource : readFileSync(filename, 'utf8'),
  })
  assert.notEqual(stableContentHash(changedSource.replaceAll('\r\n', '\n')), expected[changedPath])
  await assert.rejects(() => compilePolicySource(plugin), /identity_stale/u)
})

test('community worker keeps its calculation closure in one static dependency chunk', async () => {
  const previousCommunityBuild = process.env.VITE_SODA_COMMUNITY_BUILD
  process.env.VITE_SODA_COMMUNITY_BUILD = 'true'
  try {
    const root = fileURLToPath(new URL('..', import.meta.url))
    const loaded = await loadConfigFromFile(
      { command: 'build', mode: 'test' },
      join(root, 'vite.config.ts'),
      root,
    )
    assert(loaded)
    const workerCodeSplitting = loaded.config.worker?.rolldownOptions?.output?.codeSplitting
    assert(workerCodeSplitting && typeof workerCodeSplitting === 'object')
    assert.equal(workerCodeSplitting.includeDependenciesRecursively, true)
    const group = workerCodeSplitting.groups?.find(
      (candidate) => candidate.name === 'worker-calculation',
    )
    assert(group)
    assert.equal(group.maxSize, undefined)
    assert(group.test.test(join(root, 'src/calculation/worker-source.ts')))
    assert.equal(group.test.test(join(root, 'src/decision/worker-source.ts')), false)
    const clientCodeSplitting = loaded.config.build.rolldownOptions?.output?.codeSplitting
    assert.equal(clientCodeSplitting.maxSize, 400_000)
  } finally {
    if (previousCommunityBuild === undefined) delete process.env.VITE_SODA_COMMUNITY_BUILD
    else process.env.VITE_SODA_COMMUNITY_BUILD = previousCommunityBuild
  }
})
