import { describe, expect, it } from 'vitest'
import type { DriveDisc } from '../domain/schemas'
import { createEmptyRoster } from '../assault/catalog'
import { getCandidateWarehouseConstraint } from '../gameDataPacks/candidateWarehouseConstraints'
import { deriveSubStatHistory } from '../evaluation/subStatHistory'
import { analyzeAccountWarehouse } from './discWarehouseAnalysis'
import {
  evaluateDiscEnhancementPotential,
  isConstraintCompatible,
} from './discEnhancementPotential'
import { hasReliableWarehouseDiscRecord } from './warehouseDiscQuality'
import { warehouseClearAlternative } from './discWarehouseAnalysis.testFixtures'

const constraint = getCandidateWarehouseConstraint('agent-billy')!
function roster() {
  const base = createEmptyRoster('2026-10-04T00:00:00.000Z')
  return {
    ...base,
    agents: base.agents.map((agent) => ({ ...agent, owned: agent.agentId === 'agent-billy' })),
  }
}
function fractionalRecord(): DriveDisc {
  const disc = warehouseClearAlternative('fractional-rolls')
  disc.subStats[0] = { stat: 'crit_rate', upgrades: 4.5, value: 13.2 }
  disc.subStats[1] = { stat: 'crit_dmg', upgrades: 0.5, value: 7.2 }
  return disc
}

describe('warehouse invalid-record isolation', () => {
  it.each([
    [1, 'atk_flat'],
    [2, 'hp_flat'],
    [3, 'atk_flat'],
    [0, 'hp_flat'],
    [1.5, 'hp_flat'],
    [7, 'impact'],
  ] as const)(
    'does not declare slot %s / main %s compatible with a sourced build',
    (slot, mainStat) => {
      const disc = {
        ...warehouseClearAlternative('illegal-main'),
        slot: slot as DriveDisc['slot'],
        mainStat,
      }
      expect(isConstraintCompatible(disc, constraint)).toBe(false)
    },
  )

  it('does not classify fractional rolls as a reliable record merely because their sum matches level15', () => {
    const disc = fractionalRecord()
    expect(deriveSubStatHistory(disc).status).toBe('known')
    expect(hasReliableWarehouseDiscRecord(disc)).toBe(false)
  })

  it.each([
    ['illegal-main', { slot: 1, mainStat: 'atk_flat' }],
    ['fractional-slot', { slot: 1.5 }],
    ['fractional-level', { level: 3.5 }],
    ['negative-level', { level: -1 }],
    ['excess-level', { level: 16 }],
    ['unknown-rarity', { rarity: 'C' }],
  ] as const)('keeps %s isolated from cleanup and enhancement evidence', (id, patch) => {
    const disc = { ...warehouseClearAlternative(id), ...patch } as DriveDisc
    const input = { accountId: 'isolated-records', discs: [disc], roster: roster(), drafts: [] }
    const before = structuredClone(input)
    const decision = analyzeAccountWarehouse(input).decisions[0]!
    expect(input).toEqual(before)
    expect(decision.category).not.toBe('cleanup_candidate')
    expect(decision.absoluteRetention?.reasonKind).toBe('invalid_record')
    expect(decision.useAssessment).toMatchObject({ status: 'verify', basis: 'invalid_record' })
    expect(decision.enhancementPotential.potentialEvaluated).toBe(false)
    expect(decision.cleanupSafety.cleanupEvidenceComplete).toBe(false)
  })

  it('does not evaluate an invalid main as a generic replacement objective', () => {
    const disc = {
      ...warehouseClearAlternative('illegal-potential'),
      mainStat: 'atk_flat' as const,
    }
    const result = evaluateDiscEnhancementPotential({
      disc,
      allDiscs: [disc],
      history: deriveSubStatHistory(disc),
      agents: [],
      profileCoverageComplete: true,
    })
    expect(result.potentialEvaluated).toBe(false)
    expect(result.coverageAlternativeIds).toEqual([])
  })

  it('isolates a repeated identity and preserves an unrelated disc decision instead of reserving the warehouse', () => {
    const unrelated = warehouseClearAlternative('unrelated-valid')
    const duplicate = warehouseClearAlternative('duplicate-id')
    const base = { accountId: 'isolated-records', roster: roster(), drafts: [] }
    const isolated = analyzeAccountWarehouse({ ...base, discs: [unrelated] }).decisions[0]!
    const result = analyzeAccountWarehouse({
      ...base,
      discs: [unrelated, duplicate, { ...duplicate }],
    })
    expect(result.decisions[0]!.category).toBe(isolated.category)
    expect(result.decisions[0]!.absoluteRetention).toEqual(isolated.absoluteRetention)
    expect(result.decisions[0]!.useAssessment).toEqual(isolated.useAssessment)
    expect(result.decisions[0]!.enhancementPotential.coverageAlternativeIds).toEqual([])
    expect(
      result.decisions.slice(1).every((decision) => decision.category !== 'cleanup_candidate'),
    ).toBe(true)
    expect(
      result.decisions
        .slice(1)
        .every((decision) => decision.absoluteRetention?.reasonKind === 'invalid_record'),
    ).toBe(true)
  })
})
