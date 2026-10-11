import { describe, expect, it } from 'vitest'
import { settleReviewedRoxyEnergySpend32 } from './reviewedRoxyResourceSettlement32'
import { developmentSourceAction32 } from '../decision/developmentSourceAction32'
import { createLevel60NeutralEffectRuntimeMember } from './currentPlanningEffectDomain'

describe('adopted Roxy consumption settlement and real comparison consumer', () => {
  it('carries spend across actions rather than rounding each action', () => {
    const first = settleReviewedRoxyEnergySpend32({
      windEnergy: 0,
      energyConsumptionAccumulator: 0,
      energySpent: 10,
    })
    if (first.status !== 'supported') throw new Error('first')
    const second = settleReviewedRoxyEnergySpend32({ ...first, energySpent: 40 })
    expect(second).toMatchObject({
      status: 'supported',
      windEnergy: 2,
      energyConsumptionAccumulator: 0,
      windGranted: 2,
    })
  })
  it.each([0, 10, 24, 25])('conserves threshold/capped excess with carry %s', (carry) => {
    for (const wind of [0, 1, 2, 3]) {
      for (const spend of [0, 10, 24, 25, 40, 46, 120]) {
        const result = settleReviewedRoxyEnergySpend32({
          windEnergy: wind,
          energyConsumptionAccumulator: carry,
          energySpent: spend,
        })
        if (result.status !== 'supported') throw new Error('settlement')
        expect(result.windEnergy).toBeLessThanOrEqual(3)
        expect(result.energyConsumptionAccumulator).toBeLessThanOrEqual(25)
        expect(
          result.windGranted * 25 +
            result.energyConsumptionAccumulator +
            result.discardedConsumptionAtCap,
        ).toBe(carry + spend)
      }
    }
  })
  it.each([-1, NaN, Infinity])('rejects illegal spend %s', (energySpent) => {
    expect(
      settleReviewedRoxyEnergySpend32({
        windEnergy: 0,
        energyConsumptionAccumulator: 0,
        energySpent,
      }).status,
    ).toBe('unsupported')
  })
  it('preserves capped consumption after Wind release until the next positive spend', () => {
    const atCap = settleReviewedRoxyEnergySpend32({
      windEnergy: 3,
      energyConsumptionAccumulator: 0,
      energySpent: 40,
    })
    if (atCap.status !== 'supported') throw new Error('cap settlement')
    expect(atCap.energyConsumptionAccumulator).toBe(25)
    // The held compiler releases all three Wind units without dispatching a
    // consumption settlement. That legal terminal state carries into the next action.
    const released = { ...atCap, windEnergy: 0, energySpent: 0 }
    expect(settleReviewedRoxyEnergySpend32(released)).toMatchObject({
      status: 'supported',
      windEnergy: 0,
      energyConsumptionAccumulator: 25,
      windGranted: 0,
      discardedConsumptionAtCap: 0,
    })
    const nextSpend = settleReviewedRoxyEnergySpend32({ ...released, energySpent: 10 })
    expect(nextSpend).toMatchObject({
      status: 'supported',
      windEnergy: 1,
      energyConsumptionAccumulator: 10,
      windGranted: 1,
      discardedConsumptionAtCap: 0,
    })
    if (nextSpend.status !== 'supported') throw new Error('next spend')
    expect(nextSpend.windGranted * 25 + nextSpend.energyConsumptionAccumulator).toBe(25 + 10)
  })
  it('accepts the existing comparison compiler terminal state as the next settlement input', () => {
    const member = createLevel60NeutralEffectRuntimeMember('agent-roxy')
    member.mindscape = 0
    member.potential = 0
    member.skillLevels = { ...member.skillLevels, special: 12 }
    const compiled = developmentSourceAction32(member)
    if (
      !compiled ||
      compiled.status !== 'supported' ||
      !('terminalSourcePolicyState' in compiled.resourceLegality)
    )
      throw new Error('held comparison compiler')
    expect(
      settleReviewedRoxyEnergySpend32({
        ...compiled.resourceLegality.terminalSourcePolicyState,
        energySpent: 10,
      }),
    ).toMatchObject({
      status: 'supported',
      windEnergy: 1,
      energyConsumptionAccumulator: 10,
    })
  })
  it('exposes bounded resource termination through the existing consumer and uses actual regeneration', () => {
    const member = createLevel60NeutralEffectRuntimeMember('agent-roxy')
    member.mindscape = 0
    member.potential = 0
    member.skillLevels = { ...member.skillLevels, special: 12 }
    member.initialStats.enerRegen = 2.4
    const result = developmentSourceAction32(member)
    if (
      !result ||
      result.status !== 'supported' ||
      !result.resourceLegality ||
      !('actualEnergyRegenPerSecond' in result.resourceLegality)
    )
      throw new Error('consumer')
    expect(result.resourceLegality.actualEnergyRegenPerSecond).toBe(2.4)
    expect(result.resourceLegality.terminalSourcePolicyState.energyRange).toEqual([74, 120])
    expect(result.resourceLegality.consumptionAccumulator.sourcePolicyFinal).toBe(25)
    expect(result.eventUsages).toHaveLength(7)
    expect(result.eventUsages.every((row) => row.skillLevel === 12)).toBe(true)
    member.initialStats.enerRegen = NaN
    expect(developmentSourceAction32(member)?.status).toBe('unsupported')
  })
})
