import { accessSync, constants, mkdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const defaultAppRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Fixed task scratch; pass this environment to the build child. */
export function prepareDerivedTemporaryEnvironment(
  task,
  appRoot = defaultAppRoot,
  env = process.env,
) {
  if (!/^[a-z0-9-]+$/u.test(task)) throw new Error('derived_temporary_task_invalid')
  const { derivedRoot } = resolveBuildStorage(appRoot, env)
  if (env.SODA_BUILD_TEMP_DIRECTORY !== undefined && !env.SODA_BUILD_TEMP_DIRECTORY.trim())
    throw new Error('derived_temporary_override_empty')
  // Existing off-system-drive scratch is an explicit usable environment override.
  const inherited =
    env.TEMP && !/^c:[\\/]/iu.test(env.TEMP)
      ? env.TEMP
      : env.TMP && !/^c:[\\/]/iu.test(env.TMP)
        ? env.TMP
        : undefined
  const temporary = resolve(
    appRoot,
    env.SODA_BUILD_TEMP_DIRECTORY ?? inherited ?? join(derivedRoot, 'temp', task),
  )
  assertStorageAvailable(temporary, false)
  mkdirSync(temporary, { recursive: true })
  return { ...env, TEMP: temporary, TMP: temporary, SODA_DERIVED_ROOT: derivedRoot }
}

export function enterDerivedTemporaryEnvironment(task) {
  const next = prepareDerivedTemporaryEnvironment(task)
  const previous = { TEMP: process.env.TEMP, TMP: process.env.TMP }
  process.env.TEMP = next.TEMP
  process.env.TMP = next.TMP
  return () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

/** Recognize an explicitly configured shared pnpm store, never a personal path constant. */
export function workspaceDerivedRoot(text) {
  const match = /^storeDir:\s*(?:"([^"]+)"|'([^']+)'|([^#\r\n]+))/mu.exec(text)
  const store = (match?.[1] ?? match?.[2] ?? match?.[3] ?? '').trim()
  if (!isAbsolute(store)) return null
  const layout = /^(.*)[\\/]pnpm[\\/]store[\\/]?$/u.exec(store)
  return layout ? resolve(layout[1]) : null
}

function assertStorageAvailable(path, mustExist) {
  let cursor = path
  while (true) {
    try {
      if (!statSync(cursor).isDirectory()) throw new Error('derived_storage_not_directory')
      accessSync(cursor, constants.W_OK)
      return
    } catch (error) {
      if (error.code !== 'ENOENT' || mustExist || dirname(cursor) === cursor)
        throw new Error('derived_storage_unavailable', { cause: error })
      cursor = dirname(cursor)
    }
  }
}

export function resolveBuildStorage(appRoot = defaultAppRoot, env = process.env) {
  appRoot = resolve(appRoot)
  let machineRoot = null
  try {
    machineRoot = workspaceDerivedRoot(readFileSync(join(appRoot, 'pnpm-workspace.yaml'), 'utf8'))
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  const explicitRoot = env.SODA_DERIVED_ROOT
  if (explicitRoot !== undefined && !explicitRoot.trim())
    throw new Error('derived_storage_override_empty')
  const derivedRoot =
    explicitRoot !== undefined
      ? resolve(appRoot, explicitRoot)
      : (machineRoot ?? join(appRoot, 'node_modules/.tmp/soda-derived'))
  // A configured local disk must be available. Missing configuration denotes a portable checkout;
  // an unavailable configured disk never silently becomes a checkout-local cache.
  if (explicitRoot !== undefined || machineRoot)
    assertStorageAvailable(derivedRoot, explicitRoot === undefined)
  return {
    derivedRoot,
    communityDist:
      env.SODA_COMMUNITY_DIST ??
      (machineRoot ? join(derivedRoot, 'community/dist') : join(appRoot, 'dist')),
    source:
      explicitRoot !== undefined ? 'environment' : machineRoot ? 'workspace-store' : 'portable',
  }
}
