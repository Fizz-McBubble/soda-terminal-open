import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseCandidateSubstatPriority as parse,
  candidatePriorityPrefixVector as vector,
  candidatePriorityDominates as dominates,
} from '../../src/gameDataPacks/candidateSubstatPriority.ts'
import { refineComparableCandidatePool as refine } from '../../src/optimizer/refineComparableCandidatePool.ts'
import {
  candidateDiscFactKey,
  compareCandidatePanelPriority,
} from '../../src/optimizer/candidateSearchFacts.ts'
import { searchTeamAssignments } from '../../src/optimizer/searchTeamAssignments.ts'

const names = {
  暴击率: 'crit_rate',
  暴击伤害: 'crit_dmg',
  '攻击力%': 'atk_percent',
  防御力百分比: 'def_percent',
  穿透值: 'pen',
  固定攻击力: 'atk_flat',
  固定防御力: 'def_flat',
}
const token = (text) =>
  text === '双暴'
    ? ['crit_rate', 'crit_dmg']
    : names[text]
      ? [names[text]]
      : Object.values(names).includes(text)
        ? [text]
        : []
test('strict priority keeps tiers, not manufactured numerical weights', () => {
  const p = parse(['副词条：暴击率 > 防御力百分比 > 暴击伤害 > 穿透值 > 固定防御力'], token)
  assert.equal(p.kind, 'ordered')
  assert.deepEqual(p.tiers, [['crit_rate'], ['def_percent'], ['crit_dmg'], ['pen'], ['def_flat']])
  assert.equal('weights' in p, false)
})
test('equality groups survive mixed relations', () =>
  assert.deepEqual(parse(['暴击率 = 暴击伤害 > 攻击力% > 穿透值 = 固定攻击力'], token).tiers, [
    ['crit_rate', 'crit_dmg'],
    ['atk_percent'],
    ['pen', 'atk_flat'],
  ]))
test('conditions are retained, not activated by prose', () => {
  const p = parse(['暴击率（达到目标前） > 暴击伤害'], token)
  assert.equal(p.kind, 'conditional')
  assert.deepEqual(p.conditions, ['达到目标前'])
  assert.equal(vector(p, { crit_rate: 2 }), null)
})
test('canonical arrays are unordered without explicit declaration', () => {
  assert.equal(parse(['crit_rate', 'crit_dmg'], token).kind, 'unordered')
  assert.deepEqual(parse(['crit_rate', 'crit_dmg'], token, true).tiers, [
    ['crit_rate'],
    ['crit_dmg'],
  ])
})
test('unknown, repeated and conflicting statements fail closed', () => {
  for (const lines of [
    [],
    [''],
    ['暴击率 > 暴击率'],
    ['暴击率 > unknown'],
    ['暴击率 > 暴击伤害', '攻击力%'],
  ])
    assert.equal(parse(lines, token).kind, 'unparsed')
})
test('full-width relation and dual-crit alias', () =>
  assert.deepEqual(parse(['双暴 ＞ 攻击力% ＝ 固定攻击力'], token).tiers, [
    ['crit_rate', 'crit_dmg'],
    ['atk_percent', 'atk_flat'],
  ]))
