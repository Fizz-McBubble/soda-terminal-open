import { afterEach, describe, expect, it, vi } from 'vitest'
import * as mechanics from '../calculation/currentAgentMechanicContracts'
import { getCurrentAgentDecisionMechanicContract } from '../calculation/currentAgentDecisionMechanicContracts'
import {
  createPlanningExpressionDomainRuntime,
  evaluateUpstreamExpressionIr,
  extractUpstreamEffectValueIr,
  type UpstreamExpressionIR,
} from '../calculation/currentUpstreamExpressionIR'
import {
  absoluteDiscRetentionCatalog as catalog,
  absoluteDiscRetentionPolicy as policy,
} from './absoluteDiscRetentionCatalog'
import type { Disc, Profile } from './absoluteDiscRetentionContract'
import { resolveNamedInvestmentCalibration } from './absoluteDiscRetentionInvestmentCalibration'
import { assessDisc } from './absoluteDiscRetentionKernel'
import { scoreProfile, twoPieceApplicability } from './absoluteDiscRetentionScoring'
import { reviewedHpRetentionEvidence } from './reviewedHpRetentionEvidence'

afterEach(() => vi.restoreAllMocks())
type HpSample = {
  readonly id: string
  readonly agentId: string
  readonly branchIndex: number
}
const ids = [
  { id: 'agent-zhao:base-0:fnv1a-2a59', agentId: 'agent-zhao', branchIndex: 0 },
  { id: 'agent-zhao:base-1:fnv1a-f244', agentId: 'agent-zhao', branchIndex: 1 },
  { id: 'agent-lucia:base-0:fnv1a-782d', agentId: 'agent-lucia', branchIndex: 0 },
  { id: 'agent-zhao:base-2:fnv1a-bb99', agentId: 'agent-zhao', branchIndex: 2 },
] as const satisfies readonly HpSample[]
const cases = ids.flatMap((sample) => [4, 5, 6].map((slot) => ({ ...sample, slot })))
const native = catalog.rules.rarities.S!
function profileFor(sample: Pick<HpSample, 'agentId' | 'branchIndex'>) {
  const prefix = `${sample.agentId}:base-${sample.branchIndex}:`
  const matches = catalog.profiles.filter((row) => row.id.startsWith(prefix))
  expect(matches, `expected one current profile for ${prefix}`).toHaveLength(1)
  return matches[0]!
}
function fixture(profile: Profile, slot: number, level = 0, hpHits = 0): Disc {
  const set = catalog.sets.find((row) => twoPieceApplicability(row, profile) !== 'incompatible')!
  return {
    id: 'synthetic-hp-investment',
    setId: set.id,
    slot,
    rarity: 'S',
    mainStat: 'hp_percent',
    level,
    subStats: ['hp_flat', 'atk_flat', 'def_flat', 'pen'].map((stat, index) => {
      const upgrades = index === 0 ? hpHits : index === 1 ? Math.floor(level / 3) - hpHits : 0
      return { stat, upgrades, value: native.steps[stat]! * (1 + upgrades) }
    }),
  }
}
function score(disc: Disc, profile: Profile) {
  return scoreProfile(
    disc,
    profile,
    catalog.sets.find((row) => row.id === disc.setId),
    catalog.rules,
    policy,
  )
}

