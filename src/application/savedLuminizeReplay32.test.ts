import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AccountPlanningDraft } from '../accounts/types'
import type { AccountDecisionRun } from './calculationQueryContract'
import { createSavedDeclaredLuminizeSettlement32 } from '../accounts/luminizePlanPersistence32'
import { savedDeclaredLuminizeSettlement32Schema } from '../accounts/luminizeSavedContract32'
import { luminizeSettlementPlanPersistenceFixture } from '../accounts/luminizePlanPersistence32.testFixture'
import { evaluateReviewedLuminizeSettlement32 } from '../calculation/reviewedLuminizeSettlement32'
import * as currentIntent from '../decision/savedTeamBuildIntent'
import { contentHash } from './contentHash'
import { projectPrivateSavedTeamReplay } from './privateSavedTeamReplayProjection'
import { projectPublicCalculationResult } from './publicCalculationTransport'
import { acceptSavedTeamReplayPresentation, savedTeamReplayPlanHash } from './publicSavedTeamReplay'
import {
  inspectSavedTeamPlanSnapshotFreshness,
  inspectSavedTeamPortfolioPlanSnapshotFreshness,
} from './publicSavedPlanFreshness'
import { inspectSavedLuminizeReplay32, savedLuminizeReplaySchema32 } from './savedLuminizeReplay32'

afterEach(() => vi.restoreAllMocks())

function planFixture(): AccountPlanningDraft {
  return {
    id: 'luminize-replay-fixture',
    scopedId: 'synthetic:luminize-replay-fixture',
    accountId: 'account-luminize-replay',
    kind: 'team',
    name: 'private-name',
    state: 'saved',
    createdAt: '2026-10-18T00:00:00Z',
    updatedAt: '2026-10-18T00:00:00Z',
    revision: 1,
    comparisonCapability: 'direction',
    selection: {
      agentIds: ['agent-remielle', 'agent-aria', 'agent-velina'],
      bangbooId: null,
      scenario: 'private-scenario',
    },
    manualOverrides: {
      wEngineDirection: '',
      discDirection: '',
      progressionDirection: '',
      notes: '',
    },
    knowledgeRefs: [],
    warehouseRefs: [],
    teamEquipmentParameters: {
      wEngines: [],
      bangbooId: 'bangboo-amillion',
      bangbooStars: 1,
      source: 'player_confirmed',
    },
    solutionContext: {
      contract: 'soda-solution-context/v1',
      scope: 'team_joint',
      resourcePolicy: 'within_team_exclusive',
      sourceCandidateId: 'synthetic-remielle-team',
      inputFingerprint: 'saved-team/v2:synthetic',
      solverMethod: 'declared-test',
      gameVersion: '3.2',
      knowledgeVersion: 'synthetic',
      exactVariantKey: null,
      declaredLuminizeSettlement32: createSavedDeclaredLuminizeSettlement32(
        luminizeSettlementPlanPersistenceFixture(),
      ),
    },
  }
}

function reseal(plan: AccountPlanningDraft) {
  const saved = plan.solutionContext!.declaredLuminizeSettlement32!
  const body = { contract: saved.contract, declaration: saved.declaration }
  plan.solutionContext!.declaredLuminizeSettlement32 = {
    ...body,
    snapshotFingerprint: contentHash(body),
  }
}

function runFixture(plan: AccountPlanningDraft): AccountDecisionRun {
  return {
    runId: 'run:luminize-replay',
    input: { drafts: [plan], warehouse: { accountId: plan.accountId } },
    snapshot: { fingerprint: { inputHash: 'synthetic-current-input' } },
  } as unknown as AccountDecisionRun
}

function matchFixture(ids = planFixture().selection.agentIds) {
  return {
    buildIntent: {
      scope: 'team_joint',
      agentIds: ids,
      exactTeam: { candidateId: 'synthetic-remielle-team' },
    },
    effectiveEquipmentParameters: undefined,
    accountFactBinding: undefined,
  } as unknown as NonNullable<ReturnType<typeof currentIntent.currentSavedTeamBuildIntent>>
}