test('one high-tier roll does not dominate unlimited low-tier rolls', () => {
  const p = parse(['crit_rate', 'atk_percent'], token, true),
    a = vector(p, { crit_rate: 1 }),
    b = vector(p, { atk_percent: 5 })
  assert.equal(dominates(a, b), false)
  assert.equal(dominates(b, a), false)
  assert.equal(dominates(vector(p, { crit_rate: 2, atk_percent: 3 }), b), true)
  assert.equal(vector(p, { crit_rate: NaN }), null)
})
const policy = {
  key: (r) => r.id,
  group: (r) => r.source,
  comparable: (a, b) => a.known && b.known && a.context === b.context,
  compare: (a, b) => b.value - a.value,
}
test('re-rank compatible slots without moving unknown or other-source slots', () => {
  const a = { id: 'a', source: 'A', known: true, context: 'x', value: 5 },
    u = { ...a, id: 'u', known: false },
    b = { ...a, id: 'b', value: 10 },
    c = { ...a, id: 'c', source: 'C' }
  const rows = [a, u, b, c],
    before = JSON.stringify(rows)
  assert.deepEqual(
    refine(rows, [{ ...a, id: 'p', value: 20 }], policy).map((r) => r.id),
    ['p', 'u', 'b', 'c'],
  )
  assert.equal(JSON.stringify(rows), before)
})
test('unavailable/context-changing proposals cannot displace valid candidates', () => {
  const a = { id: 'a', source: 'A', known: true, context: 'x', value: 5 }
  assert.deepEqual(
    refine(
      [a],
      [
        { ...a, id: 'other', context: 'y', value: 100 },
        { ...a, id: 'unknown', known: false, value: 100 },
      ],
      policy,
    ),
    [a],
  )
})
test('objective ties retain original identities', () => {
  const a = { id: 'a', source: 'A', known: true, context: 'x', value: 5 }
  assert.deepEqual(
    refine(
      [a],
      [
        { ...a, id: 'equal' },
        { ...a, id: 'worse', value: 4 },
      ],
      policy,
    ),
    [a],
  )
})
test('compatibility must hold with all members, not a single anchor', () => {
  const rows = [
    { id: 'a', value: 1, source: 'A' },
    { id: 'b', value: 2, source: 'A' },
  ]
  const comparable = (a, b) =>
    a.id === b.id || ![a.id, b.id].includes('c') || [a.id, b.id].includes('a')
  assert.equal(
    refine(rows, [{ id: 'c', value: 50, source: 'A' }], { ...policy, comparable }).some(
      (r) => r.id === 'c',
    ),
    false,
  )
})
test('panel priority keeps attack threshold before secondary goal', () => {
  assert.ok(
    compareCandidatePanelPriority(
      { attackDeficit: 0, anomalyProficiency: 1 },
      { attackDeficit: 10, anomalyProficiency: 100 },
    ) < 0,
  )
  assert.equal(
    compareCandidatePanelPriority(undefined, { attackDeficit: 0, anomalyProficiency: 1 }),
    0,
  )
})

function fixture(rename = false) {
  const domains = [0, 1, 2].map((member) => {
    const agentId = `agent-${member}`
    const slots = Array.from({ length: 6 }, (_, s) =>
      Array.from({ length: member === 0 || (member === 1 && s === 5) ? 2 : 1 }, (_, option) => ({
        id: `m${member}-s${s + 1}-${rename && member === 1 && s === 5 ? 1 - option : option}`,
        slot: s + 1,
        setId: s < 4 ? 'primary' : 'secondary',
        level: 15,
        rarity: 'S',
        mainStat: ['hp_flat', 'atk_flat', 'def_flat', 'crit_rate', 'physical_dmg', 'atk_percent'][
          s
        ],
        subStats: [
          { stat: 'crit_dmg', value: 28.8, upgrades: 5 },
          { stat: 'def_percent', value: 4.8, upgrades: 0 },
          { stat: 'hp_percent', value: 3, upgrades: 0 },
          { stat: 'pen', value: 9, upgrades: 0 },
        ],
        syntheticContribution: option * (member === 1 ? 100 : 1),
      })),
    )
    const compile = (discs) =>
      discs.length === 6 &&
      new Set(discs.map((d) => d.slot)).size === 6 &&
      discs.filter((d) => d.setId === 'primary').length === 4
        ? { agentId, discs: discs.map((disc) => ({ disc, score: 0 })), totalScore: 0 }
        : null
    return { agentId, slots, patterns: [{ primary: 4, secondary: 2 }], compile }
  })
  const baseline = domains.map((d) => d.compile(d.slots.map((s) => s[0])))
  const objective = {
    evaluate: (rows) => {
      const discs = rows.flatMap((r) => r.discs.map((c) => c.disc))
      assert.equal(discs.length, 18)
      assert.equal(new Set(discs.map((d) => d.id)).size, 18)
      return discs.reduce((s, d) => s + d.syntheticContribution, 0)
    },
  }
  return { domains, baseline, objective }
}
for (const rename of [false, true])
  test(`bounded neighborhood improves audited synthetic case: rename=${rename}`, () => {
    const f = fixture(rename),
      before = JSON.stringify(f.domains.map((d) => d.slots))
    const o = searchTeamAssignments(f.baseline, f.domains, f.objective)
    assert.equal(f.objective.evaluate(o.selected), 106)
    assert.ok(o.evidence.evaluatedAssignments <= 64)
    assert.ok(o.evidence.visitedNodes <= 20000)
    assert.equal(o.evidence.status, 'budget_exhausted')
    assert.equal(JSON.stringify(f.domains.map((d) => d.slots)), before)
  })
