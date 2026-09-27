import { describe, expect, it } from 'vitest'
import { projectPublicCalculationResult } from '../application/publicCalculationTransport'
import type {
  AccountDecisionRun,
  TargetTeamWarehouseFitQueryResult,
} from '../application/calculationQueryContract'

/**
 * The browser transport must carry only what real public consumers read. These assertions pin the
 * field lists so a later change cannot silently start shipping the captured snapshot, the account
 * input or the private solve diagnostics again.
 */
describe('browser transport projection', () => {
  const run = {
    runId: 'run-1',
    capturedAt: '2026-09-26T00:00:00.000Z',
    inputFingerprint: 'fnv1a-input',
    claimStatus: 'candidate',
    decisionAuthority: { status: 'ready', recommendationCount: 2, blockers: [] },
    input: { warehouse: { accountId: 'account-1', discs: [{ id: 'd1' }], roster: {} } },
    snapshot: {
      fingerprint: { inputHash: 'fnv1a-input' },
      claims: { overall: { status: 'candidate' } },
      hardConstraints: { active: ['constraint-1'], canRestoreDefault: true },
      portfolioInput: { preference: { teamCount: 2 } },
      allocation: { global: [{ agentId: 'agent-1' }], diagnostics: [] },
      teamEngine: { recommendations: [{ candidateId: 'private' }] },
      warehouse: { decisions: [{ discId: 'private' }] },
    },
    warehouseActions: { status: 'current' },
    developmentDirectory: { contract: 'soda-development-directory/v1' },
    teamPresentation: { contract: 'soda-team-loadout-presentation/v1' },
  } as unknown as AccountDecisionRun

  it('sends only display, validation and save fields for an account decision run', () => {
    const projected = projectPublicCalculationResult('account_decision', run) as Record<
      string,
      unknown
    >
    expect(Object.keys(projected).sort()).toEqual([
      'capturedAt',
      'claimStatus',
      'decisionAuthority',
      'developmentDirectory',
      'inputFingerprint',
      'runId',
      'snapshot',
      'teamPresentation',
      'warehouseActions',
    ])
    expect(projected.input).toBeUndefined()
    expect(projected.inputFingerprint).toBe('fnv1a-input')
    // The captured decision travels as a display subset only: the private research facts stay on
    // the private side.
    const snapshot = projected.snapshot as Record<string, unknown>
    expect(Object.keys(snapshot).sort()).toEqual([
      'allocation',
      'claims',
      'decisionAuthority',
      'fingerprint',
      'hardConstraints',
      'portfolioInput',
      'sideEffect',
    ])
    expect(snapshot.teamEngine).toBeUndefined()
    expect(snapshot.warehouse).toBeUndefined()
    expect((snapshot.hardConstraints as Record<string, unknown>).active).toEqual(['constraint-1'])
    expect(
      ((snapshot.portfolioInput as Record<string, unknown>).preference as Record<string, unknown>)
        .teamCount,
    ).toBe(2)
  })

  it('omits absent projections instead of sending empty properties', () => {
    const bare = {
      ...run,
      warehouseActions: undefined,
      developmentDirectory: undefined,
      teamPresentation: undefined,
    } as unknown as AccountDecisionRun
    const projected = projectPublicCalculationResult('account_decision', bare) as Record<
      string,
      unknown
    >
    expect(Object.keys(projected).sort()).toEqual([
      'capturedAt',
      'claimStatus',
      'decisionAuthority',
      'inputFingerprint',
      'runId',
      'snapshot',
    ])
  })

  it('keeps the solved plan and execution but drops the private solve diagnostics', () => {
    const fit = {
      candidateId: 'candidate-1',
      buildIntent: {
        contract: 'soda-build-intent/v1',
        scope: 'team_joint',
        resourcePolicy: 'within_team_exclusive',
        fingerprint: 'server-computed-fingerprint',
        exactTeam: { candidateId: 'candidate-1', bangbooId: 'bangboo-1', scenarioTags: [] },
        recommendations: [{ agentId: 'agent-1', constraint: { privateRules: [1, 2, 3] } }],
        constraints: { privateWeights: [1, 2, 3] },
      },
      warehousePlan: {
        scope: 'team',
        agentIds: ['agent-1'],
        loadouts: [{ agentId: 'agent-1', discs: [{}] }],
        alternatives: [{ privateSearch: true }],
        totalScore: 1,
        gaps: [],
        solver: {
          method: 'bounded_heuristic',
          exactWithinModel: false,
          domain: 'target_team_three_agents_eighteen_discs',
          search: { privateTrace: true },
        },
        boundary: 'candidate',
      },
      targetExecution: { members: [{ agentId: 'agent-1' }] },
      teamExecutionPresentation: { view: { members: [] } },
      sourceBranchSearch: { status: 'ok', branches: [] },
      cultivationRefinement: { valueBenchmark: { rank: 1 } },
      valueBenchmark: { privateTrace: true },
      accountBoundBenchmark: {
        equipmentModifierProjection: {
          wEngines: [{ passiveStatus: 'supported', privateEffect: 'internal' }],
        },
      },
    } as unknown as TargetTeamWarehouseFitQueryResult
    const projected = projectPublicCalculationResult('target_team_warehouse_fit', fit) as Record<
      string,
      unknown
    >
    expect(projected.warehousePlan).toBeDefined()
    expect(projected.targetExecution).toBeDefined()
    expect(projected.teamExecutionPresentation).toBeDefined()
    expect(projected.sourceBranchSearch).toBeUndefined()
    expect(projected.cultivationRefinement).toBeUndefined()
    expect(projected.valueBenchmark).toBeUndefined()
    expect(projected.buildIntent).toEqual({
      contract: 'soda-build-intent/v1',
      scope: 'team_joint',
      resourcePolicy: 'within_team_exclusive',
      fingerprint: 'server-computed-fingerprint',
      exactTeam: { candidateId: 'candidate-1', bangbooId: 'bangboo-1' },
    })
    const warehousePlan = projected.warehousePlan as Record<string, unknown>
    expect(warehousePlan.alternatives).toEqual([])
    expect(warehousePlan.solver).toEqual({
      method: 'bounded_heuristic',
      exactWithinModel: false,
      domain: 'target_team_three_agents_eighteen_discs',
    })
    expect(projected.accountBoundBenchmark).toEqual({
      equipmentModifierProjection: { wEngines: [{ passiveStatus: 'supported' }] },
    })
  })

  it('allowlists every remaining query kind and keeps saved fingerprints without private intents', () => {
    const views = [
      [
        'team_overview_presentation',
        {
          contract: 'overview',
          runId: 'run-1',
          accountId: 'a',
          inputFingerprint: 'fp',
          context: {},
          overviewModel: {},
        },
      ],
      [
        'team_route_presentation',
        {
          contract: 'route',
          runId: 'run-1',
          accountId: 'a',
          inputFingerprint: 'fp',
          candidateId: 'c',
          team: null,
          targetCandidateId: null,
          automaticBangboo: null,
          playerConfirmableBangbooOptions: [],
          ratingAnalysis: null,
          recommendationScore: null,
          teamRatingLabel: '',
          alternativeTeams: [],
        },
      ],
      [
        'saved_team_plan_replay',
        {
          contract: 'replay',
          runId: 'run-1',
          accountId: 'a',
          inputFingerprint: 'fp',
          planId: 'p',
          planHash: 'hash',
          status: 'ready',
          match: {
            buildIntent: {
              fingerprint: 'original',
              exactTeam: { candidateId: 'c', privateRules: [1] },
              constraints: { privateWeights: [1] },
            },
            effectiveEquipmentParameters: null,
          },
        },
      ],
      [
        'saved_team_solution_components',
        {
          contract: 'components',
          runId: 'run-1',
          accountId: 'a',
          capturedInputFingerprint: 'fp',
          projectedInputHash: 'hash',
          nonPlanningComponents: {},
        },
      ],
      [
        'development_candidate_alternatives',
        {
          contract: 'development',
          runId: 'run-1',
          capturedAt: '',
          inputFingerprint: 'fp',
          accountId: 'a',
          agentId: 'agent-1',
          status: 'ready',
          sideEffect: 'read_only',
          buildIntent: {
            contract: 'intent',
            scope: 'agent_independent',
            fingerprint: 'original',
            constraints: { privateWeights: [1] },
          },
          baseline: [],
          candidates: [],
          gaps: [],
        },
      ],
      [
        'development_workbench_route',
        {
          contract: 'workbench',
          runId: 'run-1',
          accountId: 'a',
          inputFingerprint: 'fp',
          selection: {},
          status: 'ready',
          selectedDiscFingerprint: null,
          source: null,
          panel: null,
          setRecommendations: [],
          recordedEvaluation: null,
          discFacts: [],
          workbench: null,
          graduationPanel: [],
        },
      ],
      [
        'warehouse_disc_transition_uses',
        {
          runId: 'run-1',
          inputFingerprint: 'fp',
          discId: 'd',
          accountId: 'a',
          sideEffect: 'read_only',
          checkedAgentCount: 0,
          uses: [],
        },
      ],
    ] as const
    for (const [kind, view] of views) {
      const projected = projectPublicCalculationResult(kind, {
        ...view,
        privateMarker: 'never-on-wire',
      }) as Record<string, unknown>
      expect(projected.privateMarker).toBeUndefined()
      if (kind === 'saved_team_plan_replay') {
        expect(projected.match).toEqual({
          buildIntent: { fingerprint: 'original', exactTeam: { candidateId: 'c' } },
          effectiveEquipmentParameters: null,
        })
      }
      if (kind === 'development_candidate_alternatives')
        expect(projected.buildIntent).toEqual({
          contract: 'intent',
          scope: 'agent_independent',
          fingerprint: 'original',
        })
    }
  })
})
