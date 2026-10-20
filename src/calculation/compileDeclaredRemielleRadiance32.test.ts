import { afterEach, describe, expect, it, vi } from 'vitest'
import * as contracts from './currentAgentDecisionMechanicContracts'
import {
  compileDeclaredRemielleRadiance32,
  getDeclaredRemielleRadianceSource32,
  type DeclaredRemielleRadiance32,
} from './compileDeclaredRemielleRadiance32'
import { executePlanningInteractionContract } from './planningInteractionOperators'

afterEach(() => vi.restoreAllMocks())

function declaration(
  overrides: Partial<DeclaredRemielleRadiance32> = {},
): DeclaredRemielleRadiance32 {
  const source = getDeclaredRemielleRadianceSource32()!
  return {
    contract: 'soda-declared-remielle-radiance32/v1',
    sourceIdentityHash: source.sourceIdentityHash,
    sourceRefs: [source.resourceFlow.evidenceLocator, 'declared:test-resource-clock'],
    durationSeconds: 60,
    initialRadiance: 120,
    events: [],
    phaseFlowWindows: [],
    ...overrides,
  }
}

function success(input: unknown) {
  const result = compileDeclaredRemielleRadiance32(input)
  expect(result.status).toBe('declared_resource_arithmetic')
  if (result.status !== 'declared_resource_arithmetic') throw new Error(result.blockers.join(';'))
  return result
}

