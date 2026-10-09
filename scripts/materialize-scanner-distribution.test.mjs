import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { copyFile, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  materializeScannerDistribution,
  pinnedScannerAssetUrlRc86,
  pinnedScannerAssetUrlRc87,
  pinnedScannerAssetUrlRc88,
  scannerAssetLocation,
} from './materialize-scanner-distribution.mjs'

const source = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'downloads')
const names = [
  'Soda-Scanner-Bootstrap.cmd',
  'scanner-runtime-bootstrap.ps1',
  'scanner-runtime-pointer-store.ps1',
  'scanner-runtime-release.v1.json',
]
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

test('accepts both pinned RC8.7 and RC8.8 assets without accepting mixed identities', () => {
  for (const [version, assetUrl] of [['7', pinnedScannerAssetUrlRc87], ['8', pinnedScannerAssetUrlRc88]]) {
    const manifest = {
      assetUrl,
      assetName: `soda-scanner-runtime-18-rc8-${version}-win-x64.zip`,
      releaseTag: `scanner-runtime-v18.0.0-rc.8.${version}`,
    }
    assert.equal(scannerAssetLocation(manifest), 'github-release')
    assert.throws(() => scannerAssetLocation({ ...manifest, assetName: 'different.zip' }),
      /scanner_release_asset_invalid/)
  }
})

