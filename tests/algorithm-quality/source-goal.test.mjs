import test from 'node:test'
import assert from 'node:assert/strict'
import { candidatePriorityDominates as dominates } from '../../src/gameDataPacks/candidateSubstatPriority.ts'
import { refineSourceDominancePool } from '../../src/optimizer/refineComparableCandidatePool.ts'

test('ordinal refinement retains limited coverage and replaces only source-dominated candidates', () => {
  const a = { id: 'a', source: 'A', tier: [0, 5], slice: 5, coverage: 'limited' }
  const proposal = { ...a, id: 'p', tier: [5, 5], slice: 7 }
  const result = refineSourceDominancePool([a], [proposal], {
    key: (row) => row.id,
    group: (row) => row.source,
    canReplace: (left, right) => dominates(right.tier, left.tier) && right.slice >= left.slice,
    mark: (row) => ({ ...row, note: 'source priority, not overall damage' }),
  })
  assert.equal(result[0].id, 'p')
  assert.equal(result[0].coverage, 'limited')
  assert.ok(result[0].note)
})

test('numerical veto, ordinal trade-off and different source preserve original', () => {
  const a = { id: 'a', source: 'A', tier: [1, 5], slice: 5 }
  const proposals = [
    { ...a, id: 'negative', tier: [2, 5], slice: 4 },
    { ...a, id: 'tradeoff', tier: [2, 4], slice: 20 },
    { ...a, id: 'other', source: 'B', tier: [3, 6], slice: 30 },
  ]
  const result = refineSourceDominancePool([a], proposals, {
    key: (row) => row.id,
    group: (row) => row.source,
    canReplace: (left, right) => dominates(right.tier, left.tier) && right.slice >= left.slice,
    mark: (row) => row,
  })
  assert.deepEqual(result, [a])
})

test('an already-listed dominating source candidate can move first without duplication', () => {
  const a = { id: 'a', source: 'A', n: 1 },
    b = { id: 'b', source: 'A', n: 2 }
  assert.deepEqual(
    refineSourceDominancePool([a, b], [b], {
      key: (row) => row.id,
      group: (row) => row.source,
      canReplace: (left, right) => right.n > left.n,
      mark: (row) => row,
    }),
    [b, a],
  )
})

test('source refinement leaves unknown, different-source and incomparable slots in place', () => {
  const a = { id: 'a', source: 'A', tier: [0, 5], slice: 5 }
  const unknown = { ...a, id: 'unknown', known: false }
  const other = { ...a, id: 'other', source: 'B', tier: [9, 9] }
  const tradeoff = { ...a, id: 'tradeoff', tier: [3, 4] }
  const better = { ...a, id: 'better', tier: [2, 5] }
  const original = [a, unknown, other, tradeoff, better]
  const before = JSON.stringify(original)
  const result = refineSourceDominancePool(original, [], {
    key: (row) => row.id,
    group: (row) => row.source,
    canReplace: (left, right) =>
      left.known !== false &&
      right.known !== false &&
      dominates(right.tier, left.tier) &&
      right.slice >= left.slice,
    mark: (row) => row,
  })
  assert.deepEqual(
    result.map((row) => row.id),
    ['better', 'unknown', 'other', 'tradeoff', 'a'],
  )
  assert.equal(JSON.stringify(original), before)
})
