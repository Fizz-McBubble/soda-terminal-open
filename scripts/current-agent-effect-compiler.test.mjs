import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  compileEffectRecipients,
  compileFunctionalInputs,
  deriveFormulaEffectCoverage,
  effectCatalogContentHash,
  luciaEffectReplayPin,
  replayPinnedLuciaEffects,
} from './current-agent-effect-compiler.mjs'

const effects = (source) => compileEffectRecipients(source, 'fixture.ts')
const refs = (node) => {
  if (!node || typeof node !== 'object') return []
  return [
    ...(node.kind === 'reference' ? [node.path] : []),
    ...Object.values(node).flatMap((value) =>
      Array.isArray(value) ? value.flatMap(refs) : refs(value),
    ),
  ]
}

test('old registration retains event-only scope; formula listing argument is not targeting', () => {
  const [old, formula] = effects(`
    registerBuff('old',teamBuff.combat.atk.add(constant(12)),undefined,false,false)
    registerBuffFormula('new',teamBuff.combat.atk.add(constant(12)),undefined,false)
  `)
  assert.equal(old.applicationScope, 'event_only')
  assert.equal(formula.applicationScope, 'generic')
  assert.deepEqual(formula.recipients, ['team'])
  assert.deepEqual(old.numericExpression.expressionIr, formula.numericExpression.expressionIr)
  assert.throws(
    () => effects("registerBuffFormula('bad',teamBuff.combat.atk.add(12),undefined,false,false)"),
    /Unsupported registerBuffFormula signature/,
  )
})

test('aliases and initial HP conditional scaling use the same effect value IR', () => {
  const [effect] = effects(`
    const scaled = teamBuff.combat.sheerForce.add(darkbreaker.ifOn(
      min(sum(constant(612),prod(char.special,constant(24))),
          sum(constant(12),prod(own.initial.hp,constant(.005),sum(constant(5),prod(char.special,constant(.2))))))))
    registerBuffFormula('scaled',scaled)
  `)
  assert.equal(effect.effectId, 'scaled')
  assert.deepEqual(effect.recipients, ['team'])
  assert.equal(effect.numericExpression.expressionIrReady, true)
  assert.equal(effect.numericExpression.classification, 'upstream_expression_available')
  assert.ok(refs(effect.numericExpression.expressionIr).includes('own.initial.hp'))
  assert.ok(effect.numericExpression.dependencyKinds.includes('conditional_state'))
  assert.ok(effect.numericExpression.operators.includes('min'))
})

test('granting a stat keeps receiver separate from read inputs', () => {
  const [effect] = effects("registerBuffFormula('grant',teamBuff.combat.hp_.add(percent(.05)))")
  const ir = effect.numericExpression.expressionIr
  assert.equal(ir.receiver.path, 'teamBuff.combat.hp_')
  assert.deepEqual(ir.arguments.flatMap(refs), [])
  assert.ok(!ir.arguments.flatMap(refs).includes('own.initial.hp'))
})

test('TODO and generic placeholders preserve fail-closed consumer boundaries', () => {
  const [effect] = effects(`// TODO: incomplete state
registerBuffFormula('pending',teamBuff.combat.atk.add(boolConditional.ifOn(1)))`)
  assert.equal(effect.numericExpression.todoFlagged, true)
  assert.ok(effect.numericExpression.todoBoundary.includes('fail-closed'))
  assert.equal(effect.numericExpression.classification, 'declarative_baseline_input')
  assert.deepEqual(effect.numericExpression.genericConditionalIdentifiers, ['boolConditional'])
})

test('unsupported syntax remains unready and functional compilation retains source inputs', () => {
  const [effect] = effects("registerBuffFormula('bad',teamBuff.combat.atk.add(flag ? 1 : 0))")
  assert.equal(effect.numericExpression.expressionIrReady, false)
  assert.equal(effect.numericExpression.expressionIr.arguments[0].kind, 'unsupported')
  const [heal] = compileFunctionalInputs(
    "customHeal('heal',prod(own.final.hp,percent(.01)))",
    'fixture.ts',
  )
  assert.equal(heal.kind, 'heal')
  assert.equal(heal.numericExpression.expressionIrReady, true)
  assert.deepEqual(refs(heal.numericExpression.expressionIr), ['own.final.hp'])
  assert.equal(
    compileFunctionalInputs("customShield('bad',()=>own.final.hp)", 'fixture.ts')[0]
      .numericExpression.expressionIrReady,
    false,
  )
})

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// Verbatim MIT fixture from the pinned formula path; copyright and permission
// statement are retained in src/upstream/genshinOptimizer/NOTICE.md.
const sourcePath =
  process.env.SODA_LUCIA_EFFECT_SOURCE ??
  path.join(appRoot, 'scripts/fixtures/lucia-3456cd.formula.txt')

