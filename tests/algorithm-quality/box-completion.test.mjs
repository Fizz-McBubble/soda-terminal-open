import assert from 'node:assert/strict'
import test from 'node:test'
import {
  selectDefaultTeamRecommendationPool as pool,
  selectDefaultTeamRecommendationIds as defaults,
} from '../../src/decision/defaultTeamRecommendationSelection.ts'
import { solveMemberDisjointPortfolio as solve } from '../../src/decision/memberDisjointPortfolio.ts'
import { createTeamPreferenceIndex } from '../../src/decision/teamPreferenceEvidence.ts'
import {
  fitStrengthRegression as fit,
  predictStrengthRegression as predict,
  validateStrengthRegression as validate,
} from '../../src/decision/teamStrengthRegression.ts'
import {
  constrainTeamStrengthScore as constrain,
  strengthBandForScore as band,
  strengthBandOrdinal as ordinal,
} from '../../src/decision/teamStrengthModelScore.ts'

const candidate = (id, memberIds, score = 85, patch = {}) => ({
  candidateId: id,
  memberIds,
  sourceRecommended: false,
  explicitSelectionOnly: false,
  inferredStrength: true,
  ratingStatus: 'rated',
  ratingBand: score >= 90 ? 'S' : score >= 80 ? 'A+' : 'A',
  confidence: 'low',
  mechanicallyClosed: true,
  recommendationScore: score,
  sourceExcluded: false,
  ...patch,
})
const primary = (c) => c.memberIds[0]
const rows = [
  candidate('p1', ['a', 'x', 's1'], 89),
  candidate('p2', ['a', 'x', 's2'], 88),
  candidate('p3', ['a', 'x', 's3'], 87),
  candidate('p4', ['a', 'b', 'c'], 86),
  candidate('q', ['x', 'y', 'z'], 85),
]
const solvePool = (rows, k, options = {}) => {
  const allowed = pool(rows, primary, options).eligibleIds
  return solve(
    rows
      .filter((r) => allowed.has(r.candidateId))
      .map((r) => ({ candidate: r, memberIds: r.memberIds })),
    k,
  )
}
const ids = (result) => result.selected.map((x) => x.candidate.candidateId)

