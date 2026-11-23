import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { verifyInstalledTeamRatingRelease } from './verify-team-rating-release.mjs'
import {
  prepareDerivedTemporaryEnvironment,
  resolveBuildStorage,
} from './derived-build-storage.mjs'

const appRoot = fileURLToPath(new URL('../', import.meta.url))

export function localBuildSteps(mode, args = [], root = appRoot) {
  const vite = resolve(root, 'node_modules/vite/bin/vite.js')
  const planningIdentity = [
    resolve(root, 'scripts/generate-current-planning-consumer-policy-identity.mjs'),
    '--check',
  ]
  if (mode === 'storybook') {
    const hasOutput = args.some(
      (arg) => arg === '-o' || arg === '--output-dir' || arg.startsWith('--output-dir='),
    )
    return [
      [
        resolve(root, 'node_modules/storybook/dist/bin/dispatcher.js'),
        'build',
        '--config-dir',
        '.storybook',
        '--disable-telemetry',
        ...(hasOutput
          ? []
          : ['--output-dir', resolve(resolveBuildStorage(root).derivedRoot, 'storybook/static')]),
        ...args,
      ],
    ]
  }
  if (mode === 'server')
    return [planningIdentity, [vite, 'build', '--config', 'vite.server.config.ts', ...args]]
  if (mode !== 'web') throw new Error('local_build_mode_invalid')
  return [
    planningIdentity,
    [resolve(root, 'scripts/verify-current-generated-catalogs.mjs')],
    [resolve(root, 'node_modules/typescript/bin/tsc'), '-b'],
    [vite, 'build', ...args],
  ]
}

export function runLocalBuild(mode, args = [], { root = appRoot, spawn = spawnSync } = {}) {
  const steps = localBuildSteps(mode, args, root)
  const env = prepareDerivedTemporaryEnvironment(`local-${mode}-build`, root)
  for (const command of steps) {
    const result = spawn(process.execPath, command, {
      cwd: root,
      env,
      stdio: 'inherit',
      windowsHide: true,
    })
    if (result.status !== 0) return result.status ?? 1
  }
  return 0
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === 'server') {
    await verifyInstalledTeamRatingRelease()
  }
  process.exitCode = runLocalBuild(process.argv[2], process.argv.slice(3))
}
