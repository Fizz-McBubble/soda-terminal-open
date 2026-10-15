import { candidateFourPieceInventory } from './candidateWarehouseConstraint.testFixture'
import { describe, expect, it } from 'vitest'
import { solveCandidateWarehouse } from '../optimizer/candidateWarehouseSolver'
import {
  getCandidateWarehouseConstraint,
  getCandidateWarehouseConstraintForTeam,
} from './candidateWarehouseConstraints'

describe('Nangong team candidate warehouse constraints', () => {
  it.each([
    ['agent-aria', 'agent-nangong', 'agent-sunna'],
    ['agent-miyabi', 'agent-nangong', 'agent-yuzuha'],
    ['agent-miyabi', 'agent-nangong', 'agent-nicole'],
    ['agent-alice', 'agent-nangong', 'agent-yuzuha'],
    ['agent-yanagi', 'agent-nangong', 'agent-yuzuha'],
    ['agent-promeia', 'agent-nangong', 'agent-yuzuha'],
  ])(
    'preserves the baseline only for the advisory anomaly/support recipe in %s/%s/%s',
    (...memberIds) => {
      const constraint = getCandidateWarehouseConstraintForTeam('agent-nangong', { memberIds })!
      const base = getCandidateWarehouseConstraint('agent-nangong')!
      if (!memberIds.includes('agent-aria')) {
        expect(constraint.setPlans).toEqual(expect.arrayContaining(base.setPlans!))
      } else {
        expect(constraint.setPlans).toHaveLength(1)
        expect(constraint.setIds).not.toContain('set-astral-voice')
      }
    },
  )
  it('keeps both sourced Nangong recipes executable in the Promeia/Yuzuha team', () => {
    const memberIds = ['agent-promeia', 'agent-nangong', 'agent-yuzuha']
    const constraint = getCandidateWarehouseConstraintForTeam('agent-nangong', { memberIds })!
    const recipes = [
      ['set-astral-voice', 'set-phaethons-melody'],
      ['set-phaethons-melody', 'set-freedom-blues'],
    ] as const
    for (const [primary, secondary] of recipes) {
      expect(constraint.setPlans).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            primarySetIds: [primary],
            secondarySetIds: expect.arrayContaining([secondary]),
          }),
        ]),
      )
      const inventory = candidateFourPieceInventory(constraint, primary, secondary).map((disc) => ({
        ...disc,
        rarity: 'S' as const,
        // Retain the original 3/2/0/0 +15 history, replacing only a conflicting AP/ATK main.
        subStats: disc.subStats.map((row) =>
          row.stat === disc.mainStat
            ? { stat: 'hp_percent' as const, value: 3 * (row.upgrades + 1), upgrades: row.upgrades }
            : row,
        ),
      }))
      for (const disc of inventory) {
        expect(disc.subStats).toHaveLength(4)
        expect(new Set(disc.subStats.map((row) => row.stat)).size).toBe(4)
        expect(disc.subStats.map((row) => row.stat)).not.toContain(disc.mainStat)
        expect(disc.subStats.reduce((sum, row) => sum + row.upgrades, 0)).toBe(5)
      }
      const before = structuredClone(inventory)
      const result = solveCandidateWarehouse(inventory, ['agent-nangong'], 'agent', {}, [
        { agentId: 'agent-nangong', constraint },
      ])
      expect(inventory).toEqual(before)
      expect(new Set(result.loadouts[0]?.discs.map((item) => item.disc.id)).size).toBe(6)
      expect(result.loadouts[0]?.discs).toHaveLength(6)
      expect(result.loadouts[0]?.setPattern).toBe('4+2')
      expect(result.loadouts[0]?.degraded).toBe(false)
      expect(result.loadouts[0]?.discs.filter((item) => item.disc.setId === primary)).toHaveLength(
        4,
      )
    }
    // The advisory anomaly/support recipe must not spread to an unmatched trio.
    const unmatched = getCandidateWarehouseConstraintForTeam('agent-nangong', {
      memberIds: ['agent-nangong', 'agent-nicole', 'agent-anby'],
    })!
    expect(unmatched.setPlans).toEqual(getCandidateWarehouseConstraint('agent-nangong')!.setPlans)
    expect(unmatched.setIds).not.toContain('set-astral-voice')
  })
})
