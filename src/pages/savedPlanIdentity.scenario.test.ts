import { describe, expect, it } from 'vitest'
import type { AccountPlanningDraft } from '../accounts/types'
import type { TargetTeamWarehouseFitQueryResult } from '../application/calculationQueryContract'
import {
  resolveSavedPlanScenarioSelection,
  savedTeamDiscAssignmentFingerprint,
  savedTeamTargetFitMatchesSavedDiscs,
} from './savedPlanIdentity'

const memberIds = ['agent-anby', 'agent-billy', 'agent-nicole']

function makeDiscs(prefix: string) {
  return Array.from({ length: 6 }, (_, index) => `${prefix}-disc-${index + 1}`)
}

function makeMockPlan(
  scenarioSelection?: import('../application/publicPlanningScenarioContract').CurrentPlanningScenarioSelection32,
  scenarioIdentity?: string,
): AccountPlanningDraft {
  const loadouts = memberIds.map((agentId) => ({
    agentId,
    discIds: makeDiscs(agentId),
    totalScore: 100,
    effectiveRolls: 24,
    setPattern: '4+2' as const,
    degraded: false,
  }))
  const members = memberIds.map((agentId) => ({
    agentId,
    suggested: {
      discIds: makeDiscs(agentId),
    },
  }))
  return {
    scopedId: 'acc:plan-1',
    accountId: 'acc',
    id: 'plan-1',
    kind: 'team',
    name: '测试队伍方案',
    state: 'saved',
    comparisonCapability: 'direction',
    createdAt: '2026-10-13T00:00:00Z',
    updatedAt: '2026-10-13T00:00:00Z',
    revision: 1,
    selection: {
      agentIds: memberIds,
      bangbooId: null,
      scenario: 'default',
    },
    manualOverrides: {
      wEngineDirection: '',
      discDirection: '',
      progressionDirection: '',
      notes: '',
    },
    knowledgeRefs: [],
    warehouseRefs: loadouts.flatMap((l) => l.discIds),
    candidateWarehouse: {
      scope: 'team',
      totalScore: 300,
      loadouts,
      boundary: 'Synthetic identity-only fixture.',
    },
    teamExecutionSnapshot: {
      members: members as unknown as NonNullable<
        AccountPlanningDraft['teamExecutionSnapshot']
      >['members'],
    } as NonNullable<AccountPlanningDraft['teamExecutionSnapshot']>,
    solutionContext: {
      contract: 'soda-solution-context/v1',
      scope: 'team_joint',
      resourcePolicy: 'within_team_exclusive',
      sourceCandidateId: 'cand-1',
      inputFingerprint: 'fp-1',
      solverMethod: 'exact',
      gameVersion: '1.2.0',
      knowledgeVersion: 'kv-1',
      exactVariantKey: null,
      ...(scenarioSelection ? { scenarioSelection } : {}),
      ...(scenarioIdentity ? { scenarioIdentity } : {}),
    },
  } as AccountPlanningDraft
}

function makeMockFit(
  scenarioSelection?: import('../application/publicPlanningScenarioContract').CurrentPlanningScenarioSelection32,
  scenarioIdentity?: string,
): TargetTeamWarehouseFitQueryResult {
  return {
    candidateId: 'cand-1',
    scenarioSelection,
    scenarioIdentity,
    warehousePlan: {
      loadouts: memberIds.map((agentId) => ({
        agentId,
        discs: makeDiscs(agentId).map((id) => ({ disc: { id } })),
      })),
    } as unknown as TargetTeamWarehouseFitQueryResult['warehousePlan'],
    effectiveEquipmentParameters: null,
    targetExecution: {} as unknown as TargetTeamWarehouseFitQueryResult['targetExecution'],
    accountBoundBenchmark:
      {} as unknown as TargetTeamWarehouseFitQueryResult['accountBoundBenchmark'],
    cultivationRefinement:
      {} as unknown as TargetTeamWarehouseFitQueryResult['cultivationRefinement'],
    valueBenchmark: {} as unknown as TargetTeamWarehouseFitQueryResult['valueBenchmark'],
  } as TargetTeamWarehouseFitQueryResult
}

