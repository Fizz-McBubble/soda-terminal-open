import { createBenMember } from './reviewedBenShieldCapacity32.testFixture'
import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  evaluateReviewedBenShieldCapacity32,
  reviewedBenShieldCapacityIdentity32,
} from './reviewedBenShieldCapacity32'
import { createLevel60NeutralEffectRuntimeMember } from './currentPlanningEffectRuntime'
import { preservesReviewedFunctionalCapacities32 } from './reviewedFunctionalCapacity32'
import type { SourceBackedPlanningEffectBucket } from './currentPlanningDamageModifiers'
import * as contracts from './currentAgentDecisionMechanicContracts'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('evaluateReviewedBenShieldCapacity32: baseline generation capacity and core growth', () => {
  it.each([
    [1, 0.15, 100],
    [2, 0.175, 220],
    [3, 0.2, 330],
    [4, 0.225, 460],
    [5, 0.25, 500],
    [6, 0.275, 525],
    [7, 0.3, 550],
  ])(
    'evaluates core %s using actual source arrays (ratio: %s, flat: %s)',
    (coreLevel, ratio, flat) => {
      const ben = createBenMember({ coreLevel, finalHp: 12500, finalDef: 2000 })
      const result = evaluateReviewedBenShieldCapacity32({
        member: ben,
        equipmentExclusions: [],
      })

      expect(result.status).toBe('supported')
      expect(result.blockers).toEqual([])
      expect(result.capacities).toHaveLength(2)

      const special = result.capacities.find((c) => c.key === 'agent-ben:special_shield')!
      expect(special).toBeDefined()
      expect(special.kind).toBe('shield_generation')
      expect(special.value).toBeCloseTo(12500 * 0.16, 9)
      expect(special.included).toContain('one_declared_source_generation_capacity')
      expect(special.included).toContain('event_final_hp_with_combat_modifiers')
      expect(
        special.sourceRefs.some((ref) =>
          ref.includes(reviewedBenShieldCapacityIdentity32.formulaPath),
        ),
      ).toBe(true)

      const core = result.capacities.find((c) => c.key === 'agent-ben:core_shield')!
      expect(core).toBeDefined()
      expect(core.kind).toBe('shield_generation')
      expect(core.value).toBeCloseTo(2000 * ratio + flat, 9)
      expect(core.included).toContain('one_declared_source_generation_capacity')
      expect(core.included).toContain('event_final_def_with_combat_modifiers')
      expect(
        core.sourceRefs.some((ref) =>
          ref.includes(reviewedBenShieldCapacityIdentity32.formulaPath),
        ),
      ).toBe(true)
    },
  )
})

