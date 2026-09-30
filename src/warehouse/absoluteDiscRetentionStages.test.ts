import { describe, expect, it } from 'vitest'
import type { Catalog, Disc, Profile, QualityPolicy } from './absoluteDiscRetentionContract'
import { assessDisc, assessWarehouse, twoPieceApplicability } from './absoluteDiscRetentionKernel'

const rules: Catalog['rules'] = {
  sourceIds: ['synthetic-rules'],
  standardRarity: 'S',
  enhancementInterval: 3,
  maxSubStats: 4,
  mainStatsBySlot: { '1': ['hp_flat'], '4': ['atk_percent', 'energy_regen'] },
  rarities: {
    S: {
      maxLevel: 15,
      initialLineCounts: [3, 4],
      steps: {
        hp_flat: 1,
        atk_percent: 1,
        crit_rate: 1,
        crit_dmg: 1,
        def_flat: 1,
        def_percent: 1,
        hp_percent: 1,
        pen: 1,
      },
    },
  },
}
const baseProfile: Profile = {
  id: 'crit',
  agentId: 'agent-test',
  verified: true,
  sourceIds: ['synthetic-build'],
  weights: { crit_rate: 1, crit_dmg: 1, atk_percent: 0.75 },
  goal: 'crit_damage',
  coreStats: ['crit_rate', 'crit_dmg'],
  weightEvidence: {
    id: 'test-quality',
    method: 'goal_bound_standard_roll_quality_proxy',
    sourceIds: ['synthetic-build'],
  },
  mainStatsBySlot: { '4': { atk_percent: 'valid', energy_regen: 'valid' } },
  effectUtility: { atk_: 'valid' },
  fourPieceUses: { 'set-test': 'incompatible' },
}
function catalog(profiles: readonly Profile[] = [baseProfile]): Catalog {
  return {
    rules,
    profiles,
    sets: [
      {
        id: 'set-test',
        verified: true,
        sourceIds: ['synthetic-set'],
        twoPieceEffects: [{ stat: 'atk_', value: 10 }],
      },
    ],
    releasedAgentIds: [...new Set(profiles.map((row) => row.agentId))],
    factsGameVersion: 'test',
    assessmentGameVersion: 'test',
    branchCoverageComplete: true,
    reviewedUseScope: 'all-test-builds',
  }
}
function policy(profiles: readonly Profile[] = [baseProfile]): QualityPolicy {
  return {
    id: 'test-policy',
    calibration: 'approved',
    calibratedRarities: ['S'],
    byProfile: Object.fromEntries(
      profiles.map((row) => [
        row.id,
        {
          '1': { cleanupBelow: 48, keepFrom: 60, premiumFrom: 67 },
          '4': { cleanupBelow: 48, keepFrom: 60, premiumFrom: 67 },
        },
      ]),
    ),
    investment: {
      id: 'test-stage',
      calibration: 'approved',
      meaningfulWeightFrom: 0.5,
      leftSlotMinimumLines: 2,
      rightSlotMinimumLines: 1,
      minimumCoreLines: 1,
      growthTarget: 'keepFrom',
      progressFloorBySpentNode: { '0': 0, '1': 0.35, '2': 0.55, '3': 0.75, '4': 0.9, '5': 1 },
    },
  }
}
function disc(
  stats = ['crit_rate', 'crit_dmg', 'def_flat'],
  level = 0,
  initial = 3,
  target = 'crit_rate',
): Disc {
  const spent = Math.floor(level / 3)
  const names = spent && initial === 3 ? [...stats, 'def_percent'] : stats
  const upgrades = Math.max(0, spent - (initial === 3 ? 1 : 0))
  return {
    id: 'test-disc',
    setId: 'set-test',
    slot: 1,
    mainStat: 'hp_flat',
    rarity: 'S',
    level,
    subStats: names.map((stat) => ({
      stat,
      value: 1 + (stat === target ? upgrades : 0),
      upgrades: stat === target ? upgrades : 0,
    })),
  }
}
const assess = (item: Disc, profiles: readonly Profile[] = [baseProfile]) =>
  assessDisc(item, catalog(profiles), policy(profiles))

