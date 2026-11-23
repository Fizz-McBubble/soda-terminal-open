import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolveBuildStorage } from './derived-build-storage.mjs'

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const node = process.execPath
const activeDesktopDist = join(resolveBuildStorage(appRoot).derivedRoot, 'vite', 'dist')

export function validatePublicBuildTarget(path) {
  if (!path || !isAbsolute(path)) throw new Error('public_dist_absolute_path_required')
  const target = resolve(path)
  const projectRelative = relative(appRoot, target)
  const withinProject =
    projectRelative === '' ||
    (projectRelative !== '..' &&
      !projectRelative.startsWith(`..${sep}`) &&
      !isAbsolute(projectRelative))
  if (target === activeDesktopDist || withinProject || existsSync(target))
    throw new Error('public_dist_must_be_new_isolated_directory')
  return target
}

/**
 * Each step declares the build mode it runs in. A public release run must never leak
 * `VITE_SODA_PUBLIC_BUILD=true` into the default suites, the private API build or the smoke checks,
 * and the local gate must never inherit a public flag from an interactive shell.
 */
export function stepEnvironment(check) {
  return {
    ...process.env,
    ...(check.publicDist ? { SODA_PUBLIC_DIST: check.publicDist } : {}),
    VITE_SODA_PUBLIC_BUILD: check.publicEntryBuild === true ? 'true' : 'false',
  }
}

const checks = [
  {
    id: 'generated-catalog-integrity',
    classification: 'current_contract',
    command: node,
    args: ['scripts/verify-current-generated-catalogs.mjs'],
    quietOnPass: true,
  },
  {
    id: 'test-census',
    classification: 'current_contract',
    command: node,
    args: ['scripts/release-test-census.mjs'],
    quietOnPass: true,
  },
  {
    id: 'current-authority-validator',
    classification: 'current_contract',
    command: node,
    args: ['scripts/data-workbook/l3-validate-production-mapping.mjs', '--current'],
    quietOnPass: true,
  },
  {
    id: 'production-chain-contract',
    classification: 'current_contract',
    command: node,
    args: ['scripts/production-chain-contract.mjs'],
    quietOnPass: true,
  },
  {
    id: 'vitest-current',
    requires: [
      'generated-catalog-integrity',
      'test-census',
      'current-authority-validator',
      'production-chain-contract',
    ],
    classification: 'current_production',
    command: node,
    args: ['node_modules/vitest/vitest.mjs', 'run', '--config', 'vitest.release.config.ts'],
  },
  {
    id: 'node-current',
    classification: 'node',
    command: node,
    args: ['scripts/run-current-node-tests.mjs'],
  },
  {
    id: 'quality-ratchet-format-lint',
    classification: 'current_production',
    command: node,
    args: ['scripts/quality-check.mjs'],
  },
  {
    id: 'production-build',
    requires: ['generated-catalog-integrity', 'quality-ratchet-format-lint'],
    classification: 'current_production',
    command: node,
    args: ['node_modules/vite/bin/vite.js', 'build'],
  },
  {
    id: 'production-mode-smoke',
    requires: ['production-build'],
    classification: 'current_production',
    command: node,
    args: ['scripts/production-mode-smoke.mjs'],
  },
  {
    id: 'n1c-foundation-consumer-regression',
    requires: ['production-build'],
    classification: 'current_production',
    command: node,
    args: ['node_modules/@playwright/test/cli.js', 'test', '--config', 'playwright.n1c.config.ts'],
  },
  {
    id: 'native-environment-artifact',
    classification: 'native_artifact_environment',
    command: node,
    args: ['scripts/native-quality-check.mjs'],
    environmentExitCodes: [2],
  },
]