describe('evaluateReviewedBenShieldCapacity32: identity guards, validation, and source drift', () => {
  it.each([0, 8, 1.5, -1])('refuses invalid coreLevel %s', (invalidCore) => {
    const ben = createBenMember({ coreLevel: invalidCore as number })
    const result = evaluateReviewedBenShieldCapacity32({
      member: ben,
      equipmentExclusions: [],
    })

    expect(result.status).toBe('unsupported')
    expect(result.capacities).toEqual([])
    expect(result.blockers).toContain('功能容量缺少合法核心技/影画/潜能身份。')
  })

  it.each([-1, 7, 2.5])('refuses invalid mindscape %s', (invalidMindscape) => {
    const ben = createBenMember({ mindscape: invalidMindscape as number })
    const result = evaluateReviewedBenShieldCapacity32({
      member: ben,
      equipmentExclusions: [],
    })

    expect(result.status).toBe('unsupported')
    expect(result.capacities).toEqual([])
    expect(result.blockers).toContain('功能容量缺少合法核心技/影画/潜能身份。')
  })

  it.each([-1, 7, 1.2])('refuses invalid potential %s', (invalidPotential) => {
    const ben = createBenMember({ potential: invalidPotential as number })
    const result = evaluateReviewedBenShieldCapacity32({
      member: ben,
      equipmentExclusions: [],
    })

    expect(result.status).toBe('unsupported')
    expect(result.capacities).toEqual([])
    expect(result.blockers).toContain('功能容量缺少合法核心技/影画/潜能身份。')
  })

  it('detects member snapshot mismatch and fails closed', () => {
    const ben = createBenMember({ finalDef: 2000 })
    const alteredBen = { ...ben, finalStats: { ...ben.finalStats, def: 2500 } }

    const result = evaluateReviewedBenShieldCapacity32({
      member: ben,
      members: [alteredBen],
      equipmentExclusions: [],
    })

    expect(result.status).toBe('supported')
    expect(result.blockers).toContain('functional_member_snapshot_mismatch')
    expect(result.capacities[0]!.value).toBeNull()
    expect(result.capacities[1]!.value).toBeNull()
  })

  it('refuses evaluation when contract source or parameters drift', () => {
    const ben = createBenMember()
    const originalContract = contracts.getCurrentAgentDecisionMechanicContract('agent-ben')!
    vi.spyOn(contracts, 'getCurrentAgentDecisionMechanicContract').mockReturnValue({
      ...originalContract,
      effectContract: {
        ...originalContract.effectContract,
        source: {
          ...originalContract.effectContract.source,
          formulaSha256: 'tampered-sha256-string',
        },
      },
    })

    const result = evaluateReviewedBenShieldCapacity32({
      member: ben,
      equipmentExclusions: [],
    })

    expect(result.status).toBe('unsupported')
    expect(result.capacities).toEqual([])
    expect(result.blockers).toContain('功能来源或参数漂移：agent-ben')
  })
})

describe('evaluateReviewedBenShieldCapacity32: equipment gaps and selective capacity nullification', () => {
  it('keeps both capacity values null when equipment coverage is unbound (undefined)', () => {
    const ben = createBenMember()
    const result = evaluateReviewedBenShieldCapacity32({
      member: ben,
      equipmentExclusions: undefined,
    })

    expect(result.status).toBe('supported')
    expect(result.capacities[0]!.value).toBeNull()
    expect(result.capacities[1]!.value).toBeNull()
    expect(result.blockers).toContain('functional_equipment_coverage_unbound')
  })

  it('does NOT block on unrelated equipment writes (e.g. combat.atk_)', () => {
    const ben = createBenMember({ finalHp: 10000, finalDef: 2000 })
    const unrelatedExclusion = {
      writeFields: ['combat.atk_'],
      recipientAgentIds: ['agent-ben'],
    }

    const result = evaluateReviewedBenShieldCapacity32({
      member: ben,
      equipmentExclusions: [unrelatedExclusion],
    })

    expect(result.status).toBe('supported')
    expect(result.blockers).toEqual([])
    expect(result.capacities[0]!.value).toBeCloseTo(10000 * 0.16, 9)
    expect(result.capacities[1]!.value).toBeCloseTo(2000 * 0.3 + 550, 9)
  })

  it('selectively nullifies core_shield when DEF write is unresolved, leaving special_shield intact', () => {
    const ben = createBenMember({ finalHp: 10000, finalDef: 2000 })
    const defExclusion = {
      writeFields: ['combat.def_'],
      recipientAgentIds: ['agent-ben'],
    }

    const result = evaluateReviewedBenShieldCapacity32({
      member: ben,
      equipmentExclusions: [defExclusion],
    })

    expect(result.status).toBe('supported')
    const special = result.capacities.find((c) => c.key === 'agent-ben:special_shield')!
    const core = result.capacities.find((c) => c.key === 'agent-ben:core_shield')!

    expect(special.value).toBeCloseTo(10000 * 0.16, 9)
    expect(core.value).toBeNull()
    expect(core.excluded).toContain('functional_equipment_effect_unresolved')
    expect(result.blockers).toContain('functional_equipment_effect_unresolved')
  })

  it('selectively nullifies special_shield when HP write is unresolved, leaving core_shield intact', () => {
    const ben = createBenMember({ finalHp: 10000, finalDef: 2000 })
    const hpExclusion = {
      writeFields: ['combat.hp_'],
      recipientAgentIds: ['agent-ben'],
    }

    const result = evaluateReviewedBenShieldCapacity32({
      member: ben,
      equipmentExclusions: [hpExclusion],
    })

    expect(result.status).toBe('supported')
    const special = result.capacities.find((c) => c.key === 'agent-ben:special_shield')!
    const core = result.capacities.find((c) => c.key === 'agent-ben:core_shield')!

    expect(special.value).toBeNull()
    expect(special.excluded).toContain('functional_equipment_effect_unresolved')
    expect(core.value).toBeCloseTo(2000 * 0.3 + 550, 9)
  })

  it('ignores inactive exclusions with valid source references', () => {
    const ben = createBenMember({ finalHp: 10000, finalDef: 2000 })
    const inactiveExclusion = {
      resolvedInactive: true,
      sourceRefs: ['declared-source:inactive-check'],
      writeFields: ['combat.def_'],
      recipientAgentIds: ['agent-ben'],
    }

    const result = evaluateReviewedBenShieldCapacity32({
      member: ben,
      equipmentExclusions: [inactiveExclusion],
    })

    expect(result.status).toBe('supported')
    expect(result.blockers).toEqual([])
    expect(result.capacities[0]!.value).toBeCloseTo(10000 * 0.16, 9)
    expect(result.capacities[1]!.value).toBeCloseTo(2000 * 0.3 + 550, 9)
  })
})