describe('nine retained HP-main investment combinations and three equivalent alias combinations', () => {
  it.each(cases)(
    '$id slot $slot has a positive secondary input without lowering global core policy',
    (sample) => {
      const { slot } = sample
      const profile = profileFor(sample)
      const disc = fixture(profile, slot)
      const before = JSON.stringify(disc)
      const use = score(disc, profile)
      expect(JSON.stringify(disc)).toBe(before)
      expect(use.investment).toMatchObject({
        calibrationId: `named-secondary-hp-investment-r1:${profile.id}:S:${slot}:hp_percent`,
        qualified: true,
        minimumLines: 0,
        minimumCoreLines: 0,
        meaningfulStats: [],
        coreStats: [],
        requiredCoreStats: [],
        requiredSecondaryStats: ['hp_flat'],
        secondaryStats: ['hp_flat'],
        policyBlockers: [],
        progressFloor: 0,
        potentialTarget: 60,
      })
      expect(
        use.investment.calibrationSourceIds!.some((source) => source.startsWith('miyoushe-')),
      ).toBe(true)
      expect(profile.coreStats).toEqual(['hp_percent'])
      expect(profile.weights.hp_flat).toBeGreaterThan(0)
      expect(profile.weights.hp_flat).toBeLessThan(0.5)
      expect(policy.investment).toMatchObject({
        meaningfulWeightFrom: 0.5,
        minimumCoreLines: 1,
        leftSlotMinimumLines: 2,
        rightSlotMinimumLines: 1,
      })
      expect(use.functionalState).toBe('needs_build_context')
      const result = assessDisc(
        disc,
        {
          ...catalog,
          profiles: [profile],
          releasedAgentIds: [profile.agentId],
          coverageGaps: [],
          branchCoverageComplete: true,
        },
        policy,
      )
      expect(result.nextAction.kind).toBe('check_condition')
      expect(result.blockedBy.every((row) => row.kind === 'conditional_use')).toBe(true)
    },
  )
  it.each(cases)(
    '$id slot $slot still rejects stalled progress, poor legal ceiling and absent HP input',
    (sample) => {
      const { slot } = sample
      const profile = profileFor(sample)
      for (const [level, hpHits, qualified] of [
        [3, 0, true],
        [6, 0, false],
        [6, 1, true],
        [9, 0, false],
        [9, 1, true],
        [12, 1, false],
        [12, 2, true],
      ] as const)
        expect(score(fixture(profile, slot, level, hpHits), profile).investment.qualified).toBe(
          qualified,
        )
      const base = fixture(profile, slot)
      const absent = {
        ...base,
        subStats: base.subStats.map((line) =>
          line.stat === 'hp_flat'
            ? { stat: 'crit_rate', value: native.steps.crit_rate!, upgrades: 0 }
            : line,
        ),
      }
      expect(score(absent, profile).investment.qualified).toBe(false)
      expect(score(fixture(profile, slot, 15, 5), profile).investment.qualified).toBe(false)
    },
  )
  it('allows a legal three-line unlock and retains six prior Zhao left-slot calibrations plus the equivalent alias', () => {
    for (const sample of ids) {
      const profile = profileFor(sample)
      const seed = fixture(profile, 4)
      expect(
        score({ ...seed, subStats: seed.subStats.slice(0, 3) }, profile).investment.qualified,
      ).toBe(true)
      expect(score({ ...seed, level: 3 }, profile).investment.qualified).toBe(true)
    }
    for (const sample of [...ids.slice(0, 2), ids[3]])
      for (const slot of [1, 2, 3]) {
        const profile = profileFor(sample)
        const main = ['hp_flat', 'atk_flat', 'def_flat'][slot - 1]!
        const disc = {
          ...fixture(profile, slot),
          mainStat: main,
          subStats: ['hp_percent', 'atk_percent', 'crit_rate', 'pen'].map((stat) => ({
            stat,
            value: native.steps[stat]!,
            upgrades: 0,
          })),
        }
        expect(score(disc, profile).investment).toMatchObject({
          qualified: true,
          minimumLines: 1,
          minimumCoreLines: 1,
          requiredCoreStats: ['hp_percent'],
          requiredSecondaryStats: [],
        })
      }
  })
  it('rejects changed weights, sources, identity, rarity or main and stale upstream bindings', () => {
    const profile = profileFor(ids[0])
    const disc = fixture(profile, 4)
    for (const patch of [
      { id: 'unknown' },
      { verified: false },
      { goal: 'crit_damage' },
      { sourceIds: [...profile.sourceIds, 'changed'] },
      { weights: { ...profile.weights, hp_flat: 0.49 } },
      { coreStats: ['hp_flat'] },
    ] satisfies Partial<Profile>[])
      expect(
        resolveNamedInvestmentCalibration(disc, { ...profile, ...patch }, catalog.rules, policy),
      ).toBeNull()
    expect(
      resolveNamedInvestmentCalibration({ ...disc, rarity: 'A' }, profile, catalog.rules, policy),
    ).toBeNull()
    expect(
      resolveNamedInvestmentCalibration(
        { ...disc, mainStat: 'atk_percent' },
        profile,
        catalog.rules,
        policy,
      ),
    ).toBeNull()
    const adoptedRef = 'hoyobuild-agent-zhao-drive-discs-32-20261020:fnv1a-7879a21b'
    expect(profile.sourceIds).toContain(adoptedRef)
    expect(profile.weightEvidence!.sourceIds).toContain(adoptedRef)
    for (const changed of [
      {
        ...profile,
        sourceIds: profile.sourceIds.filter((source) => source !== adoptedRef),
        weightEvidence: {
          ...profile.weightEvidence!,
          sourceIds: profile.weightEvidence!.sourceIds.filter((source) => source !== adoptedRef),
        },
      },
      {
        ...profile,
        sourceIds: [...profile.sourceIds, 'unreviewed-source:extra'],
        weightEvidence: {
          ...profile.weightEvidence!,
          sourceIds: [...profile.weightEvidence!.sourceIds, 'unreviewed-source:extra'],
        },
      },
    ])
      expect(resolveNamedInvestmentCalibration(disc, changed, catalog.rules, policy)).toBeNull()
    const original = mechanics.getCurrentAgentEventContract(profile.agentId)!
    vi.spyOn(mechanics, 'getCurrentAgentEventContract').mockReturnValue({
      ...original,
      source: { ...original.source, commit: '0'.repeat(40) },
    })
    expect(reviewedHpRetentionEvidence(profile.agentId)).toBeNull()
    expect(resolveNamedInvestmentCalibration(disc, profile, catalog.rules, policy)).toBeNull()
  })
})