export function runReleaseGate({
  execute = spawnSync,
  publicBuild = process.env.SODA_PUBLIC_BUILD === 'true',
  publicDist = process.env.SODA_WEB_DIST,
} = {}) {
  let browserDist
  if (publicBuild) {
    try {
      if (process.env.VITE_SODA_PUBLIC_BUILD !== 'true')
        throw new Error('public_entry_build_flag_required')
      browserDist = validatePublicBuildTarget(publicDist)
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
      return {
        ready: false,
        results: [
          {
            id: 'public-build-target',
            classification: 'n5_public_artifact',
            status: 'rc_blocker',
            exitCode: 1,
          },
        ],
      }
    }
  }
  const activeChecks = publicBuild
    ? [
        ...checks.map((check) =>
          check.id === 'production-build'
            ? {
                ...check,
                // Use the same release materializer as a standalone public build. A direct
                // Vite build can silently copy an unrelated retained local installer.
                args: ['scripts/build-public-dist.mjs'],
                publicDist: browserDist,
                publicEntryBuild: true,
              }
            : check,
        ),
        {
          id: 'public-build-tests',
          classification: 'n5_public_artifact',
          command: node,
          args: ['scripts/run-current-public-tests.mjs'],
          publicEntryBuild: true,
        },
        {
          id: 'private-api-build',
          classification: 'n5_public_artifact',
          command: node,
          args: ['node_modules/vite/bin/vite.js', 'build', '--config', 'vite.server.config.ts'],
        },
        {
          id: 'private-api-smoke',
          classification: 'n5_public_artifact',
          requires: ['private-api-build'],
          command: node,
          args: ['deploy/server-smoke.mjs'],
        },
        {
          id: 'scanner-distribution-materialize',
          classification: 'n5_public_artifact',
          requires: ['production-build'],
          command: node,
          args: [
            'scripts/materialize-scanner-distribution.mjs',
            '--origin',
            process.env.SODA_PUBLIC_ORIGIN ?? '',
            '--output',
            join(browserDist, 'downloads'),
          ],
        },
        {
          id: 'public-media-clearance',
          classification: 'n5_public_artifact',
          requires: ['production-build'],
          command: node,
          args: ['deploy/materialize-public-media-clearance.mjs', '--dist', browserDist],
        },
        {
          id: 'public-browser-audit',
          classification: 'n5_public_artifact',
          requires: [
            'production-build',
            'scanner-distribution-materialize',
            'public-media-clearance',
          ],
          command: node,
          args: [
            'deploy/prepare-public-shell.mjs',
            browserDist,
            process.env.VITE_SODA_RELEASE_ID ?? '',
            process.env.SODA_PUBLIC_ORIGIN ?? '',
          ],
        },
      ]
    : checks
  const results = []
  for (const check of activeChecks) {
    const unmet =
      check.requires?.filter(
        (id) => !results.some((result) => result.id === id && result.status === 'pass'),
      ) ?? []
    if (unmet.length) {
      results.push({
        id: check.id,
        classification: check.classification,
        status: 'rc_blocker',
        exitCode: 1,
        blockedBy: unmet,
      })
      console.log(`[BLOCKED] ${check.id}: ${unmet.join(', ')}`)
      continue
    }
    console.log(`\n[RUN] ${check.id} (${check.classification})`)
    // Reuse only this invocation's successful Node suite, never a stale environment flag.
    let args =
      check.id === 'quality-ratchet-format-lint' &&
      results.some((result) => result.id === 'node-current' && result.status === 'pass')
        ? [...check.args, '--reuse-passed-node-self-tests']
        : check.args
    if (check.id === 'public-browser-audit' && browserDist) {
      const manifestPath = join(browserDist, 'offline-shell-manifest.json')
      if (existsSync(manifestPath)) {
        const browserReleaseId = JSON.parse(readFileSync(manifestPath, 'utf8')).releaseId
        args = [check.args[0], browserDist, browserReleaseId, process.env.SODA_PUBLIC_ORIGIN ?? '']
      }
    }
    const result = execute(check.command, args, {
      cwd: appRoot,
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 64 * 1024 * 1024,
      // Long suites report progress immediately; quiet contracts retain failure output.
      stdio: check.quietOnPass ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'inherit', 'inherit'],
      env: {
        ...stepEnvironment(check),
        ...(browserDist ? { SODA_WEB_DIST: browserDist } : {}),
      },
    })
    const exitCode = result.status ?? 1
    const status =
      exitCode === 0
        ? 'pass'
        : check.environmentExitCodes?.includes(exitCode)
          ? 'environment_blocked'
          : 'rc_blocker'
    results.push({ id: check.id, classification: check.classification, status, exitCode })
    if (exitCode === 0 && check.quietOnPass) console.log(`[PASS] ${check.id}`)
    else {
      process.stdout.write(result.stdout ?? '')
      process.stderr.write(result.stderr ?? '')
    }
  }
  const rcBlockers = results.filter((result) => result.status === 'rc_blocker')
  const environmentBlockers = results.filter((result) => result.status === 'environment_blocked')
  const ready = rcBlockers.length === 0 && environmentBlockers.length === 0
  console.log('\n=== CONVERGENCE RELEASE GATE SUMMARY ===')
  for (const result of results)
    console.log(`${result.status.padEnd(19)} ${result.classification.padEnd(28)} ${result.id}`)
  console.log(
    'legacy_frozen tests are classified by test-census and are not current release blockers.',
  )
  if (publicBuild) {
    console.log(`N5_LOCAL_ARTIFACT_GATE=${ready ? 'PASS' : 'BLOCKED'}`)
    console.log('Target HTTPS, licenses, load and user acceptance are separate N5/N6 gates.')
  } else {
    console.log(`PC7_RC_READINESS=${ready ? 'READY' : 'NOT_READY'}`)
    console.log(`CONVERGENCE_RELEASE_READINESS=${ready ? 'READY' : 'NOT_READY'}`)
  }
  if (!ready) {
    console.log(`RC_BLOCKERS=${rcBlockers.map((result) => result.id).join(',') || 'none'}`)
    console.log(
      `ENVIRONMENT_BLOCKERS=${environmentBlockers.map((result) => result.id).join(',') || 'none'}`,
    )
    process.exitCode = rcBlockers.length ? 1 : 2
  }
  return { ready, results }
}

if (pathToFileURL(process.argv[1]).href === import.meta.url) runReleaseGate()