describe('independent staged retention contract', () => {
  it('does not retain zero effective +0 lines merely for their high legal ceiling', () => {
    const result = assess(disc(['def_flat', 'hp_percent', 'pen']))
    expect(result.evidence[0]!.possibleFinalScore.upper).toBeGreaterThan(60)
    expect(result.reasonKind).toBe('low_investment_value')
    expect(result.reasons).not.toContain('legal_growth_cannot_reach_line')
    expect(result.nextAction.kind).toBe('manual_cleanup')
  })
  it('requires keepFrom rather than cleanupBelow to authorize an upgrade', () => {
    const item = disc(['atk_percent', 'crit_rate', 'def_flat', 'pen'], 9, 4, 'def_flat')
    const result = assess(item)
    expect(result.evidence[0]!.possibleFinalScore.upper).toBeGreaterThan(48)
    expect(result.evidence[0]!.possibleFinalScore.upper).toBeLessThan(60)
    expect(result.evidence[0]!.investment.qualified).toBe(false)
    expect(result.reasonKind).toBe('low_investment_value')
    expect(result.nextAction.kind).not.toBe('try_upgrade')
  })
  it('qualified structure authorizes only +3 and carries a stop condition', () => {
    const result = assess(disc())
    expect(result.reasonKind).toBe('try_next_upgrade')
    expect(result.nextAction).toMatchObject({ kind: 'try_upgrade', targetLevel: 3 })
    expect(result.nextAction.stopWhen.length).toBeGreaterThan(0)
    expect(result.evidence[0]!.investment.coreStats).toEqual(['crit_rate', 'crit_dmg'])
  })
  it('requires earned stage quality even with core structure and a sufficient ceiling', () => {
    const result = assess(disc(['crit_rate', 'crit_dmg', 'def_flat'], 6, 3, 'def_flat'))
    expect(result.evidence[0]!.possibleFinalScore.upper).toBeGreaterThan(60)
    expect(result.evidence[0]!.currentScore).toBeLessThan(
      result.evidence[0]!.investment.progressFloor!,
    )
    expect(result.evidence[0]!.investment.qualified).toBe(false)
    expect(result.nextAction.kind).not.toBe('try_upgrade')
  })
  it.each([3, 4])(
    'validates initial %i lines across every enhancement stage and intermediate level',
    (initial) => {
      const stats =
        initial === 3
          ? ['crit_rate', 'crit_dmg', 'def_flat']
          : ['crit_rate', 'crit_dmg', 'def_flat', 'pen']
      for (const level of [0, 1, 2, 3, 4, 6, 8, 9, 11, 12, 14, 15]) {
        const result = assess(disc(stats, level, initial))
        expect(result.reasonKind, `initial=${initial}, level=${level}`).not.toBe('invalid_record')
        const evidence = result.evidence[0]!
        expect(evidence.investment.spentNodes).toBe(Math.floor(level / 3))
        expect(evidence.investment.nextLevel).toBe(
          level === 15 ? null : (Math.floor(level / 3) + 1) * 3,
        )
        expect(evidence.expectedScore).toBeNull()
        expect(evidence.possibleFinalScore.lower).toBeLessThanOrEqual(
          evidence.possibleFinalScore.upper,
        )
        if (level === 15) expect(result.nextAction.kind).not.toBe('try_upgrade')
      }
    },
  )
  it('mature borderline quality cannot imply another upgrade', () => {
    const mature = disc(['crit_rate', 'crit_dmg', 'def_flat'], 15, 3, 'crit_rate')
    const result = assess({
      ...mature,
      subStats: mature.subStats.map((row) =>
        row.stat === 'crit_rate' || row.stat === 'def_flat'
          ? { ...row, value: 3, upgrades: 2 }
          : row,
      ),
    })
    expect(result.reasonKind).toBe('quality_borderline')
    expect(result.evidence[0]!.investment.remainingNodes).toBe(0)
    expect(result.nextAction.targetLevel).toBeNull()
    expect(result.nextAction.kind).not.toBe('try_upgrade')
  })
  it('requires both meaningful line count and a core line, independently of upside', () => {
    const oneLine = assess(disc(['crit_rate', 'def_flat', 'hp_percent']))
    expect(oneLine.evidence[0]!.possibleFinalScore.upper).toBeGreaterThan(60)
    expect(oneLine.reasonKind).toBe('low_investment_value')
    const noCore = assess(disc(), [{ ...baseProfile, coreStats: ['atk_percent'] }])
    expect(noCore.evidence[0]!.investment.meaningfulStats).toHaveLength(2)
    expect(noCore.evidence[0]!.investment.coreStats).toHaveLength(0)
    expect(noCore.reasonKind).toBe('low_investment_value')
  })
  it('main-only function keeps mature use without granting quality points', () => {
    const functional: Profile = {
      ...baseProfile,
      functionalMains: [
        {
          slot: 4,
          stat: 'energy_regen',
          sourceId: 'test-function',
          completion: 'main_only',
          detail: 'Energy recovery function',
        },
      ],
    }
    const item = {
      ...disc(['def_flat', 'hp_percent', 'pen'], 15, 3, 'def_flat'),
      slot: 4,
      mainStat: 'energy_regen',
    }
    const result = assess(item, [functional])
    expect(result.reasonKind).toBe('functional_ready')
    expect(result.qualityDisposition).toBe('keep')
    expect(result.bestUseScore).toBe(0)
    expect(result.nextAction.targetLevel).toBeNull()
  })
  it('complex whole-build thresholds remain named checks, not completed functions', () => {
    const functional: Profile = {
      ...baseProfile,
      functionalMains: [
        {
          slot: 4,
          stat: 'atk_percent',
          sourceId: 'test-function',
          completion: 'build_threshold',
          detail: 'Check complete build ATK 3000 and core F',
        },
      ],
    }
    const result = assess(
      {
        ...disc(['def_flat', 'hp_percent', 'pen'], 15, 3, 'def_flat'),
        slot: 4,
        mainStat: 'atk_percent',
      },
      [functional],
    )
    expect(result.reasonKind).toBe('conditional_use')
    expect(result.nextAction.kind).toBe('check_condition')
    expect(result.blockedBy).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'functionalTarget',
          detail: 'Check complete build ATK 3000 and core F',
        }),
      ]),
    )
  })
  it('independent two-piece use is not gated by four-piece prerequisites', () => {
    const gated = {
      ...baseProfile,
      availability: 'conditional' as const,
      fourPieceUses: { 'set-test': 'conditional' as const },
    }
    expect(twoPieceApplicability(catalog().sets[0]!, gated)).toBe('valid')
    expect(assess(disc(), [gated]).evidence[0]).toMatchObject({
      twoPieceFit: 'valid',
      setFit: 'valid',
      useState: 'valid',
    })
  })
  it('distinguishes an explicit condition from an actual missing utility fact', () => {
    const conditional: Profile = {
      ...baseProfile,
      effectUtility: { atk_: 'conditional' },
      utilityEvidence: {
        atk_: {
          state: 'conditional',
          predicateId: 'requires-team',
          evidenceIds: ['team-source'],
          detail: 'Requires named teammate',
        },
      },
    }
    const unknown = { ...conditional, utilityEvidence: undefined }
    expect(assess(disc(), [conditional]).evidence[0]!.useState).toBe('conditional')
    expect(assess(disc(), [unknown]).reasonKind).toBe('missing_fact')
    expect(assess(disc(), [unknown]).blockedBy.some((row) => row.kind === 'missing_fact')).toBe(
      true,
    )
  })
  it('requires a closed supported-use scope before declaring no supported use', () => {
    const incompatible: Profile = { ...baseProfile, effectUtility: { atk_: 'incompatible' } }
    const closed = assess(disc(), [incompatible])
    expect(closed.reasonKind).toBe('no_supported_use')
    const open = assessDisc(
      disc(),
      { ...catalog([incompatible]), reviewedUseScope: undefined },
      policy([incompatible]),
    )
    expect(open.qualityDisposition).toBe('review')
    expect(open.blockedBy.some((row) => row.field === 'reviewedUseScope')).toBe(true)
  })
  it('verified negative gates isolate unrelated invalid profiles; relevant missing profiles block cleanup', () => {
    const bad: Profile = {
      ...baseProfile,
      id: 'bad',
      agentId: 'agent-bad',
      weights: { crit_rate: NaN },
      effectUtility: { atk_: 'incompatible' },
    }
    const item = disc(['def_flat', 'hp_percent', 'pen'], 15, 3, 'def_flat')
    expect(assess(item, [baseProfile, bad]).reasonKind).toBe('proven_low_ceiling')
    const relevant = { ...bad, effectUtility: { atk_: 'valid' as const } }
    expect(assess(item, [baseProfile, relevant]).reasonKind).toBe('missing_fact')
  })
  it('reports every material blocker, including profiles outside top three scores', () => {
    const profiles = Array.from(
      { length: 6 },
      (_, i): Profile => ({
        ...baseProfile,
        id: `missing-${i}`,
        agentId: `agent-${i}`,
        effectUtility: {},
        utilityEvidence: {},
      }),
    )
    const result = assess(disc(), profiles)
    expect(new Set(result.blockedBy.map((row) => row.profileId)).size).toBe(6)
  })
  it('ownership, identity, ordering and a stronger copy leave absolute quality unchanged', () => {
    const item = disc()
    const baseline = assess(item)
    const rows = assessWarehouse(
      [disc(['crit_rate', 'crit_dmg', 'def_flat'], 15), { ...item, id: 'renamed' }],
      catalog(),
      policy(),
      { ownedAgentIds: ['agent-test'] },
    )
    const changed = rows[1]!
    expect(changed.reasonKind).toBe(baseline.reasonKind)
    expect(changed.bestUseScore).toBe(baseline.bestUseScore)
    expect(changed.evidence).toEqual(baseline.evidence)
    expect(changed.nextAction).toEqual(baseline.nextAction)
  })
})
