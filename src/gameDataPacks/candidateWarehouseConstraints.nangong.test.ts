import { describe, expect, it } from 'vitest'
import { sampleDiscs } from '../evaluation/fixtures'
import { solveCandidateWarehouse } from '../optimizer/candidateWarehouseSolver'
import type { DriveDisc } from '../domain/schemas'
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
      const inventory: DriveDisc[] = [1, 2, 3, 4, 5, 6].map((slot, index) => ({
        ...sampleDiscs.treasureCandidate,
        id: `${primary}-${slot}`,
        slot: slot as DriveDisc['slot'],
        setId: index < 4 ? primary : secondary,
        mainStat:
          slot === 1
            ? 'hp_flat'
            : slot === 2
              ? 'atk_flat'
              : slot === 3
                ? 'def_flat'
                : constraint.mainStats[String(slot) as '4' | '5' | '6']![0]!,
      }))
      const result = solveCandidateWarehouse(inventory, ['agent-nangong'], 'agent', {}, [
        { agentId: 'agent-nangong', constraint },
      ])
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
