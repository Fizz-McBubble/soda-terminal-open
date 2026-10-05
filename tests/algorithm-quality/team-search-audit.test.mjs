import test from 'node:test'
import assert from 'node:assert/strict'
import { searchTeamAssignments } from '../../src/optimizer/searchTeamAssignments.ts'
import { selectTeamObjectiveAssignment } from '../../src/optimizer/selectTeamObjectiveAssignment.ts'
import { selectPriorityBuilds } from '../../src/optimizer/selectPriorityAccountBuilds.ts'

function fixture() {
  const domains = ['a', 'b', 'c'].map((agentId, member) => {
    const slots = Array.from({ length: 6 }, (_, index) => [
      {
        id: `${agentId}-${index}`,
        slot: index + 1,
        setId: index < 4 ? 'primary' : 'secondary',
        level: 15,
        rarity: 'S',
        mainStat: ['hp_flat', 'atk_flat', 'def_flat', 'crit_rate', 'physical_dmg', 'atk_percent'][
          index
        ],
        subStats: [{ stat: 'crit_dmg', value: 4.8 * (member + 1), upgrades: member }],
      },
    ])
    return {
      agentId,
      slots,
      patterns: [{ primary: 4, secondary: 2 }],
      compile: (discs) => ({ agentId, discs: discs.map((disc) => ({ disc })), totalScore: 0 }),
    }
  })
  return { domains, baseline: domains.map((d) => d.compile(d.slots.map((s) => s[0]))) }
}

function addSuffixChoices(domains, members = [1, 2]) {
  for (const member of members)
    for (const slot of domains[member].slots) {
      const disc = slot[0]
      slot.push({
        ...disc,
        id: `${disc.id}-extra`,
        subStats: [{ stat: 'crit_dmg', value: 28.8, upgrades: 5 }],
      })
    }
}

test('a legal two-slot set exchange is reachable within the unchanged budget', () => {
  const f = fixture()
  for (const position of [0, 4]) {
    const original = f.domains[0].slots[position][0]
    f.domains[0].slots[position].push({
      ...original,
      id: `${original.id}-trade`,
      setId: position === 0 ? 'secondary' : 'primary',
    })
  }
  addSuffixChoices(f.domains)
  const objective = {
    evaluate: (rows) =>
      rows.find((r) => r.agentId === 'a').discs.filter((c) => c.disc.id.endsWith('-trade')).length *
      50,
  }
  const before = JSON.stringify(f)
  const result = searchTeamAssignments(f.baseline, f.domains, objective)
  assert.equal(objective.evaluate(result.selected), 100)
  assert.ok(result.evidence.evaluatedAssignments <= 64)
  assert.ok(result.evidence.visitedNodes <= 20000)
  assert.equal(result.evidence.status, 'budget_exhausted')
  assert.equal(JSON.stringify(f), before)
})

for (const missing of ['absent', 'changed-type', 'nonfinite']) {
  test(`functional panel support cannot disappear during team search: ${missing}`, () => {
    const f = fixture()
    const original = f.domains[1].slots[0][0]
    const next = {
      ...original,
      id: 'replacement',
      subStats: [{ stat: 'crit_dmg', value: 28.8, upgrades: 5 }],
    }
    f.domains[1].slots[0].push(next)
    const previous = f.domains[1].compile
    f.domains[1].compile = (discs) => ({
      ...previous(discs),
      panelObjective: discs.some((d) => d.id === next.id)
        ? missing === 'absent'
          ? undefined
          : {
              attackDeficit: 0,
              anomalyProficiency: 100,
              ...(missing === 'changed-type'
                ? { priorityStat: 'energyRegen', energyRegen: 100 }
                : { anomalyProficiency: NaN }),
            }
        : { attackDeficit: 0, anomalyProficiency: 100 },
    })
    f.baseline = f.domains.map((d) => d.compile(d.slots.map((s) => s[0])))
    let calls = 0
    const result = searchTeamAssignments(f.baseline, f.domains, {
      evaluate: (rows) => {
        calls++
        return rows.some((r) => r.discs.some((c) => c.disc.id === next.id)) ? 100 : 0
      },
    })
    assert.equal(result.selected, f.baseline)
    assert.equal(calls, 1)
  })
}

