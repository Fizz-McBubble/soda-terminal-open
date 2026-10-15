import assert from 'node:assert/strict'
import test from 'node:test'
import { solveMemberDisjointPortfolio as solve } from '../../src/decision/memberDisjointPortfolio.ts'
import { resolveSourcePreferenceOrder as order } from '../../src/decision/sourcePreferenceOrder.ts'
import { createTeamPreferenceIndex } from '../../src/decision/teamPreferenceEvidence.ts'

const row = (id, memberIds) => ({ candidate: { candidateId: id }, memberIds })
const ids = (result) => result.selected.map((item) => item.candidate.candidateId)
const lex = (left, right) => {
  for (let i = 0; i < left.length; i++) if (left[i] !== right[i]) return left[i] - right[i]
  return 0
}
function oracle(items, requested) {
  let best = []
  for (let mask = 0; mask < 2 ** items.length; mask++) {
    const chosen = [],
      members = new Set()
    let valid = true
    for (let i = 0; i < items.length; i++)
      if (mask & (2 ** i)) {
        chosen.push(i)
        for (const member of items[i].memberIds) {
          if (members.has(member)) valid = false
          members.add(member)
        }
      }
    if (
      valid &&
      chosen.length <= requested &&
      (chosen.length > best.length || (chosen.length === best.length && lex(chosen, best) < 0))
    )
      best = chosen
  }
  return best.map((i) => items[i].candidate.candidateId)
}
const triples = (n) => {
  const result = []
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      for (let c = b + 1; c < n; c++) result.push([String(a), String(b), String(c)])
  return result
}

