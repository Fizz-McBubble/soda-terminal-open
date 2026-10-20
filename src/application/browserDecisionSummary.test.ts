import { expect, it } from 'vitest'
import { buildAccountDecisionSnapshot } from '../decision/accountDecisionService'
import { createLocalCalculationQueryClientCore } from './localCalculationQueryClientCore'
import { currentVersionProjection } from '../gameDataPacks/currentVersionProjection'
import type { CurrentGameDataRuntimeSelection } from '../gameDataPacks/runtimeSelection'
import { query } from './localCalculationQueryClient.testFixture'
import { projectPublicCalculationResult } from './publicCalculationTransport'

it('keeps source decisions and resolves only the selected team diagnostic after the summary', async () => {
  const request = query('deferred-diagnostics', ['agent-alice', 'agent-astra', 'agent-burnice'])
  const input = { ...request.input, capturedAt: request.capturedAt }
  const before = JSON.stringify(input)
  const eager = buildAccountDecisionSnapshot(input)
  const summary = buildAccountDecisionSnapshot({ ...input, deferDiagnosticInference: true })
  const visible = (snapshot: typeof eager) => {
    const authority = snapshot.decisionAuthority
    return {
      defaults: authority.recommendations.map((row) => row.candidateId),
      consumers: authority.consumerRecommendations.map((row) => ({
        candidateId: row.candidateId,
        memberIds: row.memberIds,
        teamRating: row.teamRating,
        teamStrengthOrder: row.teamStrengthOrder,
        cultivationPriority: row.cultivationPriority,
        authority: row.metaCalibration.authority,
        sourceBand: row.metaCalibration.projectedStrengthBand,
      })),
    }
  }
  expect(visible(summary)).toEqual(visible(eager))
  const prior = eager.decisionAuthority.consumerRecommendations.find(
    (row) => row.metaCalibration.inference,
  )
  expect(prior).toBeDefined()
  expect(summary.decisionAuthority.consumerRecommendations).toContainEqual(
    expect.objectContaining({ candidateId: prior!.candidateId, mechanicDiagnosticDeferred: true }),
  )
  expect(
    summary.decisionAuthority.consumerRecommendations.every(
      (row) => !row.metaCalibration.inference,
    ),
  ).toBe(true)
  const runtime: CurrentGameDataRuntimeSelection = {
    contract: 'soda-current-game-data-runtime-selection/v1',
    status: 'compiled_current',
    packageId: currentVersionProjection.packageId,
    packageVersion: currentVersionProjection.packageVersion,
    gameVersion: currentVersionProjection.gameVersion,
    source: 'implicit_compiled_baseline',
  }
  const client = createLocalCalculationQueryClientCore({
    readRuntimeSelection: async () => runtime,
    calculateSnapshot: async () => summary,
  })
  const run = await client.calculateAccountDecision(request)
  const compact = projectPublicCalculationResult('account_decision', run) as Record<string, unknown>
  expect(compact.input).toBeUndefined()
  expect(compact.snapshot).not.toHaveProperty('decisionAuthority.consumerRecommendations')
  expect(compact).toHaveProperty('developmentWorkbenchPresentation.agents')
  const captured = JSON.stringify(run.snapshot)
  const route = await client.queryTeamRoutePresentation({
    contractVersion: request.contractVersion,
    kind: 'team_route_presentation',
    runId: run.runId,
    candidateId: prior!.candidateId,
  })
  expect(route.team).not.toBeNull()
  expect(route.mechanicDiagnostic).toEqual(prior!.metaCalibration.inference)
  expect(projectPublicCalculationResult('team_route_presentation', route)).toHaveProperty(
    'mechanicDiagnostic',
    route.mechanicDiagnostic,
  )
  expect(JSON.stringify(run.snapshot)).toBe(captured)
  expect(JSON.stringify(input)).toBe(before)
  client.releaseAccountDecisionRun!(run.runId)
  await expect(
    client.queryTeamRoutePresentation({
      contractVersion: request.contractVersion,
      kind: 'team_route_presentation',
      runId: run.runId,
      candidateId: prior!.candidateId,
    }),
  ).rejects.toThrow('unavailable')
}, 30_000)
