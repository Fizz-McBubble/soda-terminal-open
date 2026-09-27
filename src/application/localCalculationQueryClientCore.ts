import { buildAccountDecisionInputFingerprint } from '../decision/accountDecisionService'
import { createLocalTargetTeamFitQuery } from './localTargetTeamFitQuery'
import type { AccountDecisionSnapshotCalculator } from './browserAccountDecisionWorker'
import { projectDevelopmentCandidateAlternatives } from '../decision/developmentCandidateAlternatives'
import { projectDevelopmentValueBenchmarks } from '../decision/developmentValueBenchmark'
import { projectDevelopmentCandidatePresentation } from './developmentCandidatePresentation'
import type { CurrentGameDataRuntimeSelection } from '../gameDataPacks/runtimeSelection'
import {
  calculationQueryContractVersion,
  type AccountDecisionRun,
  type CalculationQueryClient,
} from './calculationQueryContract'
import { createLocalDecisionPortfolioQuery } from './localDecisionPortfolioQuery'
import {
  findWarehouseDiscTransitionUse,
  compareWarehouseDiscTransitionUses,
} from '../decision/warehouseDiscTransitionUses'
import { projectWarehouseActions } from './warehouseActionProjection'
import { projectDevelopmentDirectoryQuery } from './developmentDirectoryQueryProjection'
import { projectDevelopmentComparisonPanels } from './developmentComparisonPanelProjection'
import { projectDevelopmentWorkbenchPresentation } from './developmentWorkbenchPresentationProjection'
import { projectDevelopmentWorkbenchRoute } from './developmentWorkbenchRouteProjection'
import { projectPrivateTeamOverview } from '../pages/privateTeamLoadoutPresentationProducer'
import { prepareRemainingBox } from './remainingBox'
import { projectPrivateTeamRoute } from '../pages/privateTeamRouteProjection'
import { projectPrivateSavedTeamReplay } from './privateSavedTeamReplayProjection'
import { projectPrivateSavedTeamSolutionComponents } from './privateSavedTeamSolutionComponentsProjection'