test('unsupported objective values retain physical feasible results without a manufactured zero', () => {
  const f = fixture()
  let calls = 0
  const objective = {
    evaluate: () => {
      calls++
      return null
    },
  }
  const supportedSeed = searchTeamAssignments(f.baseline, f.domains, objective)
  assert.equal(supportedSeed.selected, f.baseline)
  assert.equal(supportedSeed.evidence.status, 'unsupported')
  const rescued = searchTeamAssignments([], f.domains, objective)
  assert.equal(rescued.evidence.status, 'feasible')
  assert.equal(rescued.selected.length, 3)
  assert.equal(calls, 2)
})

test('bounded reranking preserves every member functional objective', () => {
  const f = fixture()
  f.baseline[0].panelObjective = { attackDeficit: 0, anomalyProficiency: 100 }
  f.baseline[1].panelObjective = { attackDeficit: 0, anomalyProficiency: 200 }
  const degraded = f.baseline.map((row) =>
    row.agentId === 'b'
      ? {
          ...row,
          panelObjective: { attackDeficit: 100, anomalyProficiency: 200 },
          totalScore: 1000,
        }
      : row,
  )
  let calls = 0
  const chosen = selectTeamObjectiveAssignment([f.baseline, degraded], 3, {
    evaluate: (rows) => {
      calls++
      return rows.reduce((total, row) => total + row.totalScore, 0)
    },
  })
  assert.equal(chosen, f.baseline)
  assert.equal(calls, 1)
  // Pure member permutation remains comparable; selection does not use array indexes.
  const better = [...f.baseline].reverse().map((row) => ({ ...row, totalScore: 1 }))
  assert.equal(
    selectTeamObjectiveAssignment([f.baseline, better], 3, {
      evaluate: (rows) => rows.reduce((total, row) => total + row.totalScore, 0),
    }),
    better,
  )
})

test('beam fallback retains later members functional target before personal score', () => {
  const f = fixture()
  const candidates = f.baseline.map((row) => ({
    ...row,
    discIds: row.discs.map((c) => c.disc.id),
    panelObjective: { attackDeficit: 0, anomalyProficiency: 200 },
  }))
  const bad = {
    ...candidates[1],
    totalScore: 1000,
    discIds: candidates[1].discIds.map((id) => `${id}-bad`),
    panelObjective: { attackDeficit: 100, anomalyProficiency: 200 },
  }
  const map = new Map(candidates.map((row) => [row.agentId, [row]]))
  map.get('b').push(bad)
  const priorities = candidates.map((row) => row.agentId)
  assert.equal(selectPriorityBuilds(priorities, map)[1], candidates[1])
  assert.equal(selectPriorityBuilds(priorities, map, { evaluate: () => null })[1], candidates[1])
})

test('three-owner cycle remains reachable without a legal two-owner swap', () => {
  const f = fixture()
  const discs = f.domains.map((d) => d.slots[0][0])
  f.domains.forEach((d, index) => d.slots[0].push(discs[(index + 1) % 3]))
  addSuffixChoices(f.domains)
  f.domains[1].slots[0].pop()
  f.domains[2].slots[0].pop()
  const objective = {
    evaluate: (rows) =>
      rows.every(
        (row) =>
          row.discs[0].disc.id ===
          discs[(f.domains.findIndex((d) => d.agentId === row.agentId) + 1) % 3].id,
      )
        ? 100
        : 0,
  }
  const result = searchTeamAssignments(f.baseline, f.domains, objective)
  assert.equal(objective.evaluate(result.selected), 100)
  assert.equal(new Set(result.selected.flatMap((row) => row.discs.map((c) => c.disc.id))).size, 18)
  assert.ok(result.evidence.evaluatedAssignments <= 64)
})

