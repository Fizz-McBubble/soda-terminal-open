import { describe, expect, it } from 'vitest'
import {
  absoluteDiscRetentionCatalog as catalog,
  absoluteDiscRetentionPolicy as policy,
} from './absoluteDiscRetentionCatalog'
import type { Disc, Profile, QualityPolicy } from './absoluteDiscRetentionContract'
import {
  namedPolicies,
  resolveNamedInvestmentCalibration as resolve,
} from './absoluteDiscRetentionInvestmentCalibration'
import { assessDisc } from './absoluteDiscRetentionKernel'
import { scoreProfile } from './absoluteDiscRetentionScoring'
import { enrichRetentionEvidence } from './absoluteDiscRetentionStages'

const attackSlot = { '2': 'atk_flat' }
const healthSlots = { '1': 'hp_flat', '2': 'atk_flat', '3': 'def_flat' }
// Retain the exact approved submap while admitting only the three reviewed aliases.
const retainedNamedPolicies = {
  'agent-soukaku:base-0:fnv1a-788b': [['e4603840', '7d17142d'], 'atk_percent', attackSlot],
  'agent-soukaku:base-1:fnv1a-f9a2': [['e4603840', '7d17142d'], 'atk_percent', attackSlot],
  'agent-soukaku:main-alt-1:anomaly_support': [['55bd5625', '9d414c98'], 'atk_percent', attackSlot],
  'agent-soukaku:main-alt-2:secondary': [['294c5feb', 'e70b83da'], 'atk_percent', attackSlot],
  'agent-seth:base-0:fnv1a-bd3c': [['7fea4163'], 'atk_percent', attackSlot],
  'agent-seth:base-1:fnv1a-5f8a': [['7fea4163'], 'atk_percent', attackSlot],
  'agent-seth:base-2:fnv1a-3f61': [['7fea4163'], 'atk_percent', attackSlot],
  'agent-seth:main-alt-0:short_fight': [['b087233c'], 'atk_percent', attackSlot],
  'agent-astra:base-0:fnv1a-210f': [['29936f38', '80cc6333'], 'atk_percent', attackSlot],
  'agent-astra:base-1:fnv1a-77cc': [['29936f38', '80cc6333'], 'atk_percent', attackSlot],
  'agent-zhao:base-0:fnv1a-6f7e': [['242f10da'], 'hp_percent', healthSlots],
  'agent-zhao:base-1:fnv1a-f0e4': [['242f10da'], 'hp_percent', healthSlots],
  'agent-yuzuha:base-0:fnv1a-c737': [['9e5be292', 'a1e7c403'], 'atk_percent', attackSlot],
  'agent-yuzuha:base-1:fnv1a-6e0c': [['9e5be292', 'a1e7c403'], 'atk_percent', attackSlot],
  'agent-pan-yinhu:base-0:fnv1a-c922': [['b3f0f001'], 'atk_percent', attackSlot],
  'agent-pan-yinhu:base-1:fnv1a-6968': [['b3f0f001'], 'atk_percent', attackSlot],
  'agent-lucia:base-0:fnv1a-782d': [['340ac385'], 'hp_percent', healthSlots],
  'agent-sunna:base-0:fnv1a-e37e': [['735d8a2c', '5868c485'], 'atk_percent', attackSlot],
} as const
const equivalentNamedAliases = {
  'agent-seth:base-3:fnv1a-cd1e': 'agent-seth:base-0:fnv1a-bd3c',
  'agent-zhao:base-2:fnv1a-bb99': 'agent-zhao:base-0:fnv1a-6f7e',
  'agent-pan-yinhu:base-2:fnv1a-ecea': 'agent-pan-yinhu:base-0:fnv1a-c922',
} as const