test('display cap preserves only three carry triples but both portfolios can use the fourth', () => {
  const p = pool(rows, primary)
  assert.deepEqual([...p.defaultIds], ['p1', 'p2', 'p3', 'q'])
  assert.deepEqual([...p.eligibleIds], ['p1', 'p2', 'p3', 'p4', 'q'])
  assert.deepEqual(ids(solvePool(rows, 2)), ['p4', 'q'])
})
test('compatibility wrapper retains the bounded default ID contract', () => {
  assert.deepEqual(defaults(rows, primary), pool(rows, primary).defaultIds)
})
test('per-carry cap counts physical trios and does not count reordered or Bangboo variants twice', () => {
  const p = pool(
    [
      rows[0],
      { ...rows[0], candidateId: 'variant', memberIds: ['a', 's1', 'x'] },
      ...rows.slice(1),
    ],
    primary,
  )
  assert.ok(p.defaultIds.has('variant'))
  assert.ok(!p.defaultIds.has('p4'))
  assert.equal(
    ids(solvePool([{ ...rows[0] }, { ...rows[0], candidateId: 'variant' }], 2)).length,
    1,
  )
})
test('explicitly withdrawn source-rated rows cannot suppress a valid A fallback', () => {
  const p = pool(
    [
      candidate('old', ['a', 'b', 'c'], 95, { sourceRecommended: true, withdrawn: true }),
      candidate('a', ['x', 'y', 'z'], 75),
    ],
    primary,
  )
  assert.deepEqual([...p.defaultIds], ['a'])
  assert.deepEqual([...p.eligibleIds], ['a'])
})
test('retained source tier is not rejected merely for a fallback designation or missing optional score', () => {
  const c = candidate('source', ['a', 'b', 'c'], 75, {
    sourceRecommended: true,
    sourceExcluded: true,
    recommendationScore: null,
    mechanicallyClosed: false,
  })
  assert.deepEqual(
    [
      ...pool([c], () => {
        throw new Error('source does not require inferred primary')
      }).defaultIds,
    ],
    ['source'],
  )
})
test('source and inferred routes both preserve exact membership, rating and deliberate-selection gates', () => {
  const invalid = [
    { memberIds: ['a', 'a', 'b'] },
    { memberIds: ['a', 'b'] },
    { memberIds: ['a', 'b', ' c'] },
    { ratingStatus: 'hard_invalid' },
    { ratingBand: 'Experimental' },
    { confidence: 'experimental' },
    { explicitSelectionOnly: true },
    { withdrawn: true },
  ]
  for (const sourceRecommended of [false, true])
    for (const patch of invalid)
      assert.equal(
        pool([candidate('bad', ['a', 'b', 'c'], 95, { sourceRecommended, ...patch })], primary)
          .defaultIds.size,
        0,
      )
})
test('inferred rows still require finite scores, closure, non-exclusion and valid primary identity', () => {
  for (const patch of [
    { recommendationScore: null },
    { recommendationScore: NaN },
    { recommendationScore: Infinity },
    { recommendationScore: 69.99 },
    { mechanicallyClosed: false },
    { sourceExcluded: true },
    { inferredStrength: false },
  ])
    assert.equal(pool([candidate('bad', ['a', 'b', 'c'], 95, patch)], primary).eligibleIds.size, 0)
  for (const invalidPrimary of [null, 'foreign'])
    assert.equal(pool(rows, () => invalidPrimary).eligibleIds.size, 0)
})
test('conflicting duplicate candidate IDs fail closed instead of inheriting another record eligibility', () => {
  assert.throws(() => pool([rows[0], { ...rows[0], memberIds: ['d', 'e', 'f'] }], primary))
  assert.throws(() => pool([rows[0], { ...rows[0], withdrawn: true }], primary))
  assert.equal(pool([rows[0], { ...rows[0] }], primary).eligibleIds.size, 1)
})
test('invalid high-score rows do not suppress an otherwise eligible A direction', () => {
  assert.deepEqual(
    [
      ...pool(
        [
          candidate('bad', ['a', 'b', 'c'], 95, { withdrawn: true }),
          candidate('ok', ['d', 'e', 'f'], 75),
        ],
        primary,
      ).defaultIds,
    ],
    ['ok'],
  )
  assert.deepEqual(
    [
      ...pool([candidate('bad', ['a', 'b', 'c'], 95), candidate('ok', ['d', 'e', 'f'], 75)], (c) =>
        c.candidateId === 'bad' ? null : primary(c),
      ).defaultIds,
    ],
    ['ok'],
  )
})
test('normal default selection does not execute lower-score fallback features unnecessarily', () => {
  const calls = []
  const input = [candidate('high', ['a', 'b', 'c'], 85), candidate('low', ['d', 'e', 'f'], 75)]
  assert.deepEqual(
    [...pool(input, (c) => (calls.push(c.candidateId), primary(c))).defaultIds],
    ['high'],
  )
  assert.deepEqual(calls, ['high'])
})
test('multi-team eligibility includes existing A backups without lowering the default-card gate', () => {
  const low = [
    candidate('a1', ['a', 'b', 'c'], 79),
    candidate('a2', ['d', 'e', 'f'], 78),
    candidate('a3', ['g', 'h', 'i'], 77),
  ]
  const input = [candidate('high', ['a', 'd', 'g'], 85), ...low],
    calls = []
  const p = pool(input, (c) => (calls.push(c.candidateId), primary(c)), {
    includePortfolioFallback: true,
  })
  assert.deepEqual([...p.defaultIds], ['high'])
  assert.equal(p.eligibleIds.size, 4)
  assert.equal(new Set(calls).size, calls.length)
  assert.deepEqual(ids(solvePool(input, 3, { includePortfolioFallback: true })), ['a1', 'a2', 'a3'])
  assert.deepEqual(ids(solvePool(low, 3, { includePortfolioFallback: true })), ['a1', 'a2', 'a3'])
})
test('returned sets are request-local and neither selection nor solving changes caller facts', () => {
  const snapshot = JSON.stringify(rows),
    a = pool(rows, primary)
  a.eligibleIds.clear()
  a.defaultIds.add('foreign')
  assert.equal(pool(rows, primary).eligibleIds.size, 5)
  assert.equal(JSON.stringify(rows), snapshot)
})

