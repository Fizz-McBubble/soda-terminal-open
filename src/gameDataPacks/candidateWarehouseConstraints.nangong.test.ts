import { candidateFourPieceInventory } from './candidateWarehouseConstraint.testFixture'
import { describe, expect, it } from 'vitest'
import { solveCandidateWarehouse } from '../optimizer/candidateWarehouseSolver'
import {
  getCandidateWarehouseConstraint,
  getCandidateWarehouseConstraintForTeam,
} from './candidateWarehouseConstraints'
import { evaluateCandidateSetPlanEligibility } from './candidateSetPlanEligibility'

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
  it.each(['agent-astra', 'agent-sunna', 'agent-yuzuha'])(
    'requires a real Quick Assist for the Astral Voice source branch with %s',
    (support) => {
      const memberIds = ['agent-miyabi', 'agent-nangong', support]
      const constraint = getCandidateWarehouseConstraintForTeam('agent-nangong', { memberIds })!
      const astral = constraint.setPlans!.find(plan => plan.primarySetIds.includes('set-astral-voice'))!
      const alternative = constraint.setPlans!.find(plan => plan.primarySetIds.includes('set-phaethons-melody'))!
      const eligibility = evaluateCandidateSetPlanEligibility
      expect(astral).toMatchObject({
        condition: {
          sourceId: 'miyoushe-74153268-nangong-anomaly-support-astral-voice',
          rule: { kind: 'teammate_specialty_and_action', specialties: ['anomaly'], action: 'team_quick_assist' },
        },
      })
      expect(eligibility('agent-nangong', astral, { memberIds }).status).toBe('condition-unknown')
      expect(eligibility('agent-nangong', astral, {
        memberIds,
        operationCoverage: { basis: 'final-candidate', teamQuickAssist: 'not-covered' },
      }).status).toBe('condition-not-met')
      expect(eligibility('agent-nangong', astral, {
        memberIds,
        operationCoverage: { basis: 'final-candidate', teamQuickAssist: 'verified' },
      })).toMatchObject({ status: 'eligible', effectCoverage: 'unknown' })
      expect(eligibility('agent-nangong', alternative, { memberIds }).status).toBe('unrestricted')
    },
  )
  it('keeps both six-disc recipes while qualifying the one that needs a recorded Quick Assist', () => {
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
      const needsQuickAssist = primary === 'set-astral-voice'
      expect(result.loadouts[0]?.degraded).toBe(needsQuickAssist)
      if (needsQuickAssist)
        expect(result.loadouts[0]?.degradeReasons.join(' ')).toContain('完整、唯一三人队伍')
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
