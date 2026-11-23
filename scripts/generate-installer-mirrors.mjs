import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { installerChunkSize } from '../deploy/cloudflare/installer-chunk-cache.mjs'

const [packagesPath, ...proofPaths] = process.argv.slice(2)
if (!packagesPath || proofPaths.length === 0)
  throw new Error(
    'Usage: node scripts/generate-installer-mirrors.mjs <packages.json> <mirror-proof.json> [...]',
  )
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'))
const packages = await readJson(packagesPath)
const proofs = (await Promise.all(proofPaths.map(readJson))).flat()
const providers = new Map([
  ['https://cnb.cool', 'cnb'],
  ['https://atomgit.com', 'atomgit'],
])
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const releases = []
for (const [key, manifestPath] of [
  ['quick', '../src/assetQuickRead/releaseManifest.json'],
  ['scanner', '../public/downloads/scanner-installer-release.v1.json'],
]) {
  const installer = packages.find((entry) => entry.key === key)
  assert(installer, `Missing published package: ${key}`)
  const manifest = await readJson(new URL(manifestPath, import.meta.url))
  const bytes = await readFile(installer.file)
  assert.equal(bytes.length, manifest.size)
  assert.equal(sha256(bytes), manifest.sha256)
  const sources = new Map()
  for (const proof of proofs) {
    if (proof.key !== key || proof.passed !== true) continue
    assert.equal(proof.sha256, manifest.sha256)
    assert.equal(proof.bytes, manifest.size)
    assert.equal(proof.range, 206)
    const url = new URL(proof.url)
    const provider = providers.get(url.origin)
    assert(provider && !url.search && !url.hash && !url.username && !url.password)
    assert(url.pathname.endsWith('/' + installer.fileName))
    assert(!sources.has(provider), `Duplicate mirror for ${key}: ${provider}`)
    sources.set(provider, { provider, url: url.href })
  }
  const chunks = []
  for (let offset = 0; offset < bytes.length; offset += installerChunkSize)
    chunks.push(sha256(bytes.subarray(offset, offset + installerChunkSize)))
  releases.push({
    version: manifest.version,
    size: manifest.size,
    sha256: manifest.sha256,
    sources: [...sources.values()],
    chunks,
  })
}
await writeFile(
  new URL('../deploy/cloudflare/installer-mirrors.json', import.meta.url),
  JSON.stringify(releases, null, 2) + '\n',
)