describe('evaluateReviewedBenShieldCapacity32: combat modifier buckets and shield% modifier', () => {
  it('incorporates applicable combat DEF bucket into core_shield calculation', () => {
    const ben = createBenMember({ initialDef: 1000, finalDef: 2000 })
    const defBucket: SourceBackedPlanningEffectBucket = {
      bucketId: 'test-def-boost',
      effectKey: 'test-def-boost',
      providerAgentId: 'agent-ben',
      recipientAgentIds: ['agent-ben'],
      receiverPath: null,
      damageType: null,
      action: null,
      attribute: null,
      application: 'defense_percent',
      value: 0.25, // +25% initial DEF = +250 DEF
      sourceRefs: ['source:test-def-boost'],
    }

    const result = evaluateReviewedBenShieldCapacity32({
      member: ben,
      equipmentExclusions: [],
      equipmentModifierBuckets: [defBucket],
    })

    expect(result.status).toBe('supported')
    const special = result.capacities.find((c) => c.key === 'agent-ben:special_shield')!
    const core = result.capacities.find((c) => c.key === 'agent-ben:core_shield')!

    // special_shield unaffected by DEF bucket
    expect(special.value).toBeCloseTo(12000 * 0.16, 9)

    // core_shield uses (2000 + 250) * 0.3 + 550 = 2250 * 0.3 + 550 = 675 + 550 = 1225
    expect(core.value).toBeCloseTo(2250 * 0.3 + 550, 9)
    expect(core.included).toContain('test-def-boost')
    expect(core.sourceRefs).toContain('source:test-def-boost')
  })

  it('incorporates applicable combat HP bucket into special_shield calculation', () => {
    const ben = createBenMember({ initialHp: 10000, finalHp: 12000 })
    const hpBucket: SourceBackedPlanningEffectBucket = {
      bucketId: 'test-hp-boost',
      effectKey: 'test-hp-boost',
      providerAgentId: 'agent-ben',
      recipientAgentIds: ['agent-ben'],
      receiverPath: null,
      damageType: null,
      action: null,
      attribute: null,
      application: 'hp_percent',
      value: 0.2, // +20% initial HP = +2000 HP -> 14000 HP
      sourceRefs: ['source:test-hp-boost'],
    }

    const result = evaluateReviewedBenShieldCapacity32({
      member: ben,
      equipmentExclusions: [],
      equipmentModifierBuckets: [hpBucket],
    })

    expect(result.status).toBe('supported')
    const special = result.capacities.find((c) => c.key === 'agent-ben:special_shield')!
    const core = result.capacities.find((c) => c.key === 'agent-ben:core_shield')!

    // special_shield uses (12000 + 2000) * 0.16 = 14000 * 0.16 = 2240
    expect(special.value).toBeCloseTo(14000 * 0.16, 9)
    expect(special.included).toContain('test-hp-boost')
    expect(special.sourceRefs).toContain('source:test-hp-boost')

    // core_shield unaffected by HP bucket
    expect(core.value).toBeCloseTo(2000 * 0.3 + 550, 9)
  })

  it('applies shield% modifier exactly once when recipient and action match', () => {
    const ben = createBenMember({ finalHp: 10000, finalDef: 2000 })
    const matchingShieldBucket: SourceBackedPlanningEffectBucket = {
      bucketId: 'shield-gear-bonus',
      effectKey: 'shield-gear-bonus',
      providerAgentId: 'agent-ben',
      recipientAgentIds: ['agent-ben'],
      receiverPath: null,
      damageType: null,
      action: 'ex_special',
      attribute: null,
      application: 'shield_percent',
      value: 0.15,
      sourceRefs: ['gear:shield-15'],
    }

    const result = evaluateReviewedBenShieldCapacity32({
      member: ben,
      equipmentExclusions: [],
      equipmentModifierBuckets: [matchingShieldBucket],
    })

    expect(result.status).toBe('supported')
    const special = result.capacities.find((c) => c.key === 'agent-ben:special_shield')!
    const core = result.capacities.find((c) => c.key === 'agent-ben:core_shield')!

    expect(special.value).toBeCloseTo(10000 * 0.16 * 1.15, 9)
    expect(core.value).toBeCloseTo((2000 * 0.3 + 550) * 1.15, 9)
    expect(special.included).toContain('shield-gear-bonus')
    expect(core.included).toContain('shield-gear-bonus')
  })

  it('ignores shield% modifier if recipient does not match Ben', () => {
    const ben = createBenMember({ finalHp: 10000, finalDef: 2000 })
    const wrongRecipientBucket: SourceBackedPlanningEffectBucket = {
      bucketId: 'shield-gear-wrong-agent',
      effectKey: 'shield-gear-wrong-agent',
      providerAgentId: 'agent-seth',
      recipientAgentIds: ['agent-seth'],
      receiverPath: null,
      damageType: null,
      action: null,
      attribute: null,
      application: 'shield_percent',
      value: 0.3,
      sourceRefs: ['gear:seth-only'],
    }

    const result = evaluateReviewedBenShieldCapacity32({
      member: ben,
      equipmentExclusions: [],
      equipmentModifierBuckets: [wrongRecipientBucket],
      members: [ben, createLevel60NeutralEffectRuntimeMember('agent-seth')],
    })

    expect(result.status).toBe('supported')
    expect(result.capacities[0]!.value).toBeCloseTo(10000 * 0.16, 9)
    expect(result.capacities[1]!.value).toBeCloseTo(2000 * 0.3 + 550, 9)
  })

  it('ignores shield% modifier if action does not match ex_special', () => {
    const ben = createBenMember({ finalHp: 10000, finalDef: 2000 })
    const wrongActionBucket: SourceBackedPlanningEffectBucket = {
      bucketId: 'shield-gear-chain-only',
      effectKey: 'shield-gear-chain-only',
      providerAgentId: 'agent-ben',
      recipientAgentIds: ['agent-ben'],
      receiverPath: null,
      damageType: null,
      action: 'chain',
      attribute: null,
      application: 'shield_percent',
      value: 0.3,
      sourceRefs: ['gear:chain-only'],
    }

    const result = evaluateReviewedBenShieldCapacity32({
      member: ben,
      equipmentExclusions: [],
      equipmentModifierBuckets: [wrongActionBucket],
    })

    expect(result.status).toBe('supported')
    expect(result.capacities[0]!.value).toBeCloseTo(10000 * 0.16, 9)
    expect(result.capacities[1]!.value).toBeCloseTo(2000 * 0.3 + 550, 9)
  })

  it('fails closed when shield% modifier has invalid non-finite value', () => {
    const ben = createBenMember()
    const invalidBucket: SourceBackedPlanningEffectBucket = {
      bucketId: 'shield-gear-nan',
      effectKey: 'shield-gear-nan',
      providerAgentId: 'agent-ben',
      recipientAgentIds: ['agent-ben'],
      receiverPath: null,
      damageType: null,
      action: null,
      attribute: null,
      application: 'shield_percent',
      value: Number.NaN,
      sourceRefs: ['gear:nan'],
    }

    const result = evaluateReviewedBenShieldCapacity32({
      member: ben,
      equipmentExclusions: [],
      equipmentModifierBuckets: [invalidBucket],
    })

    expect(result.status).toBe('supported')
    expect(result.blockers).toContain('functional_shield_modifier_observation_unresolved')
    expect(result.capacities[0]!.value).toBeNull()
    expect(result.capacities[1]!.value).toBeNull()
  })
})

