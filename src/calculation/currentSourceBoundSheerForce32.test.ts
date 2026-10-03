import { afterEach, describe, expect, it, vi } from 'vitest'
import * as actorContracts from './currentAgentMechanicContracts'
import * as effectContracts from './currentAgentDecisionMechanicContracts'
import { createLevel60NeutralEffectRuntimeMember } from './currentPlanningEffectDomain'
import { applicationForReceiver } from './currentPlanningDamageModifiers'
import { reviewedPublicMappedStatLocators32 } from './currentSourceBoundSheerForceIdentity32'
import {
  evaluateSourceBoundSheerForce32,
  resolvePlanningEventSheerForce32,
} from './currentSourceBoundSheerForce32'

const fixture = {
  agentId: 'agent-yixuan',
  level: 60,
  coreLevel: 6,
  initialStats: { atk: 1000, hp: 10000 },
  finalStats: { atk: 1000, hp: 10000 },
}
function value(input: typeof fixture = fixture) {
  const result = evaluateSourceBoundSheerForce32(input)
  if (result.status !== 'supported') throw new Error(result.blockers.join(';'))
  return result
}
afterEach(() => vi.restoreAllMocks())

describe('pinned initial/combat/final sheer dependencies', () => {
  it('uses actual Yixuan coreParams[1][0]=.1, not a generic attack or HP substitute', () => {
    expect(value().sheerForce).toBe(1300) // 1000*.3+10000*.1.
    expect(
      value({
        ...fixture,
        initialStats: { atk: 2416.89724, hp: 12540.02073 },
        finalStats: { atk: 2416.89724, hp: 12540.02073 },
      }).sheerForce,
    ).toBeCloseTo(1979.071245)
    expect(value().sourceRefs).toContain(
      'libs/zzz/formula/src/data/common/index.ts#8C97E50A3B88846F7083290C53604F6545E818CAE3E7E3F8464C18011B2F594F',
    )
  })
  it.each([
    [1250, 10000, 1375],
    [1000, 12500, 1550],
    [1250, 12500, 1625],
  ])('recomputes final ATK%s and final HP%s independently', (atk, hp, expected) => {
    expect(value({ ...fixture, finalStats: { atk, hp } }).sheerForce).toBe(expected)
  })
  it.each([2, 6, 7])('retains the source scalar at valid core level%s', (coreLevel) => {
    expect(value({ ...fixture, level: 1, coreLevel }).sheerForce).toBe(1300)
  })
  it.each([0, 1, 8, 2.5, Number.NaN])('refuses skip or invalid core%s', (coreLevel) => {
    expect(evaluateSourceBoundSheerForce32({ ...fixture, coreLevel }).status).toBe('unsupported')
  })
  it('does not infer a conversion for an unknown or non-rupture actor', () => {
    for (const agentId of ['agent-unknown', 'agent-roxy', 'agent-billy'])
      expect(evaluateSourceBoundSheerForce32({ ...fixture, agentId }).status).toBe('unsupported')
  })
  it('rejects mismatched pinned source, instead of trusting the subject name', () => {
    const actor = actorContracts.getCurrentAgentEventContract(fixture.agentId)!
    vi.spyOn(actorContracts, 'getCurrentAgentEventContract').mockReturnValue({
      ...actor,
      source: { ...actor.source, formulaSha256: '0'.repeat(64) },
    })
    expect(evaluateSourceBoundSheerForce32(fixture).status).toBe('unsupported')
  })

  it('accepts only the exact reviewed public locator with all source hashes intact', () => {
    const contract = effectContracts.getCurrentAgentDecisionMechanicContract(fixture.agentId)!
    const publicContract = structuredClone(contract)
    publicContract.effectContract.runtimeDefaults.source.mappedStatsPath =
      reviewedPublicMappedStatLocators32.Yixuan
    vi.spyOn(effectContracts, 'getCurrentAgentDecisionMechanicContract').mockReturnValue(
      publicContract,
    )
    expect(value().sheerForce).toBe(1300)
    for (const locator of [
      'soda-source-ref:' + '0'.repeat(32),
      reviewedPublicMappedStatLocators32.Manato,
    ]) {
      publicContract.effectContract.runtimeDefaults.source.mappedStatsPath = locator
      expect(evaluateSourceBoundSheerForce32(fixture).status).toBe('unsupported')
    }
    publicContract.effectContract.runtimeDefaults.source.mappedStatsPath =
      reviewedPublicMappedStatLocators32.Yixuan
    publicContract.effectContract.runtimeDefaults.source.mappedStatsSha256 = '0'.repeat(64)
    expect(evaluateSourceBoundSheerForce32(fixture).status).toBe('unsupported')
  })
  it('rejects a missing stat dependency and a mismatched mapped-stat source', () => {
    const contract = effectContracts.getCurrentAgentDecisionMechanicContract(fixture.agentId)!
    const missingDependency = structuredClone(contract)
    Reflect.deleteProperty(
      missingDependency.effectContract.runtimeDefaults.references,
      'dm.core.sheerForce',
    )
    vi.spyOn(effectContracts, 'getCurrentAgentDecisionMechanicContract').mockReturnValue(
      missingDependency,
    )
    expect(evaluateSourceBoundSheerForce32(fixture).status).toBe('unsupported')
    vi.restoreAllMocks()
    const mismatchedSource = structuredClone(contract)
    mismatchedSource.effectContract.runtimeDefaults.source.mappedStatsSha256 = '0'.repeat(64)
    vi.spyOn(effectContracts, 'getCurrentAgentDecisionMechanicContract').mockReturnValue(
      mismatchedSource,
    )
    expect(evaluateSourceBoundSheerForce32(fixture).status).toBe('unsupported')
  })
  it('recomputes a derived static value and adds a combat sheer buff exactly once', () => {
    const neutral = createLevel60NeutralEffectRuntimeMember(fixture.agentId)
    const source = value()
    const member = {
      ...neutral,
      coreLevel: 6,
      initialStats: { ...neutral.initialStats, ...fixture.initialStats },
      finalStats: {
        ...neutral.finalStats,
        ...fixture.finalStats,
        sheerForce: 1300,
        sheerForceBasis: {
          kind: 'source_derived_static' as const,
          bindingHash: source.bindingHash,
          sourceRefs: source.sourceRefs,
        },
      },
    }
    const result = resolvePlanningEventSheerForce32({
      member,
      attack: 1250,
      hp: 12500,
      combatSheerForce: 300,
    })
    expect(result).toMatchObject({ status: 'supported', sheerForce: 1925 })
    expect(member.finalStats.sheerForce).toBe(1300)
    expect(
      resolvePlanningEventSheerForce32({
        member: { ...member, finalStats: { ...member.finalStats, sheerForce: 9999 } },
        attack: 1250,
        hp: 12500,
        combatSheerForce: 300,
      }).status,
    ).toBe('unsupported')
    expect(
      resolvePlanningEventSheerForce32({
        member: {
          ...member,
          finalStats: {
            ...member.finalStats,
            sheerForceBasis: {
              ...member.finalStats.sheerForceBasis,
              bindingHash: 'stale',
            },
          },
        },
        attack: 1250,
        hp: 12500,
        combatSheerForce: 300,
      }).status,
    ).toBe('unsupported')
  })
  it('preserves provided final sheerForce and rejects ambiguous extra windows', () => {
    const neutral = createLevel60NeutralEffectRuntimeMember(fixture.agentId)
    const member = {
      ...neutral,
      initialStats: { ...neutral.initialStats, ...fixture.initialStats },
      finalStats: { ...neutral.finalStats, ...fixture.finalStats, sheerForce: 999 },
    }
    expect(
      resolvePlanningEventSheerForce32({ member, attack: 1000, hp: 10000, combatSheerForce: 0 }),
    ).toEqual({ status: 'supported', sheerForce: 999 })
    for (const change of [
      { attack: 1250, hp: 10000, combatSheerForce: 0 },
      { attack: 1000, hp: 12500, combatSheerForce: 0 },
      { attack: 1000, hp: 10000, combatSheerForce: 300 },
    ])
      expect(resolvePlanningEventSheerForce32({ member, ...change }).status).toBe('unsupported')
  })
  it('keeps initial source conversions outside generic buckets and consumes combat HP domains', () => {
    expect(applicationForReceiver('ownBuff.initial.sheerForce')).toBe(
      'outside_direct_event_formula',
    )
    expect(applicationForReceiver('ownBuff.combat.hp_')).toBe('hp_percent')
    expect(applicationForReceiver('teamBuff.combat.hp')).toBe('hp_flat')
    expect(applicationForReceiver('teamBuff.combat.sheerForce')).toBe('sheer_force')
    expect(applicationForReceiver('notOwnBuff.combat.sheerForce')).toBe('sheer_force')
  })
})
