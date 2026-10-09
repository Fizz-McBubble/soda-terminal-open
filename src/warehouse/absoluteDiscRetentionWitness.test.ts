import { describe, expect, it } from 'vitest'
import { assessDisc } from './absoluteDiscRetentionKernel'
import type {
  Catalog,
  Decision,
  Disc,
  GameRules,
  Profile,
  QualityPolicy,
} from './absoluteDiscRetentionContract'

// Synthetic fixtures reused from the independently reviewed F02 probes; no account input.
const steps = {
  hp_flat: 112,
  atk_flat: 19,
  def_flat: 15,
  hp_percent: 3,
  atk_percent: 3,
  def_percent: 4.8,
  crit_rate: 2.4,
  crit_dmg: 4.8,
  pen: 9,
  anomaly_proficiency: 9,
}
const rules: GameRules = {
  sourceIds: ['synthetic-fixture-rules'],
  standardRarity: 'S',
  enhancementInterval: 3,
  maxSubStats: 4,
  mainStatsBySlot: {
    '1': ['hp_flat'],
    '2': ['atk_flat'],
    '3': ['def_flat'],
    '4': ['crit_rate', 'crit_dmg', 'atk_percent'],
    '5': ['atk_percent'],
    '6': ['energy_regen', 'atk_percent'],
  },
  rarities: { S: { maxLevel: 15, initialLineCounts: [3, 4], steps } },
}
function profile(id: string, patch: Partial<Profile> = {}): Profile {
  return {
    id,
    agentId: id,
    verified: true,
    sourceIds: ['synthetic-profile-source'],
    goal: 'crit_damage',
    coreStats: ['crit_rate', 'crit_dmg'],
    weights: { crit_rate: 1, crit_dmg: 1, atk_percent: 0.75, atk_flat: 0.5 },
    effectUtility: { atk_: 'valid' },
    mainStatsBySlot: {
      '4': { crit_rate: 'valid' },
      '5': { atk_percent: 'valid' },
      '6': { energy_regen: 'valid' },
    },
    weightEvidence: {
      id: 'synthetic-weight-reference',
      method: 'goal_bound_standard_roll_quality_proxy',
      sourceIds: ['synthetic-profile-source'],
    },
    ...patch,
  }
}
function conditional(id: string, patch: Partial<Profile> = {}) {
  return profile(id, {
    mainAvailability: 'conditional',
    conditionEvidence: [
      {
        state: 'conditional',
        predicateId: 'synthetic-team-prerequisite',
        detail: 'Synthetic unconfirmed team condition',
        evidenceIds: ['synthetic-condition-source'],
      },
    ],
    ...patch,
  })
}
function catalog(profiles: readonly Profile[]): Catalog {
  return {
    rules,
    profiles,
    sets: [
      {
        id: 'synthetic-set',
        verified: true,
        sourceIds: ['synthetic-set-source'],
        twoPieceEffects: [{ stat: 'atk_', value: 0.1 }],
      },
    ],
    releasedAgentIds: [...new Set(profiles.map((row) => row.agentId))],
    factsGameVersion: 'synthetic-v1',
    assessmentGameVersion: 'synthetic-v1',
    branchCoverageComplete: true,
    reviewedUseScope: 'synthetic-complete-scope',
  }
}
function policy(profiles: readonly Profile[]): QualityPolicy {
  return {
    id: 'synthetic-policy-current-parameters',
    calibration: 'approved',
    calibratedRarities: ['S'],
    byProfile: Object.fromEntries(
      profiles.map((row) => [
        row.id,
        Object.fromEntries(
          [1, 2, 3, 4, 5, 6].map((slot) => [
            String(slot),
            { cleanupBelow: 48, keepFrom: 60, premiumFrom: 67 },
          ]),
        ),
      ]),
    ),
    investment: {
      id: 'source-goal-stage-investment-r1',
      calibration: 'approved',
      meaningfulWeightFrom: 0.5,
      leftSlotMinimumLines: 2,
      rightSlotMinimumLines: 1,
      minimumCoreLines: 1,
      growthTarget: 'keepFrom',
      progressFloorBySpentNode: { '0': 0, '1': 0.25, '2': 0.45, '3': 0.65, '4': 0.85, '5': 1 },
    },
  }
}
function disc(
  slot: number,
  mainStat: string,
  level: number,
  stats: [keyof typeof steps, number][],
): Disc {
  return {
    id: 'synthetic-disc',
    setId: 'synthetic-set',
    slot,
    mainStat,
    rarity: 'S',
    level,
    subStats: stats.map(([stat, units]) => ({
      stat,
      value: steps[stat] * units,
      upgrades: units - 1,
    })),
  }
}
const mature = disc(1, 'hp_flat', 15, [
  ['crit_rate', 6],
  ['crit_dmg', 1],
  ['atk_percent', 1],
  ['def_flat', 1],
])
const seed = disc(1, 'hp_flat', 0, [
  ['crit_rate', 1],
  ['crit_dmg', 1],
  ['atk_percent', 1],
  ['def_flat', 1],
])
const valid = profile('z-valid', {
  weights: { crit_rate: 0.75, crit_dmg: 1, atk_percent: 0.75, atk_flat: 0.5 },
})
const highConditional = conditional('a-conditional', {
  weights: { crit_rate: 1, crit_dmg: 0.2, atk_percent: 0.1 },
})
const validFunction = profile('z-valid-function', {
  goal: 'functional',
  weights: { atk_percent: 1 },
  coreStats: ['atk_percent'],
  functionalMains: [
    {
      slot: 6,
      stat: 'energy_regen',
      sourceId: 'synthetic-function-source',
      completion: 'main_only',
      detail: 'Synthetic main-only function',
    },
  ],
})
const highFunctionAlternative = conditional('a-cond-function', {
  weights: { def_flat: 1 },
  coreStats: ['def_flat'],
})
const functionDisc = (level: number) =>
  disc(6, 'energy_regen', level, [
    ['def_flat', 1 + level / 3],
    ['hp_percent', 1],
    ['atk_flat', 1],
    ['def_percent', 1],
  ])