test('cross-owner paired swaps preserve both set patterns', () => {
  const f = fixture()
  f.domains[1].slots[0][0].setId = 'secondary'
  f.domains[1].slots[4][0].setId = 'primary'
  const exchanged = [0, 4].map((slot) => [f.domains[0].slots[slot][0], f.domains[1].slots[slot][0]])
  for (let index = 0; index < 2; index++) {
    const slot = [0, 4][index]
    f.domains[0].slots[slot].push(exchanged[index][1])
    f.domains[1].slots[slot].push(exchanged[index][0])
  }
  addSuffixChoices(f.domains, [2])
  const objective = {
    evaluate: (rows) =>
      rows.find((r) => r.agentId === 'a').discs[0].disc.id === exchanged[0][1].id ? 100 : 0,
  }
  const result = searchTeamAssignments(f.baseline, f.domains, objective)
  assert.equal(objective.evaluate(result.selected), 100)
  for (const row of result.selected)
    assert.equal(row.discs.filter((c) => c.disc.setId === 'primary').length, 4)
})

test('member and pool permutations plus physical ID renaming preserve the scored improvement', () => {
  for (const reversed of [false, true])
    for (const rename of [false, true]) {
      const f = fixture()
      for (const position of [0, 4]) {
        const d = f.domains[0].slots[position][0]
        f.domains[0].slots[position].push({
          ...d,
          id: `${d.id}-trade`,
          setId: position === 0 ? 'secondary' : 'primary',
        })
      }
      addSuffixChoices(f.domains)
      if (rename) {
        const discs = new Set([
          ...f.domains.flatMap((d) => d.slots.flat()),
          ...f.baseline.flatMap((row) => row.discs.map((c) => c.disc)),
        ])
        let index = 0
        for (const disc of discs) disc.id = `physical-${1000 - index++}`
      }
      if (reversed) {
        f.domains.reverse()
        f.baseline.reverse()
        f.domains.forEach((d) => d.slots.forEach((pool) => pool.reverse()))
      }
      const objective = {
        evaluate: (rows) =>
          rows.find((r) => r.agentId === 'a').discs[0].disc.setId === 'secondary' ? 100 : 0,
      }
      const result = searchTeamAssignments(f.baseline, f.domains, objective)
      assert.equal(objective.evaluate(result.selected), 100)
      assert.ok(result.evidence.evaluatedAssignments <= 64)
      assert.ok(result.evidence.visitedNodes <= 20000)
    }
})

test('complete evidence counts the exhaustive physical assignment oracle once each', () => {
  const f = fixture()
  for (const domain of f.domains) {
    const disc = domain.slots[0][0]
    domain.slots[0].push({ ...disc, id: `${disc.id}-extra`, level: 12 })
  }
  const seen = new Set()
  const result = searchTeamAssignments(f.baseline, f.domains, {
    evaluate: (rows) => {
      const key = rows.map((row) => row.discs[0].disc.id).join('|')
      assert.equal(seen.has(key), false)
      seen.add(key)
      return rows.filter((row) => row.discs[0].disc.level === 12).length
    },
  })
  assert.equal(result.evidence.status, 'complete')
  assert.equal(result.evidence.evaluatedAssignments, 8)
  assert.equal(seen.size, 8)
})

test('one-node exhaustion cannot claim inventory infeasibility', () => {
  const f = fixture()
  const limited = searchTeamAssignments([], f.domains, undefined, { evaluations: 64, nodes: 1 })
  assert.equal(limited.evidence.status, 'budget_exhausted')
  assert.equal(limited.evidence.shortages, undefined)
  assert.equal(limited.evidence.evaluatedAssignments, 0)
  f.domains[0].slots[0] = []
  const result = searchTeamAssignments([], f.domains, undefined, { evaluations: 64, nodes: 1 })
  // The empty first slot proves impossibility without another node. If traversal
  // ever requires more work, the budget status must not carry shortages.
  assert.equal(result.evidence.status, 'complete')
  assert.ok(result.evidence.shortages.some((s) => s.kind === 'slot'))
  assert.equal(result.evidence.evaluatedAssignments, 0)
})