test('materializes a same-origin bootstrap with a pinned external runtime without changing source', async () => {
  const root = await mkdtemp(join(tmpdir(), 'soda-scanner-build-test-'))
  try {
    const output = join(root, 'dist', 'downloads')
    const sourceHashes = await Promise.all(
      names.map(async (name) => sha256(await readFile(join(source, name)))),
    )
    for (const origin of [
      'http://example.test',
      'https://example.test/path',
      'https://example.test:8443',
      'https://user@example.test',
    ]) {
      await assert.rejects(
        materializeScannerDistribution({ origin, output }),
        /scanner_public_origin_invalid/,
      )
    }
    assert.deepEqual(await readdir(root), [])

    const rendered = await materializeScannerDistribution({
      origin: 'https://example.test',
      output,
    })
    assert.deepEqual((await readdir(output)).sort(), [...names].sort())
    const command = await readFile(join(output, names[0]))
    const text = command.toString('utf8')
    assert.match(text, /set "ORIGIN=https:\/\/example\.test"/)
    assert.equal((text.match(/powershell -NoProfile/g) ?? []).length, 1)
    assert.doesNotMatch(text, /Get-Credential|PreviewCredential|WWW-Authenticate/)
    assert.match(text, /MaximumRedirection=0/)
    assert.doesNotMatch(text, /__SODA_[A-Z0-9_]+__/)
    assert.equal(text.replaceAll('\r\n', '').includes('\n'), false)
    assert.equal(rendered.commandSha256, sha256(command))
    for (const [index, key] of ['bootstrapSha256', 'pointerSha256', 'manifestSha256'].entries()) {
      const payload = await readFile(join(output, names[index + 1]))
      assert.equal(rendered[key], sha256(payload))
      assert.ok(text.includes(rendered[key]))
    }
    assert.equal(rendered.releaseState, 'published')
    const manifest = JSON.parse(await readFile(join(output, names[3]), 'utf8'))
    assert.equal(manifest.releaseState, 'published')
    assert.equal(manifest.assetUrl, pinnedScannerAssetUrlRc88)
    await assert.rejects(
      materializeScannerDistribution({
        origin: 'https://example.test',
        output: join(root, 'external-zip-bundled'),
        assetPath: join(root, 'missing.zip'),
      }),
      /scanner_external_archive_must_not_be_bundled/,
    )
    assert.deepEqual(
      await Promise.all(names.map(async (name) => sha256(await readFile(join(source, name))))),
      sourceHashes,
    )

    const fixture = join(root, 'fixture')
    await mkdir(fixture)
    await Promise.all(names.map((name) => copyFile(join(source, name), join(fixture, name))))
    const unsafe = JSON.parse(await readFile(join(fixture, names[3]), 'utf8'))
    unsafe.assetUrl = 'https://other.example/downloads/scanner.zip'
    await writeFile(join(fixture, names[3]), JSON.stringify(unsafe))
    await assert.rejects(
      materializeScannerDistribution({
        origin: 'https://example.test',
        output: join(root, 'unsafe-output'),
        templateRoot: fixture,
      }),
      /scanner_release_template_invalid/,
    )
    assert.deepEqual((await readdir(root)).sort(), ['dist', 'fixture'])

    for (const url of [
      pinnedScannerAssetUrlRc86.replace('/soda-terminal-scanner/', '/other-repo/'),
      pinnedScannerAssetUrlRc86.replace('-rc.8.6/', '-rc.4/'),
      pinnedScannerAssetUrlRc86.replace('github.com', 'github.com.evil.example'),
      pinnedScannerAssetUrlRc86 + '?download=1',
    ]) {
      unsafe.assetUrl = url
      await writeFile(join(fixture, names[3]), JSON.stringify(unsafe))
      await assert.rejects(
        materializeScannerDistribution({
          origin: 'https://example.test',
          output: join(root, 'rejected-url'),
          templateRoot: fixture,
        }),
        /scanner_release_template_invalid/,
      )
    }

    unsafe.assetUrl = `/downloads/${unsafe.assetName}`
    unsafe.releaseState = 'published'
    await writeFile(join(fixture, names[3]), JSON.stringify(unsafe))
    const publishedOutput = join(root, 'published-output')
    const published = await materializeScannerDistribution({
      origin: 'https://example.test',
      output: publishedOutput,
      templateRoot: fixture,
    })
    assert.equal(published.releaseState, 'published')
    assert.equal(
      JSON.parse(await readFile(join(publishedOutput, names[3]), 'utf8')).releaseState,
      'published',
    )
    assert.deepEqual((await readdir(publishedOutput)).sort(), [...names].sort())

    const archive = Buffer.from('isolated scanner runtime fixture')
    const archiveName = 'scanner-fixture.zip'
    const archivePath = join(root, archiveName)
    await writeFile(archivePath, archive)
    unsafe.releaseState = 'not_published'
    unsafe.assetName = archiveName
    unsafe.assetUrl = `/downloads/${archiveName}`
    unsafe.size = archive.length
    unsafe.sha256 = sha256(archive)
    await writeFile(join(fixture, names[3]), JSON.stringify(unsafe))
    const archiveOutput = join(root, 'archive-output')
    const copied = await materializeScannerDistribution({
      origin: 'https://example.test',
      output: archiveOutput,
      templateRoot: fixture,
      assetPath: archivePath,
    })
    assert.equal(copied.assetName, archiveName)
    assert.deepEqual(await readFile(join(archiveOutput, archiveName)), archive)
    assert.deepEqual((await readdir(archiveOutput)).sort(), [...names, archiveName].sort())

    for (const [mutation, expected] of [
      [{ assetName: 'other.zip', assetUrl: '/downloads/other.zip' }, /archive_name_mismatch/],
      [{ size: archive.length + 1 }, /archive_mismatch/],
      [{ sha256: '0'.repeat(64) }, /archive_mismatch/],
    ]) {
      const broken = { ...unsafe, ...mutation }
      await writeFile(join(fixture, names[3]), JSON.stringify(broken))
      const rejectedOutput = join(root, `rejected-${expected.source}-${broken.size}`)
      await assert.rejects(
        materializeScannerDistribution({
          origin: 'https://example.test',
          output: rejectedOutput,
          templateRoot: fixture,
          assetPath: archivePath,
        }),
        expected,
      )
      await assert.rejects(readdir(rejectedOutput), { code: 'ENOENT' })
    }
  } finally {
    if (!resolve(root).startsWith(`${resolve(tmpdir())}${sep}`))
      throw new Error('unsafe_scanner_test_cleanup')
    await rm(root, { recursive: true })
  }
})