describe('declared Remielle Radiance actions and explicit resource clock', () => {
  it('uses adopted initial, indexed Basic gains and Solo gain; hand sum 10+5+5+15+35+30=100', () => {
    const result = success(
      declaration({
        initialRadiance: 10,
        events: [
          { atSeconds: 1, eventKey: 'basic.leap.hit1' },
          { atSeconds: 2, eventKey: 'basic.leap.hit2' },
          { atSeconds: 3, eventKey: 'basic.leap.hit3' },
          { atSeconds: 4, eventKey: 'basic.leap.hit4' },
          { atSeconds: 5, eventKey: 'basic.solo_dance' },
        ],
      }),
    )
    expect(result.states.map((state) => state.valueAfter)).toEqual([15, 20, 35, 70, 100])
    expect(result).toMatchObject({
      generated: 90,
      consumed: 0,
      overflow: 0,
      endingValue: 100,
      conserved: true,
    })
    const entry = success(
      declaration({ initialRadiance: 17, events: [{ atSeconds: 0, eventKey: 'battle_entry' }] }),
    )
    expect(entry).toMatchObject({ generated: 103, endingValue: 120 })
  })

  it.each(['basic.rainbow', 'basic.fleeting'] as const)(
    'clips %s to cap and separately reports overflow',
    (eventKey) => {
      const result = success(
        declaration({ initialRadiance: 100, events: [{ atSeconds: 1, eventKey }] }),
      )
      expect(result).toMatchObject({ generated: 20, consumed: 0, overflow: 100, endingValue: 120 })
      expect(result.actions[0]).toMatchObject({
        requestedAmount: 120,
        effectiveDelta: 20,
        overflow: 100,
      })
      const clippedAdd = success(
        declaration({
          initialRadiance: 100,
          events: [{ atSeconds: 1, eventKey: 'basic.leap.hit4' }],
        }),
      )
      expect(clippedAdd).toMatchObject({ generated: 20, overflow: 15, endingValue: 120 })
    },
  )

  it.each([
    [90, 90, 0],
    [91, 51, 40],
    [120, 80, 40],
  ])(
    'applies the adopted strict assist threshold at %s',
    (initialRadiance, endingValue, consumed) => {
      expect(
        success(
          declaration({
            initialRadiance,
            events: [{ atSeconds: 1, eventKey: 'assist.flower_feather' }],
          }),
        ),
      ).toMatchObject({ endingValue, consumed })
    },
  )

  it('drains before ordered same-time actions, then checks full resource for entry', () => {
    const result = success(
      declaration({
        durationSeconds: 20,
        phaseFlowWindows: [
          { startSeconds: 0, endSeconds: 10 },
          { startSeconds: 10, endSeconds: 20 },
        ],
        events: [
          { atSeconds: 10, eventKey: 'assist.flower_feather' },
          { atSeconds: 10, eventKey: 'basic.rainbow' },
        ],
      }),
    )
    // First window:120-30=90, assist costs0, refill+30/overflow90; next window drains30.
    expect(result.states.map((state) => state.valueAfter)).toEqual([90, 90, 120, 90])
    expect(result).toMatchObject({
      generated: 30,
      consumed: 60,
      overflow: 90,
      endingValue: 90,
      conserved: true,
    })
    const reversed = declaration({
      phaseFlowWindows: [{ startSeconds: 1, endSeconds: 2 }],
      events: [
        { atSeconds: 1, eventKey: 'basic.rainbow' },
        { atSeconds: 1, eventKey: 'assist.flower_feather' },
      ],
    })
    expect(compileDeclaredRemielleRadiance32(reversed)).toMatchObject({
      status: 'unsupported',
      blockers: ['remielle_radiance_phase_entry_requires_full_resource'],
    })
  })

  it('enters after a same-time completed refill, not before it', () => {
    const result = success(
      declaration({
        durationSeconds: 5,
        initialRadiance: 50,
        events: [{ atSeconds: 0, eventKey: 'basic.fleeting' }],
        phaseFlowWindows: [{ startSeconds: 0, endSeconds: 5 }],
      }),
    )
    expect(result).toMatchObject({ generated: 70, consumed: 15, overflow: 50, endingValue: 105 })
  })

  it('stops at depletion and does not restart an exhausted window after a later refill', () => {
    const result = success(
      declaration({
        phaseFlowWindows: [{ startSeconds: 0, endSeconds: 60 }],
        events: [{ atSeconds: 50, eventKey: 'basic.fleeting' }],
      }),
    )
    expect(result.states.map((state) => [state.atSeconds, state.valueAfter])).toEqual([
      [40, 0],
      [50, 120],
    ])
    expect(result.phaseFlowWindows[0]?.depletedAtSeconds).toBe(40)
    expect(result).toMatchObject({
      generated: 120,
      consumed: 120,
      endingValue: 120,
      overflow: 0,
      conserved: true,
    })
  })

  it('integrates only declared windows, including fractional action boundaries', () => {
    const result = success(
      declaration({
        durationSeconds: 5,
        phaseFlowWindows: [{ startSeconds: 1, endSeconds: 3 }],
        events: [{ atSeconds: 1.5, eventKey: 'basic.leap.hit1' }],
      }),
    )
    // 120-1.5+1.5-4.5=115.5; attempted gain5 overflows3.5.
    expect(result).toMatchObject({ generated: 1.5, consumed: 6, overflow: 3.5, endingValue: 115.5 })
  })

  it('hands effective deltas to the generic evaluator; raw unclipped gain is rejected', () => {
    const result = success(
      declaration({
        initialRadiance: 100,
        events: [{ atSeconds: 0, eventKey: 'basic.leap.hit4' }],
      }),
    )
    expect(executePlanningInteractionContract(result.resourceContract)).toMatchObject({
      status: 'supported',
      conserved: true,
    })
    expect(
      executePlanningInteractionContract({
        ...result.resourceContract,
        transitions: [
          {
            atSeconds: 0,
            ownerAgentId: 'agent-remielle',
            delta: 35,
            reason: 'unclipped counterexample',
          },
        ],
      }),
    ).toMatchObject({ status: 'unsupported' })
    expect(result.completeResourceCycle).toBe(false)
    expect(result.formalCycleReady).toBe(false)
    expect(result.runtimeTimelineProven).toBe(false)
  })

  it.each([
    { initialRadiance: undefined },
    { initialRadiance: -1 },
    { initialRadiance: 121 },
    { initialRadiance: Number.NaN },
    { durationSeconds: Number.POSITIVE_INFINITY },
    { durationSeconds: 0 },
    { sourceIdentityHash: 'stale-source' },
    { sourceRefs: [] },
    { sourceRefs: ['unbound:source'] },
    { unknownField: true },
    { events: [{ atSeconds: 1, eventKey: 'phase_flow.auto_attack' }] },
    { events: [{ atSeconds: 61, eventKey: 'battle_entry' }] },
    {
      events: [
        { atSeconds: 2, eventKey: 'battle_entry' },
        { atSeconds: 1, eventKey: 'basic.rainbow' },
      ],
    },
    { events: [{ atSeconds: Number.NaN, eventKey: 'battle_entry' }] },
    { phaseFlowWindows: [{ startSeconds: 0, endSeconds: 0 }] },
    { phaseFlowWindows: [{ startSeconds: 0, endSeconds: 61 }] },
    {
      phaseFlowWindows: [
        { startSeconds: 0, endSeconds: 3 },
        { startSeconds: 2, endSeconds: 4 },
      ],
    },
    {
      phaseFlowWindows: [
        { startSeconds: 5, endSeconds: 6 },
        { startSeconds: 1, endSeconds: 2 },
      ],
    },
    { initialRadiance: 90, phaseFlowWindows: [{ startSeconds: 0, endSeconds: 1 }] },
  ])(
    'fails closed for malformed, stale, unordered or unsupported declarations: %j',
    (overrides) => {
      expect(compileDeclaredRemielleRadiance32({ ...declaration(), ...overrides }).status).toBe(
        'unsupported',
      )
    },
  )

  it.each(['operation', 'condition', 'parameterIndex'] as const)(
    'refuses an uninterpretable adopted template %s rather than inventing arithmetic',
    (field) => {
      const contract = structuredClone(
        contracts.getCurrentAgentDecisionMechanicContract('agent-remielle')!,
      )
      const templates = contract.resourceContract!.resourceFlow.transitionTemplates!
      const target = templates.find((template) => template.eventKey === 'assist.flower_feather')!
      const input = declaration({ events: [{ atSeconds: 1, eventKey: 'assist.flower_feather' }] })
      Object.assign(
        target,
        field === 'operation'
          ? { operation: 'multiply' }
          : field === 'condition'
            ? { condition: 'remaining<=90 || true' }
            : { parameterIndex: 99 },
      )
      vi.spyOn(contracts, 'getCurrentAgentDecisionMechanicContract').mockReturnValue(contract)
      const source = getDeclaredRemielleRadianceSource32()
      expect(
        compileDeclaredRemielleRadiance32({
          ...input,
          sourceIdentityHash: source?.sourceIdentityHash ?? 'invalid-source',
        }).status,
      ).toBe('unsupported')
    },
  )
})
