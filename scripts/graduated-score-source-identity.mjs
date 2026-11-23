import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const appRoot = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
// Include the offline adapter and the actual runtime closure, including dynamically loaded roots.
const roots = ['scripts/build-full-rotation-reference-inputs.mjs',
  'scripts/build-kodie-mechanism-policies.mjs',
  'src/calculation/currentAgentPlanningEffectBlueprint.ts',
  'src/calculation/currentPlanningEffectRuntime.ts',
  'src/calculation/currentFormulaMechanicContracts.ts',
  'scripts/team-kodie-source-clock-control.mjs',
  'scripts/build-zsim-full-rotation-reference-inputs.mjs', 'scripts/team-zsim-native-apl-hugo.py', 'scripts/team_zsim_summit.py',
  'scripts/team_zsim_interrupt_resources.py',
  'scripts/team_zsim_cordis_trigger.py',
  'scripts/team_zsim_trigger_source.py',
  'scripts/team_zsim_seed_source.py', 'scripts/team_zsim_astral_voice.py',
  'scripts/team_zsim_seed_named_resources.py',
  'scripts/team_zsim_astra_replacement.py',
  // Python imports are not traversed by the TypeScript resolver below.
  'scripts/team_zsim_potential_source.py', 'scripts/team_zsim_potential_effects.py',
  'scripts/team_zsim_anby_theoretical_clock.py',
  'scripts/team_zsim_shadow_harmony_guard.py',
  'scripts/team_zsim_weighted_hits.py', 'scripts/team_zsim_hit_resources.py', 'scripts/team_zsim_anby_boundary.py',
  'scripts/team_zsim_lighter_astra_mindscapes.py',
  'scripts/team_zsim_miyabi_packets.py', 'scripts/team_zsim_shock_eligibility.py',
  'scripts/team_zsim_sugar_buildup.py', 'scripts/team_zsim_passive_swap_clock.py',
  'scripts/team_zsim_reaction_daze.py', 'scripts/team_zsim_policy_frost.py',
  'scripts/team_zsim_mechanism_policy.py', 'scripts/team_zsim_policy_assault.py', 'scripts/team_zsim_policy_seed.py',
  'scripts/team_zsim_policy_anomaly.py', 'scripts/team_zsim_policy_aftershock.py',
  'scripts/team_zsim_policy_broad.py',
  'scripts/team_zsim_native_member_policy.py',
  'scripts/team_zsim_shared_expansion_policy.py', 'scripts/team_zsim_shared_runtime.py',
  'scripts/team_zsim_shared_anomaly_expansion.py', 'scripts/team_zsim_support_expansion_policy.py',
  'scripts/team_zsim_caesar_support.py', 'scripts/team_zsim_piper_runtime.py',
  'scripts/team_zsim_lucy_support.py', 'scripts/team_zsim_qte_sources.py', 'scripts/team_zsim_chaos_jazz.py',
  'scripts/team_zsim_burnice_state.py', 'scripts/team_zsim_burnice_actions.py',
  'scripts/team_zsim_burnice_runtime.py', 'scripts/team_zsim_burnice_abloom.py', 'scripts/team_zsim_burnice_policy.py',
  'scripts/team_zsim_nicole_support.py', 'scripts/team_zsim_nicole_policy.py',
  'scripts/team_zsim_anby_ordinary_runtime.py', 'scripts/team_zsim_anby_ordinary_policy.py',
  'scripts/team_zsim_zhu_yuan_shells.py', 'scripts/team_zsim_soukaku_support.py',
  'scripts/team_zsim_zhu_yuan_core.py', 'scripts/team_zsim_chaotic_metal.py',
  'scripts/team_zsim_soukaku_mechanics.py',
  'scripts/team_zsim_rina_support.py', 'scripts/team_zsim_rina_meter.py',
  'scripts/team_zsim_rina_packets.py',
  'scripts/build-kodie-mechanism-policies.mjs', 'scripts/team-kodie-member-policy.mjs',
  'scripts/team-kodie-lighter-adapter.mjs', 'scripts/team-kodie-lighter-ledger.mjs', 'scripts/team-kodie-lighter-state.mjs',
  'scripts/team-seth-opening.mjs', 'scripts/team-seth-neutral-special.mjs',
  'scripts/build-mechanism-rotation-batch.py',
  'scripts/team_zsim_policy_sheer.py',
  'scripts/team_zsim_qingyi_resources.py',
  'scripts/team_zsim_qingming_initial.py',
  'scripts/team_zsim_source_provenance.py',
  'scripts/team_zsim_vivian_event_provenance.py',
  'src/gameDataPacks/generated/current-agent-mechanic-catalog.v1.json',
  'src/gameDataPacks/generated/current-agent-decision-mechanic-catalog.v1.json',
  'src/gameDataPacks/data/current-encyclopedia-display.3.3.json',
  'scripts/graduated-score-source-identity.mjs', 'src/calculation/referenceCombatRuntime.ts',
  'src/decision/teamRatingProtocol.ts', 'src/calculation/currentAgentMechanicContracts.ts',
  'src/decision/teamGraduationBuilds.ts',
  'src/calculation/potentialApplicationBinding.ts',
  'src/gameDataPacks/reviewedPotentialSupportDefinitions.ts']
