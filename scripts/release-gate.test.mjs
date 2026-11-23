import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { runReleaseGate, stepEnvironment } from './release-gate.mjs'
import { currentNodeTests } from './release-test-classification.mjs'
import { recoveryBuildOptions } from './build-incremental32-recovery-dist.mjs'
import {
  assertBuildIdentityOverrides,
  deriveBuildReleaseIdentity,
  resolveBuildSourceAuthority,
} from './build-release-identity.mjs'

const sentinelKey = 'SODA_RELEASE_GATE_TEST_SENTINEL'
// Absolute, outside the checkout, and absent: the public target validator rejects anything else.
const publicDistCandidate = join(tmpdir(), `soda-release-gate-test-public-dist-${process.pid}`)
const sourceReleaseId = 'soda-open-0123456789abcdef'

test('build modes derive distinct identities from one pinned source release', () => {
  assert.equal(deriveBuildReleaseIdentity({ sourceReleaseId }).releaseId, sourceReleaseId)
  assert.equal(
    deriveBuildReleaseIdentity({
      sourceReleaseId,
      incremental32Recovery: true,
    }).releaseId,
    `${sourceReleaseId}-compat32`,
  )
  assert.equal(
    deriveBuildReleaseIdentity({
      sourceReleaseId,
      incremental33Recovery: true,
    }).releaseId,
    `${sourceReleaseId}-compat33`,
  )
  assert.equal(
    deriveBuildReleaseIdentity({
      sourceReleaseId,
      usageStatistics: true,
    }).releaseId,
    `${sourceReleaseId}-usage`,
  )
  assert.equal(
    deriveBuildReleaseIdentity({
      sourceReleaseId,
      incremental33Recovery: true,
      usageStatistics: true,
    }).releaseId,
    `${sourceReleaseId}-compat33-usage`,
  )
})

test('build identity rejects dual recovery modes and arbitrary source or build overrides', () => {
  assert.throws(
    () =>
      deriveBuildReleaseIdentity({
        sourceReleaseId,
        incremental32Recovery: true,
        incremental33Recovery: true,
      }),
    /build_recovery_modes_conflict/,
  )
  const identity = deriveBuildReleaseIdentity({
    sourceReleaseId,
    incremental33Recovery: true,
  })
  assert.throws(
    () =>
      assertBuildIdentityOverrides(identity, {
        SODA_SOURCE_RELEASE_ID: 'soda-open-fedcba9876543210',
      }),
    /build_source_release_id_override_forbidden/,
  )
  assert.throws(
    () =>
      assertBuildIdentityOverrides(identity, {
        VITE_SODA_RELEASE_ID: sourceReleaseId,
      }),
    /build_release_id_override_forbidden/,
  )
})

