import assert from 'node:assert/strict'
import test from 'node:test'
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
