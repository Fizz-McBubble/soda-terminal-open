import { describe, expect, it } from 'vitest'
import inventory from '../gameDataPacks/generated/capture-source-potential-inventory.v1.json'
import {
  getReviewedPotentialDefinition,
  reviewedPotentialDefinitions,
} from '../gameDataPacks/reviewedPotentialDefinitions'
import {
  reviewedPotentialTimers32,
  reviewedPotentialRawArtifact32,
  resolveReviewedHarumasaGleamingEdgeWindow32,
  resolveReviewedPotentialTimer32,
  type ReviewedPotentialTimerObservation32,
} from './reviewedPotentialSourceClosure32'

function observation(
  agentId = 'agent-harumasa',
  stateKey = 'harumasa_focus',
  triggeredAt = 0,
): ReviewedPotentialTimerObservation32 {
  return {
    ownerAgentId: agentId,
    stateKey,
    triggeredAt,
    triggerKey: stateKey === 'grace_electric_enhancement' ? 'zap_consumed' : 'ex_special',
    upstreamRawSha256: getReviewedPotentialDefinition(agentId)!.source.upstreamRawSha256,
  }
}

describe('reviewed potential scalar source closure', () => {
  it('extends the existing five-second core window only at potential two and above', () => {
    const row = {
      ...observation('agent-harumasa', 'harumasa_gleaming_edge'),
      triggerKey: 'gleaming_edge_qualifying_critical_hit',
    }
    for (const potential of [0, 1, 2, 6]) {
      const duration = potential >= 2 ? 10 : 5
      expect(
        resolveReviewedHarumasaGleamingEdgeWindow32({
          potential,
          at: duration - 0.01,
          observations: [row],
        }),
      ).toMatchObject({ status: 'known', active: true, expiresAt: duration })
      expect(
        resolveReviewedHarumasaGleamingEdgeWindow32({
          potential,
          at: duration,
          observations: [row],
        }),
      ).toMatchObject({ status: 'known', active: false })
    }
    expect(
      resolveReviewedHarumasaGleamingEdgeWindow32({ potential: null, at: 1, observations: [row] })
        .status,
    ).toBe('unknown')
  })
  it('reconciles every nonempty raw subject by exact source identity and parameter rows', () => {
    const rawSubjects = inventory.entries.filter((row) => row.hasPotential)
    expect(rawSubjects).toHaveLength(10)
    expect(rawSubjects.map((row) => row.stableId).sort()).toEqual(
      reviewedPotentialDefinitions.map((row) => row.agentId).sort(),
    )
    let rows = 0
    for (const raw of rawSubjects) {
      const definition = getReviewedPotentialDefinition(raw.stableId)!
      expect(definition.source.upstreamRawSha256).toBe(raw.rawSha256.toLowerCase())
      expect(definition.source.upstreamRawPath.endsWith(raw.upstreamPath)).toBe(true)
      const boundRows = new Set(
        definition.effects.flatMap((effect) => effect.formulaBinding.sourceParameterBinding.rows),
      )
      for (const timer of reviewedPotentialTimers32.filter((row) => row.agentId === raw.stableId)) {
        expect(timer.secondsByLevel.slice(1)).toEqual(
          raw.potentialParams[timer.rawParameterRow - 1],
        )
        boundRows.add(timer.rawParameterRow)
      }
      // Raw preservation is independent of rejecting a proved parser artifact.
      if (raw.stableId === 'agent-soldier-11') {
        expect(raw.potentialParams[0]).toEqual(reviewedPotentialRawArtifact32.rawValuesByLevel)
        expect(boundRows.has(1)).toBe(false)
        boundRows.add(1)
      }
      expect([...boundRows].sort((a, b) => a - b)).toEqual(
        raw.potentialParams.map((_, index) => index + 1),
      )
      rows += raw.potentialParams.length
    }
    expect(rows).toBe(28)
  })

  it('reproduces the upstream Soldier 11 name extraction artifact instead of treating 11 as a mechanic', () => {
    const definition = getReviewedPotentialDefinition('agent-soldier-11')!
    // Same numeric-token behavior as pinned util.ts; the upstream caller
    // removes "Soldier 0 - Anby" but leaves "Soldier 11" in the prose.
    for (const [index, value] of definition.effects[0].valueByLevel.slice(2).entries()) {
      const text = `In Additional Ability: Fields of Fire, Soldier 11's CRIT DMG is increased by ${value * 100}%.`
      const tokens = [...text.matchAll(/(\d+\.?\d*)(?:\s*(%)|s?\b)(?!>)/g)].map(
        (match) => Number(match[1]) * (match[2] ? 0.01 : 1),
      )
      expect(tokens).toEqual([11, definition.effects[0].valueByLevel[index + 2]])
    }
    expect(reviewedPotentialRawArtifact32.disposition).toBe('character_name_numeric_extraction')
    expect(definition.effects[0].formulaBinding.sourceParameterBinding.rows).toEqual([2])
  })

  it('retains separate duration operands at every potential level without pricing damage', () => {
    expect(
      reviewedPotentialTimers32.map((row) => [
        row.agentId,
        row.rawParameterRow,
        row.secondsByLevel,
      ]),
    ).toEqual([
      ['agent-harumasa', 3, [0, 0, 12, 12, 12, 12, 12]],
      ['agent-harumasa', 4, [0, 0, 10, 10, 10, 10, 10]],
      ['agent-grace', 2, [0, 0, 25, 25, 25, 25, 25]],
    ])
    for (const potential of [0, 1, 2, 3, 4, 5, 6]) {
      expect(
        resolveReviewedPotentialTimer32({
          agentId: 'agent-harumasa',
          stateKey: 'harumasa_focus',
          potential,
          at: 0,
          observations: [observation()],
        }).active,
      ).toBe(potential >= 2)
    }
  })

  it('expires at the source boundary and resets rather than adds durations', () => {
    const base = { agentId: 'agent-harumasa', stateKey: 'harumasa_focus', potential: 6 }
    expect(
      resolveReviewedPotentialTimer32({ ...base, at: 11.99, observations: [observation()] }).active,
    ).toBe(true)
    expect(
      resolveReviewedPotentialTimer32({ ...base, at: 12, observations: [observation()] }).active,
    ).toBe(false)
    expect(
      resolveReviewedPotentialTimer32({
        ...base,
        at: 12,
        observations: [observation(undefined, undefined, 10), observation()],
      }),
    ).toMatchObject({ active: true, expiresAt: 22 })
    expect(
      resolveReviewedPotentialTimer32({
        ...base,
        at: 22,
        observations: [observation(undefined, undefined, 10)],
      }).active,
    ).toBe(false)
  })

  it('requires real resource/critical-hit trigger evidence for Grace and Gleaming Edge', () => {
    const grace = {
      agentId: 'agent-grace',
      stateKey: 'grace_electric_enhancement',
      potential: 6,
      at: 25,
    }
    expect(
      resolveReviewedPotentialTimer32({
        ...grace,
        observations: [observation('agent-grace', grace.stateKey)],
      }),
    ).toMatchObject({ active: false, expiresAt: 25 })
    expect(
      resolveReviewedPotentialTimer32({
        ...grace,
        observations: [{ ...observation('agent-grace', grace.stateKey), triggerKey: 'special' }],
      }).status,
    ).toBe('unknown')
    const edge = {
      agentId: 'agent-harumasa',
      stateKey: 'harumasa_gleaming_edge',
      potential: 6,
      at: 9,
    }
    expect(
      resolveReviewedPotentialTimer32({
        ...edge,
        observations: [observation(undefined, edge.stateKey)],
      }).status,
    ).toBe('unknown')
    expect(
      resolveReviewedPotentialTimer32({
        ...edge,
        observations: [
          {
            ...observation(undefined, edge.stateKey),
            triggerKey: 'gleaming_edge_qualifying_critical_hit',
          },
        ],
      }),
    ).toMatchObject({ active: true, expiresAt: 10 })
  })

  it('fails closed for missing, foreign, future, stale-source or invalid observations', () => {
    const base = { agentId: 'agent-harumasa', stateKey: 'harumasa_focus', potential: 6, at: 1 }
    for (const observations of [
      [],
      [{ ...observation(), ownerAgentId: 'agent-grace' }],
      [{ ...observation(), upstreamRawSha256: 'stale' }],
      [observation(undefined, undefined, 2)],
      [observation(undefined, undefined, NaN)],
      [{ ...observation(), triggerKey: 'basic' }],
    ]) {
      expect(resolveReviewedPotentialTimer32({ ...base, observations })).toMatchObject({
        status: 'unknown',
        active: null,
      })
    }
    expect(
      resolveReviewedPotentialTimer32({ ...base, potential: 7, observations: [observation()] })
        .status,
    ).toBe('unknown')
    expect(
      resolveReviewedPotentialTimer32({ ...base, at: -1, observations: [observation()] }).status,
    ).toBe('unknown')
  })
})
