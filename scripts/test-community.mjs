#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { communityTests } from './community-test-manifest.mjs'
import { runAlgorithmQualityTests } from './run-algorithm-quality-tests.mjs'
import {
  resolveBuildStorage,
  prepareDerivedTemporaryEnvironment,
  enterDerivedTemporaryEnvironment,
} from './derived-build-storage.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Use the exported candidate's exact configuration before spending a remote CI run. */
export function runCommunityPreflight({
  candidate = root,
  tests = [],
  execute = spawnSync,
  exists = existsSync,
  environment = prepareDerivedTemporaryEnvironment,
} = {}) {
  if (!exists(resolve(candidate, 'SOURCE-MANIFEST.json')))
    throw new Error('community_preflight_requires_exported_candidate')
  const selected = [
    ...new Set(tests.length ? [...tests, 'src/scanner/versionConsistencyAudit.test.ts'] : []),
  ]
  if (selected.some((file) => !communityTests.includes(file)))
    throw new Error('community_preflight_requires_named_community_tests')
  const env = {
    ...environment('community-preflight', candidate),
    VITE_SODA_PUBLIC_BUILD: 'false',
    VITE_SODA_COMMUNITY_BUILD: 'true',
  }
  const steps = [
    ['scripts/source-manifest.mjs', '--check'],
    ['scripts/test-community.mjs', '--runtime-check'],
    ['node_modules/typescript/bin/tsc', '--noEmit', '--project', 'tsconfig.json'],
    ...(selected.length
      ? [['node_modules/vitest/vitest.mjs', 'run', '--config', 'vite.config.ts', ...selected]]
      : []),
  ]
  for (const args of steps) {
    const result = execute(process.execPath, args, {
      cwd: candidate,
      env,
      stdio: 'inherit',
      windowsHide: true,
    })
    if (result.status !== 0) return result.status ?? 1
  }
  console.log(
    JSON.stringify({ scope: 'community-preflight', namedTests: selected, releaseGate: false }),
  )
  return 0
}

/** Check the installed generated consumers before spending a full remote test run. */
export async function checkCommunityRuntime(candidate = root) {
  const { createServer } = await import('vite')
  const server = await createServer({
    root: candidate,
    server: { middlewareMode: true, hmr: false, watch: null },
    appType: 'custom',
  })
  try {
    const { current31TeamIntrinsicIndexStatus: index } = await server.ssrLoadModule(
      '/src/decision/current31TeamIntrinsicIndex.ts',
    )
    if (index.status !== 'ready')
      throw new Error(`community_runtime_index_not_ready: ${index.reason}`)
    const { inferTeamStrength } = await server.ssrLoadModule('/src/decision/teamStrengthModel.ts')
    const named = inferTeamStrength(['agent-jane', 'agent-burnice', 'agent-caesar'])
    if (!named || !Number.isFinite(named.score))
      throw new Error('community_runtime_model_not_ready')
    console.log(
      JSON.stringify({
        scope: 'community-runtime-preflight',
        index: 'ready',
        namedScore: named.score,
      }),
    )
  } finally {
    await server.close()
  }
}

function runCommunityTests({ nodeOnly = false, shard } = {}) {
  const storage = resolveBuildStorage(root)
  const testEnvironment = prepareDerivedTemporaryEnvironment('community-test', root)
  let algorithmStatus = 0
  if (!shard) {
    const restoreAlgorithmTemporary = enterDerivedTemporaryEnvironment('community-test')
    try {
      algorithmStatus = runAlgorithmQualityTests()
    } finally {
      restoreAlgorithmTemporary()
    }
    const projectionTests = spawnSync(
      process.execPath,
      [
        '--test',
        resolve(root, 'build/communitySourceProjection.node-test.mjs'),
        resolve(root, 'scripts/source-manifest.test.mjs'),
        resolve(root, 'scripts/current-agent-effect-compiler.test.mjs'),
        resolve(root, 'deploy/cloudflare/edge.test.mjs'),
        resolve(root, 'deploy/cloudflare/scan-feedback.test.mjs'),
        resolve(root, 'deploy/cloudflare/asset-feedback.test.mjs'),
        resolve(root, 'deploy/cloudflare/installer-feedback.test.mjs'),
        resolve(root, 'deploy/cloudflare/scanner-installer.test.mjs'),
        resolve(root, 'deploy/cloudflare/asset-quick-read-installer.test.mjs'),
        resolve(root, 'deploy/cloudflare/prepare.test.mjs'),
      ],
      {
        cwd: root,
        env: testEnvironment,
        stdio: 'inherit',
      },
    )
    if (projectionTests.status !== 0) process.exit(projectionTests.status ?? 1)
  }
  if (nodeOnly) process.exit(algorithmStatus)
  const result = spawnSync(
    process.execPath,
    [
      resolve(root, 'node_modules/vitest/vitest.mjs'),
      'run',
      '--config',
      'vite.config.ts',
      ...(shard ? ['--shard', shard] : []),
      ...communityTests,
    ],
    {
      cwd: root,
      env: {
        ...testEnvironment,
        VITE_SODA_PUBLIC_BUILD: 'false',
        VITE_SODA_COMMUNITY_BUILD: 'true',
        SODA_DERIVED_ROOT: storage.derivedRoot,
      },
      stdio: 'inherit',
    },
  )
  process.exit((result.status ?? 1) || algorithmStatus)
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const args = process.argv.slice(2)
  if (args[0] === '--preflight') process.exitCode = runCommunityPreflight({ tests: args.slice(1) })
  else if (args.length === 1 && args[0] === '--runtime-check') await checkCommunityRuntime()
  else if (args.length === 1 && args[0] === '--node-only') runCommunityTests({ nodeOnly: true })
  else if (args.length === 2 && args[0] === '--vitest-shard' && /^[1-3]\/3$/u.test(args[1]))
    runCommunityTests({ shard: args[1] })
  else if (args.length) throw new Error('unknown_community_test_arguments')
  else runCommunityTests()
}
