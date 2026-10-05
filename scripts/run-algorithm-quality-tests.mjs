import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { algorithmQualityArguments } from './algorithm-quality-manifest.mjs'

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// Loader hooks belong only to this child, never the ordinary Node suites.
export function runAlgorithmQualityTests({ spawn = spawnSync, root = appRoot } = {}) {
  const result = spawn(process.execPath, algorithmQualityArguments(), {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true,
    env: { ...process.env, VITE_SODA_PUBLIC_BUILD: 'false' },
  })
  return result.status ?? 1
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url)
  process.exitCode = runAlgorithmQualityTests()