describe('evaluateReviewedBenShieldCapacity32: preservation and protection against larger damage but smaller shield', () => {
  it('preserves functional capacities when candidate has equal or greater shield values', () => {
    const baselineActor = createBenMember({ finalHp: 10000, finalDef: 2000 })
    const baseline = evaluateReviewedBenShieldCapacity32({
      member: baselineActor,
      equipmentExclusions: [],
    }).capacities

    const candidateActor = createBenMember({ finalHp: 11000, finalDef: 2200 })
    const candidate = evaluateReviewedBenShieldCapacity32({
      member: candidateActor,
      equipmentExclusions: [],
    }).capacities

    expect(preservesReviewedFunctionalCapacities32(baseline, candidate)).toBe(true)
  })

  it('refuses preservation when candidate has larger damage/ATK but smaller HP (smaller special_shield)', () => {
    const baselineActor = createBenMember({ finalHp: 12000, finalDef: 2000 })
    const baseline = evaluateReviewedBenShieldCapacity32({
      member: baselineActor,
      equipmentExclusions: [],
    }).capacities

    // Candidate traded HP for ATK
    const candidateActor = createBenMember({ finalHp: 9000, finalDef: 2000 })
    const candidate = evaluateReviewedBenShieldCapacity32({
      member: candidateActor,
      equipmentExclusions: [],
    }).capacities

    expect(preservesReviewedFunctionalCapacities32(baseline, candidate)).toBe(false)
  })

  it('refuses preservation when candidate has larger damage/ATK but smaller DEF (smaller core_shield)', () => {
    const baselineActor = createBenMember({ finalHp: 10000, finalDef: 2500 })
    const baseline = evaluateReviewedBenShieldCapacity32({
      member: baselineActor,
      equipmentExclusions: [],
    }).capacities

    // Candidate traded DEF for ATK
    const candidateActor = createBenMember({ finalHp: 10000, finalDef: 1800 })
    const candidate = evaluateReviewedBenShieldCapacity32({
      member: candidateActor,
      equipmentExclusions: [],
    }).capacities

    expect(preservesReviewedFunctionalCapacities32(baseline, candidate)).toBe(false)
  })

  it('refuses preservation when candidate capacity value is null due to unresolved condition or write', () => {
    const baselineActor = createBenMember({ finalHp: 10000, finalDef: 2000 })
    const baseline = evaluateReviewedBenShieldCapacity32({
      member: baselineActor,
      equipmentExclusions: [],
    }).capacities

    const candidateActor = createBenMember({ finalHp: 12000, finalDef: 2500 })
    const candidate = evaluateReviewedBenShieldCapacity32({
      member: candidateActor,
      equipmentExclusions: [{ writeFields: ['combat.def_'], recipientAgentIds: ['agent-ben'] }],
    }).capacities

    expect(candidate.find((c) => c.key === 'agent-ben:core_shield')!.value).toBeNull()
    expect(preservesReviewedFunctionalCapacities32(baseline, candidate)).toBe(false)
  })
})
