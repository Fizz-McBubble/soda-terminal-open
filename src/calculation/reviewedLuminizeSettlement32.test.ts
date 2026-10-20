import { describe, expect, it } from 'vitest'
import {
  compareReviewedLuminizeSettlements32,
  evaluateReviewedLuminizeSettlement32,
} from './reviewedLuminizeSettlement32'
import { luminizeFixture32 } from './reviewedLuminizeSettlement32.testFixture'
import { historicalLuminizeSettlementSchema32 } from './luminizeSettlementContract32'

describe('declared Luminize settlement', () => {
  it('uses the declared skill MV rather than the ordinary physical anomaly MV', () => {
    // 1000 ATK × 1.6 skill MV × 794/(794+794) × 100/100 AP × level-60 factor 2.
    expect(evaluateReviewedLuminizeSettlement32(luminizeFixture32())).toMatchObject({
      status: 'declared_arithmetic',
      totalDamage: 1600,
      formalCycleReady: false,
      modelQualification32: null,
    })
  })
  it('separates stored Refringe, current provider AP and general anomaly bonus', () => {
    const input = luminizeFixture32()
    input.remielle.anomalyProficiency = 400
    input.remielle.generalAnomalyDamageBonus = 0.15
    input.voidflares[0]!.storedRefringeCoefficient = 0.2
    expect(evaluateReviewedLuminizeSettlement32(input).totalDamage).toBeCloseTo(
      1600 * 1.4 * 1.15 * 1.2,
      10,
    )
    input.remielle.anomalyProficiency = 800
    const result = evaluateReviewedLuminizeSettlement32(input)
    expect(result.totalDamage).toBeCloseTo(1600 * 1.8 * 1.15 * 1.2, 10)
    expect(result.instances[0]!.storedRefringeCoefficient).toBe(0.2)
  })
  it('retains individual owners and attributes in a mixed volley', () => {
    const input = luminizeFixture32()
    input.memberAgentIds.push('agent-anby')
    input.voidflares.push({
      ...structuredClone(input.voidflares[0]!),
      id: 'flare-electric',
      ownerAgentId: 'agent-anby',
      attribute: 'electric',
      storedRefringeCoefficient: 0.5,
    })
    input.target.resistanceByAttribute.electric = 0.2
    input.target.resistanceReductionByAttribute.electric = 0
    const result = evaluateReviewedLuminizeSettlement32(input)
    expect(result.status).toBe('declared_arithmetic')
    expect(result.totalDamage).toBeCloseTo(1600 + 1600 * 1.5 * 0.8, 10)
    expect(result.instances.map(({ ownerAgentId }) => ownerAgentId)).toEqual([
      'agent-billy',
      'agent-anby',
    ])
  })
  it.each([
    'self-owner',
    'wrong-attribute',
    'outside-member',
    'future-snapshot',
    'missing-resistance',
    'duplicate-flare',
    'source-drift',
    'foreign-multiplier',
  ])('rejects %s without emitting a damage value', (kind) => {
    const input = luminizeFixture32()
    if (kind === 'self-owner') input.voidflares[0]!.ownerAgentId = 'agent-remielle'
    if (kind === 'wrong-attribute') input.voidflares[0]!.attribute = 'fire'
    if (kind === 'outside-member') input.voidflares[0]!.ownerAgentId = 'agent-anby'
    if (kind === 'future-snapshot') input.voidflares[0]!.snapshotAtSeconds = 11
    if (kind === 'missing-resistance') input.target.resistanceReductionByAttribute = {}
    if (kind === 'duplicate-flare') input.voidflares.push(structuredClone(input.voidflares[0]!))
    if (kind === 'source-drift') input.sourceIdentityHash = 'previous-source'
    if (kind === 'foreign-multiplier') Object.assign(input.voidflares[0]!.stats, { buffBonus: 0.5 })
    expect(evaluateReviewedLuminizeSettlement32(input)).toMatchObject({
      status: 'unsupported',
      totalDamage: null,
    })
  })
  it('compares numerical builds under the same named window, but rejects a window change', () => {
    const before = luminizeFixture32()
    const after = structuredClone(before)
    after.remielle.anomalyProficiency = 400
    expect(compareReviewedLuminizeSettlements32(before, after)).toMatchObject({
      status: 'declared_comparison',
      currentDamage: 1600,
      candidateDamage: 2240,
      delta: 640,
    })
    after.remielle.prismaticDefenseIgnoreWindow = true
    expect(compareReviewedLuminizeSettlements32(before, after).status).toBe('unsupported')
  })
  it('restores historical source inputs but never recomputes them under a new identity', () => {
    const input = { ...luminizeFixture32(), sourceIdentityHash: 'previous-source' }
    expect(historicalLuminizeSettlementSchema32.safeParse(input).success).toBe(true)
    expect(evaluateReviewedLuminizeSettlement32(input).status).toBe('unsupported')
  })
})