function profileFor(agentId: string, branchIndex: number) {
  const prefix = `${agentId}:base-${branchIndex}:`
  const matches = catalog.profiles.filter((row) => row.id.startsWith(prefix))
  expect(matches, `expected one current profile for ${prefix}`).toHaveLength(1)
  return matches[0]!
}
// Zhao's two reviewed branches share this exact 4+2 member; one is conditional.
const profile = profileFor('agent-zhao', 0)
const native = catalog.rules.rarities.S!
const set = catalog.sets.find((row) => row.id === 'set-bunny-in-wonderland')!
function item(lines = 4, level = 0, coreUpgrades = Math.floor(level / 3)): Disc {
  const stats = ['hp_percent', 'crit_rate', 'def_flat', 'pen'].slice(0, lines)
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
      requiredCoreStats: ['hp_percent'],
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
    const hpProfile = profileFor('agent-zhao', 0)
    const hpSet = set
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
      recommendationSetFit: 'valid',
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
    { weights: { ...profile.weights, hp_percent: 0.9 } },
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
      resolve({ ...item(), slot: 5, mainStat: 'crit_rate' }, profile, catalog.rules, policy),
    ).toBeNull()
    expect(
      resolve({ ...item(), mainStat: 'hp_percent' }, profile, catalog.rules, policy),
    ).toBeNull()
    expect(
      resolve(item(), profile, { ...catalog.rules, sourceIds: ['changed-rules'] }, policy),
    ).toBeNull()
    const modifiedRolls = {
      ...native,
      steps: { ...native.steps, hp_percent: native.steps.hp_percent! + 1 },
    }
    expect(
      resolve(
        item(),
        profile,
        { ...catalog.rules, rarities: { ...catalog.rules.rarities, S: modifiedRolls } },
        policy,
      ),
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
    const branch = profileFor('agent-zhao', 1)
    const matchingSet = set
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
    const conditional = profileFor('agent-zhao', 1)
    const result = assessDisc(
      item(),
      {
        ...catalog,
        profiles: [conditional, profile],
        releasedAgentIds: [profile.agentId],
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
  it('retains the 18 policies and three historical aliases and rejects changed 3.3 branch evidence', () => {
    expect(Object.keys(retainedNamedPolicies)).toHaveLength(18)
    expect(Object.keys(namedPolicies)).toHaveLength(21)
    expect(
      Object.fromEntries(
        Object.entries(namedPolicies).filter(([id]) => Object.hasOwn(retainedNamedPolicies, id)),
      ),
    ).toEqual(retainedNamedPolicies)
    expect(
      Object.keys(namedPolicies)
        .filter((id) => !Object.hasOwn(retainedNamedPolicies, id))
        .sort(),
    ).toEqual(Object.keys(equivalentNamedAliases).sort())
    // These eight 3.2 identities had their core and source evidence changed in 3.3.
    const changedBranches: Record<string, string> = {
      'agent-seth:base-0:fnv1a-bd3c': 'agent-seth:base-0:fnv1a-bfbf',
      'agent-seth:base-1:fnv1a-5f8a': 'agent-seth:base-1:fnv1a-5f8a',
      'agent-seth:base-2:fnv1a-3f61': 'agent-seth:base-2:fnv1a-3f61',
      'agent-seth:base-3:fnv1a-cd1e': 'agent-seth:base-3:fnv1a-ed3e',
      'agent-seth:main-alt-0:short_fight': 'agent-seth:main-alt-0:short_fight',
      'agent-pan-yinhu:base-0:fnv1a-c922': 'agent-pan-yinhu:base-0:fnv1a-12c5',
      'agent-pan-yinhu:base-1:fnv1a-6968': 'agent-pan-yinhu:base-1:fnv1a-2fd4',
      'agent-pan-yinhu:base-2:fnv1a-ecea': 'agent-pan-yinhu:base-2:fnv1a-631b',
    }
    for (const [id, currentId] of Object.entries(changedBranches)) {
      const branch = catalog.profiles.find((row) => row.id === currentId)!
      expect(branch, currentId).toBeDefined()
      expect(branch.coreStats).toEqual(['atk_percent'])
      expect(branch.weights.atk_flat).toBeGreaterThan(0)
      expect(branch.weights.atk_flat).toBeLessThan(policy.investment!.meaningfulWeightFrom)
      expect(resolve(item(), branch, catalog.rules, policy)).toBeNull()
      const primary = branch.branchSetPlan?.primarySetIds[0]
      if (primary) {
        const disc = {
          ...item(),
          setId: primary,
          subStats: item().subStats.map((row, i) =>
            i === 0 ? { stat: 'atk_percent', upgrades: 0, value: native.steps.atk_percent! } : row,
          ),
        }
        const result = assess(disc, branch)
        expect(result.evidence[0]!.investment.calibrationId).toBeNull()
        expect(result.nextAction.kind).toBe('complete_data')
      } else {
        expect(currentId).toBe('agent-seth:main-alt-0:short_fight')
      }

      const stalePolicy = {
        ...policy,
        byProfile: { ...policy.byProfile, [id]: policy.byProfile[currentId]! },
      }
      expect(resolve(item(), { ...branch, id }, catalog.rules, stalePolicy)).toBeNull()
    }
    for (const [aliasId, approvedId] of Object.entries(equivalentNamedAliases)) {
      expect(namedPolicies[aliasId], aliasId).toEqual(retainedNamedPolicies[approvedId])
      const alias = catalog.profiles.find(
        (row) => row.id === (changedBranches[aliasId] ?? aliasId),
      )!
      const approved = catalog.profiles.find(
        (row) => row.id === (changedBranches[approvedId] ?? approvedId),
      )!
      expect(alias, aliasId).toBeDefined()
      expect(approved, approvedId).toBeDefined()
      expect(alias.goal).toBe(approved.goal)
      expect(alias.weights).toEqual(approved.weights)
      expect([...(alias.coreStats ?? [])].sort()).toEqual([...(approved.coreStats ?? [])].sort())
      expect([...alias.sourceIds].sort()).toEqual([...approved.sourceIds].sort())
      expect({
        ...alias.weightEvidence,
        sourceIds: [...alias.weightEvidence!.sourceIds].sort(),
      }).toEqual({
        ...approved.weightEvidence,
        sourceIds: [...approved.weightEvidence!.sourceIds].sort(),
      })
    }
    const obsoleteBindings = [
      ['agent-seth:base-0:fnv1a-f5ec', 'agent-seth:base-0:fnv1a-bd3c'],
      ['agent-seth:base-1:fnv1a-8e7e', 'agent-seth:base-1:fnv1a-5f8a'],
      ['agent-seth:base-2:fnv1a-18a1', 'agent-seth:base-2:fnv1a-3f61'],
      ['agent-zhao:base-0:fnv1a-2a59', 'agent-zhao:base-0:fnv1a-6f7e'],
      ['agent-zhao:base-1:fnv1a-f244', 'agent-zhao:base-1:fnv1a-f0e4'],
      ['agent-pan-yinhu:base-0:fnv1a-79f0', 'agent-pan-yinhu:base-0:fnv1a-c922'],
      ['agent-pan-yinhu:base-1:fnv1a-792d', 'agent-pan-yinhu:base-1:fnv1a-6968'],
    ] as const
    for (const [obsoleteId, currentId] of obsoleteBindings) {
      const current = catalog.profiles.find(
        (row) => row.id === (changedBranches[currentId] ?? currentId),
      )
      expect(current, `current branch ${currentId} must be present`).toBeDefined()
      if (!current) continue
      for (const rejectedId of [obsoleteId, `${currentId}:forged`, 'unknown-profile']) {
        // Supply matching cutoffs so missing policy data cannot mask an ID admission bug.
        const aliasedPolicy: QualityPolicy = {
          ...policy,
          byProfile: { ...policy.byProfile, [rejectedId]: policy.byProfile[current.id]! },
        }
        expect(
          resolve(item(), { ...current, id: rejectedId }, catalog.rules, aliasedPolicy),
          rejectedId,
        ).toBeNull()
      }
    }
    const calibratedCurrentIds = catalog.profiles
      .filter((branch) => resolve(item(), branch, catalog.rules, policy) !== null)
      .map((branch) => branch.id)
      .sort()
    const unchanged = Object.entries(namedPolicies).filter(
      ([id]) => !Object.hasOwn(changedBranches, id),
    )
    expect(unchanged).toHaveLength(13)
    expect(calibratedCurrentIds).toEqual(unchanged.map(([id]) => id).sort())
    for (const [profileId, [, expectedCoreStat, slotMap]] of unchanged) {
      const p = catalog.profiles.find((row) => row.id === profileId)
      expect
        .soft(p, `named profile ${profileId} must be present in production catalog`)
        .toBeDefined()
      if (!p) continue

      for (const [slotStr, mainStat] of Object.entries(slotMap)) {
        const disc: Disc = {
          id: `proof-${profileId}-${slotStr}`,
          setId: set.id,
          rarity: 'S',
          slot: Number(slotStr),
          mainStat,
          level: 0,
          subStats: [],
        }
        const resolved = resolve(disc, p, catalog.rules, policy)
        expect
          .soft(resolved, `profile ${profileId} slot ${slotStr} ${mainStat} must resolve`)
          .not.toBeNull()
        expect.soft(resolved?.id).toContain(profileId)
        expect.soft(resolved?.requiredCoreStat).toBe(expectedCoreStat)
        for (const rejectedId of [`${profileId}:forged`, 'unknown-profile'])
          expect(
            resolve(disc, { ...p, id: rejectedId }, catalog.rules, {
              ...policy,
              byProfile: { ...policy.byProfile, [rejectedId]: policy.byProfile[profileId]! },
            }),
            rejectedId,
          ).toBeNull()

        // Verify fail-closed protection: rules mismatch strictly rejects
        const staleRules = { ...catalog.rules, sourceIds: ['stale-source'] }
        expect(resolve(disc, p, staleRules, policy)).toBeNull()

        // Verify slot/mainStat mismatch strictly rejects
        const mismatchedDisc: Disc = { ...disc, mainStat: 'anomaly_proficiency' }
        expect(resolve(mismatchedDisc, p, catalog.rules, policy)).toBeNull()

        expect(
          resolve(
            disc,
            { ...p, sourceIds: [...p.sourceIds, 'unreviewed-source:extra'] },
            catalog.rules,
            policy,
          ),
        ).toBeNull()
        expect(
          resolve(
            disc,
            {
              ...p,
              weightEvidence: {
                ...p.weightEvidence!,
                sourceIds: [...p.weightEvidence!.sourceIds, 'unreviewed-source:extra'],
              },
            },
            catalog.rules,
            policy,
          ),
        ).toBeNull()
        for (const adoptedRef of p.sourceIds.filter((source) =>
          /^hoyobuild-agent-(seth|zhao|pan-yinhu)-drive-discs-32-20261020:/.test(source),
        )) {
          const withoutAdoptedSource = p.sourceIds.filter((source) => source !== adoptedRef)
          const withoutAdoptedWeightSource = {
            ...p.weightEvidence!,
            sourceIds: p.weightEvidence!.sourceIds.filter((source) => source !== adoptedRef),
          }
          const staleRef = `${adoptedRef.split(':')[0]}:stale-content-hash`
          for (const changed of [
            { ...p, sourceIds: withoutAdoptedSource },
            { ...p, weightEvidence: withoutAdoptedWeightSource },
            {
              ...p,
              sourceIds: withoutAdoptedSource,
              weightEvidence: withoutAdoptedWeightSource,
            },
            {
              ...p,
              sourceIds: [...withoutAdoptedSource, staleRef],
              weightEvidence: {
                ...withoutAdoptedWeightSource,
                sourceIds: [...withoutAdoptedWeightSource.sourceIds, staleRef],
              },
            },
          ])
            expect(resolve(disc, changed, catalog.rules, policy), profileId).toBeNull()
        }
      }
    }
  })
})