const oracle = (rows, k) => {
  let best = []
  for (let mask = 0; mask < 2 ** rows.length; mask++) {
    const selected = [],
      members = new Set()
    let valid = true
    for (let i = 0; i < rows.length; i++)
      if (mask & (2 ** i)) {
        selected.push(i)
        for (const m of rows[i].memberIds) {
          if (members.has(m)) valid = false
          members.add(m)
        }
      }
    const lexEarlier = selected.some(
      (x, i) => x < best[i] && selected.slice(0, i).every((v, j) => v === best[j]),
    )
    if (
      valid &&
      selected.length <= k &&
      (selected.length > best.length || (selected.length === best.length && lexEarlier))
    )
      best = selected
  }
  return best.map((i) => rows[i].candidateId)
}
test('540 combined eligibility-plus-portfolio cases match an independent exhaustive reference', () => {
  let seed = 154270
  const rand = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32
  for (let t = 0; t < 180; t++) {
    const input = []
    while (input.length < 8 + (t % 4)) {
      const m = new Set()
      while (m.size < 3) m.add(String(Math.floor(rand() * 9)))
      const flags = {
        withdrawn: rand() < 0.12,
        explicitSelectionOnly: rand() < 0.1,
        mechanicallyClosed: rand() > 0.1,
      }
      input.push(candidate('t' + input.length, [...m], 70 + Math.floor(rand() * 29), flags))
    }
    for (const k of [1, 2, 3]) {
      // Independent eligibility is intentionally literal and does not call pool().
      const valid = input.filter(
        (c) => !c.withdrawn && !c.explicitSelectionOnly && c.mechanicallyClosed,
      )
      const high = valid.filter((c) => c.recommendationScore >= 80)
      const eligible = k > 1 ? valid : high.length ? high : valid
      const result = solvePool(input, k, { includePortfolioFallback: k > 1 })
      assert.deepEqual(ids(result), oracle(eligible, k))
      assert.notEqual(result.status, 'budget_exhausted')
    }
  }
})
const fact = () => ({
  claimId: 'f',
  preferredMemberIds: ['a', 'b', 'c'],
  alternativeMemberIds: ['a', 'b', 'd'],
  sourceVersion: '3.1',
  sourceUrl: 'https://example.org/source',
  checkedAt: '2026-10-14',
  locator: 'fixture',
  reason: 'fixture',
  sourceSha256: 'a'.repeat(64),
})
test('source index protects accepted relations against both original-object and returned-view mutation', () => {
  const f = fact(),
    index = createTeamPreferenceIndex([f], '3.1'),
    input = [
      ['a', 'b', 'd'],
      ['a', 'b', 'c'],
    ],
    expected = [...input].reverse()
  f.preferredMemberIds.reverse()
  f.withdrawn = true
  f.alternativeMemberIds[0] = 'other'
  for (const view of [index.acceptedFacts, index.forTeam(input[0])]) {
    view[0].withdrawn = true
    view[0].preferredMemberIds[0] = 'foreign'
    view.splice(0)
  }
  assert.deepEqual(
    index.order(input, (x) => x),
    expected,
  )
  assert.equal(index.acceptedFacts[0].withdrawn, undefined)
})
const m = () => ({
  means: [0],
  scales: [1],
  coefficients: [1],
  intercept: 80,
  alpha: 10,
  sampleCount: 10,
})
for (const [name, patch] of Object.entries({
  zeroScale: { scales: [0] },
  negativeScale: { scales: [-1] },
  dimensions: { means: [] },
  nanCoefficient: { coefficients: [NaN] },
  infiniteIntercept: { intercept: Infinity },
  directionViolation: { coefficients: [-1], coefficientDirections: [1] },
  sparseMeans: { means: new Array(1) },
  badCount: { sampleCount: 0 },
  badDirection: { coefficientDirections: [2] },
}))
  test('prediction rejects a damaged numeric model: ' + name, () =>
    assert.throws(() => predict({ ...m(), ...patch }, [1])),
  )
