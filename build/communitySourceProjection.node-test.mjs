import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import {
  hasPrivateCommunityLocator,
  projectCommunitySourceText,
} from './communitySourceProjection.mjs'

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

test('the installed consumer-policy closure keeps identity through repeated public projection', () => {
  const identityUrl = new URL(
    '../src/calculation/currentPlanningConsumerPolicyIdentity32.ts',
    import.meta.url,
  )
  const identity = readFileSync(identityUrl, 'utf8')
  const paths = [...identity.matchAll(/'((?:\.\/|\.\.\/)[^']+\.(?:ts|json))'/g)].map(
    (match) => match[1],
  )
  assert(paths.length > 0)
  let installedSources = 0
  let redactedSources = 0
  for (const path of paths) {
    const url = new URL(path, identityUrl)
    // These explicit raw dependencies must ship with the runtime. Silently
    // omitting a match changes the model/index identity and disables BOX inference.
    const source = readFileSync(url, 'utf8')
    installedSources++
    const projected = projectCommunitySourceText(source, url.pathname)
    const sourceHash = normalizedSourceHash(source)
    const projectedHash = normalizedSourceHash(projected)
    if (!hasPrivateCommunityLocator(source)) assert.equal(projectedHash, sourceHash, path)
    if (projectedHash !== sourceHash) {
      assert(hasPrivateCommunityLocator(source), 'only private locators may change identity')
      redactedSources++
    }
    const repeated = projectCommunitySourceText(projected, url.pathname)
    assert.equal(normalizedSourceHash(repeated), projectedHash, path)
  }
  assert(installedSources > 0, 'the installed consumer-policy closure must not be empty')
  assert.equal(installedSources, paths.length, 'every declared policy input must be installed')
  console.info({ installedSources, redactedSources })
})