function project(plan: AccountPlanningDraft) {
  const run = runFixture(plan)
  return projectPrivateSavedTeamReplay(run, plan.id, savedTeamReplayPlanHash(plan))
}

describe('saved Luminize declaration replay and current seal', () => {
  it('recomputes current saved inputs and exposes only the thin independent volley DTO', () => {
    const plan = planFixture()
    vi.spyOn(currentIntent, 'currentSavedTeamBuildIntent').mockReturnValue(matchFixture())
    const expected = evaluateReviewedLuminizeSettlement32(
      plan.solutionContext!.declaredLuminizeSettlement32!.declaration,
    )
    if (expected.status !== 'declared_arithmetic') throw new Error('Fixture must be evaluable')
    const result = project(plan)
    expect(result).toMatchObject({
      status: 'ready',
      luminizeSettlement32: {
        status: 'declared_arithmetic',
        totalDamage: expected.totalDamage,
        formalCycleReady: false,
        modelQualification32: null,
        blockers: [],
        instances: [
          { ownerAgentId: 'agent-aria', attribute: 'ether', damage: expected.totalDamage },
        ],
      },
    })
    expect(
      savedLuminizeReplaySchema32.safeParse(JSON.parse(JSON.stringify(result.luminizeSettlement32)))
        .success,
    ).toBe(true)
    const serialized = JSON.stringify(result.luminizeSettlement32)
    const wire = projectPublicCalculationResult('saved_team_plan_replay', result)
    expect(wire).toHaveProperty('luminizeSettlement32', result.luminizeSettlement32)
    expect(
      acceptSavedTeamReplayPresentation(wire as typeof result, {
        runId: result.runId,
        accountId: result.accountId,
        inputFingerprint: result.inputFingerprint,
        planId: result.planId,
        planHash: result.planHash,
        luminizeSnapshotFingerprint:
          plan.solutionContext!.declaredLuminizeSettlement32!.snapshotFingerprint,
      }),
    ).not.toBeNull()
    for (const omitted of [
      'sourceRefs',
      'declaration',
      'private-name',
      'private-scenario',
      'stats',
      'storedRefringeCoefficient',
    ])
      expect(serialized).not.toContain(`"${omitted}"`)
    expect(plan.solutionContext!.declaredLuminizeSettlement32!.declaration).toEqual(
      luminizeSettlementPlanPersistenceFixture(),
    )
  })

  it('hashes both declared numeric inputs and their seal, while labels stay irrelevant', () => {
    const before = planFixture()
    const renamed = { ...before, name: 'changed private label' }
    expect(savedTeamReplayPlanHash(renamed)).toBe(savedTeamReplayPlanHash(before))
    const changed = structuredClone(before)
    changed.solutionContext!.declaredLuminizeSettlement32!.declaration.remielle.anomalyProficiency += 1
    expect(savedTeamReplayPlanHash(changed)).not.toBe(savedTeamReplayPlanHash(before))
    reseal(changed)
    expect(savedTeamReplayPlanHash(changed)).not.toBe(savedTeamReplayPlanHash(before))
    expect(() =>
      projectPrivateSavedTeamReplay(
        runFixture(changed),
        changed.id,
        savedTeamReplayPlanHash(before),
      ),
    ).toThrow()
  })

  it('invalidates the replay hash for resource timeline edits even before a new identity is issued', () => {
    const plan = planFixture()
    const before = savedTeamReplayPlanHash(plan)
    plan.solutionContext!.resourceTimelineDeclaration32 = {
      contract: 'soda-declared-resource-timeline32/v1',
      sourceIdentityHash: 'source-fixture',
      memberAgentIds: [...plan.selection.agentIds] as [string, string, string],
      durationSeconds: 30,
      events: [],
    }
    const withDeclaration = savedTeamReplayPlanHash(plan)
    expect(withDeclaration).not.toBe(before)
    plan.solutionContext!.resourceTimelineDeclaration32.durationSeconds = 31
    expect(savedTeamReplayPlanHash(plan)).not.toBe(withDeclaration)
    const edited = savedTeamReplayPlanHash(plan)
    plan.solutionContext!.resourceTimelineDeclarationIdentity32 = 'reissued-identity'
    expect(savedTeamReplayPlanHash(plan)).not.toBe(edited)
  })

  it('retains historical source declarations in backups but rejects current replay and freshness', () => {
    const plan = planFixture()
    plan.solutionContext!.declaredLuminizeSettlement32!.declaration.sourceIdentityHash =
      'previous-source'
    reseal(plan)
    const before = JSON.stringify(plan)
    expect(
      savedDeclaredLuminizeSettlement32Schema.safeParse(
        plan.solutionContext!.declaredLuminizeSettlement32,
      ).success,
    ).toBe(true)
    const producer = vi
      .spyOn(currentIntent, 'currentSavedTeamBuildIntent')
      .mockReturnValue(matchFixture())
    expect(project(plan)).toMatchObject({
      status: 'unavailable',
      match: null,
      luminizeSettlement32: {
        status: 'stale',
        totalDamage: null,
        instances: [],
        blockers: ['luminize_saved_source_stale'],
      },
    })
    expect(producer).not.toHaveBeenCalled()
    expect(
      inspectSavedTeamPlanSnapshotFreshness(plan, null, undefined, 'saved-team/v2:synthetic'),
    ).toEqual({ stale: true, reason: 'luminize-source-stale' })
    expect(JSON.stringify(plan)).toBe(before)
  })

  it.each(['seal', 'scope', 'selection', 'deployment', 'malformed', 'malformed-source'] as const)(
    'explicitly refuses %s failures',
    (kind) => {
      const plan = planFixture()
      if (kind === 'seal')
        plan.solutionContext!.declaredLuminizeSettlement32!.declaration.remielle.anomalyProficiency += 1
      if (kind === 'scope') plan.solutionContext!.scope = 'portfolio_joint'
      if (kind === 'selection') plan.selection.agentIds[1] = 'agent-billy'
      if (kind === 'deployment')
        plan.teamExecutionSnapshot = {
          memberIds: plan.selection.agentIds,
          deploymentOrder: [...plan.selection.agentIds].reverse(),
        } as AccountPlanningDraft['teamExecutionSnapshot']
      if (kind === 'malformed')
        plan.solutionContext!.declaredLuminizeSettlement32 = { snapshotFingerprint: '' } as never
      if (kind === 'malformed-source') {
        plan.solutionContext!.declaredLuminizeSettlement32!.declaration.sourceIdentityHash =
          '  previous-source  '
        reseal(plan)
      }
      vi.spyOn(currentIntent, 'currentSavedTeamBuildIntent').mockReturnValue(matchFixture())
      expect(project(plan)).toMatchObject({
        status: 'unavailable',
        match: null,
        luminizeSettlement32: { status: 'invalid', totalDamage: null },
      })
      expect(
        inspectSavedTeamPlanSnapshotFreshness(
          plan,
          'saved-team/v2:synthetic',
          undefined,
          'saved-team/v2:synthetic',
        ),
      ).toEqual({ stale: true, reason: 'luminize-declaration-invalid' })
    },
  )

  it('requires team_joint even for a single-agent historical plan and portfolio freshness', () => {
    const plan = planFixture()
    plan.kind = 'agent'
    expect(inspectSavedTeamPlanSnapshotFreshness(plan, 'saved-team/v2:synthetic')).toEqual({
      stale: true,
      reason: 'luminize-declaration-invalid',
    })
    plan.kind = 'team'
    plan.solutionContext!.scope = 'portfolio_joint'
    expect(inspectSavedTeamPortfolioPlanSnapshotFreshness(plan, null)).toEqual({
      stale: true,
      reason: 'luminize-declaration-invalid',
    })
  })

  it('rejects a current candidate from another formation and an unevaluable sealed flare', () => {
    const plan = planFixture()
    const producer = vi
      .spyOn(currentIntent, 'currentSavedTeamBuildIntent')
      .mockReturnValue(matchFixture(['agent-remielle', 'agent-billy', 'agent-velina']))
    expect(project(plan)).toMatchObject({
      status: 'unavailable',
      match: null,
      luminizeSettlement32: {
        status: 'invalid',
        blockers: ['luminize_saved_current_team_mismatch'],
        totalDamage: null,
      },
    })
    producer.mockReturnValue(matchFixture())
    plan.solutionContext!.declaredLuminizeSettlement32!.declaration.voidflares[0]!.attribute =
      'physical'
    reseal(plan)
    expect(project(plan)).toMatchObject({
      status: 'unavailable',
      match: null,
      luminizeSettlement32: {
        status: 'invalid',
        blockers: ['luminize_snapshot_ownership_or_time_mismatch'],
        totalDamage: null,
      },
    })
  })

  it('does not fabricate a current result when the exact team cannot be replayed', () => {
    vi.spyOn(currentIntent, 'currentSavedTeamBuildIntent').mockReturnValue(undefined)
    expect(project(planFixture())).toMatchObject({
      status: 'unavailable',
      match: null,
      luminizeSettlement32: {
        status: 'unavailable',
        totalDamage: null,
        instances: [],
        blockers: ['luminize_saved_current_team_unavailable'],
      },
    })
  })

  it('validates the DTO seal and expected captured identity against late or stripped replies', () => {
    const plan = planFixture()
    vi.spyOn(currentIntent, 'currentSavedTeamBuildIntent').mockReturnValue(matchFixture())
    const result = project(plan)
    const expected = {
      runId: result.runId,
      accountId: result.accountId,
      inputFingerprint: result.inputFingerprint,
      planId: result.planId,
      planHash: result.planHash,
      luminizeSnapshotFingerprint:
        plan.solutionContext!.declaredLuminizeSettlement32!.snapshotFingerprint,
    }
    expect(acceptSavedTeamReplayPresentation(result, expected)).toEqual(result)
    expect(
      acceptSavedTeamReplayPresentation(result, {
        ...expected,
        luminizeSnapshotFingerprint: undefined,
      }),
    ).toBeNull()
    for (const change of [
      { runId: 'late-run' },
      { planHash: 'previous-plan' },
      { inputFingerprint: 'previous-input' },
      { luminizeSnapshotFingerprint: 'previous-snapshot' },
    ])
      expect(acceptSavedTeamReplayPresentation(result, { ...expected, ...change })).toBeNull()
    expect(
      acceptSavedTeamReplayPresentation({ ...result, luminizeSettlement32: undefined }, expected),
    ).toBeNull()
    const tampered = structuredClone(result)
    tampered.luminizeSettlement32!.totalDamage = 0
    expect(acceptSavedTeamReplayPresentation(tampered, expected)).toBeNull()
    const qualified = { ...result.luminizeSettlement32!, formalCycleReady: true }
    expect(savedLuminizeReplaySchema32.safeParse(qualified).success).toBe(false)
  })

  it('leaves the existing undeclared replay path intact', () => {
    const plan = planFixture()
    delete plan.solutionContext!.declaredLuminizeSettlement32
    vi.spyOn(currentIntent, 'currentSavedTeamBuildIntent').mockReturnValue(matchFixture())
    expect(inspectSavedLuminizeReplay32(plan)).toEqual({ status: 'not_declared' })
    expect(project(plan)).toMatchObject({ status: 'ready' })
    expect(project(plan)).not.toHaveProperty('luminizeSettlement32')
  })
})