describe('the consumed Lucia source formula keeps buff cap separate from other HP effects', () => {
  const contract = getCurrentAgentDecisionMechanicContract('agent-lucia')!.effectContract
  function amount(id: string, hp: number, active = true) {
    const effect = contract.effects.find((row) => row.effectId === id)!
    const value = extractUpstreamEffectValueIr(
      effect.numericExpression.expressionIr as UpstreamExpressionIR,
    )
    expect(value.status).toBe('supported')
    if (value.status !== 'supported') throw new Error('Unsupported source value')
    const result = evaluateUpstreamExpressionIr(
      value.value as UpstreamExpressionIR,
      createPlanningExpressionDomainRuntime({
        references: {
          'own.initial.hp': hp,
          'own.final.hp': hp,
          'char.special': 12,
          darkbreaker: active,
        },
      }),
    )
    expect(result.status).toBe('supported')
    return result.status === 'supported' ? result.value : null
  }
  it('consumes base12, the real initial-HP formula, cap and actual Darkbreaker state', () => {
    expect(contract.effects.find((row) => row.effectId === 'exSpecial_sheerForce')).toMatchObject({
      locator: 'Lucia.ts:213',
      applicationScope: 'generic',
      recipients: ['team'],
    })
    expect(amount('exSpecial_sheerForce', 20000)).toBeCloseTo(752)
    expect(amount('exSpecial_sheerForce', 24000)).toBeCloseTo(900)
    expect(amount('exSpecial_sheerForce', 30000)).toBeCloseTo(900)
    expect(amount('exSpecial_sheerForce', 24000, false)).toBe(0)
  })
  it('does not zero Harmony HP damage when the team buff is already capped', () => {
    expect(amount('exSpecial_harmony_dmg_', 30000)).toBeCloseTo(21000)
    expect(
      (amount('exSpecial_harmony_dmg_', 30112) as number) -
        (amount('exSpecial_harmony_dmg_', 30000) as number),
    ).toBeCloseTo(78.4)
  })
})