const sha = bytes => createHash('sha256').update(bytes).digest('hex')

export function runtimeImportSpecifiers(source, fileName = 'input.ts') {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true)
  const found = []
  const collect = node => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause
      const bindings = clause?.namedBindings
      const onlyTypes = clause && !clause.name && bindings && ts.isNamedImports(bindings) &&
        bindings.elements.length > 0 && bindings.elements.every(x => x.isTypeOnly)
      if (!clause?.isTypeOnly && !onlyTypes) found.push(node.moduleSpecifier.text)
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.exportClause
      const onlyTypes = clause && ts.isNamedExports(clause) && clause.elements.length > 0 && clause.elements.every(x => x.isTypeOnly)
      if (!node.isTypeOnly && !onlyTypes) found.push(node.moduleSpecifier.text)
    } else if (ts.isCallExpression(node) && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0]) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(file) === 'require')) {
      found.push(node.arguments[0].text)
    }
    ts.forEachChild(node, collect)
  }
  collect(file)
  return found
}

export async function currentGraduatedScoreSourceInputs(readFileFn = readFile) {
  const pending = roots.map(p => path.resolve(appRoot, p)), files = new Map()
  const options = { moduleResolution: ts.ModuleResolutionKind.Bundler, allowJs: true, resolveJsonModule: true }
  while (pending.length) {
    const file = pending.pop()
    if (files.has(file)) continue
    const bytes = await readFileFn(file)
    files.set(file, sha(bytes))
    if (file.endsWith('.json') || file.endsWith('.py')) continue
    for (const specifier of runtimeImportSpecifiers(bytes.toString('utf8'), file)) {
      if (!specifier.startsWith('.')) continue
      if (/\.(?:css|scss|svg|png|webp|jpg)$/i.test(specifier)) continue
      const result = ts.resolveModuleName(specifier, file, options, ts.sys).resolvedModule
      if (!result) throw new Error(`unresolved graduated score input: ${file} -> ${specifier}`)
      const target = path.resolve(result.resolvedFileName)
      if (!target.startsWith(appRoot + path.sep) || target.includes(`${path.sep}node_modules${path.sep}`)) continue
      // The generated result can be reached through broad type imports; it cannot hash itself.
      if (target === path.join(appRoot, 'src/gameDataPacks/generated/graduated-team-scores.v1.json')) continue
      if (!target.endsWith('.d.ts')) pending.push(target)
    }
  }
  const inputs = [...files].map(([file, digest]) => [path.relative(appRoot, file).replaceAll('\\', '/'), digest])
    .sort(([a], [b]) => a.localeCompare(b, 'en'))
  return inputs
}

export async function currentGraduatedScoreSourceIdentity(readFileFn = readFile) {
  return sha(JSON.stringify(await currentGraduatedScoreSourceInputs(readFileFn)))
}

// Kodie executes JavaScript and source data; the Python producers belong to
// the independent Zsim path. Keep the full identity on artifacts, but do not
// discard an in-flight Kodie evaluation for an unused Python adapter edit.
// Sources explicitly declared by the retained axis are still verified there.
export function verifyKodieExecutionSourceInputs(before, after) {
  const executed = inputs => inputs.filter(([file]) => !file.endsWith('.py'))
  assert.deepEqual(executed(after), executed(before), 'Kodie execution source changed during rotation evaluation')
}

export async function verifyGraduatedScoreSourceIdentity(artifact, current) {
  if (!Array.isArray(artifact?.rows)) throw new Error('invalid graduated score rows')
  if (artifact.rows.length && artifact.algorithmSourceHash !== (current ?? await currentGraduatedScoreSourceIdentity()))
    throw new Error('graduated score algorithm source identity changed; rebuild and review scores')
}

export async function verifyCurrentGraduatedScoreArtifact() {
  const artifact = JSON.parse(await readFile(new URL('../src/gameDataPacks/generated/graduated-team-scores.v1.json', import.meta.url), 'utf8'))
  await verifyGraduatedScoreSourceIdentity(artifact)
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url)
  await verifyCurrentGraduatedScoreArtifact()
