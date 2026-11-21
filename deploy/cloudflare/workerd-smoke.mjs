/** Run against a prepared candidate after npm install; exercises real Static Assets routing. */
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { access, readFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { allowedImage } from './edge.mjs'

async function freePort() {
  const server = createServer()
  await new Promise((done) => server.listen(0, '127.0.0.1', done))
  const port = server.address().port
  await new Promise((done) => server.close(done))
  return port
}

export async function smokeWorkerd(
  candidate,
  imageUrl,
  { persistTo = process.env.SODA_WORKERD_PERSIST_DIRECTORY } = {},
) {
  if (persistTo !== undefined && (typeof persistTo !== 'string' || !persistTo.trim()))
    throw new Error('workerd_persistence_directory_invalid')
  const root = resolve(candidate)
  const config = JSON.parse(await readFile(join(root, 'wrangler.json'), 'utf8'))
  const manifest = JSON.parse(
    await readFile(join(root, 'web', 'offline-shell-manifest.json'), 'utf8'),
  )
  if (config.assets?.directory !== './web' || config.assets?.run_worker_first === true)
    throw new Error('unexpected_assets_routing_configuration')
  const bin = join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js')
  await access(bin)
  const port = await freePort()
  const child = spawn(
    process.execPath,
    [
      bin,
      'dev',
      '--local',
      '--ip',
      '127.0.0.1',
      '--port',
      String(port),
      // Keep local SQLite state on a caller-selected short path when Windows
      // path limits prevent workerd from opening state below a deep candidate.
      ...(persistTo === undefined ? [] : ['--persist-to', resolve(persistTo)]),
    ],
    {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    },
  )
  let output = ''
  const collect = (chunk) => {
    output = `${output}${chunk}`.slice(-3000)
  }
  child.stdout.on('data', collect)
  child.stderr.on('data', collect)
  const base = `http://127.0.0.1:${port}`
  const get = (path, init) => fetch(`${base}${path}`, init)
  try {
    let ready = false
    for (let n = 0; n < 80; n += 1) {
      if (child.exitCode !== null) throw new Error(`wrangler_exited:${child.exitCode}:${output}`)
      try {
        const response = await get('/_soda/health')
        if (response.ok) {
          ready = true
          break
        }
      } catch {
        /* workerd is still starting */
      }
      await new Promise((done) => setTimeout(done, 250))
    }
    if (!ready) throw new Error(`wrangler_start_timeout:${output}`)
    const health = await (await get('/_soda/health')).json()
    assert.equal(health.runtime, 'cloudflare-static/v1')
    assert.equal(health.calculationApi, 'disabled')
    const healthResponse = await get('/_soda/health')
    assert.equal(healthResponse.headers.get('cache-control'), 'no-store')
    assert.match(healthResponse.headers.get('content-security-policy') ?? '', /default-src 'none'/u)
    const api = await get('/api/calculation/tasks', { method: 'POST', body: 'private-input' })
    assert.equal(api.status, 410)
    assert.equal(api.headers.get('cache-control'), 'no-store')
    const protectedPaths = [
      '/.env',
      '/.git/config',
      '/src/main.tsx',
      '/assets/app.js.map',
      '/private/a',
      '/outputs/private.json',
      '/nested/.env',
      '/%2eenv',
      '/%252eenv',
      '/assets/app%2ejs%2emap',
    ]
    for (const path of protectedPaths) {
      const response = await get(path, { headers: { 'sec-fetch-mode': 'navigate' } })
      assert.equal(response.status, 404, `${path} escaped Worker protection`)
    }
    const invalidImage = await get('/official-catalog-cache?source=http%3A%2F%2F127.0.0.1%2Fa')
    assert.equal(invalidImage.status, 403)
    let imageEvidence
    if (imageUrl) {
      assert(allowedImage(new URL(imageUrl)), 'image_url_not_allowlisted')
      const direct = await fetch(imageUrl, {
        redirect: 'manual',
        signal: AbortSignal.timeout(10_000),
      })
      assert.equal(direct.status, 200, 'direct_upstream_image_unavailable')
      const directBytes = Buffer.from(await direct.arrayBuffer())
      assert(directBytes.length > 0 && directBytes.length <= 8 * 1024 * 1024)
      const proxied = await get(`/official-catalog-cache?source=${encodeURIComponent(imageUrl)}`)
      assert.equal(proxied.status, 200)
      assert.equal(proxied.headers.get('x-soda-asset-error'), null)
      assert.equal(proxied.headers.get('content-type'), direct.headers.get('content-type'))
      const proxiedBytes = Buffer.from(await proxied.arrayBuffer())
      const sha256 = createHash('sha256').update(directBytes).digest('hex')
      assert.equal(createHash('sha256').update(proxiedBytes).digest('hex'), sha256)
      const head = await get(`/official-catalog-cache?source=${encodeURIComponent(imageUrl)}`, {
        method: 'HEAD',
      })
      assert.equal(head.status, 200)
      assert.equal(head.headers.get('content-length'), String(directBytes.length))
      assert.equal((await head.arrayBuffer()).byteLength, 0)
      imageEvidence = {
        bytes: directBytes.length,
        sha256,
        mime: direct.headers.get('content-type'),
      }
    }
    const spa = await get('/loadouts/team', { headers: { 'sec-fetch-mode': 'navigate' } })
    assert.equal(spa.status, 200)
    assert.match(await spa.text(), /soda-compute-mode/u)
    const staticPaths = [
      manifest.computeWorker,
      manifest.assets.find(
        (path) =>
          path.startsWith('/assets/') && path.endsWith('.js') && path !== manifest.computeWorker,
      ),
    ]
    for (const path of staticPaths) {
      assert(path, 'missing_static_script_in_manifest')
      const response = await get(path)
      assert.equal(response.status, 200, `${path} not served as an asset`)
      assert.match(response.headers.get('content-type') ?? '', /javascript/u)
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
      assert.equal(response.headers.get('cache-control'), 'public, max-age=31536000, immutable')
      const actual = createHash('sha256')
        .update(Buffer.from(await response.arrayBuffer()))
        .digest('hex')
      const expected = createHash('sha256')
        .update(await readFile(join(root, 'web', path.slice(1))))
        .digest('hex')
      assert.equal(actual, expected, `${path} bytes differ from prepared asset`)
    }
    const index = await get('/index.html')
    assert.equal(index.status, 200)
    assert.equal(index.headers.get('content-type')?.includes('text/html'), true)
    assert.match(index.headers.get('content-security-policy') ?? '', /frame-ancestors 'none'/u)
    assert.equal(index.headers.get('cache-control'), 'public, max-age=0, must-revalidate')
    const icon = await get('/assets/soda-brand-icon.png')
    assert.equal(icon.status, 200)
    assert.equal(
      icon.headers.get('cache-control'),
      'public, max-age=86400, stale-while-revalidate=86400',
    )
    for (const path of ['/service-worker.js', '/offline-shell-manifest.json']) {
      const response = await get(path)
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('cache-control'), 'public, max-age=0, must-revalidate')
    }
    const worker = config.assets.run_worker_first
    assert(Array.isArray(worker) && !worker.includes('/*'))
    return {
      runtime: 'workerd',
      releaseId: health.releaseId,
      protectedPaths: protectedPaths.length,
      apiDisabled: true,
      spa: true,
      staticAssets: staticPaths.length,
      imageEvidence,
      deployed: false,
    }
  } finally {
    child.kill()
    await new Promise((done) => {
      if (child.exitCode !== null) return done()
      child.once('exit', done)
      setTimeout(done, 2500).unref()
    })
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.length < 3 || process.argv.length > 4) {
    console.error(
      'usage: node workerd-smoke.mjs <prepared-candidate-directory> [allowlisted-image-url]',
    )
    process.exitCode = 2
  } else {
    try {
      console.log(JSON.stringify(await smokeWorkerd(process.argv[2], process.argv[3]), null, 2))
    } catch (error) {
      console.error(error)
      process.exitCode = 1
    }
  }
}