test('full greedy keeps its zero-search result and nonpositive requests select nothing', () => {
  const rows = [row('first', ['a', 'b', 'c']), row('second', ['d', 'e', 'f'])]
  assert.deepEqual(ids(solve(rows, 2)), ['first', 'second'])
  assert.equal(solve(rows, 2).searchSteps, 0)
  for (const count of [0, -1, NaN]) assert.equal(solve(rows, count).selected.length, 0)
})
test('complete small-domain results match 4096 independent powerset oracles', () => {
  const all = triples(6)
  const catalogue = all.filter((_, i) => i % 2 === 0).concat([all[1], all[3]])
  assert.equal(new Set(catalogue.map((x) => x.join('|'))).size, 12)
  for (let mask = 0; mask < 4096; mask++) {
    const rows = catalogue.flatMap((members, i) => (mask & (2 ** i) ? [row('c' + i, members)] : []))
    const result = solve(rows, 2, 10000)
    assert.deepEqual(ids(result), oracle(rows, 2))
    assert.equal(result.status, result.selected.length === 2 ? 'complete' : 'infeasible')
  }
})
test('budget cutoff retains two feasible teams rather than the one-team greedy incumbent', () => {
  const members = [
    ['0', '2', '8'],
    ['0', '1', '8'],
    ['0', '5', '6'],
    ['0', '4', '5'],
    ['2', '3', '7'],
    ['1', '2', '7'],
    ['1', '2', '3'],
    ['1', '5', '8'],
    ['0', '2', '3'],
  ]
  const rows = members.map((m, i) => row('p' + i, m))
  const result = solve(rows, 3, 12)
  assert.deepEqual(ids(result), ['p1', 'p4'])
  assert.equal(result.searchSteps, 12)
  assert.equal(result.status, 'budget_exhausted')
})
test('a greedy shortfall is repaired and objective is cardinality then input priority', () => {
  const rows = [
    row('trap', ['a', 'b', 'c']),
    row('left', ['a', 'd', 'e']),
    row('right', ['b', 'f', 'g']),
  ]
  assert.deepEqual(ids(solve(rows, 2)), ['left', 'right'])
  assert.deepEqual(ids(solve(rows, 3)), ['left', 'right'])
  assert.equal(solve(rows, 3).status, 'infeasible')
})
test('more budget cannot lose an existing feasible incumbent and inputs are not mutated', () => {
  let seed = 20261015
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32
  const all = triples(9)
  for (let trial = 0; trial < 100; trial++) {
    const indices = new Set()
    while (indices.size < 9) indices.add(Math.floor(random() * all.length))
    const rows = [...indices].map((i, j) => row('p' + j, all[i]))
    const before = JSON.stringify(rows)
    let count = 0
    for (const budget of [0, 1, 2, 3, 4, 8, 12, 20, 40, 80]) {
      const result = solve(rows, 3, budget)
      assert.ok(result.searchSteps <= budget)
      assert.ok(result.selected.length >= count)
      count = result.selected.length
      const selected = result.selected.flatMap((item) => item.memberIds)
      assert.equal(new Set(selected).size, selected.length)
    }
    assert.equal(JSON.stringify(rows), before)
  }
})
test('same-trio variants do not create new resources; conflicting candidate IDs fail closed', () => {
  assert.deepEqual(
    ids(
      solve([row('a', ['1', '2', '3']), row('b', ['3', '1', '2']), row('c', ['4', '5', '6'])], 2),
    ),
    ['a', 'c'],
  )
  assert.throws(() => solve([row('a', ['1', '2', '3']), row('a', ['4', '5', '6'])], 2))
  assert.throws(() => solve([row('a', ['1', '1', '2'])], 1))
})
test('sixty independent member identities do not alias at 32 bits', () => {
  const rows = Array.from({ length: 20 }, (_, i) =>
    row('t' + i, [String(i * 3), String(i * 3 + 1), String(i * 3 + 2)]),
  )
  assert.equal(solve(rows, 20).selected.length, 20)
})
test('source order moves only the connected peers and keeps unrelated slots unchanged', () => {
  const input = ['weaker', 'unrelated', 'stronger']
  assert.deepEqual(order(input, (x) => x, [['stronger', 'weaker']]).ordered, [
    'stronger',
    'unrelated',
    'weaker',
  ])
  assert.deepEqual(input, ['weaker', 'unrelated', 'stronger'])
})
test('a cycle cannot be resolved by source order; other components still order normally', () => {
  const result = order(['b', 'u', 'a', 'd', 'c'], (x) => x, [
    ['a', 'b'],
    ['b', 'a'],
    ['c', 'd'],
  ])
  assert.deepEqual(result.ordered, ['b', 'u', 'a', 'c', 'd'])
  assert.equal(result.cyclicComponentCount, 1)
})
test('absent source peers cannot hide a substitute; duplicate evidence adds no weight', () => {
  assert.deepEqual(order(['a', 'b'], (x) => x, [['missing', 'a']]).ordered, ['a', 'b'])
  const result = order(['b', 'a'], (x) => x, [
    ['a', 'b'],
    ['a', 'b'],
  ])
  assert.deepEqual(result.ordered, ['a', 'b'])
  assert.equal(result.activeRelationCount, 1)
})
test('all variants of one trio retain order and precede the weaker trio without invented resources', () => {
  const keys = { a1: 'a', a2: 'a', b1: 'b', b2: 'b', u: 'u' }
  const result = order(['b1', 'u', 'a1', 'a2', 'b2'], (x) => keys[x], [['a', 'b']]).ordered
  assert.deepEqual(result, ['a1', 'u', 'a2', 'b1', 'b2'])
})
test('the existing source index consumes the shared component algorithm and keeps withdrawal checks', () => {
  const fact = {
    claimId: 'p',
    preferredMemberIds: ['a', 'b', 'c'],
    alternativeMemberIds: ['a', 'b', 'd'],
    sourceVersion: '3.1',
    sourceUrl: 'https://example.org/source',
    checkedAt: '2026-10-14',
    locator: 'fixture',
    reason: 'fixture',
    sourceSha256: 'a'.repeat(64),
  }
  const index = createTeamPreferenceIndex([fact], '3.1')
  const unrelated = ['x', 'y', 'z']
  assert.deepEqual(
    index.order([fact.alternativeMemberIds, unrelated, fact.preferredMemberIds], (x) => x),
    [fact.preferredMemberIds, unrelated, fact.alternativeMemberIds],
  )
  assert.equal(
    createTeamPreferenceIndex([{ ...fact, withdrawn: true }], '3.1').acceptedFacts.length,
    0,
  )
  assert.equal(createTeamPreferenceIndex([fact], '3.2').acceptedFacts.length, 0)
})

// The evidence core has no data-file or application imports. These checks run
// against actual production functions, without source replacement or mocks.
const { createPerformancePartitionEvidenceIndex: indexPerformance } =
  await import('../../src/decision/teamPerformancePartitionEvidence.ts')
const leftMembers = ['a', 'b', 'c'],
  rightMembers = ['a', 'b', 'd']
