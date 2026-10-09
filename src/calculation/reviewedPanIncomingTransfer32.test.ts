import { describe, expect, it } from 'vitest'
import { getCurrentAgentPlanningEffectBlueprint } from './currentAgentPlanningEffectBlueprint'
import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'
import {
  createLevel60NeutralEffectRuntimeMember,
  evaluateCurrentPlanningEffectEntries32,
} from './currentPlanningEffectRuntime'
import {
  panMeridianFlowEffectKey32,
  panMeridianFlowIncomingReference32,
  recipientIds,
} from './currentPlanningDamageModifiers'
import { planningRuntimeEffectBuckets32 } from './currentPlanningSelfEffects32'
import { resolveCurrentPlanningEventEffects32 } from './currentPlanningEventEffectResolution32'

function fixture(target?: unknown, active = 1) {
  const memberIds = ['agent-pan-yinhu', 'agent-yixuan', 'agent-yidhari'] as const
  const members = memberIds.map(createLevel60NeutralEffectRuntimeMember)
  members[0].coreLevel = 7
  members[0].initialStats = { ...members[0].initialStats, atk: 2800 }
  members[0].finalStats = { ...members[0].finalStats, atk: 4000 }
  for (const member of members.slice(1)) {
    member.initialStats = { ...member.initialStats, sheerForce: 2000 }
    member.finalStats = { ...member.finalStats, sheerForce: 2000 }
  }
  const entry = getCurrentAgentPlanningEffectBlueprint(panMeridianFlowEffectKey32)!
  const baselineReferencesByAgentId = {
    'agent-pan-yinhu': {
      meridian_flow: active,
      ...(target === undefined ? {} : { [panMeridianFlowIncomingReference32]: target }),
    },
  }
  return { memberIds, members, entries: [entry], baselineReferencesByAgentId }
}

function runtime(f: ReturnType<typeof fixture>) {
  return evaluateCurrentPlanningEffectEntries32(f, f.entries)
}

describe('source-bound Pan next incoming recipient through runtime and event graph', () => {
  it.each([undefined, null, 0, '', 'agent-pan-yinhu', 'agent-lucy', ['agent-yixuan']])(
    'rejects a nonzero transfer without a valid unique incoming identity: %j',
    (target) => {
      const result = runtime(fixture(target))
      expect(result.status).toBe('unsupported')
      if (result.status !== 'unsupported') throw new Error('Expected missing recipient rejection')
      expect(result.blockers.join(';')).toContain('唯一')
    },
  )

  it('leaves a proven inactive transfer at zero without inventing an incoming actor', () => {
    const f = fixture(undefined, 0)
    const result = runtime(f)
    expect(result.status).toBe('supported')
    if (result.status !== 'supported') throw new Error(result.blockers.join(';'))
    expect(planningRuntimeEffectBuckets32(result.results, f.memberIds)).toEqual([])
  })

  it.each(['agent-yixuan', 'agent-yidhari'])(
    'uses initial ATK and grants exactly one source contribution to %s',
    (target) => {
      const f = fixture(target),
        before = structuredClone(f)
      const result = runtime(f)
      expect(result.status).toBe('supported')
      if (result.status !== 'supported') throw new Error(result.blockers.join(';'))
      const buckets = planningRuntimeEffectBuckets32(result.results, f.memberIds)
      expect(buckets).toHaveLength(1)
      expect(buckets[0].value).toBe(2800 * 0.18) // Independent source core-7 coefficient.
      expect(buckets[0].recipientAgentIds).toEqual([target])
      for (const ownerAgentId of f.memberIds.slice(1)) {
        const contract = getCurrentAgentEventContract(ownerAgentId)!
        const event = contract.eventContract.events.find(
          (row) => row.formulaFamily === 'sheer_damage',
        )!
        const resolved = resolveCurrentPlanningEventEffects32({
          ...f,
          ownerAgentId,
          event,
          attribute: contract.identity.attribute,
          buckets,
        })
        expect(resolved.status).toBe('supported')
        if (resolved.status !== 'supported') throw new Error(resolved.blockers.join(';'))
        expect(
          resolved.buckets.filter((row) => row.effectKey === panMeridianFlowEffectKey32),
        ).toHaveLength(1)
        for (const id of f.memberIds.slice(1))
          expect(resolved.finalStats[id].sheerForce).toBe(2000 + (id === target ? 504 : 0))
      }
      expect(f).toEqual(before)
    },
  )

  it('rejects the old two-recipient bucket and event-only missing-target bypass', () => {
    const f = fixture('agent-yixuan')
    const result = runtime(f)
    if (result.status !== 'supported') throw new Error(result.blockers.join(';'))
    const buckets = planningRuntimeEffectBuckets32(result.results, f.memberIds)
    const contract = getCurrentAgentEventContract('agent-yixuan')!
    const event = contract.eventContract.events.find((row) => row.formulaFamily === 'sheer_damage')!
    expect(
      resolveCurrentPlanningEventEffects32({
        ...f,
        ownerAgentId: 'agent-yixuan',
        event,
        attribute: contract.identity.attribute,
        buckets: [{ ...buckets[0], recipientAgentIds: ['agent-yixuan', 'agent-yidhari'] }],
      }).status,
    ).toBe('unsupported')
    expect(
      resolveCurrentPlanningEventEffects32({
        ...fixture(),
        ownerAgentId: 'agent-yixuan',
        event,
        attribute: contract.identity.attribute,
        buckets: [],
      }).status,
    ).toBe('unsupported')
    expect(
      recipientIds({
        effectKey: panMeridianFlowEffectKey32,
        providerAgentId: 'agent-pan-yinhu',
        memberIds: f.memberIds,
        targetKinds: ['team'],
        receiverPath: 'notOwnBuff.combat.sheerForce',
      }),
    ).toEqual([])
  })
})