export function createLocalCalculationQueryClientCore(
  options: {
    readRuntimeSelection: () => Promise<CurrentGameDataRuntimeSelection>
    calculateSnapshot: AccountDecisionSnapshotCalculator
  },
): CalculationQueryClient {
  const runs = new Map<string, AccountDecisionRun>()
  const teamFits = new Map<
    string,
    Map<string, Awaited<ReturnType<CalculationQueryClient['calculateTargetTeamWarehouseFit']>>>
  >()
  const pendingRuns = new Map<string, AbortController>()
  const calculateSnapshot = options.calculateSnapshot
  const readRuntimeSelection = options.readRuntimeSelection
  const invalidateRuns = () => {
    for (const controller of pendingRuns.values()) controller.abort()
    pendingRuns.clear()
    runs.clear()
    teamFits.clear()
  }

  async function requireCompiledRuntime() {
    let runtime: CurrentGameDataRuntimeSelection
    try {
      runtime = await readRuntimeSelection()
    } catch {
      invalidateRuns()
      throw new Error('无法读取游戏资料，请恢复与当前应用配套的资料后重新分析。')
    }
    if (runtime.status === 'compiled_current') return runtime
    // A package change invalidates every captured calculation. Do not leave a run address that a
    // caller could accidentally reuse for a portfolio query or a save flow.
    invalidateRuns()
    throw new Error(runtime.message)
  }

  const client: CalculationQueryClient = {
    releaseAccountDecisionRun(runId) {
      pendingRuns.get(runId)?.abort()
      pendingRuns.delete(runId)
      runs.delete(runId)
      teamFits.delete(runId)
    },
    fingerprintAccountDecisionInput(input) {
      return buildAccountDecisionInputFingerprint(input).inputHash
    },

    async calculateAccountDecision(query) {
      if (query.contractVersion !== calculationQueryContractVersion)
        throw new Error(`Unsupported Calculation/Query contract: ${query.contractVersion}.`)
      pendingRuns.get(query.runId)?.abort()
      const controller = new AbortController()
      pendingRuns.set(query.runId, controller)
      try {
        await requireCompiledRuntime()
        controller.signal.throwIfAborted()
        const snapshot = await calculateSnapshot(
          { ...query.input, capturedAt: query.capturedAt },
          { signal: controller.signal },
        )
        await requireCompiledRuntime()
        controller.signal.throwIfAborted()
        const run: AccountDecisionRun = {
          runId: query.runId,
          capturedAt: query.capturedAt,
          inputFingerprint: snapshot.fingerprint.inputHash,
          claimStatus: snapshot.claims.overall.status,
          decisionAuthority: {
            status: snapshot.decisionAuthority.status,
            recommendationCount: snapshot.decisionAuthority.recommendations.length,
            blockers:
              snapshot.decisionAuthority.status === 'blocked'
                ? [...snapshot.decisionAuthority.blockers]
                : [],
          },
          input: query.input,
          snapshot,
        }
        run.warehouseActions = projectWarehouseActions({ run, status: 'current' })
        run.developmentDirectory = projectDevelopmentDirectoryQuery(run)
        run.developmentWorkbenchPresentation = projectDevelopmentWorkbenchPresentation(run)
        run.teamPresentation = projectPrivateTeamOverview(run)
        teamFits.delete(run.runId)
        runs.set(run.runId, run)
        return run
      } finally {
        if (pendingRuns.get(query.runId) === controller) pendingRuns.delete(query.runId)
      }
    },

    async queryTeamOverviewPresentation(query, internal) {
      if (query.contractVersion !== calculationQueryContractVersion)
        throw new Error(`Unsupported Calculation/Query contract: ${query.contractVersion}.`)
      await requireCompiledRuntime()
      const run = runs.get(query.runId)
      if (!run) throw new Error(`Account Decision run is unavailable: ${query.runId}.`)
      const fits = (query.fitCandidateIds ?? []).map((id) => {
        const fit = teamFits.get(run.runId)?.get(id)
        if (!fit) throw new Error('队伍配装结果已失效，请重新分析。')
        return fit
      })
      if (!query.sourceRunId) {
        if (query.reservedPlanIds?.length) throw new Error('队伍展示上下文无效。')
        return projectPrivateTeamOverview(run, query.context, undefined, fits)
      }
      const source = runs.get(query.sourceRunId) ?? internal?.sourceRun
      if (!source || source.runId !== query.sourceRunId || source.runId === run.runId)
        throw new Error('原队伍分析已失效，请重新分析剩余队伍。')
      if (source.input.warehouse.accountId !== run.input.warehouse.accountId)
        throw new Error('当前账户已切换，请重新分析。')
      const prepared = prepareRemainingBox(source.input, query.reservedPlanIds ?? [])
      if (
        buildAccountDecisionInputFingerprint(prepared.input).inputHash !==
        buildAccountDecisionInputFingerprint(run.input).inputHash
      )
        throw new Error('保留队伍或剩余仓库已变化，请重新分析。')
      return projectPrivateTeamOverview(run, query.context, source, fits)
    },

    async queryTeamRoutePresentation(query) {
      if (query.contractVersion !== calculationQueryContractVersion)
        throw new Error(`Unsupported Calculation/Query contract: ${query.contractVersion}.`)
      await requireCompiledRuntime()
      const run = runs.get(query.runId)
      if (!run) throw new Error(`Account Decision run is unavailable: ${query.runId}.`)
      return projectPrivateTeamRoute(run, query.candidateId)
    },

    async querySavedTeamPlanReplay(query) {
      if (query.contractVersion !== calculationQueryContractVersion)
        throw new Error(`Unsupported Calculation/Query contract: ${query.contractVersion}.`)
      await requireCompiledRuntime()
      const run = runs.get(query.runId)
      if (!run) throw new Error(`Account Decision run is unavailable: ${query.runId}.`)
      return projectPrivateSavedTeamReplay(run, query.planId, query.planHash)
    },

    async querySavedTeamSolutionComponents(query) {
      if (query.contractVersion !== calculationQueryContractVersion)
        throw new Error(`Unsupported Calculation/Query contract: ${query.contractVersion}.`)
      await requireCompiledRuntime()
      const run = runs.get(query.runId)
      if (!run) throw new Error(`Account Decision run is unavailable: ${query.runId}.`)
      return projectPrivateSavedTeamSolutionComponents(run, query.currentInput)
    },

    async queryDevelopmentWorkbenchRoute(query) {
      if (query.contractVersion !== calculationQueryContractVersion)
        throw new Error(`Unsupported Calculation/Query contract: ${query.contractVersion}.`)
      await requireCompiledRuntime()
      const run = runs.get(query.runId)
      if (!run) throw new Error(`Account Decision run is unavailable: ${query.runId}.`)
      return projectDevelopmentWorkbenchRoute(run, query.selection)
    },

    queryDecisionPortfolio: createLocalDecisionPortfolioQuery({
      runs,
      requireCompiledRuntime,
      calculateTargetTeamWarehouseFit: (query) => client.calculateTargetTeamWarehouseFit(query),
    }),

    calculateTargetTeamWarehouseFit: createLocalTargetTeamFitQuery({
      runs,
      teamFits,
      requireCompiledRuntime,
    }),

    async queryWarehouseDiscTransitionUses(query, options) {
      if (query.contractVersion !== calculationQueryContractVersion)
        throw new Error('请更新页面后重试。')
      await requireCompiledRuntime()
      const run = runs.get(query.runId)
      if (!run || !run.input.warehouse.accountId) throw new Error('请重新分析仓库后查看过渡搭配。')
      if (!run.input.warehouse.discs.some((disc) => disc.id === query.discId))
        throw new Error('这张驱动盘已不在本次仓库记录中。')
      const agentIds = [
        ...new Set(
          run.input.warehouse.roster.agents
            .filter((agent) => agent.owned)
            .map((agent) => agent.agentId),
        ),
      ].sort()
      const uses = []
      for (const agentId of agentIds) {
        if (options?.signal?.aborted) throw new Error('已停止查看过渡搭配。')
        if (runs.get(query.runId) !== run) throw new Error('仓库已更新，请重新查看过渡搭配。')
        const use = findWarehouseDiscTransitionUse(run.input, query.discId, agentId)
        if (use) uses.push(use)
        // Keep the existing local async client responsive while checking owned agents.
        await new Promise<void>((resolve) => setTimeout(resolve, 0))
      }
      uses.sort(compareWarehouseDiscTransitionUses)
      return {
        runId: run.runId,
        inputFingerprint: run.snapshot.fingerprint.inputHash,
        discId: query.discId,
        accountId: run.input.warehouse.accountId,
        sideEffect: 'read_only',
        checkedAgentCount: agentIds.length,
        uses,
      }
    },

    async queryDevelopmentCandidateAlternatives(query) {
      if (query.contractVersion !== calculationQueryContractVersion)
        throw new Error(`Unsupported Calculation/Query contract: ${query.contractVersion}.`)
      await requireCompiledRuntime()
      const run = runs.get(query.runId)
      if (!run) throw new Error(`Account Decision run is unavailable: ${query.runId}.`)
      const accountId = run.input.warehouse.accountId
      if (!accountId) throw new Error(`Account Decision run has no account: ${query.runId}.`)
      const projection = projectDevelopmentCandidateAlternatives(run.input, query.agentId)
      const valueBenchmarks = projectDevelopmentValueBenchmarks({
        warehouse: run.input.warehouse,
        agentId: query.agentId,
        baseline: projection.baseline,
        candidates: projection.candidates,
        savedPlans: run.input.drafts,
        stale: false,
      })
      return {
        contract: 'soda-development-candidate-alternatives/v1',
        runId: run.runId,
        capturedAt: run.capturedAt,
        inputFingerprint: run.snapshot.fingerprint.inputHash,
        accountId,
        agentId: query.agentId,
        sideEffect: 'read_only',
        ...projection,
        valueBenchmarks,
        presentation: projectDevelopmentCandidatePresentation(query.agentId),
        panelPresentation: projectDevelopmentComparisonPanels({
          warehouse: run.input.warehouse,
          drafts: run.input.drafts ?? [],
          agentId: query.agentId,
          baseline: projection.baseline,
          candidates: projection.candidates,
        }),
      }
    },
  }
  return client
}
