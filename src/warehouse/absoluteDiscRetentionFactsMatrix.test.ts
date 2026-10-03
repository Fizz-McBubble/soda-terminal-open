import { describe, expect, it } from 'vitest'
import { getCandidateWarehouseConstraint } from '../gameDataPacks/candidateWarehouseConstraints'
import {
  absoluteDiscRetentionCatalog,
  absoluteDiscRetentionPolicy,
} from './absoluteDiscRetentionCatalog'
import { assessDisc, twoPieceApplicability } from './absoluteDiscRetentionKernel'
import { resolveRetentionUseFacts } from './absoluteDiscRetentionUseFacts'
import {
  resolveRetentionQualityWeights,
  retentionWeightPolicyId,
} from './absoluteDiscRetentionWeights'

const constraint = (id: string) => {
  const value = getCandidateWarehouseConstraint(id)
  expect(value, `adopted build constraint: ${id}`).toBeDefined()
  return value!
}
const facts = (id: string) => resolveRetentionUseFacts(constraint(id), id)
const profiles = (id: string) =>
  absoluteDiscRetentionCatalog.profiles.filter((row) => row.agentId === id)

describe('production adopted-fact matrix', () => {
  it.each([
    ['set-phaethons-melody', 'impact', 'cleanup_candidate'],
    ['set-polar-metal', 'energy_regen', 'keep'],
  ])(
    'resolves independent use conditions before granting %s a ready %s function',
    (setId, mainStat, expected) => {
      const result = assessDisc(
        {
          id: 'synthetic-conditional-function',
          setId,
          slot: 6,
          rarity: 'S',
          level: 15,
          mainStat,
          subStats: [
            { stat: 'def_flat', value: 90, upgrades: 5 },
            { stat: 'hp_percent', value: 3, upgrades: 0 },
            { stat: 'crit_rate', value: 2.4, upgrades: 0 },
            { stat: 'crit_dmg', value: 4.8, upgrades: 0 },
          ],
        },
        absoluteDiscRetentionCatalog,
        absoluteDiscRetentionPolicy,
      )
      expect(result.qualityDisposition).toBe(expected)
      expect(result.reasonKind).toBe(
        expected === 'review'
          ? 'conditional_use'
          : expected === 'cleanup_candidate'
            ? 'no_supported_use'
            : 'functional_ready',
      )
      expect(result.nextAction).toMatchObject({
        kind:
          expected === 'review'
            ? 'check_condition'
            : expected === 'cleanup_candidate'
              ? 'manual_cleanup'
              : 'keep',
        targetLevel: null,
      })
      expect(result.blockedBy.some((row) => row.kind === 'conditional_use')).toBe(
        expected === 'review',
      )
      if (expected === 'cleanup_candidate') {
        // AM 2pc is incidental to these impact builds; main-only functionality
        // cannot make an incompatible set relevant. No source-supported 4pc branch exists.
        expect(
          result.evidence
            .filter((row) => row.functionalState === 'ready')
            .every((row) => row.setFit === 'incompatible'),
        ).toBe(true)
        return
      }
      expect(result.witnessProfileIds.length).toBeGreaterThan(0)
      for (const id of result.witnessProfileIds) {
        expect(result.evidence.find((row) => row.profileId === id)).toMatchObject({
          useState: expected === 'review' ? 'conditional' : 'valid',
          functionalState: 'ready',
        })
      }
    },
  )

  it('retains all 30 set identities while equal two-piece families share only effect utility', () => {
    const sets = absoluteDiscRetentionCatalog.sets
    expect(sets).toHaveLength(30)
    expect(new Set(sets.map((row) => row.id)).size).toBe(30)
    const families = new Map<string, typeof sets>()
    for (const set of sets) {
      expect(set.verified).toBe(true)
      expect(set.sourceIds.length).toBeGreaterThan(0)
      const key = JSON.stringify(set.twoPieceEffects)
      families.set(key, [...(families.get(key) ?? []), set])
    }
    const duplicates = [...families.values()].filter((group) => group.length > 1)
    expect(duplicates.length).toBeGreaterThan(0)
    for (const group of duplicates)
      for (const profile of absoluteDiscRetentionCatalog.profiles) {
        expect(new Set(group.map((set) => twoPieceApplicability(set, profile))).size).toBe(1)
      }
    const swing = sets.find((row) => row.id === 'set-swing-jazz')!
    const moon = sets.find((row) => row.id === 'set-moonlight-lullaby')!
    expect(swing.twoPieceEffects).toEqual(moon.twoPieceEffects)
    expect(
      absoluteDiscRetentionCatalog.profiles.some(
        (row) => row.fourPieceUses?.[swing.id] !== row.fourPieceUses?.[moon.id],
      ),
    ).toBe(true)
  })
  it.each([
    ['agent-ellen', 'crit_damage', 'atk_percent', 'atk_'],
    ['agent-manato', 'crit_damage', 'hp_percent', 'hp_'],
    ['agent-ben', 'crit_damage', 'def_percent', 'def_'],
    ['agent-grace', 'anomaly_damage', 'anomaly_proficiency', 'anomProf'],
    ['agent-jane', 'anomaly_damage', 'anomaly_proficiency', 'anomProf'],
  ])('uses sourced %s goal %s and scaling route %s', (id, goal, stat, effect) => {
    const resolved = facts(id!)
    expect(resolved.goal).toBe(goal)
    expect(resolved.scalingStats).toContain(stat)
    expect(resolved.effects[effect!]!.state).toBe('valid')
    expect(resolved.effects[effect!]!.evidenceIds.length).toBeGreaterThan(0)
    const quality = resolveRetentionQualityWeights(constraint(id!), id!, resolved)
    expect(quality.weights[stat!]).toBeGreaterThan(0)
    expect(quality.weightEvidence.id).toBe(retentionWeightPolicyId)
    expect(quality.weightEvidence.method).toBe('goal_bound_standard_roll_quality_proxy')
  })
  it('Jane Assault crit reads AP and core skill, rather than CR/CD quality targets', () => {
    const resolved = facts('agent-jane')
    for (const effect of ['crit_', 'crit_dmg_']) {
      expect(resolved.effects[effect]!.state).toBe('incidental')
      expect(resolved.effects[effect]!.predicateId).toBe('special_anomaly_crit_uses_proficiency')
    }
    const quality = resolveRetentionQualityWeights(constraint('agent-jane'), 'agent-jane', resolved)
    expect(quality.weights.anomaly_proficiency).toBe(1)
    expect(quality.coreStats).toContain('anomaly_proficiency')
    expect(quality.coreStats).not.toContain('crit_rate')
    expect(quality.coreStats).not.toContain('crit_dmg')
    expect(quality.weights.crit_rate ?? 0).toBe(0)
    expect(quality.weights.crit_dmg ?? 0).toBe(0)
  })
  it.each([
    ['agent-nicole', 'energy_regen'],
    ['agent-anby', 'impact'],
    ['agent-grace', 'anomaly_mastery'],
  ])('%s has a source-backed main-only %s function', (id, stat) => {
    const mains = profiles(id!)
      .flatMap((row) => row.functionalMains ?? [])
      .filter((row) => row.stat === stat)
    expect(mains.length).toBeGreaterThan(0)
    expect(
      mains.every(
        (row) => row.slot >= 4 && row.completion === 'main_only' && Boolean(row.sourceId),
      ),
    ).toBe(true)
  })
  it('shield capacity follows active mechanics rather than the defense job label', () => {
    expect(facts('agent-caesar').effects.shield_!.state).toBe('valid')
    expect(facts('agent-ben').effects.shield_!.state).toBe('valid')
    const noShield = resolveRetentionUseFacts(
      {
        ...constraint('agent-ben'),
        agentId: 'agent-unmapped-defense',
        progressionDirection: ['防护职业；队友提供护盾，本人不生成护盾'],
      },
      'agent-unmapped-defense',
    )
    expect(noShield.effects.shield_!.state).toBe('incompatible')
    expect(noShield.effects.shield_!.predicateId).toBe('no_shield_mechanic_in_kit')
  })
  it('ordinary buttons do not prove a primary action damage channel', () => {
    const support = facts('agent-nicole')
    expect(support.actions.basic!.state).toBe('incidental')
    expect(support.actions.dash!.state).toBe('incidental')
    expect(support.actions.aftershock!.state).toBe('incompatible')
    expect(facts('agent-ellen').actions.basic!.state).toBe('valid')
    expect(facts('agent-soldier-0-anby').actions.aftershock!.state).toBe('valid')
    expect(facts('agent-harumasa').actions.dash!.state).toBe('valid')
  })
  it('penetration ratio use does not grant flat PEN primary-quality weight', () => {
    const resolved = facts('agent-rina')
    expect(resolved.effects.pen_!.state).toBe('valid')
    const quality = resolveRetentionQualityWeights(constraint('agent-rina'), 'agent-rina', resolved)
    expect(quality.weights.pen ?? 0).toBe(0)
    expect(
      profiles('agent-rina')
        .flatMap((row) => row.functionalMains ?? [])
        .some((row) => row.stat === 'pen_ratio' && row.completion === 'build_threshold'),
    ).toBe(true)
    expect(facts('agent-yidhari').effects.pen_!.state).toBe('incompatible')
  })
  it.each([
    ['agent-billy', 'physical_dmg_'],
    ['agent-soldier-11', 'fire_dmg_'],
    ['agent-ellen', 'ice_dmg_'],
    ['agent-grace', 'electric_dmg_'],
    ['agent-zhu-yuan', 'ether_dmg_'],
    ['agent-miyabi', 'ice_dmg_'],
    ['agent-yixuan', 'ether_dmg_'],
  ])('%s follows adopted ordinary/special elemental channel %s', (id, matching) => {
    const resolved = facts(id!)
    for (const key of [
      'physical_dmg_',
      'fire_dmg_',
      'ice_dmg_',
      'electric_dmg_',
      'ether_dmg_',
      'wind_dmg_',
    ])
      expect(resolved.effects[key]!.state, `${id}:${key}`).toBe(
        key === matching ? 'valid' : 'incompatible',
      )
    expect(resolved.effects[matching!]!.evidenceIds.length).toBeGreaterThan(0)
  })
  it('numeric quality proxies follow source goal and ignore guide array/text order', () => {
    const original = constraint('agent-ellen')
    const swapped = {
      ...original,
      subStatWeights: Object.fromEntries(
        Object.keys(original.subStatWeights)
          .reverse()
          .map((key) => [key, 0.01]),
      ),
      progressionDirection: [...original.progressionDirection].reverse(),
    }
    const first = resolveRetentionQualityWeights(
      original,
      'agent-ellen',
      resolveRetentionUseFacts(original, 'agent-ellen'),
    )
    const second = resolveRetentionQualityWeights(
      swapped,
      'agent-ellen',
      resolveRetentionUseFacts(swapped, 'agent-ellen'),
    )
    expect(second.weights).toEqual(first.weights)
    expect(new Set(second.coreStats)).toEqual(new Set(first.coreStats))
    expect(first.weights.crit_rate).toBe(1)
    expect(first.weights.crit_dmg).toBe(1)
    expect(first.weights.atk_percent).toBe(0.75)
    expect(first.weightEvidence.sourceIds.length).toBeGreaterThan(0)
  })
})
