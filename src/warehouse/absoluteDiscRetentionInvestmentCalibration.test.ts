import { describe, expect, it } from 'vitest'
import {
  absoluteDiscRetentionCatalog as catalog,
  absoluteDiscRetentionPolicy as policy,
} from './absoluteDiscRetentionCatalog'
import type { Disc, Profile, QualityPolicy } from './absoluteDiscRetentionContract'
import { resolveNamedInvestmentCalibration as resolve } from './absoluteDiscRetentionInvestmentCalibration'
import { assessDisc } from './absoluteDiscRetentionKernel'
import { scoreProfile, twoPieceApplicability } from './absoluteDiscRetentionScoring'
import { enrichRetentionEvidence } from './absoluteDiscRetentionStages'

const profile = catalog.profiles.find((row) => row.id === 'agent-seth:base-0:fnv1a-f5ec')!
const native = catalog.rules.rarities.S!
const set = catalog.sets.find((row) => twoPieceApplicability(row, profile) === 'valid')!
function item(lines = 4, level = 0, coreUpgrades = Math.floor(level / 3)): Disc {
  const stats = ['atk_percent', 'crit_rate', 'def_flat', 'pen'].slice(0, lines)
  return {
    id: 'synthetic-named-investment',
    rarity: 'S',
    slot: 2,
    mainStat: 'atk_flat',
    setId: set.id,
    level,
    subStats: stats.map((stat, index) => {
      const upgrades =
        index === 0 ? coreUpgrades : index === 1 ? Math.floor(level / 3) - coreUpgrades : 0
      return { stat, upgrades, value: native.steps[stat]! * (1 + upgrades) }
    }),
  }
}
const score = (disc: Disc, branch = profile, cutoffs = policy) =>
  scoreProfile(disc, branch, set, catalog.rules, cutoffs)
const assess = (disc: Disc, branch = profile) =>
  assessDisc(
    disc,
    {
      ...catalog,
      profiles: [branch],
      releasedAgentIds: [branch.agentId],
      coverageGaps: [],
      branchCoverageComplete: true,
    },
    policy,
  )

