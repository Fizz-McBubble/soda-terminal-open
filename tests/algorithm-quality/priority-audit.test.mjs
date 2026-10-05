import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import {
  parseCandidateSubstatPriority,
  candidatePriorityPrefixVector,
} from '../../src/gameDataPacks/candidateSubstatPriority.ts'
import { compareCandidateDiscFacts } from '../../src/optimizer/candidateSearchFacts.ts'
import { candidateDiscProposals } from '../../src/optimizer/candidateDiscProposals.ts'

// Match Vite's real internal bindings and Node's JSON contract; no data replacements.
const bindingsUrl = new URL('../../build/public-boundaries.json', import.meta.url)
const bindings = JSON.parse(readFileSync(bindingsUrl, 'utf8')).boundaries
const isPublic =
  JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).name ===
  'soda-terminal-open'
registerHooks({
  resolve(specifier, context, next) {
    const binding = bindings.find((row) => row.specifier === specifier)
    const result = next(
      binding ? new URL(isPublic ? binding.public : binding.local, bindingsUrl).href : specifier,
      context,
    )
    return result.url.endsWith('.json') ? { ...result, importAttributes: { type: 'json' } } : result
  },
})
const { candidatePriorityEvidence } =
  await import('../../src/gameDataPacks/candidatePriorityEvidence.ts')
const { candidatePriorityToken } = await import('../../src/gameDataPacks/candidateStatParsing.ts')
const { getCandidateWarehouseConstraint } =
  await import('../../src/gameDataPacks/candidateWarehouseConstraints.ts')
const { gameData32BuildGuidance } =
  await import('../../src/gameDataPacks/gameData32BuildGuidance.ts')
const { playerBuildProfiles30 } = await import('../../src/gameDataPacks/playerBuildProfiles.ts')

test('actual pinned Claret source remains ordered and input is immutable', () => {
  const constraint = getCandidateWarehouseConstraint('agent-claret')
  const before = JSON.stringify(constraint)
  assert.deepEqual(candidatePriorityEvidence(constraint).tiers, [
    ['crit_rate'],
    ['def_percent'],
    ['crit_dmg'],
    ['pen'],
    ['def_flat'],
  ])
  assert.equal(JSON.stringify(constraint), before)
})
test('actual pinned Roxy source keeps the documented ordinal chain', () => {
  assert.deepEqual(candidatePriorityEvidence(getCandidateWarehouseConstraint('agent-roxy')).tiers, [
    ['crit_rate'],
    ['crit_dmg'],
    ['atk_percent'],
    ['pen'],
    ['atk_flat'],
  ])
})
for (const [text, kind, tiers] of [
  [
    '暴击率 = 防御力百分比 > 暴击伤害 > 穿透值 > 固定防御力',
    'ordered',
    [['crit_rate', 'def_percent'], ['crit_dmg'], ['pen'], ['def_flat']],
  ],
  ['暴击率（达到目标前） > 防御力百分比 > 暴击伤害 > 穿透值 > 固定防御力', 'conditional', null],
  ['暴击率 > 未知条件属性', 'unordered', null],
])
  test(`source adapter preserves actual text semantics: ${text}`, () => {
    const guidance = gameData32BuildGuidance['agent-claret']
    const original = guidance.subStatLines
    try {
      guidance.subStatLines = [text]
      const result = candidatePriorityEvidence(getCandidateWarehouseConstraint('agent-claret'))
      assert.equal(result.kind, kind)
      if (tiers) assert.deepEqual(result.tiers, tiers)
    } finally {
      guidance.subStatLines = original
    }
  })

test('source ID, hash and verified pins all gate order', () => {
  for (const update of [{ id: 'different' }, { contentHash: 'different' }, { verified: false }]) {
    const constraint = structuredClone(getCandidateWarehouseConstraint('agent-claret'))
    constraint.sources = constraint.sources.map((source) => ({ ...source, ...update }))
    assert.equal(candidatePriorityEvidence(constraint).kind, 'unordered')
  }
})