test('finite arithmetic overflow cannot be converted into an apparently valid S rating', () => {
  assert.throws(() => predict({ ...m(), coefficients: [Number.MAX_VALUE] }, [2]))
  for (const x of [NaN, Infinity, -Infinity])
    for (const f of [
      band,
      ordinal,
      (v) => constrain(v, { noPrimaryOutput: false, severeFieldCompetition: false }),
    ])
      assert.throws(() => f(x))
})
test('finite normal prediction, band thresholds and role ceilings remain unchanged', () => {
  assert.equal(predict(m(), [2]), 82)
  for (const [score, expected] of [
    [69.99, 'B'],
    [70, 'A'],
    [79.99, 'A'],
    [80, 'A+'],
    [89.99, 'A+'],
    [90, 'S'],
  ])
    assert.equal(band(score), expected)
  assert.equal(constrain(99, { noPrimaryOutput: false, severeFieldCompetition: true }), 98)
  assert.equal(constrain(99, { noPrimaryOutput: true, severeFieldCompetition: false }), 59)
})
const train = (key, group, values, target) => ({ key, group, values, target })
test('overflowing normalization and sparse coefficient directions are rejected before fitting', () => {
  assert.throws(() => fit([train('a', 'a', [1e308], 74), train('b', 'b', [1e308], 84)]))
  assert.throws(() => fit([train('a', 'a', [1], 74), train('b', 'b', [2], 84)], 10, new Array(1)))
})
test('holdout rejects empty data, unknown grouping, blank group and cross-group duplicate team IDs', () => {
  assert.throws(() => validate([], 'team'))
  const rows = [train('a', 'g1', [1], 74), train('b', 'g2', [2], 84), train('c', 'g3', [3], 94)]
  assert.throws(() => validate(rows, 'invalid'))
  assert.throws(() => validate([...rows, { ...rows[0], group: 'g2' }], 'core'))
  assert.throws(() => validate([{ ...rows[0], group: '' }, ...rows.slice(1)], 'core'))
})
test('held-out targets and their entire core stay outside training and normalization', () => {
  const rows = [
    train('a', 'g1', [1000, 2], 74),
    train('b', 'g1', [2000, 4], 84),
    train('c', 'g2', [1, 6], 64),
    train('d', 'g3', [3, 8], 94),
  ]
  const before = validate(rows, 'core'),
    changed = rows.map((r) => (r.group === 'g1' ? { ...r, target: r.target + 10000 } : r)),
    after = validate(changed, 'core')
  for (const a of before.filter((r) => r.group === 'g1')) {
    const b = after.find((r) => r.key === a.key)
    assert.equal(a.predicted, b.predicted)
    assert.equal(a.meanBaseline, 79)
    assert.equal(a.trainingCount, 2)
    const independent = fit(rows.filter((r) => r.group !== 'g1'))
    assert.equal(a.predicted, predict(independent, rows.find((r) => r.key === a.key).values))
  }
})
test('constant features fit a finite intercept without data mutation or illegal signed coefficients', () => {
  const rows = [train('a', 'a', [2, 0], 74), train('b', 'b', [2, 0], 84)],
    snapshot = JSON.stringify(rows)
  const model = fit(rows, 10, [1, -1])
  assert.deepEqual(model.coefficients, [0, 0])
  assert.equal(predict(model, [2, 0]), 79)
  assert.equal(JSON.stringify(rows), snapshot)
})