describe('approved named single-core investment calibration', () => {
  it('binds its mechanism identity and retains the global policy and numeric gates', () => {
    const evidence = score(item())
    expect(evidence.useState).toBe('valid')
    expect(evidence.investment).toMatchObject({
      qualified: true,
      policyId: policy.investment!.id,
      calibrationId: `named-single-core-investment-r1:${profile.id}:S:2:atk_flat`,
      minimumLines: 1,
      requiredCoreStats: ['atk_percent'],
      progressFloor: 0,
      potentialTarget: 60,
      policyBlockers: [],
    })
    expect(evidence.cutoffs).toEqual({ cleanupBelow: 48, keepFrom: 60, premiumFrom: 67 })
    expect(assess(item()).nextAction).toMatchObject({ kind: 'try_upgrade', targetLevel: 3 })
  })
  it.each([3, 4])('admits a legal %i-line starting history and its +3 successor', (lines) => {
    const seed = item(lines)
    expect(score(seed).investment.qualified).toBe(true)
    // Three-line starts spend +3 unlocking the fourth line, rather than adding a roll.
    const next = lines === 3 ? item(4, 3, 0) : item(4, 3, 1)
    const unlocked =
      lines === 3
        ? {
            ...next,
            subStats: next.subStats.map((line) => ({
              ...line,
              value: native.steps[line.stat]!,
              upgrades: 0,
            })),
          }
        : next
    expect(score(unlocked).investment.qualified).toBe(true)
    expect(score(unlocked).investment.progressFloor).toBe(12)
  })
  it('does not substitute a positive flat stat for the exact required core', () => {
    const hpProfile = catalog.profiles.find((row) => row.id === 'agent-zhao:base-0:fnv1a-2a59')!
    const hpSet = catalog.sets.find(
      (row) => twoPieceApplicability(row, hpProfile) !== 'incompatible',
    )!
    const missing: Disc = {
      ...item(),
      setId: hpSet.id,
      subStats: ['hp_flat', 'crit_rate', 'def_flat', 'pen'].map((stat) => ({
        stat,
        value: native.steps[stat]!,
        upgrades: 0,
      })),
    }
    const evidence = scoreProfile(missing, hpProfile, hpSet, catalog.rules, policy)
    expect(evidence.currentScore).toBeGreaterThan(0)
    expect(evidence.investment.calibrationId).toBeTruthy()
    expect(evidence.investment.qualified).toBe(false)
    expect(evidence.investment.coreStats).toEqual([])
    expect(evidence.investment.policyBlockers).toEqual([])
    expect(assess(missing, hpProfile).nextAction.kind).not.toBe('try_upgrade')
  })
  it('retains stage progress and legal upper-bound rejection', () => {
    const stalled = score(item(4, 6, 0))
    expect(stalled.currentScore).toBeLessThan(stalled.investment.progressFloor!)
    expect(stalled.possibleFinalScore.upper).toBeGreaterThanOrEqual(60)
    expect(stalled.investment.qualified).toBe(false)
    const low = score(item(4, 9, 0))
    expect(low.possibleFinalScore.upper).toBeLessThan(60)
    expect(low.investment.qualified).toBe(false)
    // Independently supplied lower upper bound cannot be licensed by sufficient current progress.
    const bound = enrichRetentionEvidence({
      disc: item(4, 12, 2),
      profile,
      set,
      rules: catalog.rules,
      policy,
      mainFit: 'valid',
      twoPieceFit: 'valid',
      fourPieceFit: 'incompatible',
      setFit: 'valid',
      currentScore: 50,
      possibleUpper: 59,
      remainingNodes: 1,
    })
    expect(bound.investment.qualified).toBe(false)
  })
  it.each([
    { id: 'unknown-profile' },
    { agentId: 'agent-other' },
    { goal: 'unknown' },
    { verified: false },
    { weights: { ...profile.weights, atk_percent: 0.9 } },
    { coreStats: ['atk_flat'] },
    { sourceIds: [...profile.sourceIds, 'changed-source'] },
    { weightEvidence: { ...profile.weightEvidence!, method: 'changed-method' } },
    { weightEvidence: { ...profile.weightEvidence!, sourceIds: ['changed-source'] } },
    { weightEvidence: { ...profile.weightEvidence!, id: 'changed-calibration' } },
  ] satisfies Partial<Profile>[])(
    'fails closed when a reviewed branch binding changes: %j',
    (patch) => {
      const changed = { ...profile, ...patch }
      expect(resolve(item(), changed, catalog.rules, policy)).toBeNull()
      if (patch.sourceIds || patch.weightEvidence) {
        expect(score(item(), changed).investment.qualified).toBeNull()
        expect(score(item(), changed).investment.policyBlockers).toHaveLength(1)
      }
    },
  )
  it('does not extend to another rarity, main, slot, rules source or policy threshold', () => {
    expect(resolve({ ...item(), rarity: 'A' }, profile, catalog.rules, policy)).toBeNull()
    expect(
      resolve({ ...item(), slot: 1, mainStat: 'hp_flat' }, profile, catalog.rules, policy),
    ).toBeNull()
    expect(
      resolve({ ...item(), mainStat: 'hp_percent' }, profile, catalog.rules, policy),
    ).toBeNull()
    expect(
      resolve(item(), profile, { ...catalog.rules, sourceIds: ['changed-rules'] }, policy),
    ).toBeNull()
    for (const change of [
      { meaningfulWeightFrom: 0.4 },
      { minimumCoreLines: 2 },
      { growthTarget: 'premiumFrom' as const },
      { progressFloorBySpentNode: { ...policy.investment!.progressFloorBySpentNode, '1': 0.2 } },
    ]) {
      expect(
        resolve(item(), profile, catalog.rules, {
          ...policy,
          investment: { ...policy.investment!, ...change },
        }),
      ).toBeNull()
    }
    const changed: QualityPolicy = {
      ...policy,
      byProfile: {
        ...policy.byProfile,
        [profile.id]: { '2': { cleanupBelow: 47, keepFrom: 60, premiumFrom: 67 } },
      },
    }
    expect(resolve(item(), profile, catalog.rules, changed)).toBeNull()
  })
  it('preserves conditional use and its independent blockers after investment qualifies', () => {
    const branch = catalog.profiles.find((row) => row.id === 'agent-soukaku:base-0:fnv1a-788b')!
    const matchingSet = catalog.sets.find(
      (row) => twoPieceApplicability(row, branch) !== 'incompatible',
    )!
    const evidence = scoreProfile(
      { ...item(), setId: matchingSet.id },
      branch,
      matchingSet,
      catalog.rules,
      policy,
    )
    expect(evidence.investment.qualified).toBe(true)
    expect(evidence.useState).toBe('conditional')
    expect(evidence.blockers.length).toBeGreaterThan(0)
    expect(assess({ ...item(), setId: matchingSet.id }, branch).nextAction.kind).toBe(
      'check_condition',
    )
  })
  it('keeps independently qualified valid and conditional uses separate in the decision', () => {
    const conditional = catalog.profiles.find(
      (row) => row.id === 'agent-soukaku:base-0:fnv1a-788b',
    )!
    const result = assessDisc(
      item(),
      {
        ...catalog,
        profiles: [conditional, profile],
        releasedAgentIds: [conditional.agentId, profile.agentId],
        coverageGaps: [],
        branchCoverageComplete: true,
      },
      policy,
    )
    const alternate = result.evidence.find((row) => row.profileId === conditional.id)!
    expect(alternate.investment.qualified).toBe(true)
    expect(alternate.useState).toBe('conditional')
    expect(alternate.blockers.length).toBeGreaterThan(0)
    expect(result.nextAction).toMatchObject({ kind: 'try_upgrade', targetLevel: 3 })
    expect(result.witnessProfileIds).toEqual([profile.id])
    expect(result.blockedBy).toEqual([])
  })
})
