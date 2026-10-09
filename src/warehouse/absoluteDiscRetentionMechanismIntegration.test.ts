import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEmptyRoster } from '../assault/catalog'
import * as mechanics from '../calculation/currentAgentMechanicContracts'
import { getCandidateWarehouseConstraint } from '../gameDataPacks/candidateWarehouseConstraints'
import { resolveRetentionUseFacts } from './absoluteDiscRetentionUseFacts'
import { resolveRetentionQualityWeights } from './absoluteDiscRetentionWeights'
import { absoluteDiscRetentionCatalog } from './absoluteDiscRetentionCatalog'
import { sourcedFunctionalMains } from './absoluteDiscRetentionFunctions'
import { analyzeAccountWarehouse } from './discWarehouseAnalysis'
import { warehouseAnalysisRuleVersion } from './warehousePolicyVersion'
import type { DriveDisc } from '../domain/schemas'

afterEach(() => vi.restoreAllMocks())

const quality = (agentId: string) => {
  const constraint = getCandidateWarehouseConstraint(agentId)!
  return resolveRetentionQualityWeights(
    constraint,
    agentId,
    resolveRetentionUseFacts(constraint, agentId),
  )
}

describe('warehouse quality consumes the adopted game mechanisms', () => {
  // Independent arithmetic from the pinned character JSON, not the production
  // panel or weight resolver. Level60, promotion5; no weapon/core assumptions.
  it.each([
    ['agent-billy', 'atk_flat', 19, 3, 113 + 6.7335 * 59 + 202],
    ['agent-claret', 'def_flat', 15, 4.8, 35 + 4.8155 * 59 + 122],
    ['agent-ben', 'def_flat', 15, 4.8, 58 + 7.8989 * 59 + 200],
    ['agent-yixuan', 'hp_flat', 112, 3, 673 + 84.2519 * 59 + 2310],
  ] as const)('uses all five promotions for %s %s', (id, stat, flat, percent, base) => {
    const result = quality(id)
    const expected = Math.round(((0.75 * flat) / ((base * percent) / 100)) * 1e6) / 1e6
    expect(result.weights[stat]).toBe(expected)
    expect(result.weightEvidence.sourceIds.length).toBeGreaterThan(0)
  })

  it('does not turn an absent promotion record into a zero-benefit flat stat', () => {
    const id = 'agent-billy'
    const constraint = getCandidateWarehouseConstraint(id)!
    const facts = resolveRetentionUseFacts(constraint, id)
    const original = mechanics.getCurrentAgentEventContract(id)!
    vi.spyOn(mechanics, 'getCurrentAgentEventContract').mockReturnValue({
      ...original,
      promotionStats: [],
    })
    const result = resolveRetentionQualityWeights(constraint, id, facts)
    expect(result.weights.atk_flat).toBeGreaterThan(0)
    expect(result.qualityInputEvidence.atk_flat?.state).toBe('missing_fact')
    expect(result.weightEvidence.method).toBe('uncalibrated_direction_only')
  })

  it('connects Ben shield generation without promoting Seth shield cap or receiver AP', () => {
    const ben = getCandidateWarehouseConstraint('agent-ben')!
    const mains = sourcedFunctionalMains(ben, ben.agentId, [], 'test-guide', 'crit_damage')
    expect(mains).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stat: 'def_percent',
          completion: 'main_only',
          sourceId: expect.stringContaining('mechanic-function:agent-ben:core_shield:'),
        }),
      ]),
    )
    expect(mains.every((main) => main.slot >= 4)).toBe(true)
    const seth = getCandidateWarehouseConstraint('agent-seth')!
    const sethMains = sourcedFunctionalMains(seth, seth.agentId, [], 'test-guide', 'functional')
    const attackMains = sethMains.filter((main) => main.stat === 'atk_percent')
    expect(attackMains.length).toBeGreaterThan(0)
    expect(attackMains.every((main) => main.completion === 'build_threshold')).toBe(true)
    expect(sethMains.some((main) => main.stat === 'anomaly_proficiency')).toBe(false)
  })

  it('updates actual cleanup consumption and invalidation while preserving account independence', () => {
    const date = '2026-10-09T00:00:00.000Z'
    const disc: DriveDisc = {
      id: 'synthetic-ben-shield-disc',
      slot: 6,
      setId: 'set-soul-rock',
      rarity: 'S',
      level: 15,
      mainStat: 'def_percent',
      subStats: [
        { stat: 'hp_flat', value: 112, upgrades: 0 },
        { stat: 'hp_percent', value: 3, upgrades: 0 },
        { stat: 'atk_flat', value: 19, upgrades: 0 },
        { stat: 'anomaly_proficiency', value: 54, upgrades: 5 },
      ],
      locked: false,
      favorite: false,
      tags: [],
      createdAt: date,
      updatedAt: date,
      dataVersion: '3.2',
    }
    const roster = createEmptyRoster(date)
    const input = { accountId: 'synthetic-quality-consumer', discs: [disc], roster, drafts: [] }
    const before = JSON.stringify(input)
    const snapshot = analyzeAccountWarehouse(input)
    expect(JSON.stringify(input)).toBe(before)
    expect(snapshot.ruleVersion).toBe(warehouseAnalysisRuleVersion)
    expect(snapshot.dataVersion).toBe(
      `${absoluteDiscRetentionCatalog.assessmentGameVersion}-candidate-warehouse`,
    )
    const result = snapshot.decisions[0]!
    expect(result.category).toBe('targeted_keep')
    expect(result.absoluteRetention?.reasonKind).toBe('functional_ready')
    expect(
      result.absoluteRetention?.witnessProfileIds?.some((id) => id.startsWith('agent-ben:')),
    ).toBe(true)
    expect(result.cleanupSafety.cleanupEvidenceComplete).toBe(false)
    const ben = roster.agents.find((agent) => agent.agentId === 'agent-ben')!
    ben.owned = true
    const owned = analyzeAccountWarehouse(input).decisions[0]!
    expect(owned.absoluteRetention?.bestUseScore).toBe(result.absoluteRetention?.bestUseScore)
    expect(owned.absoluteRetention?.disposition).toBe(result.absoluteRetention?.disposition)
    expect(
      absoluteDiscRetentionCatalog.profiles.some((profile) => profile.agentId === ben.agentId),
    ).toBe(true)
  })
})
