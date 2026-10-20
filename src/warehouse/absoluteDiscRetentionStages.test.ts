import { describe, expect, it } from 'vitest'
import type { Profile } from './absoluteDiscRetentionContract'
import { noFunctionalSubstatGoalMethod } from './absoluteDiscRetentionContract'
import { assessDisc, assessWarehouse, twoPieceApplicability } from './absoluteDiscRetentionKernel'
import { scoreProfile } from './absoluteDiscRetentionScoring'
import { enrichRetentionEvidence } from './absoluteDiscRetentionStages'
import {
  assess,
  baseProfile,
  catalog,
  disc,
  policy,
  rules,
} from './absoluteDiscRetentionStagesFixture'

describe('independent staged retention contract', () => {
  const uncertainProfile = (weight: number, state: 'conditional' | 'missing_fact'): Profile => ({
    ...baseProfile,
    weights: { ...baseProfile.weights, hp_percent: weight },
    qualityInputEvidence: {
      hp_percent: {
        state,
        predicateId: 'synthetic-hp-input',
        detail: 'Synthetic unconfirmed HP benefit',
        evidenceIds: ['synthetic-build'],
      },
    },
  })
  it.each(['conditional', 'missing_fact'] as const)(
    'keeps a fixed normalization %s dependency at every four-line enhancement stage',
    (state) => {
      const profile = uncertainProfile(0.5, state)
      for (const level of [0, 3, 6, 9, 12, 15]) {
        const item = disc(['crit_rate', 'crit_dmg', 'atk_percent', 'def_flat'], level, 4)
        const result = assess(item, [profile])
        const evidence = result.evidence[0]!
        const resolved = assess(item, [{ ...profile, qualityInputEvidence: {} }]).evidence[0]!
        expect(evidence.currentScore).toBe(resolved.currentScore)
        expect(evidence.maximumRaw).toBe(resolved.maximumRaw)
        expect(evidence.possibleFinalScore).toEqual(resolved.possibleFinalScore)
        expect(evidence.useState).toBe(state === 'conditional' ? 'conditional' : 'missing_fact')
        expect(evidence.blockers[0]!.detail).toContain('固定品质标尺的理想分母')
        expect(evidence.blockers).toContainEqual(
          expect.objectContaining({
            field: 'qualityInput.hp_percent',
            kind: state === 'conditional' ? 'conditional_use' : 'missing_fact',
          }),
        )
        expect(result.nextAction.kind).not.toBe('try_upgrade')
      }
    },
  )
  it('ignores unreachable unknown inputs proven irrelevant to the fixed normalization', () => {
    const profile: Profile = {
      ...uncertainProfile(0.1, 'missing_fact'),
      weights: { ...baseProfile.weights, def_flat: 0.5, hp_percent: 0.1 },
    }
    for (const level of [0, 3, 12, 15]) {
      const item = disc(['crit_rate', 'crit_dmg', 'atk_percent', 'def_flat'], level, 4)
      const result = assess(item, [profile])
      const resolved = assess(item, [{ ...profile, qualityInputEvidence: {} }])
      expect(result.evidence[0]!.useState).toBe('valid')
      expect(result.evidence[0]!.blockers).toEqual([])
      expect(result.reasonKind).toBe(resolved.reasonKind)
      expect(result.nextAction).toEqual(resolved.nextAction)
      expect(result.evidence[0]!.maximumRaw).toBe(resolved.evidence[0]!.maximumRaw)
    }
    // The same input can still be revealed when a legal fourth line remains.
    expect(
      assess(disc(['crit_rate', 'crit_dmg', 'atk_percent']), [profile]).evidence[0],
    ).toMatchObject({
      useState: 'missing_fact',
      blockers: [expect.objectContaining({ field: 'qualityInput.hp_percent' })],
    })
    // It also remains material once present, even when it cannot change normalization.
    expect(
      assess(disc(['crit_rate', 'crit_dmg', 'hp_percent', 'def_flat'], 15, 4), [profile])
        .evidence[0],
    ).toMatchObject({
      useState: 'missing_fact',
      blockers: [expect.objectContaining({ field: 'qualityInput.hp_percent' })],
    })
  })
  it('does not hide mutually replacing uncertain normalization inputs', () => {
    const profile: Profile = {
      ...uncertainProfile(0.5, 'missing_fact'),
      weights: { ...baseProfile.weights, def_percent: 0.5, hp_percent: 0.5 },
      qualityInputEvidence: {
        ...uncertainProfile(0.5, 'missing_fact').qualityInputEvidence,
        def_percent: {
          state: 'conditional',
          predicateId: 'synthetic-def-input',
          detail: 'Synthetic DEF condition',
          evidenceIds: ['synthetic-build'],
        },
      },
    }
    const item = disc(['crit_rate', 'crit_dmg', 'atk_percent', 'def_flat'], 15, 4)
    const result = assess(item, [profile]).evidence[0]!
    expect(result.blockers.map((row) => row.field).sort()).toEqual([
      'qualityInput.def_percent',
      'qualityInput.hp_percent',
    ])
    const withoutHp = { ...profile, weights: { ...profile.weights, hp_percent: 0 } }
    expect(scoreProfile(item, withoutHp, catalog().sets[0], rules, policy()).maximumRaw).toBe(
      result.maximumRaw,
    )
    const withoutEither = { ...profile, weights: { ...baseProfile.weights } }
    expect(
      scoreProfile(item, withoutEither, catalog().sets[0], rules, policy()).maximumRaw,
    ).toBeLessThan(result.maximumRaw)
  })
  it('keeps an uncalibrated numeric weight veto after the last enhancement', () => {
    const profile: Profile = {
      ...baseProfile,
      weightEvidence: { ...baseProfile.weightEvidence!, method: 'uncalibrated_direction_only' },
    }
    expect(
      assess(disc(['crit_rate', 'crit_dmg', 'atk_percent', 'def_flat'], 15, 4), [profile])
        .evidence[0],
    ).toMatchObject({
      useState: 'missing_fact',
      blockers: [expect.objectContaining({ field: 'numericWeights' })],
    })
  })
  it('a sourced absence of a substat goal does not block unrelated cleanup', () => {
    const profile: Profile = {
      ...baseProfile,
      goal: 'functional',
      weights: {},
      coreStats: [],
      weightEvidence: {
        id: 'sourced-negative-goal',
        method: noFunctionalSubstatGoalMethod,
        sourceIds: ['synthetic-build'],
      },
    }
    const item = disc(['def_flat', 'hp_percent', 'pen'])
    expect(assess(item, [profile]).evidence[0]!.investment.qualified).toBe(false)
    expect(assess(item, [profile]).reasonKind).not.toBe('missing_fact')
    for (const incomplete of [
      { ...profile, weightEvidence: { ...profile.weightEvidence!, method: 'unknown' } },
      { ...profile, weightEvidence: { ...profile.weightEvidence!, sourceIds: [] } },
      { ...profile, weights: { crit_rate: 1 } },
      { ...profile, coreStats: ['crit_rate'] },
    ]) {
      const result = enrichRetentionEvidence({
        disc: item,
        profile: incomplete,
        set: catalog().sets[0],
        rules,
        policy: { ...policy([incomplete]), investment: undefined },
        mainFit: 'valid',
        twoPieceFit: 'valid',
        fourPieceFit: 'incompatible',
        setFit: 'valid',
        currentScore: 0,
        possibleUpper: 0,
        remainingNodes: 5,
      })
      expect(result.investment.qualified).toBeNull()
    }
    for (const completion of ['main_only', 'build_threshold'] as const) {
      const functional: Profile = {
        ...profile,
        functionalMains: [
          { slot: 4, stat: 'energy_regen', sourceId: 'synthetic-build', completion },
        ],
      }
      const result = assess({ ...item, slot: 4, mainStat: 'energy_regen' }, [functional])
      expect(result.evidence[0]!.investment.qualified).toBe(
        completion === 'main_only' ? true : null,
      )
    }
  })
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
    expect(
      assess(item, [{ ...relevant, verified: false, availability: 'conditional' }]).reasonKind,
    ).toBe('missing_fact')
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
