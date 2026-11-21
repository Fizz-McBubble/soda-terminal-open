import { describe, expect, it } from 'vitest'
import { getCurrentAgentPlanningEffectBlueprint } from './currentAgentPlanningEffectBlueprint'
import {
  createLevel60NeutralEffectRuntimeMember,
  type PlanningEffectRuntimeMember,
} from './currentPlanningEffectDomain'
import {
  knownInactivePlanningEffect32,
  reduceObservedPlanningEffect32,
} from './planningKnownInactiveEffects32'
import { statWeightCalibrationFixture } from '../decision/developmentStatWeights.calibrationFixture'
import { evaluateDevelopmentValueBenchmarkSide } from '../decision/developmentValueBenchmark'

describe('source-proven inactive effects', () => {
  it('reduces the verified Sunna M0 IR branch without an unreachable M1 stack observation', () => {
    const entry = getCurrentAgentPlanningEffectBlueprint(
      'agent-sunna:reviewed_cat_gaze_defense_reduction32',
    )!
    const member = createLevel60NeutralEffectRuntimeMember('agent-sunna')
    expect(entry.numericExpression.sourceStatus).toBe('declarative_baseline_input')
    expect(reduceObservedPlanningEffect32(entry, { ...member, mindscape: 0 })).toEqual({
      expression: { kind: 'literal', value: 0 },
      inactive: true,
    })
    expect(knownInactivePlanningEffect32(entry, { ...member, mindscape: 1 })).toBe(false)
    expect(knownInactivePlanningEffect32(entry, { ...member, mindscape: 6 })).toBe(false)
    for (const mindscape of [undefined, Number.NaN])
      expect(
        knownInactivePlanningEffect32(entry, {
          ...member,
          mindscape,
        } as PlanningEffectRuntimeMember),
      ).toBe(false)
  })
  it('does not admit rewritten or wrong-owner declarative components as source-proven inactive', () => {
    const entry = getCurrentAgentPlanningEffectBlueprint(
      'agent-sunna:reviewed_cat_gaze_defense_reduction32',
    )!
    const member = createLevel60NeutralEffectRuntimeMember('agent-sunna')
    expect(
      reduceObservedPlanningEffect32({ ...entry, sourceRefs: ['unreviewed-source'] }, member),
    ).toBeNull()
    expect(reduceObservedPlanningEffect32({ ...entry, targetKinds: ['self'] }, member)).toBeNull()
    expect(
      reduceObservedPlanningEffect32(
        {
          ...entry,
          numericExpression: {
            ...entry.numericExpression,
            expressionIr: { kind: 'literal', value: 0 },
          },
        },
        member,
      ),
    ).toBeNull()
    expect(
      reduceObservedPlanningEffect32(entry, createLevel60NeutralEffectRuntimeMember('agent-piper')),
    ).toBeNull()
  })
  it('closes unavailable mindscapes without inventing their unobserved triggers', () => {
    const entry = getCurrentAgentPlanningEffectBlueprint('agent-billy:m4_exSpecial_crit_')!
    const member = createLevel60NeutralEffectRuntimeMember('agent-billy')
    expect(knownInactivePlanningEffect32(entry, member)).toBe(true)
    expect(knownInactivePlanningEffect32(entry, { ...member, mindscape: 4 })).toBe(false)
  })
  it('solo additional ability is actually inactive, while an eligible team still needs its trigger', () => {
    const entry = getCurrentAgentPlanningEffectBlueprint('agent-claret:ability_laceration_dmg_')!
    const member = createLevel60NeutralEffectRuntimeMember('agent-claret')
    expect(knownInactivePlanningEffect32(entry, member)).toBe(true)
    expect(
      knownInactivePlanningEffect32(entry, member, {}, [
        'agent-claret',
        'agent-rina',
        'agent-anby',
      ]),
    ).toBe(false)
  })
  it('uses declared false observation but never converts an absent one to false', () => {
    const entry = getCurrentAgentPlanningEffectBlueprint('agent-claret:core_basic_dmg_')!
    const member = createLevel60NeutralEffectRuntimeMember('agent-claret')
    expect(knownInactivePlanningEffect32(entry, member, { perfectDodge: false })).toBe(true)
    expect(knownInactivePlanningEffect32(entry, member)).toBe(false)
  })
  it('reaches the actual personal benchmark without leaving resolved M0 effects as unknown', () => {
    const fixture = statWeightCalibrationFixture()
    const side = evaluateDevelopmentValueBenchmarkSide({ ...fixture, stale: false })
    expect(side.state).toBe('supported')
    expect(side.coverage?.excludedEffects).toEqual([])
    expect(side.coverage?.includedEffectKeys).toContain('agent-claret:m1_maim_mult_')
  })
})
