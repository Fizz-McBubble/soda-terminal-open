import { describe, expect, it } from 'vitest'
import { createEmptyRoster } from '../assault/catalog'
import { defaultTeamPortfolioPreference } from '../accounts/teamPortfolioPreference'
import type { AccountDecisionQueryInput } from '../application/calculationQueryContract'
import type { DriveDisc } from '../domain/schemas'
import { projectDevelopmentCandidateAlternatives } from './developmentCandidateAlternatives'
import { getCandidateWarehouseConstraint } from '../gameDataPacks/candidateWarehouseConstraints'
import { solveCandidateWarehouse } from '../optimizer/candidateWarehouseSolver'
import { statWeightCalibrationFixture } from './developmentStatWeights.calibrationFixture'
import { history } from '../warehouse/absoluteDiscRetentionScoring'
import {
  absoluteDiscRetentionCatalog,
  toAbsoluteRetentionDisc,
} from '../warehouse/absoluteDiscRetentionCatalog'

function disc(slot: 1 | 2 | 3 | 4 | 5 | 6, id: string): DriveDisc {
  const constraint = getCandidateWarehouseConstraint('agent-billy')!
  const plan = constraint.setPlans![0]!
  return {
    id,
    slot,
    setId: slot <= 4 ? plan.primarySetIds[0]! : plan.secondarySetIds[0]!,
    level: 15,
    mainStat:
      slot === 1
        ? 'hp_flat'
        : slot === 2
          ? 'atk_flat'
          : slot === 3
            ? 'def_flat'
            : constraint.mainStats[String(slot) as '4' | '5' | '6']![0]!,
    subStats: [],
    locked: false,
    favorite: false,
    tags: [],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    dataVersion: '3.1',
  }
}

function input(): AccountDecisionQueryInput {
  const roster = createEmptyRoster('2026-09-01T00:00:00.000Z')
  roster.agents = roster.agents.map((agent) =>
    agent.agentId === 'agent-billy' || agent.agentId === 'agent-anby'
      ? { ...agent, owned: true }
      : agent,
  )
  return {
    warehouse: {
      accountId: 'account-development-query',
      account: null,
      roster,
      discs: Array.from({ length: 12 }, (_, index) =>
        disc(((index % 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6, `disc-${index}`),
      ),
    },
    drafts: [
      {
        scopedId: 'account-development-query:anby-plan',
        accountId: 'account-development-query',
        id: 'anby-plan',
        kind: 'agent',
        name: '安比方案',
        state: 'saved',
        selection: { agentIds: ['agent-anby'], bangbooId: null, scenario: 'general' },
        manualOverrides: {
          wEngineDirection: 'none',
          discDirection: 'none',
          progressionDirection: 'none',
          notes: 'fixture',
        },
        knowledgeRefs: [],
        warehouseRefs: ['disc-0', 'disc-1', 'disc-2', 'disc-3', 'disc-4', 'disc-5'],
        comparisonCapability: 'direction',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
        revision: 1,
      },
    ],
    activePlanIds: { 'agent-anby': 'anby-plan' },
    developmentPriorityAgentIds: ['agent-billy'],
    preference: defaultTeamPortfolioPreference,
  }
}

describe('development candidate alternatives projection', () => {
  it('excludes an illegal legacy slot 5 from source solving and the initial cultivation candidates without rewriting inventory', () => {
    const value = input()
    const calibration = statWeightCalibrationFixture('agent-billy')
    value.warehouse = {
      ...calibration.warehouse,
      discs: calibration.discs.map((item) => ({ ...item, setId: disc(item.slot, item.id).setId })),
    }
    for (const item of value.warehouse.discs)
      expect(() =>
        history(toAbsoluteRetentionDisc(item), absoluteDiscRetentionCatalog.rules),
      ).not.toThrow()
    const legal = value.warehouse.discs.find((item) => item.slot === 5)!
    const illegal: DriveDisc = {
      ...legal,
      id: 'legacy-main-sub-conflict',
      mainStat: 'atk_percent',
      level: 0,
      subStats: [
        { stat: 'atk_percent', value: 3, upgrades: 0 },
        { stat: 'crit_rate', value: 2.4, upgrades: 0 },
        { stat: 'crit_dmg', value: 4.8, upgrades: 0 },
      ],
    }
    value.warehouse.discs.push(illegal)
    const before = JSON.stringify(value.warehouse.discs)
    const plan = solveCandidateWarehouse(value.warehouse.discs, ['agent-billy'], 'agent')
    expect(plan.loadouts).toHaveLength(1)
    expect(plan.loadouts[0]!.discs.find((choice) => choice.disc.slot === 5)!.disc.mainStat).toBe(
      legal.mainStat,
    )
    expect(
      plan.loadouts.flatMap((loadout) => loadout.discs.map((choice) => choice.disc.id)),
    ).not.toContain(illegal.id)
    expect(() =>
      solveCandidateWarehouse(value.warehouse.discs, ['agent-billy'], 'agent', {
        fixedDiscByAgent: { 'agent-billy': illegal.id },
      }),
    ).toThrow('固定盘被排除')
    const projection = projectDevelopmentCandidateAlternatives(value, 'agent-billy')
    expect(projection.status).toBe('ready')
    expect(projection.candidates.length).toBeGreaterThan(0)
    expect(
      projection.candidates.flatMap((candidate) =>
        candidate.loadouts.flatMap((loadout) => loadout.discs.map((choice) => choice.disc.id)),
      ),
    ).not.toContain(illegal.id)
    const onlyIllegal = value.warehouse.discs.filter(
      (item) => item.slot !== 5 || item.id === illegal.id,
    )
    expect(solveCandidateWarehouse(onlyIllegal, ['agent-billy'], 'agent').loadouts).toEqual([])
    expect(JSON.stringify(value.warehouse.discs)).toBe(before)
  })

  it('keeps saved references advisory and solves from the complete warehouse', () => {
    const withSavedReference = input()
    const withoutSavedReference = { ...withSavedReference, drafts: [], activePlanIds: {} }
    const result = projectDevelopmentCandidateAlternatives(withSavedReference, 'agent-billy')
    const control = projectDevelopmentCandidateAlternatives(withoutSavedReference, 'agent-billy')

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('fixture should be queryable')
    expect(result.candidates).toEqual(control.candidates)
    expect(result.candidates[0]?.loadouts[0]?.discs).toHaveLength(6)
    expect(result.baseline).toEqual([])
    expect(result.candidateSearch).toMatchObject({
      rankingMethod: 'source_and_local_refinement',
      productionGameAccuracyCertified: false,
    })
    expect(result.candidateSearch?.status).toBeDefined()
    expect(result.buildIntent).toMatchObject({
      contract: 'soda-build-intent/v1',
      scope: 'agent_independent',
      resourcePolicy: 'advisory',
    })
  })

  it('fails closed for an unowned agent', () => {
    expect(projectDevelopmentCandidateAlternatives(input(), 'agent-nicole')).toMatchObject({
      status: 'unavailable',
      candidates: [],
    })
  })

  it('reports an unavailable result with a reason when the warehouse cannot form six discs', () => {
    const value = input()
    value.warehouse.discs = value.warehouse.discs.filter((disc) => disc.slot !== 6)
    const result = projectDevelopmentCandidateAlternatives(value, 'agent-billy')
    expect(result.status).toBe('unavailable')
    expect(result.candidates).toEqual([])
    expect(result.gaps.length).toBeGreaterThan(0)
  })
})