test('retained MIT formula fixture contains the exact pinned LF source and scaling registration', () => {
  const bytes = readFileSync(sourcePath)
  assert.equal(
    createHash('sha256').update(bytes).digest('hex').toUpperCase(),
    luciaEffectReplayPin.lfSha256,
  )
  assert.equal(bytes.includes(Buffer.from('\r\n')), false)
  const source = bytes.toString('utf8')
  const compiled = compileEffectRecipients(source, 'Lucia.ts')
  const formula = compiled.find((effect) => effect.effectId === 'exSpecial_sheerForce')
  assert.equal(formula.locator, 'Lucia.ts:213')
  assert.equal(formula.applicationScope, 'generic')
  assert.deepEqual(formula.recipients, ['team'])
  assert.ok(refs(formula.numericExpression.expressionIr).includes('own.initial.hp'))
})

test('fixed-source replay adds only the omitted effect and preserves all other records', () => {
  const current = JSON.parse(
    readFileSync(
      path.join(
        appRoot,
        'src/gameDataPacks/generated/current-agent-decision-mechanic-catalog.v1.json',
      ),
      'utf8',
    ),
  )
  const before = structuredClone(current)
  const row = before.formulaEffects.find((item) => item.upstreamKey === 'Lucia')
  row.effects = row.effects.filter((effect) => effect.effectId !== 'exSpecial_sheerForce')
  Object.assign(before.coverage, deriveFormulaEffectCoverage(before.formulaEffects))
  before.contentHash = effectCatalogContentHash(before)
  const source = readFileSync(sourcePath, 'utf8')
  const after = replayPinnedLuciaEffects(before, source)
  const next = after.formulaEffects.find((item) => item.upstreamKey === 'Lucia')
  assert.deepEqual(
    next.effects.filter((effect) => effect.effectId !== 'exSpecial_sheerForce'),
    row.effects,
  )
  assert.deepEqual(next.functionalInputs, row.functionalInputs)
  assert.equal(next.effects.length, row.effects.length + 1)
  assert.deepEqual(
    after.formulaEffects.filter((item) => item.upstreamKey !== 'Lucia'),
    before.formulaEffects.filter((item) => item.upstreamKey !== 'Lucia'),
  )
  for (const key of Object.keys(before).filter(
    (key) => !['formulaEffects', 'coverage', 'contentHash'].includes(key),
  ))
    assert.deepEqual(after[key], before[key])
  assert.deepEqual(
    deriveFormulaEffectCoverage(after.formulaEffects),
    Object.fromEntries(
      Object.keys(deriveFormulaEffectCoverage(after.formulaEffects)).map((key) => [
        key,
        after.coverage[key],
      ]),
    ),
  )
  assert.equal(after.contentHash, effectCatalogContentHash(after))
  assert.deepEqual(replayPinnedLuciaEffects(after, source), after)
  assert.deepEqual(
    replayPinnedLuciaEffects(before, source.replaceAll('\r\n', '\n').replaceAll('\n', '\r\n')),
    after,
  )

  assert.throws(() => replayPinnedLuciaEffects(before, source + '\n'), /source bytes mismatch/)
  for (const mutate of [
    (catalog) => {
      catalog.gameVersion = '3.1'
    },
    (catalog) => {
      catalog.generatedFrom.formulaCommit = 'a'.repeat(40)
    },
    (catalog) => {
      catalog.formulaEffects.find((item) => item.upstreamKey === 'Lucia').source.formulaSha256 =
        'B'.repeat(64)
    },
    (catalog) => {
      catalog.formulaEffects.find(
        (item) => item.upstreamKey === 'Lucia',
      ).effects[0].numericExpression.expressionSha256 = 'C'.repeat(64)
    },
    (catalog) => {
      catalog.formulaEffects.find((item) => item.upstreamKey === 'Lucia').functionalInputs[0].kind =
        'shield'
    },
  ]) {
    const bad = structuredClone(before)
    mutate(bad)
    bad.contentHash = effectCatalogContentHash(bad)
    assert.throws(
      () => replayPinnedLuciaEffects(bad, source),
      /mismatch|changes an existing|changes existing functional/,
    )
  }
  const badHash = structuredClone(before)
  badHash.contentHash = '0'.repeat(64)
  assert.throws(() => replayPinnedLuciaEffects(badHash, source), /content hash mismatch/)
})