function assess(
  item: Disc,
  profiles: readonly Profile[],
  mutate = (value: QualityPolicy) => value,
) {
  return assessDisc(item, catalog(profiles), mutate(policy(profiles)))
}
function expectWitness(
  result: Decision,
  witness: Profile,
  reason: Decision['reasonKind'],
  action: Decision['nextAction']['kind'],
) {
  expect(result.reasonKind).toBe(reason)
  expect(result.nextAction.kind).toBe(action)
  expect(result.witnessProfileIds).toEqual([witness.id])
  expect(result.bestUseProfileId).toBe(witness.id)
  if (action === 'check_condition') {
    expect(
      result.blockedBy.some(
        (row) => row.profileId === witness.id && row.predicateId === 'synthetic-team-prerequisite',
      ),
    ).toBe(true)
    expect(result.nextAction.targetLevel).toBeNull()
  } else expect(result.blockedBy).toEqual([])
}

describe('absolute retention selects an independently sufficient valid witness', () => {
  it.each([
    ['R02 valid quality', mature, valid, highConditional, 'quality_keep', 'keep', null],
    [
      'R03 completed function',
      functionDisc(15),
      validFunction,
      highFunctionAlternative,
      'functional_ready',
      'keep',
      null,
    ],
    [
      'R04 equal-score qualified trial',
      seed,
      profile('z-valid-trial'),
      conditional('a-conditional-trial'),
      'try_next_upgrade',
      'try_upgrade',
      3,
    ],
    [
      'growing main-only function',
      functionDisc(12),
      validFunction,
      highFunctionAlternative,
      'try_next_upgrade',
      'try_upgrade',
      15,
    ],
  ] as const)(
    '%s takes precedence over a conditional alternative',
    (_, item, sufficient, alternative, reason, action, target) => {
      const control = assess(item, [sufficient])
      const result = assess(item, [sufficient, alternative])
      expectWitness(result, sufficient, reason, action)
      expect(result.qualityDisposition).toBe(control.qualityDisposition)
      expect(result.nextAction).toEqual(control.nextAction)
      expect(result.nextAction.targetLevel).toBe(target)
      expect(result.sourceCoverage).toBe('complete')
      expect(result.evidence.find((row) => row.profileId === sufficient.id)).toEqual(
        control.evidence[0],
      )
      expect(
        result.evidence
          .find((row) => row.profileId === alternative.id)
          ?.blockers.some((row) => row.predicateId === 'synthetic-team-prerequisite'),
      ).toBe(true)
      expect(assess(item, [alternative, sufficient]).witnessProfileIds).toEqual([sufficient.id])
    },
  )

  it('V01 retains the conditional quality route when it is the only sufficient route', () => {
    expectWitness(
      assess(mature, [highConditional]),
      highConditional,
      'conditional_use',
      'check_condition',
    )
  })
  it('prefers an admitted valid trial over a conditional quality winner', () => {
    const validTrial = profile('z-valid-trial')
    const conditionalQuality = conditional('a-conditional-quality')
    const result = assess(seed, [validTrial, conditionalQuality], (value) => ({
      ...value,
      byProfile: {
        ...value.byProfile,
        [conditionalQuality.id]: { '1': { cleanupBelow: 20, keepFrom: 30, premiumFrom: 67 } },
      },
    }))
    expect(
      result.evidence.find((row) => row.profileId === conditionalQuality.id)!.currentScore,
    ).toBeGreaterThanOrEqual(30)
    expect(
      result.evidence.find((row) => row.profileId === validTrial.id)!.investment.qualified,
    ).toBe(true)
    expectWitness(result, validTrial, 'try_next_upgrade', 'try_upgrade')
    expect(result.nextAction.targetLevel).toBe(3)
  })
  it.each(['material', 'functional', 'calibration'] as const)(
    'does not admit a valid trial ahead of conditional quality with a %s trial gate',
    (gate) => {
      const validTrial = profile('z-valid-trial')
      const conditionalQuality = conditional('a-conditional-quality')
      const context = {
        ...validFunction,
        functionalMains: validFunction.functionalMains!.map((row) => ({
          ...row,
          completion: 'build_threshold' as const,
        })),
      }
      const profiles =
        gate === 'functional'
          ? [validTrial, conditionalQuality, context]
          : [validTrial, conditionalQuality]
      const item =
        gate === 'functional'
          ? disc(6, 'energy_regen', 0, [
              ['crit_rate', 1],
              ['crit_dmg', 1],
              ['atk_percent', 1],
              ['def_flat', 1],
            ])
          : seed
      const baseCatalog = catalog(profiles)
      const basePolicy = policy(profiles)
      const pol = {
        ...basePolicy,
        calibration: gate === 'calibration' ? ('candidate' as const) : ('approved' as const),
        byProfile: {
          ...basePolicy.byProfile,
          [conditionalQuality.id]: {
            [String(item.slot)]: { cleanupBelow: 20, keepFrom: 30, premiumFrom: 67 },
          },
        },
      }
      const result = assessDisc(
        item,
        gate === 'material' ? { ...baseCatalog, branchCoverageComplete: false } : baseCatalog,
        pol,
      )
      expect(
        result.evidence.find((row) => row.profileId === validTrial.id)!.investment.qualified,
      ).toBe(true)
      expectWitness(result, conditionalQuality, 'conditional_use', 'check_condition')
      expect(result.qualityDisposition).toBe('keep')
    },
  )
  it('V02 does not promote valid quality below its own keep threshold', () => {
    const result = assess(mature, [valid, highConditional], (value) => ({
      ...value,
      byProfile: {
        ...value.byProfile,
        [valid.id]: { '1': { cleanupBelow: 48, keepFrom: 90, premiumFrom: 95 } },
      },
    }))
    expectWitness(result, highConditional, 'conditional_use', 'check_condition')
  })
  it('V03 keeps valid quality when conditional quality is below its threshold', () => {
    const low = conditional('a-low-conditional', {
      weights: { crit_rate: 0.25, crit_dmg: 1, atk_percent: 1 },
    })
    expectWitness(assess(mature, [valid, low]), valid, 'quality_keep', 'keep')
  })
  it('V04 retains the conditional qualified trial without automatically upgrading', () => {
    const only = conditional('a-conditional-trial')
    expectWitness(assess(seed, [only]), only, 'conditional_use', 'check_condition')
  })
  it('V05 does not promote an unqualified valid trial', () => {
    const validTrial = profile('z-valid-trial')
    const conditionalTrial = conditional('a-conditional-trial')
    const result = assess(seed, [validTrial, conditionalTrial], (value) => ({
      ...value,
      byProfile: {
        ...value.byProfile,
        [validTrial.id]: { '1': { cleanupBelow: 99, keepFrom: 100, premiumFrom: 100 } },
      },
    }))
    expect(
      result.evidence.find((row) => row.profileId === validTrial.id)?.investment.qualified,
    ).toBe(false)
    expectWitness(result, conditionalTrial, 'conditional_use', 'check_condition')
  })
  it('V06 keeps a completed valid function with a below-threshold conditional alternative', () => {
    const low = conditional('a-low-function', {
      weights: { def_flat: 0.25, hp_percent: 1, def_percent: 1 },
      coreStats: ['hp_percent'],
    })
    const result = assess(functionDisc(15), [validFunction, low], (value) => ({
      ...value,
      byProfile: {
        ...value.byProfile,
        [low.id]: { '6': { cleanupBelow: 80, keepFrom: 95, premiumFrom: 100 } },
      },
    }))
    expectWitness(result, validFunction, 'functional_ready', 'keep')
  })
  it('a qualified valid trial still waits for missing material or unresolved functional context', () => {
    const trial = profile('valid-trial')
    const base = catalog([trial])
    const missing = assessDisc(seed, { ...base, branchCoverageComplete: false }, policy([trial]))
    expect(missing.reasonKind).toBe('missing_fact')
    expect(missing.nextAction.kind).toBe('complete_data')
    const context = {
      ...validFunction,
      functionalMains: validFunction.functionalMains!.map((row) => ({
        ...row,
        completion: 'build_threshold' as const,
      })),
    }
    const functionalSeed = disc(6, 'energy_regen', 0, [
      ['crit_rate', 1],
      ['crit_dmg', 1],
      ['atk_percent', 1],
      ['def_flat', 1],
    ])
    const result = assess(functionalSeed, [trial, context])
    expect(result.evidence.find((row) => row.profileId === trial.id)?.investment.qualified).toBe(
      true,
    )
    expect(result.nextAction.kind).toBe('check_condition')
    expect(result.witnessProfileIds).toEqual([context.id])
  })
})