test('complete small-domain search agrees with all 128 combinations', () => {
  const f = fixture()
  const o = searchTeamAssignments(f.baseline, f.domains, f.objective, {
    evaluations: 1024,
    nodes: 20000,
  })
  assert.equal(o.evidence.status, 'complete')
  assert.equal(o.evidence.evaluatedAssignments, 128)
  assert.equal(f.objective.evaluate(o.selected), 106)
})
test('zero budget invokes no objective', () => {
  const f = fixture()
  let calls = 0
  const o = searchTeamAssignments(
    f.baseline,
    f.domains,
    {
      evaluate() {
        calls++
        return 1
      },
    },
    { evaluations: 0, nodes: 100 },
  )
  assert.equal(calls, 0)
  assert.equal(o.selected, f.baseline)
  assert.equal(o.evidence.status, 'budget_exhausted')
})
test('one evaluation preserves incumbent', () => {
  const f = fixture(),
    o = searchTeamAssignments(f.baseline, f.domains, f.objective, { evaluations: 1, nodes: 20000 })
  assert.equal(o.selected, f.baseline)
  assert.equal(o.evidence.evaluatedAssignments, 1)
})
test('absent objective does not manufacture a score', () => {
  const f = fixture(),
    o = searchTeamAssignments(f.baseline, f.domains)
  assert.equal(o.selected, f.baseline)
  assert.equal(o.evidence.status, 'unsupported')
})
test('incomplete baseline can obtain a feasible physical assignment', () => {
  const f = fixture(),
    o = searchTeamAssignments([], f.domains)
  assert.equal(o.selected.length, 3)
  assert.equal(o.evidence.status, 'feasible')
})
test('inventory shortage requires completed domain proof', () => {
  const f = fixture()
  f.domains[0].slots[0] = []
  const o = searchTeamAssignments([], f.domains, f.objective)
  assert.equal(o.evidence.status, 'complete')
  assert.ok(o.evidence.shortages.some((s) => s.kind === 'slot'))
})
test('conflicting duplicate ID is rejected', () => {
  const f = fixture()
  f.domains[0].slots[0].push({ ...f.domains[0].slots[0][0], level: 12 })
  const o = searchTeamAssignments(f.baseline, f.domains, f.objective)
  assert.equal(o.evidence.status, 'unsupported')
  assert.equal(o.evidence.evaluatedAssignments, 0)
})
test('fixed/excluded domain choices cannot be reintroduced', () => {
  const f = fixture()
  f.domains[1].slots[5] = [f.domains[1].slots[5][0]]
  const o = searchTeamAssignments(f.baseline, f.domains, f.objective)
  assert.equal(f.objective.evaluate(o.selected), 6)
  assert.equal(o.evidence.status, 'complete')
})
test('cross-member same-slot swap works without any free discs', () => {
  const f = fixture()
  f.domains.forEach((d) => (d.slots = d.slots.map((s) => [s[0]])))
  const a = f.domains[0].slots[0][0],
    b = f.domains[1].slots[0][0]
  f.domains[0].slots[0].push(b)
  f.domains[1].slots[0].push(a)
  const objective = { evaluate: (rows) => (rows[0].discs.some((x) => x.disc.id === b.id) ? 10 : 0) }
  const o = searchTeamAssignments(f.baseline, f.domains, objective)
  assert.equal(objective.evaluate(o.selected), 10)
  assert.equal(new Set(o.selected.flatMap((r) => r.discs.map((x) => x.disc.id))).size, 18)
})
test('combat objective cannot bypass functional panel constraint', () => {
  const f = fixture()
  f.domains.forEach((d, i) => {
    const c = d.compile
    d.compile = (discs) => {
      const row = c(discs)
      return row
        ? {
            ...row,
            panelObjective: {
              attackDeficit: i === 1 && discs.some((x) => x.syntheticContribution === 100) ? 1 : 0,
              anomalyProficiency: 0,
            },
          }
        : null
    }
  })
  f.baseline = f.domains.map((d) => d.compile(d.slots.map((s) => s[0])))
  const o = searchTeamAssignments(f.baseline, f.domains, f.objective)
  assert.equal(f.objective.evaluate(o.selected), 6)
})
test('search fact identity excludes labels and uses physical ID only as final tie', () => {
  const f = fixture(),
    d = f.domains[0].slots[0][0]
  assert.equal(
    candidateDiscFactKey(d),
    candidateDiscFactKey({ ...d, id: 'different', favorite: true, tags: ['changed'] }),
  )
})
