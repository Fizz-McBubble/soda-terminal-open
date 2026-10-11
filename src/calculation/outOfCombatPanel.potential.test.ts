import { describe, expect, it } from 'vitest'
import { createEmptyRoster } from '../assault/catalog'
import type { DriveDisc } from '../domain/schemas'
import { projectNormalizedAccountFinalStatsDetailed } from '../decision/normalizedAccountFinalStats'
import { bindReviewedPotentialApplications } from './potentialApplicationBinding'
import { projectOutOfCombatMenuPanel } from './outOfCombatPanel'
import { projectOutOfCombatInitialModifiers } from './outOfCombatInitialModifiers'

const discs: DriveDisc[] = [1, 2, 3, 4, 5, 6].map((slot) => ({
  id: `potential-${slot}`,
  slot: slot as DriveDisc['slot'],
  setId: 'set-swing-jazz',
  level: 15,
  rarity: 'S',
  mainStat: (
    ['hp_flat', 'atk_flat', 'def_flat', 'atk_percent', 'pen_ratio', 'energy_regen'] as const
  )[slot - 1]!,
  subStats: [],
  locked: false,
  favorite: false,
  tags: [],
  createdAt: '2026-10-10T00:00:00.000Z',
  updatedAt: '2026-10-10T00:00:00.000Z',
  dataVersion: 'synthetic-potential-panel',
}))
const input = {
  agentId: 'agent-rina',
  level: 60,
  ascension: 5,
  core: 5,
  wEngine: { id: 'wengine-13001', level: 60, ascension: 5, refinement: 1 },
  discs,
}

describe('out-of-combat potential ownership', () => {
  it.each([0, 1, 2, 3, 4, 5, 6])(
    'keeps Rina P%s combat PEN bonus outside the game menu',
    (potentialImage) => {
      const result = projectOutOfCombatMenuPanel({ ...input, potentialImage })
      expect(result.status).toBe('ok')
      // S15 slot5=24%, core F=14.4%; awakened combat effects are not menu fields.
      expect(result.values.penRatio).toBeCloseTo(38.4, 9)
      expect(
        result.trace.filter((row) => row.source.includes('potential_penetration')),
      ).toHaveLength(0)
      const zero = projectOutOfCombatMenuPanel({ ...input, potentialImage: 0 })
      expect({ ...result.values, penRatio: zero.values.penRatio }).toEqual(zero.values)
      expect(result.trace.some((row) => row.source.includes('potential_team_'))).toBe(false)
    },
  )

  it('preserves the enabled P5 unequipped game-menu calibration counterexample', () => {
    expect(
      projectOutOfCombatInitialModifiers({
        agentId: 'agent-rina',
        potentialImage: 5,
        critDamage: 50,
      }),
    ).toEqual({ status: 'supported', modifiers: [] })
  })

  it('keeps the established eligible planning default without treating it as a scan observation', () => {
    const explicit = projectOutOfCombatMenuPanel({ ...input, potentialImage: 6 })
    expect(projectOutOfCombatMenuPanel(input).values).toEqual(explicit.values)
    expect(projectOutOfCombatMenuPanel({ ...input, potentialImage: null }).values).toEqual(
      explicit.values,
    )
  })

  it.each([-1, 7, 2.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid potential %s',
    (potentialImage) => {
      expect(projectOutOfCombatMenuPanel({ ...input, potentialImage })).toMatchObject({
        status: 'unsupported',
        reason: '潜能必须为 0 到 6 的整数。',
      })
    },
  )

  it.each(['agent-lycaon', 'agent-burnice', 'agent-ellen', 'agent-koleda', 'agent-jane'])(
    'keeps %s conditional potential out of menu totals',
    (agentId) => {
      const zero = projectOutOfCombatMenuPanel({ ...input, agentId, potentialImage: 0 })
      const maximum = projectOutOfCombatMenuPanel({ ...input, agentId, potentialImage: 6 })
      expect(zero.status).toBe('ok')
      expect(maximum.status).toBe('ok')
      expect(maximum.values).toEqual(zero.values)
      expect(maximum.trace.some((row) => row.source.includes('potential_'))).toBe(false)
    },
  )

  it('keeps damage initial stats separate and admits the same static effect once in the existing event path', () => {
    const rosterAgent = createEmptyRoster().agents.find((row) => row.agentId === input.agentId)!
    const agent = {
      ...rosterAgent,
      owned: true,
      level: input.level,
      ascension: input.ascension,
      potentialImage: 6,
      skillLevels: { ...rosterAgent.skillLevels, core: 7 },
      wEngineDetails: { ...rosterAgent.wEngineDetails, ...input.wEngine },
    }
    const normalized = projectNormalizedAccountFinalStatsDetailed({
      agent,
      engineId: input.wEngine.id,
      discs,
    })
    if (normalized.status !== 'supported') throw new Error(normalized.reasons.join(';'))
    expect(normalized.stats.finalStats.pen_).toBeCloseTo(0.384, 9)
    const effects = bindReviewedPotentialApplications({
      member: {
        agentId: input.agentId,
        potential: 6,
        initialStats: {
          pen_: normalized.stats.finalStats.pen_,
          enerRegen: normalized.stats.finalStats.enerRegen,
        },
        provenance: 'calculation_context',
      },
      event: {
        eventId: 'synthetic-direct-event',
        actionFamilies: [],
        providerStateKeys: [],
        targetStateKeys: [],
        sourceRefs: ['synthetic-direct-event-evidence'],
      },
    }).filter((row) => row.status === 'applied')
    expect(effects).toHaveLength(1)
    expect(effects[0]).toMatchObject({ effectId: 'potential_penetration', value: 0.016 })
    expect(normalized.stats.finalStats.pen_).toBeCloseTo(
      projectOutOfCombatMenuPanel({ ...input, potentialImage: 6 }).values.penRatio / 100,
      9,
    )
    expect(normalized.stats.finalStats.pen_ + effects[0]!.value).toBeCloseTo(0.4, 9)
  })
})