test('unverified profile field cannot inherit a verified entry with the same ID/hash', () => {
  const profile = playerBuildProfiles30.find((row) =>
    row.fields.some((field) => field.path === 'build.main_sub_stats' && field.source),
  )
  const field = profile.fields.find((row) => row.path === 'build.main_sub_stats')
  const original = structuredClone(field)
  const constraint = structuredClone(getCandidateWarehouseConstraint(profile.agentId))
  try {
    field.value = { subStats: ['暴击率 > 暴击伤害'] }
    field.source = { ...field.source, verified: false }
    constraint.sources = [{ ...field.source, verified: true }]
    constraint.subStatWeights = { crit_rate: 1, crit_dmg: 1 }
    assert.equal(candidatePriorityEvidence(constraint).kind, 'unordered')
  } finally {
    Object.assign(field, original)
  }
})

test('unknown or named conditions never activate a priority vector', () => {
  for (const text of ['暴击率（未确认阈值） > 暴击伤害', '暴击率 > 未知词条']) {
    assert.equal(
      candidatePriorityPrefixVector(parseCandidateSubstatPriority([text], candidatePriorityToken), {
        crit_rate: 5,
      }),
      null,
    )
  }
})

const disc = (id, value = 2) => ({
  id,
  setId: 'same',
  slot: 1,
  level: 15,
  rarity: 'S',
  mainStat: 'hp_flat',
  subStats: [{ stat: 'crit_rate', value, upgrades: 0 }],
})
test('fact tie breaks compare numerical values numerically, then physical IDs', () => {
  assert.ok(compareCandidateDiscFacts(disc('a', 2), disc('b', 10)) < 0)
  assert.ok(compareCandidateDiscFacts({ ...disc('a'), level: 2 }, { ...disc('b'), level: 10 }) < 0)
  assert.ok(compareCandidateDiscFacts(disc('a'), disc('b')) < 0)
})
test('prefix overflow and structurally invalid tiers fail closed', () => {
  assert.equal(
    candidatePriorityPrefixVector(
      { kind: 'ordered', tiers: [['a'], ['b']] },
      { a: 1e308, b: 1e308 },
    ),
    null,
  )
  assert.equal(candidatePriorityPrefixVector({ kind: 'ordered', tiers: [[]] }, {}), null)
})
test('nonfinite scores cannot consume proposal slots', () => {
  const valid = disc('valid'),
    invalid = disc('invalid')
  const priority = parseCandidateSubstatPriority(['crit_rate'], candidatePriorityToken, true)
  assert.deepEqual(
    candidateDiscProposals([invalid, valid], priority, ['crit_rate'], { crit_rate: 2.4 }, (row) =>
      row.id === 'invalid' ? NaN : 1,
    ).map((row) => row.id),
    ['valid'],
  )
})
test('missing or invalid roll normalization never becomes zero-valued evidence', () => {
  const priority = parseCandidateSubstatPriority(['crit_rate'], candidatePriorityToken, true)
  for (const steps of [
    {},
    { crit_rate: 0 },
    { crit_rate: Infinity },
    { crit_rate: NaN },
    { crit_rate: -2.4 },
  ]) {
    assert.deepEqual(
      candidateDiscProposals([disc('invalid')], priority, ['crit_rate'], steps, () => 1),
      [],
    )
  }
})
test('proposals stay inside caller supplied legal slot/fixed/excluded pool and do not mutate it', () => {
  const pool = [disc('allowed')]
  const before = JSON.stringify(pool)
  assert.deepEqual(
    candidateDiscProposals(
      pool,
      parseCandidateSubstatPriority([], candidatePriorityToken),
      ['crit_rate'],
      { crit_rate: 2.4 },
      () => 1,
    ),
    pool,
  )
  assert.equal(JSON.stringify(pool), before)
})