test('private recovery fallback requires a named label and never bypasses public markers', async () => {
  const root = mkdtempSync(join(tmpdir(), 'soda-private-build-authority-'))
  try {
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({ name: 'soda-terminal', private: true }),
    )
    await assert.rejects(resolveBuildSourceAuthority(root, {}), /private_source_label_required/)
    const authority = await resolveBuildSourceAuthority(
      root,
      { SODA_SOURCE_VERIFIED: 'false' },
      { privateLabel: 'private-release-20261026-compat33' },
    )
    assert.deepEqual(authority, {
      sourceReleaseId: 'private-release-20261026',
      sourceVerified: false,
      sourceKind: 'private',
      sourceMarkers: [],
    })
    assert.equal(
      deriveBuildReleaseIdentity({
        sourceReleaseId: authority.sourceReleaseId,
        sourceVerified: false,
        incremental33Recovery: true,
      }).releaseId,
      'private-release-20261026-compat33',
    )

    writeFileSync(join(root, 'SOURCE-LOCK.json'), '{}')
    await assert.rejects(
      resolveBuildSourceAuthority(
        root,
        { SODA_PRIVATE_SOURCE_LABEL: 'private-release-20261026' },
        { privateLabel: 'private-release-20261026' },
      ),
      /public_source_private_identity_forbidden/,
    )
    rmSync(join(root, 'SOURCE-LOCK.json'))
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'soda-terminal-open' }))
    await assert.rejects(
      resolveBuildSourceAuthority(root, {}, { privateLabel: 'private-release-20261026' }),
      { code: 'ENOENT' },
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('3.3 recovery selects its own precision boundary without inheriting the 3.2 flag', () => {
  const options = recoveryBuildOptions({
    SODA_DERIVED_ROOT: tmpdir(),
    SODA_RECOVERY_GAME_VERSION: '3.3',
    SODA_COMMUNITY_DIST: join(tmpdir(), 'recovery/3.3-update', `candidate-${process.pid}`),
    VITE_SODA_INCREMENTAL32_RECOVERY: 'true',
    VITE_SODA_INCREMENTAL33_RECOVERY: 'false',
  })
  assert.equal(options.gameVersion, '3.3')
  assert.equal(options.env.VITE_SODA_INCREMENTAL32_RECOVERY, 'false')
  assert.equal(options.env.VITE_SODA_INCREMENTAL33_RECOVERY, 'true')
})

test('legacy recovery keeps its explicit 3.2 boundary and rejects an inherited 3.3 mode', () => {
  const options = recoveryBuildOptions({
    SODA_DERIVED_ROOT: tmpdir(),
    SODA_COMMUNITY_DIST: join(tmpdir(), 'recovery/3.2-update', `candidate-${process.pid}`),
    VITE_SODA_INCREMENTAL33_RECOVERY: 'true',
  })
  assert.equal(options.gameVersion, '3.2')
  assert.equal(options.env.VITE_SODA_INCREMENTAL32_RECOVERY, 'true')
  assert.equal(options.env.VITE_SODA_INCREMENTAL33_RECOVERY, 'false')
})

test('recovery refuses unsupported versions and cross-version or existing output', () => {
  const root = mkdtempSync(join(tmpdir(), 'soda-recovery-output-'))
  const env = { SODA_DERIVED_ROOT: root, SODA_RECOVERY_GAME_VERSION: '3.3' }
  assert.throws(
    () => recoveryBuildOptions({ ...env, SODA_RECOVERY_GAME_VERSION: '3.4' }),
    /Unsupported/,
  )
  assert.throws(
    () =>
      recoveryBuildOptions({ ...env, SODA_COMMUNITY_DIST: join(root, 'recovery/3.2-update/old') }),
    /must be a child/,
  )
  assert.throws(
    () =>
      recoveryBuildOptions({
        ...env,
        SODA_COMMUNITY_DIST: join(root, 'recovery/3.3-update/conflict'),
        VITE_SODA_INCREMENTAL32_RECOVERY: 'true',
        VITE_SODA_INCREMENTAL33_RECOVERY: 'true',
      }),
    /cannot both be enabled/,
  )
  const output = join(root, 'recovery/3.3-update/existing')
  mkdirSync(output, { recursive: true })
  writeFileSync(join(output, 'sentinel'), 'previous candidate bytes')
  assert.throws(
    () => recoveryBuildOptions({ ...env, SODA_COMMUNITY_DIST: output }),
    /already exists/,
  )
  assert.equal(readFileSync(join(output, 'sentinel'), 'utf8'), 'previous candidate bytes')
})

function withParentPublicFlag(value, run) {
  const previousFlag = process.env.VITE_SODA_PUBLIC_BUILD
  const previousExitCode = process.exitCode
  try {
    if (value === undefined) delete process.env.VITE_SODA_PUBLIC_BUILD
    else process.env.VITE_SODA_PUBLIC_BUILD = value
    return run()
  } finally {
    if (previousFlag === undefined) delete process.env.VITE_SODA_PUBLIC_BUILD
    else process.env.VITE_SODA_PUBLIC_BUILD = previousFlag
    process.exitCode = previousExitCode
  }
}

/** The gate reports progress on stdout; these assertions only need the captured executions. */
function silently(run) {
  const log = console.log
  const error = console.error
  const write = process.stdout.write.bind(process.stdout)
  const writeError = process.stderr.write.bind(process.stderr)
  console.log = () => {}
  console.error = () => {}
  process.stdout.write = () => true
  process.stderr.write = () => true
  try {
    return run()
  } finally {
    console.log = log
    console.error = error
    process.stdout.write = write
    process.stderr.write = writeError
  }
}

function executeAndCapture({ publicBuild, publicFlag }) {
  const executions = []
  const execute = (command, args, options) => {
    executions.push({ command, args, options })
    return { status: 0, stdout: '', stderr: '' }
  }
  const result = withParentPublicFlag(publicFlag, () =>
    silently(() =>
      runReleaseGate({
        execute,
        publicBuild,
        publicDist: publicBuild ? publicDistCandidate : undefined,
      }),
    ),
  )
  return { result, executions }
}

/** Exactly one step must match; a duplicate match means the runner was not per-step deterministic. */
function flagFor(executions, matchesStep, label) {
  const matches = executions.filter((execution) => matchesStep(execution.args))
  assert.equal(matches.length, 1, `expected exactly one step for ${label}`)
  return matches[0].options.env.VITE_SODA_PUBLIC_BUILD
}

const hasArg = (args, value) => args.includes(value)
const hasArgMatching = (args, pattern) => args.some((arg) => pattern.test(arg))
const scripts = (name) => (args) => hasArgMatching(args, new RegExp(`scripts/${name}$`))

test('quality self-tests remain in the current Node suite that the gate reuses', () => {
  for (const file of [
    'scripts/quality-check.test.mjs',
    'scripts/native-quality-check.test.mjs',
    'scripts/f5-style-boundary-check.test.mjs',
  ])
    assert.equal(currentNodeTests.filter((entry) => entry === file).length, 1, file)
})

test('local and public gates reuse quality self-tests only after the current Node suite passes', () => {
  for (const publicBuild of [false, true]) {
    const { executions } = executeAndCapture({
      publicBuild,
      publicFlag: publicBuild ? 'true' : undefined,
    })
    const quality = executions.filter((entry) => entry.args[0] === 'scripts/quality-check.mjs')
    assert.equal(quality.length, 1)
    assert.ok(quality[0].args.includes('--reuse-passed-node-self-tests'))
    assert.ok(
      executions.findIndex((entry) => entry.args[0] === 'scripts/run-current-node-tests.mjs') <
        executions.indexOf(quality[0]),
    )
  }
})

test('a failed Node suite stays blocking and does not authorize self-test reuse', () => {
  const executions = []
  const result = withParentPublicFlag(undefined, () =>
    silently(() =>
      runReleaseGate({
        publicBuild: false,
        execute: (_command, args) => {
          executions.push(args)
          return { status: args[0] === 'scripts/run-current-node-tests.mjs' ? 1 : 0 }
        },
      }),
    ),
  )
  assert.equal(result.ready, false)
  assert.equal(result.results.find((entry) => entry.id === 'node-current').status, 'rc_blocker')
  const quality = executions.find((args) => args[0] === 'scripts/quality-check.mjs')
  assert.ok(quality)
  assert.equal(quality.includes('--reuse-passed-node-self-tests'), false)
})

test('failed current contracts block heavy Vitest instead of testing stale inputs', () => {
  const contracts = [
    ['generated-catalog-integrity', 'scripts/verify-current-generated-catalogs.mjs'],
    ['test-census', 'scripts/release-test-census.mjs'],
    ['current-authority-validator', 'scripts/data-workbook/l3-validate-production-mapping.mjs'],
    ['production-chain-contract', 'scripts/production-chain-contract.mjs'],
  ]
  for (const [id, script] of contracts) {
    const executions = []
    const result = withParentPublicFlag(undefined, () =>
      silently(() =>
        runReleaseGate({
          publicBuild: false,
          execute: (_command, args) => {
            executions.push(args)
            return { status: args[0] === script ? 1 : 0 }
          },
        }),
      ),
    )
    assert.equal(result.ready, false)
    assert.deepEqual(result.results.find((entry) => entry.id === 'vitest-current').blockedBy, [id])
    assert.equal(
      executions.some((args) => args.includes('vitest.release.config.ts')),
      false,
    )
  }
})

test('public release gate assigns the build mode per step instead of inheriting it', () => {
  assert.equal(existsSync(publicDistCandidate), false)
  process.env[sentinelKey] = 'keep-me'
  try {
    const { executions } = executeAndCapture({ publicBuild: true, publicFlag: 'true' })
    assert.ok(executions.length > 0)
    for (const execution of executions)
      assert.equal(
        execution.options.env[sentinelKey],
        'keep-me',
        'unrelated environment configuration must stay inherited',
      )

    // Public front-end build and public-mode contract tests: flag on.
    assert.equal(
      flagFor(executions, scripts('build-public-dist\\.mjs'), 'public front-end build'),
      'true',
    )
    assert.equal(
      flagFor(executions, scripts('run-current-public-tests\\.mjs'), 'public-mode tests'),
      'true',
    )

    // Default/private suites, private API and smoke checks: flag explicitly off.
    assert.equal(
      flagFor(executions, (args) => hasArg(args, 'vitest.release.config.ts'), 'current vitest'),
      'false',
    )
    assert.equal(
      flagFor(executions, scripts('run-current-node-tests\\.mjs'), 'current node'),
      'false',
    )
    assert.equal(
      flagFor(
        executions,
        scripts('verify-current-generated-catalogs\\.mjs'),
        'generated catalog integrity',
      ),
      'false',
    )
    assert.equal(flagFor(executions, scripts('release-test-census\\.mjs'), 'test census'), 'false')
    assert.equal(
      flagFor(
        executions,
        (args) =>
          hasArg(args, '--current') && hasArgMatching(args, /l3-validate-production-mapping\.mjs$/),
        'authority validator',
      ),
      'false',
    )
    assert.equal(
      flagFor(executions, scripts('production-chain-contract\\.mjs'), 'production chain'),
      'false',
    )
    assert.equal(flagFor(executions, scripts('quality-check\\.mjs'), 'quality ratchet'), 'false')
    assert.equal(flagFor(executions, scripts('production-mode-smoke\\.mjs'), 'mode smoke'), 'false')
    assert.equal(
      flagFor(
        executions,
        (args) => hasArgMatching(args, /@playwright\/test\/cli\.js$/),
        'n1c regression',
      ),
      'false',
    )
    assert.equal(
      flagFor(executions, scripts('native-quality-check\\.mjs'), 'native artifact check'),
      'false',
    )
    assert.equal(
      flagFor(executions, (args) => hasArg(args, 'vite.server.config.ts'), 'private API build'),
      'false',
    )
    assert.equal(
      flagFor(
        executions,
        (args) => hasArgMatching(args, /server-smoke\.mjs$/),
        'private API smoke',
      ),
      'false',
    )
    assert.equal(
      flagFor(
        executions,
        scripts('materialize-scanner-distribution\\.mjs'),
        'scanner distribution',
      ),
      'false',
    )
    assert.equal(
      flagFor(
        executions,
        (args) => hasArgMatching(args, /prepare-public-shell\.mjs$/),
        'shell audit',
      ),
      'false',
    )
  } finally {
    delete process.env[sentinelKey]
  }
})

test('public release gate keeps the isolated browser dist and the documented step set', () => {
  const { result, executions } = executeAndCapture({ publicBuild: true, publicFlag: 'true' })
  const ids = result.results.map((step) => step.id)
  for (const id of [
    'public-build-tests',
    'private-api-build',
    'private-api-smoke',
    'scanner-distribution-materialize',
    'public-media-clearance',
    'public-browser-audit',
  ])
    assert.ok(ids.includes(id), `missing public step ${id}`)

  const builds = executions.filter((execution) =>
    execution.args.includes('scripts/build-public-dist.mjs'),
  )
  assert.equal(builds.length, 1)
  assert.deepEqual(builds[0].args, ['scripts/build-public-dist.mjs'])
  assert.equal(builds[0].options.env.SODA_PUBLIC_DIST, publicDistCandidate)
  assert.equal(
    executions.some(
      (execution) =>
        execution.options.env.VITE_SODA_PUBLIC_BUILD === 'true' &&
        execution.args.includes('node_modules/vite/bin/vite.js'),
    ),
    false,
    'public release must not bypass the verified installer materializer',
  )
  for (const execution of executions)
    assert.equal(execution.options.env.SODA_WEB_DIST, publicDistCandidate)
})

test('local release gate keeps every step in the local build mode', () => {
  const { executions } = executeAndCapture({ publicBuild: false, publicFlag: undefined })
  assert.ok(executions.length > 0)
  for (const execution of executions)
    assert.equal(execution.options.env.VITE_SODA_PUBLIC_BUILD, 'false')
  assert.equal(
    flagFor(executions, (args) => hasArgMatching(args, /vite\/bin\/vite\.js$/), 'local build'),
    'false',
  )
})

test('local release gate overrides a public flag inherited from an interactive shell', () => {
  const { executions } = executeAndCapture({ publicBuild: false, publicFlag: 'true' })
  assert.ok(executions.length > 0)
  for (const execution of executions)
    assert.equal(execution.options.env.VITE_SODA_PUBLIC_BUILD, 'false')
  const vitest = executions.find((entry) => entry.args.includes('vitest.release.config.ts'))
  assert.deepEqual(vitest.options.stdio, ['ignore', 'inherit', 'inherit'])
  const integrity = executions.find(
    (entry) => entry.args[0] === 'scripts/verify-current-generated-catalogs.mjs',
  )
  assert.deepEqual(integrity.options.stdio, ['ignore', 'pipe', 'pipe'])
})

test('an assigned build mode reaches the child process instead of the parent value', () => {
  const printFlag = ['-e', 'process.stdout.write(String(process.env.VITE_SODA_PUBLIC_BUILD))']
  const localChild = spawnSync(process.execPath, printFlag, {
    encoding: 'utf8',
    env: stepEnvironment({}),
  })
  assert.equal(localChild.stdout, 'false')
  const publicChild = spawnSync(process.execPath, printFlag, {
    encoding: 'utf8',
    env: stepEnvironment({ publicEntryBuild: true }),
  })
  assert.equal(publicChild.stdout, 'true')
})

test('public release gate still refuses a parent without the public entry flag', () => {
  let result
  withParentPublicFlag(undefined, () => {
    result = silently(() =>
      runReleaseGate({
        execute: () => ({ status: 0, stdout: '', stderr: '' }),
        publicBuild: true,
        publicDist: publicDistCandidate,
      }),
    )
  })
  assert.equal(result.ready, false)
  assert.deepEqual(
    result.results.map((step) => [step.id, step.status]),
    [['public-build-target', 'rc_blocker']],
  )
})
