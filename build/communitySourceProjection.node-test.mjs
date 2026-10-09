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