const performance = (version, a, b, direction = 'higher_is_better') => ({
  gameVersion: version,
  targetTrios: [
    { id: 'left', stableMemberIds: leftMembers },
    { id: 'right', stableMemberIds: rightMembers },
  ],
  sources: [
    {
      url: 'https://example.org/partition',
      phase: 'shiyu_defense',
      partition: '5-1',
      metric: { kind: 'score', direction, unit: 'points' },
      observations: [
        { targetTrioId: 'left', avgRoundM0: a, m0ObservationStatus: 'observed' },
        { targetTrioId: 'right', avgRoundM0: b, m0ObservationStatus: 'observed' },
      ],
    },
  ],
})
test('current opposing partition withholds an old preference without manufacturing an opposite rating', () => {
  const index = indexPerformance([performance('3.2.3', 90, 100), performance('3.1.3', 200, 100)])
  const result = index.review(leftMembers, rightMembers)
  assert.equal(result.defaultSameBandOrderingEligible, false)
  assert.equal(result.numericalStrengthAdjudication, false)
  assert.deepEqual(
    result.comparisons.map((x) => x.evidenceVersion),
    ['3.2.3', '3.1.3'],
  )
})
test('partition index never joins opposite sides from different versions or modes', () => {
  const a = performance('3.2.3', 90, 100),
    b = performance('3.1.3', 200, 100)
  a.sources[0].observations.pop()
  b.sources[0].observations.shift()
  assert.equal(indexPerformance([a, b]).review(leftMembers, rightMembers).comparisons.length, 0)
  a.sources.push(b.sources[0])
  assert.equal(indexPerformance([a]).review(leftMembers, rightMembers).comparisons.length, 0)
})
test('unpublished, repeated and ambiguous identities do not become zero-strength observations', () => {
  for (const value of [0, NaN, Infinity, -5])
    assert.equal(
      indexPerformance([performance('3.2.3', value, 100)]).review(leftMembers, rightMembers)
        .comparisons.length,
      0,
    )
  const data = performance('3.2.3', 90, 100)
  data.sources[0].observations.push({ ...data.sources[0].observations[0] })
  assert.equal(indexPerformance([data]).review(leftMembers, rightMembers).comparisons.length, 0)
  assert.equal(
    indexPerformance([data]).review(['a', 'a', 'b'], rightMembers).defaultSameBandOrderingEligible,
    false,
  )
})
test('partition direction and ties remain explicit rather than averaged into one total score', () => {
  const index = indexPerformance([
    performance('3.2.3', 30, 40, 'lower_is_better'),
    performance('3.2.3', 100, 100),
  ])
  assert.deepEqual(
    index.review(leftMembers, rightMembers).comparisons.map((x) => x.relation),
    ['supports_preference', 'tied'],
  )
})
test('index is a frozen-input snapshot; caller data and returned metrics cannot corrupt repeated queries', () => {
  const data = performance('3.2.3', 90, 100)
  data.sources[0].metric.sourceFields = { m0: 'avg_round' }
  const index = indexPerformance([data])
  data.sources[0].observations[0].avgRoundM0 = 999
  const result = index.review(leftMembers, rightMembers)
  result.comparisons[0].metric.direction = 'lower_is_better'
  result.comparisons[0].metric.sourceFields.m0 = 'tampered'
  const again = index.review(leftMembers, rightMembers)
  assert.equal(again.comparisons[0].strongerValue, 90)
  assert.equal(again.comparisons[0].metric.direction, 'higher_is_better')
  assert.equal(again.comparisons[0].metric.sourceFields.m0, 'avg_round')
  assert.equal(again.defaultSameBandOrderingEligible, false)
})
test('source slugs must agree with stable member mapping before a row can participate', () => {
  const data = performance('3.2.3', 90, 100)
  for (const t of data.targetTrios)
    t.sourceSlugByStableMemberId = Object.fromEntries(
      t.stableMemberIds.map((x) => [x, 'slug-' + x]),
    )
  for (const r of data.sources[0].observations)
    r.characterSlugs = (r.targetTrioId === 'left' ? leftMembers : rightMembers).map(
      (x) => 'slug-' + x,
    )
  assert.equal(indexPerformance([data]).review(leftMembers, rightMembers).comparisons.length, 1)
  data.sources[0].observations[0].characterSlugs = ['x', 'y', 'z']
  assert.equal(indexPerformance([data]).review(leftMembers, rightMembers).comparisons.length, 0)
})