describe('savedPlanIdentity scenario validation and compatibility', () => {
  it('resolves legacy absent selection and rejects explicit null', () => {
    expect(resolveSavedPlanScenarioSelection(undefined)).toEqual({
      schemaVersion: 1,
      id: 'normalized-comparison',
    })
    expect(() => resolveSavedPlanScenarioSelection(null)).toThrow('不支持或未知')
  })

  it('strictly validates scenario object and rejects unknown id or schemaVersion without fallback', () => {
    expect(() =>
      resolveSavedPlanScenarioSelection({
        schemaVersion: 1,
        id: 'future-boss-scenario',
      } as unknown as import('../application/publicPlanningScenarioContract').CurrentPlanningScenarioSelection32),
    ).toThrow('不支持或未知的规划场景')

    expect(() =>
      resolveSavedPlanScenarioSelection({
        schemaVersion: 2,
        id: 'normalized-comparison',
      } as unknown as import('../application/publicPlanningScenarioContract').CurrentPlanningScenarioSelection32),
    ).toThrow('不支持或未知的规划场景')

    expect(() =>
      resolveSavedPlanScenarioSelection({
        schemaVersion: 1,
        id: 'normalized-comparison',
        extraKey: true,
      } as unknown as import('../application/publicPlanningScenarioContract').CurrentPlanningScenarioSelection32),
    ).toThrow('不支持或未知的规划场景')
  })

  it('allows legacy plan without scenario fields to match legacy normal fit and normalized fit', () => {
    const legacyPlan = makeMockPlan()
    const legacyFit = makeMockFit()
    const normalizedFit = makeMockFit({ schemaVersion: 1, id: 'normalized-comparison' })

    expect(savedTeamTargetFitMatchesSavedDiscs(legacyPlan, legacyFit)).toBe(true)
    expect(savedTeamTargetFitMatchesSavedDiscs(legacyPlan, normalizedFit)).toBe(true)
  })

  it('rejects match when legacy normal plan is compared against declared-stun-comparison fit', () => {
    const legacyPlan = makeMockPlan()
    const stunFit = makeMockFit(
      { schemaVersion: 1, id: 'declared-stun-comparison' },
      'stun-identity-hash',
    )

    expect(savedTeamTargetFitMatchesSavedDiscs(legacyPlan, stunFit)).toBe(false)
  })

  it('rejects match when stun plan is compared against legacy normal fit or normalized fit', () => {
    const stunPlan = makeMockPlan(
      { schemaVersion: 1, id: 'declared-stun-comparison' },
      'stun-identity-hash',
    )
    const legacyFit = makeMockFit()
    const normalizedFit = makeMockFit({ schemaVersion: 1, id: 'normalized-comparison' })

    expect(savedTeamTargetFitMatchesSavedDiscs(stunPlan, legacyFit)).toBe(false)
    expect(savedTeamTargetFitMatchesSavedDiscs(stunPlan, normalizedFit)).toBe(false)
  })

  it('matches stun plan against matching stun fit with same scenarioIdentity', () => {
    const stunPlan = makeMockPlan(
      { schemaVersion: 1, id: 'declared-stun-comparison' },
      'stun-identity-hash',
    )
    const stunFit = makeMockFit(
      { schemaVersion: 1, id: 'declared-stun-comparison' },
      'stun-identity-hash',
    )

    expect(savedTeamTargetFitMatchesSavedDiscs(stunPlan, stunFit)).toBe(true)
  })

  it('rejects stun plan when stun fit has mismatched or missing scenarioIdentity', () => {
    const stunPlan = makeMockPlan(
      { schemaVersion: 1, id: 'declared-stun-comparison' },
      'stun-identity-hash',
    )
    const mismatchedFit = makeMockFit(
      { schemaVersion: 1, id: 'declared-stun-comparison' },
      'different-stun-identity',
    )
    const missingIdentityFit = makeMockFit({
      schemaVersion: 1,
      id: 'declared-stun-comparison',
    })

    expect(savedTeamTargetFitMatchesSavedDiscs(stunPlan, mismatchedFit)).toBe(false)
    expect(savedTeamTargetFitMatchesSavedDiscs(stunPlan, missingIdentityFit)).toBe(false)
    expect(
      savedTeamTargetFitMatchesSavedDiscs(
        makeMockPlan({ schemaVersion: 1, id: 'declared-stun-comparison' }),
        mismatchedFit,
      ),
    ).toBe(false)
  })

  it('produces distinct disc assignment fingerprints for normal vs stun comparison', () => {
    const normalPlan = makeMockPlan({ schemaVersion: 1, id: 'normalized-comparison' })
    const stunPlan = makeMockPlan(
      { schemaVersion: 1, id: 'declared-stun-comparison' },
      'stun-identity-hash',
    )
    const legacyPlan = makeMockPlan()

    const normalFingerprint = savedTeamDiscAssignmentFingerprint(normalPlan)
    const stunFingerprint = savedTeamDiscAssignmentFingerprint(stunPlan)
    const legacyFingerprint = savedTeamDiscAssignmentFingerprint(legacyPlan)

    expect(stunFingerprint).not.toBe(normalFingerprint)
    expect(stunFingerprint).not.toBe(legacyFingerprint)
    // Legacy plan resolves to normalized comparison, so its fingerprint matches explicit normal
    expect(legacyFingerprint).toBe(normalFingerprint)
  })
})
