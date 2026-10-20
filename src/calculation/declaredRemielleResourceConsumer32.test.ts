import { describe, expect, it } from 'vitest'
import { getDeclaredRemielleRadianceSource32 } from './compileDeclaredRemielleRadiance32'
import { compileCurrentPlanningBaselineResourceContracts } from './currentPlanningBaselineObservations'
import { executePlanningInteractionContract } from './planningInteractionOperators'

const members = ['agent-remielle', 'agent-aria', 'agent-velina'] as const
const declaration = () => ({
  contract: 'soda-declared-remielle-radiance32/v1',
  sourceIdentityHash: getDeclaredRemielleRadianceSource32()!.sourceIdentityHash,
  sourceRefs: getDeclaredRemielleRadianceSource32()!.sourceRefs,
  durationSeconds: 30,
  initialRadiance: 120,
  events: [{ atSeconds: 10, eventKey: 'assist.flower_feather' }],
  phaseFlowWindows: [{ startSeconds: 0, endSeconds: 10 }],
})
describe('declared Remielle resource consumer', () => {
  it('replaces the neutral Radiance row with declared transitions, preserving other resource contracts', () => {
    const before = compileCurrentPlanningBaselineResourceContracts(members)
    const result = compileCurrentPlanningBaselineResourceContracts(members, declaration())
    expect(result.status, JSON.stringify(result)).toBe('supported')
    if (result.status !== 'supported' || before.status !== 'supported')
      throw new Error('compilation failed')
    expect(result.declaredRemielleRadiance32).toMatchObject({
      endingValue: 90,
      consumed: 30,
      completeResourceCycle: false,
    })
    const radiance = result.contracts.find(
      (row) =>
        row.operator === 'resource_state_transition' && row.resourceKey === 'floating_radiance',
    )!
    expect(executePlanningInteractionContract(radiance)).toMatchObject({
      endingValue: 90,
      conserved: true,
    })
    expect(result.contracts.filter((row) => row !== radiance)).toEqual(
      before.contracts.filter(
        (row) =>
          row.operator !== 'resource_state_transition' || row.resourceKey !== 'floating_radiance',
      ),
    )
    expect(result.resourceObservationHash).not.toBe(before.resourceObservationHash)
  })
  it('rejects a malformed explicit declaration instead of falling back to a neutral resource state', () => {
    expect(
      compileCurrentPlanningBaselineResourceContracts(members, {
        ...declaration(),
        sourceIdentityHash: 'old',
      }).status,
    ).toBe('unsupported')
  })
  it('rejects a declared Remielle clock on a formation without Remielle', () => {
    expect(
      compileCurrentPlanningBaselineResourceContracts(
        ['agent-billy', 'agent-anby', 'agent-nicole'],
        declaration(),
      ).status,
    ).toBe('unsupported')
  })
})
