// @vitest-environment node
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, resolve, sep } from 'node:path'
import { expect, it, vi } from 'vitest'
import { prepareCommunityShell } from './prepare-community-shell.mjs'

vi.mock('../deploy/auditPublicMediaClearance.mjs', () => ({
  auditPublicMediaClearance: vi.fn(),
}))

it('binds every critical offline asset to the exact emitted bytes', () => {
  const root = mkdtempSync(join(tmpdir(), 'soda-shell-hash-test-'))
  try {
    mkdirSync(join(root, 'assets'))
    const releaseId = 'soda-hash-test-release'
    const worker = 'browserCalculationQuery.worker-test1234.js'
    const files: Record<string, string> = {
      'index.html':
        '<meta name="soda-bundle-entry" content="browser-compute" /><meta name="soda-compute-mode" content="browser" />',
      'favicon.svg': '<svg />',
      'service-worker.js': '/* service worker */',
      [`assets/${worker}`]: '/* worker */',
      'assets/entry-test.js': `export const release = '${releaseId}'; export const worker = '${worker}';`,
      'assets/entry-test.css': 'body { color: red; }',
      'assets/runtime-test.json': '{"ready":true}',
      'assets/decorative-test.png': 'decorative bytes',
    }
    for (const [path, value] of Object.entries(files)) writeFileSync(join(root, path), value)
    const manifest = prepareCommunityShell({ dist: root, releaseId })
    expect(Object.keys(manifest.criticalAssetSha256)).toEqual(manifest.criticalAssets)
    expect(manifest.criticalAssets).toContain(`/assets/${worker}`)
    expect(manifest.criticalAssets).toContain('/assets/entry-test.css')
    expect(manifest.criticalAssets).toContain('/assets/runtime-test.json')
    expect(manifest.criticalAssetSha256['/assets/decorative-test.png']).toBeUndefined()
    for (const asset of manifest.criticalAssets)
      expect(manifest.criticalAssetSha256[asset]).toBe(
        createHash('sha256')
          .update(readFileSync(join(root, asset.slice(1))))
          .digest('hex'),
      )
    expect(JSON.parse(readFileSync(join(root, 'offline-shell-manifest.json'), 'utf8'))).toEqual(
      manifest,
    )
  } finally {
    const generated = relative(resolve(tmpdir()), resolve(root))
    if (generated && !generated.startsWith(`..${sep}`) && generated !== '..')
      rmSync(root, { recursive: true })
    else throw new Error('unexpected_test_directory')
  }
})
