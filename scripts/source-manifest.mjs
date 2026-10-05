#!/usr/bin/env node
/** Explicit identity maintenance for an already exported, editable public source release. */
import { createHash } from 'node:crypto'
import { lstat, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const manifestName = 'SOURCE-MANIFEST.json'
const rootFiles = new Set([
  'index.html',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'tsconfig.json',
  'vite.config.ts',
  '.gitignore',
  '.gitattributes',
  'LICENSE',
  'README.md',
])
const sourceDirectories = new Set([
  'src',
  'build',
  'scripts',
  'deploy',
  'public',
  '.github',
  'patches',
])

function safePath(path) {
  if (
    typeof path !== 'string' ||
    !path ||
    isAbsolute(path) ||
    path.includes('\\') ||
    path.includes(':') ||
    path.split('/').some((part) => !part || part === '.' || part === '..') ||
    /(?:^|\/)(?:\.git|\.env(?:\.[^/]*)?|node_modules|dist|outputs|test-results|docs|server|native|artifacts)(?:\/|$)/iu.test(
      path,
    ) ||
    /\.(?:pem|key|log)$/iu.test(path) ||
    (!rootFiles.has(path) &&
      !sourceDirectories.has(path.split('/')[0]) &&
      !/^tests\/algorithm-quality\/[^/]+\.mjs$/u.test(path))
  )
    throw new Error('source_manifest_unsafe_path')
  if (
    path.startsWith('public/sponsor/') &&
    !/^public\/sponsor\/(?:alipay|wechat)(?:-(?:5|10|20|50|100))?-qr\.png$/u.test(path)
  )
    throw new Error('source_manifest_unsafe_path')
  return path
}

async function fileBytes(root, path) {
  safePath(path)
  const parts = path.split('/')
  let file = root
  for (let index = 0; index < parts.length; index += 1) {
    file = join(file, parts[index])
    const stat = await lstat(file)
    if (stat.isSymbolicLink() || (index < parts.length - 1 ? !stat.isDirectory() : !stat.isFile()))
      throw new Error(`source_manifest_non_regular:${path}`)
  }
  return readFile(file)
}

async function loadManifest(root) {
  const file = join(root, manifestName)
  const stat = await lstat(file)
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('source_manifest_non_regular')
  const bytes = await readFile(file)
  const manifest = JSON.parse(bytes)
  if (
    manifest.schemaVersion !== 1 ||
    !manifest.files ||
    Array.isArray(manifest.files) ||
    typeof manifest.files !== 'object' ||
    !Object.keys(manifest.files).length
  )
    throw new Error('source_manifest_invalid')
  for (const [path, hash] of Object.entries(manifest.files)) {
    safePath(path)
    if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/u.test(hash))
      throw new Error('source_manifest_invalid_hash')
  }
  return { bytes, manifest }
}

async function assertNoUnpinnedSource(root, pinned) {
  // Look only in public release source directories, never node_modules/dist or other local data.
  // An extra extensionless-import candidate must not silently shadow a pinned module.
  const unpinned = []
  async function visit(directory, prefix) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = `${prefix}/${entry.name}`
      if (entry.isSymbolicLink()) throw new Error(`source_manifest_non_regular:${path}`)
      if (entry.isDirectory()) await visit(join(directory, entry.name), path)
      else if (!pinned.has(path)) unpinned.push(path)
    }
  }
  for (const directory of [...sourceDirectories, 'tests/algorithm-quality']) {
    try {
      const stat = await lstat(join(root, directory))
      if (!stat.isDirectory() || stat.isSymbolicLink())
        throw new Error('source_manifest_non_regular')
      await visit(join(root, directory), directory)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }
  if (unpinned.length)
    throw new Error(
      `source_manifest_unpinned:${unpinned.slice(0, 20).join(',')}; name additions with pnpm source:refresh --add`,
    )
}

/** Build cannot silently sign modified source with the previous release identity. */
export async function verifySourceManifest(root = defaultRoot) {
  root = resolve(root)
  const { bytes, manifest } = await loadManifest(root)
  const drift = []
  for (const [path, expected] of Object.entries(manifest.files)) {
    try {
      if (sha256(await fileBytes(root, path)) !== expected) drift.push(path)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      drift.push(path)
    }
  }
  if (drift.length)
    throw new Error(
      `source_manifest_drift:${drift.slice(0, 20).join(',')}; review changes and run pnpm source:refresh explicitly`,
    )
  await assertNoUnpinnedSource(root, new Set(Object.keys(manifest.files)))
  return {
    releaseId: `soda-open-${sha256(bytes).slice(0, 16)}`,
    count: Object.keys(manifest.files).length,
  }
}

/** Deliberate refresh; never invoked by build. Additions/removals must be named by the editor. */
export async function refreshSourceManifest({ root = defaultRoot, add = [], remove = [] } = {}) {
  root = resolve(root)
  const packageJson = JSON.parse(await fileBytes(root, 'package.json'))
  if (packageJson.name !== 'soda-terminal-open' || packageJson.private === true)
    throw new Error('source_manifest_refresh_public_export_only')
  const { manifest } = await loadManifest(root)
  const paths = new Set(Object.keys(manifest.files))
  for (const path of remove) {
    safePath(path)
    if (!paths.delete(path)) throw new Error(`source_manifest_remove_unknown:${path}`)
  }
  for (const path of add) paths.add(safePath(path))
  if (!paths.size) throw new Error('source_manifest_empty')
  await assertNoUnpinnedSource(root, paths)
  const files = {}
  const changed = []
  for (const path of [...paths].sort((a, b) => a.localeCompare(b))) {
    const bytes = await fileBytes(root, path)
    if (
      /\.(?:ts|tsx|js|jsx|mjs|json|html|css|md|txt|yaml)$/u.test(path) &&
      /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:api[_-]?key|secret|token|password)\s*[:=]\s*["'][^"']{12,}["']/imu.test(
        bytes.toString('utf8'),
      )
    )
      throw new Error(`source_manifest_possible_credential:${path}`)
    files[path] = sha256(bytes)
    if (files[path] !== manifest.files[path]) changed.push(path)
  }
  const next = Buffer.from(`${JSON.stringify({ schemaVersion: 1, files }, null, 2)}\n`)
  await writeFile(join(root, manifestName), next)
  return {
    releaseId: `soda-open-${sha256(next).slice(0, 16)}`,
    changed,
    removed: remove,
    count: paths.size,
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const mode = args.shift() ?? '--check'
  const add = [],
    remove = []
  while (args.length) {
    const flag = args.shift(),
      path = args.shift()
    if (!path || !['--add', '--remove'].includes(flag))
      throw new Error('source_manifest_invalid_arguments')
    ;(flag === '--add' ? add : remove).push(path)
  }
  if (
    !['--check', '--refresh'].includes(mode) ||
    (mode === '--check' && (add.length || remove.length))
  )
    throw new Error('source_manifest_invalid_arguments')
  ;(mode === '--refresh' ? refreshSourceManifest({ add, remove }) : verifySourceManifest()).then(
    (result) => console.log(JSON.stringify({ ok: true, ...result })),
    (error) => {
      console.error(error.message)
      process.exitCode = 1
    },
  )
}
