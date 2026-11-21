import {
  normalizeReviewedEventConditionDeclarations32,
  reviewedEventConditionDeclarationsIdentity32,
} from '../calculation/reviewedEventConditionDeclarations32'
import {
  projectReviewedIncrementalEvent32,
  projectReviewedIncrementalEventMetadata32,
} from './privateReviewedIncrementalEvent32'
import {
  projectDevelopmentWEngineComparison,
  projectDevelopmentWEngineOptions,
} from './developmentWEngineComparisonProjection'
import { supportsPotentialImage } from '../assault/agentCapabilities'
import { stableContentHash } from '../gameDataPacks/types'
import { buildAccountDecisionInputFingerprint } from '../decision/accountDecisionFingerprint'
import { createLocalTargetTeamFitQuery } from './localTargetTeamFitQuery'
import { requireCompiledRuntimeWithSignal, requireRunWithSignal } from './localQueryRuntimeGuard'
import type { AccountDecisionSnapshotCalculator } from './browserAccountDecisionWorker'
import { projectDevelopmentCandidateAlternatives } from '../decision/developmentCandidateAlternatives'
import { projectDevelopmentParameterizedCandidates } from './developmentParameterizedCandidates'
import {
  projectDevelopmentValueBenchmarks,
  createDevelopmentValueBenchmarkEvaluator,
} from '../decision/developmentValueBenchmark'
import { projectDevelopmentCandidatePresentation } from './developmentCandidatePresentation'
import { parseDevelopmentParametersByRank } from '../accounts/developmentComparisonParametersSchema'
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
import { projectDevelopmentWorkbenchRoute } from './developmentWorkbenchRouteProjection'
import { createDevelopmentCandidateLoadoutCache } from './developmentCandidateLoadoutCache'
import { createDevelopmentCandidateAlternativesCache } from './developmentCandidateAlternativesCache'
import { createLocalTeamOverviewQuery } from './localTeamOverviewQuery'
import { projectPrivateTeamRoute } from '../pages/privateTeamRouteProjection'
import { projectPrivateSavedTeamReplay } from './privateSavedTeamReplayProjection'
import { projectPrivateSavedTeamSolutionComponents } from './privateSavedTeamSolutionComponentsProjection'
import { projectPlanningBenchmark32 } from './privatePlanningBenchmark32'
import { projectCommonAnomalySettlementQuery32 } from './privateCommonAnomalySettlementQuery32'
import { resolveCurrentPlanningScenario32 } from '../calculation/currentPlanningScenario32'
import { validateSourceResourceGrantDeclaration32 } from '../calculation/sourceMechanismResourceGrantContract32'
import { isCurrentDevelopmentDirectoryFacts } from './publicDevelopmentDirectoryFacts'
import { loadBoxCandidate, loadSavedBoxCandidate } from './boxAdmissionQueryProjection'

export function createLocalCalculationQueryClientCore(options: {
  readRuntimeSelection: () => Promise<CurrentGameDataRuntimeSelection>
  calculateSnapshot: AccountDecisionSnapshotCalculator
}): CalculationQueryClient {
  const runs = new Map<string, AccountDecisionRun>()
  const candidateLoadouts = createDevelopmentCandidateLoadoutCache()
  const candidateAlternatives = createDevelopmentCandidateAlternativesCache()
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
    candidateLoadouts.clear()
    candidateAlternatives.clear()
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
    async queryDevelopmentDirectoryFacts(query, requestOptions) {
      if (query.contractVersion !== calculationQueryContractVersion || !query.operationId)
        throw new Error('养成目录事实请求格式无效。')
      requestOptions?.signal?.throwIfAborted()
      await requireCompiledRuntime()
      requestOptions?.signal?.throwIfAborted()
      const { projectDevelopmentDirectoryFacts } =
        await import('./developmentDirectoryFactsProjection')
      requestOptions?.signal?.throwIfAborted()
      const result = projectDevelopmentDirectoryFacts(query)
      if (!isCurrentDevelopmentDirectoryFacts(result, query))
        throw new Error('养成目录事实与当前请求不一致，请重试。')
      return result
    },
    async queryDevelopmentWorkbenchFacts(query, requestOptions) {
      if (query.contractVersion !== calculationQueryContractVersion || !query.operationId)
        throw new Error('个人事实请求格式无效。')
      requestOptions?.signal?.throwIfAborted()
      await requireCompiledRuntime()
      requestOptions?.signal?.throwIfAborted()
      const { projectDevelopmentWorkbenchFacts } =
        await import('./developmentWorkbenchFactsProjection')
      requestOptions?.signal?.throwIfAborted()
      return projectDevelopmentWorkbenchFacts(query)
    },
    async queryCommonAnomalySettlement32(request) {
      const query = structuredClone(request)
      if (query.contractVersion !== calculationQueryContractVersion)
        throw new Error(`Unsupported Calculation/Query contract: ${query.contractVersion}.`)
      await requireCompiledRuntime()
      return projectCommonAnomalySettlementQuery32(query)
    },
    async queryPlanningBenchmark32(query) {
      if (query.contractVersion !== calculationQueryContractVersion)
        throw new Error(`Unsupported Calculation/Query contract: ${query.contractVersion}.`)
      await requireCompiledRuntime()
      const run = runs.get(query.runId)
      const fit = teamFits.get(query.runId)?.get(query.candidateId)
      if (!run || run.inputFingerprint !== query.accountFingerprint)
        throw new Error('账户分析已失效，请重新分析后读取逐次条件。')
      if (!fit || fit.fingerprint !== query.fitFingerprint)
        throw new Error('十八盘配装已变化，请重新生成后读取逐次条件。')
      if (query.declarations && !query.sourceBindingFingerprint)
        throw new Error('请先读取与当前配装绑定的条件定义。')
      return projectPlanningBenchmark32(
        {
          runId: run.runId,
          candidateId: query.candidateId,
          accountFingerprint: run.inputFingerprint,
          capturedAt: run.capturedAt,
          warehouse: run.input.warehouse,
          fit,
          selectedEquipment: fit.effectiveEquipmentParameters,
        },
        query.declarations,
        query.sourceBindingFingerprint,
      )
    },
    async queryReviewedIncrementalEvent32(query) {
      if (query.contractVersion !== calculationQueryContractVersion)
        throw new Error(`Unsupported Calculation/Query contract: ${query.contractVersion}.`)
      await requireCompiledRuntime()
      return projectReviewedIncrementalEvent32(query.runId, query.input)
    },
    releaseAccountDecisionRun(runId) {
      pendingRuns.get(runId)?.abort()
      pendingRuns.delete(runId)
      const run = runs.get(runId)
      if (run) {
        candidateLoadouts.forget(run)
        candidateAlternatives.forget(run)
      }
      runs.delete(runId)
      teamFits.delete(runId)
    },
    fingerprintAccountDecisionInput(input) {
      return buildAccountDecisionInputFingerprint(input).inputHash
    },

    async calculateAccountDecision(request) {
      const query = structuredClone(request)
      if (query.contractVersion !== calculationQueryContractVersion)
        throw new Error(`Unsupported Calculation/Query contract: ${query.contractVersion}.`)
      pendingRuns.get(query.runId)?.abort()
      const controller = new AbortController()
      pendingRuns.set(query.runId, controller)
      try {
        await requireCompiledRuntime()
        controller.signal.throwIfAborted()
        const snapshot = await calculateSnapshot(
          { ...query.input, capturedAt: query.capturedAt, deferWarehouseAnalysis: true },
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
        if (snapshot.warehouse)
          run.warehouseActions = projectWarehouseActions({ run, status: 'current' })
        run.developmentDirectory = projectDevelopmentDirectoryQuery(run)
        teamFits.delete(run.runId)
        runs.set(run.runId, run)
        return run
      } finally {
        if (pendingRuns.get(query.runId) === controller) pendingRuns.delete(query.runId)
      }
    },

    queryTeamOverviewPresentation: createLocalTeamOverviewQuery(
      runs,
      teamFits,
      requireCompiledRuntime,
    ),

    async queryTeamRoutePresentation(query, requestOptions) {
      const run = await requireRunWithSignal(
        query,
        runs,
        requireCompiledRuntime,
        requestOptions?.signal,
      )
      return projectPrivateTeamRoute(
        loadBoxCandidate(run, query.candidateId, true),
        query.candidateId,
      )
    },

    async querySavedTeamPlanReplay(query) {
      if (query.contractVersion !== calculationQueryContractVersion)
        throw new Error(`Unsupported Calculation/Query contract: ${query.contractVersion}.`)
      await requireCompiledRuntime()
      const run = runs.get(query.runId)
      if (!run) throw new Error(`Account Decision run is unavailable: ${query.runId}.`)
      return projectPrivateSavedTeamReplay(
        loadSavedBoxCandidate(run, query.planId, query.planHash),
        query.planId,
        query.planHash,
      )
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
      return projectDevelopmentWorkbenchRoute(
        run,
        query.selection,
        query.currentRecord,
        candidateLoadouts.read(run, query.selection),
      )
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

    async queryWarehouseActions(query, requestOptions) {
      if (query.contractVersion !== calculationQueryContractVersion)
        throw new Error('请更新页面后重试。')
      await requireCompiledRuntimeWithSignal(requireCompiledRuntime, requestOptions?.signal)
      const run = runs.get(query.runId)
      if (!run) throw new Error('本次仓库分析已失效，请重新分析。')
      const { ensureAccountDecisionWarehouseActions } =
        await import('../decision/accountDecisionWarehouseLazyProjection')
      requestOptions?.signal?.throwIfAborted()
      if (runs.get(query.runId) !== run) throw new Error('本次仓库分析已失效，请重新分析。')
      const result = ensureAccountDecisionWarehouseActions(run)
      await requireCompiledRuntimeWithSignal(requireCompiledRuntime, requestOptions?.signal)
      if (runs.get(query.runId) !== run) throw new Error('本次仓库分析已失效，请重新分析。')
      return result
    },

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

    async queryDevelopmentCandidateAlternatives(request) {
      const query = structuredClone(request)
      if (query.contractVersion !== calculationQueryContractVersion)
        throw new Error(`Unsupported Calculation/Query contract: ${query.contractVersion}.`)
      const resourceGrantValidation = validateSourceResourceGrantDeclaration32(
        query.resourceGrantDeclaration32,
      )
      if (resourceGrantValidation.status === 'invalid')
        throw new Error('资源到账声明格式无效，请重新填写后分析。')
      const resourceGrantDeclaration32 =
        resourceGrantValidation.status === 'valid' ? resourceGrantValidation.declaration : undefined
      await requireCompiledRuntime()
      const run = runs.get(query.runId)
      if (!run) throw new Error(`Account Decision run is unavailable: ${query.runId}.`)
      const accountId = run.input.warehouse.accountId
      if (!accountId) throw new Error(`Account Decision run has no account: ${query.runId}.`)
      if (
        query.wEngineComparison &&
        (!Number.isSafeInteger(query.wEngineComparison.candidateRank) ||
          query.wEngineComparison.candidateRank < 1 ||
          !query.wEngineComparison.inputFingerprint ||
          !query.wEngineComparison.loadoutFingerprint ||
          (query.wEngineComparison.progressionMode !== undefined &&
            !['account_owned_if_available', 'theoretical_benchmark_only'].includes(
              query.wEngineComparison.progressionMode,
            )))
      )
        throw new Error('音擎比较须绑定当前账户及有效的六盘候选。')
      const eventConditionDeclarationsByAgentId = normalizeReviewedEventConditionDeclarations32(
        query.eventConditionDeclarationsByAgentId,
        [query.agentId],
      )
      const eventConditionDeclarationsIdentity = reviewedEventConditionDeclarationsIdentity32(
        eventConditionDeclarationsByAgentId,
      )
      const scenario = resolveCurrentPlanningScenario32(query.scenarioSelection)
      const resultCacheKey = stableContentHash({
        runId: run.runId,
        inputFingerprint: run.inputFingerprint,
        agentId: query.agentId,
        candidateParametersByRank: query.candidateParametersByRank ?? null,
        wEngineComparison: query.wEngineComparison ?? null,
        scenarioIdentity: scenario.identity,
        eventConditionDeclarationsIdentity,
        resourceGrantDeclaration32: resourceGrantDeclaration32 ?? null,
      })
      const cachedResult = candidateAlternatives.read(run, resultCacheKey)
      if (cachedResult) return cachedResult
      const evaluator = createDevelopmentValueBenchmarkEvaluator()
      const explicit = parseDevelopmentParametersByRank(query.candidateParametersByRank)
      const initialDirectionParameters = explicit[1]?.independentDirection ? explicit[1] : undefined
      const baseProjection = projectDevelopmentCandidateAlternatives(
        run.input,
        query.agentId,
        initialDirectionParameters,
        scenario.selection,
        eventConditionDeclarationsByAgentId?.[query.agentId],
        evaluator,
      )
      // The workbench's legacy assertion uses the default scenario, without explicit declarations.
      // Other scenarios keep that assertion's original fresh-solve path and cannot borrow this cache.
      if (
        scenario.identity === resolveCurrentPlanningScenario32().identity &&
        !eventConditionDeclarationsByAgentId?.[query.agentId] &&
        !initialDirectionParameters
      )
        candidateLoadouts.remember(run, query.agentId, baseProjection.candidates)
      const { projection, candidateSearchByRank, effectiveParametersByRank } =
        projectDevelopmentParameterizedCandidates({
          baseProjection,
          explicit,
          initialDirectionParameters,
          generate: (parameters) =>
            projectDevelopmentCandidateAlternatives(
              run.input,
              query.agentId,
              parameters,
              scenario.selection,
              eventConditionDeclarationsByAgentId?.[query.agentId],
              evaluator,
            ),
        })
      const valueBenchmarks = projectDevelopmentValueBenchmarks(
        {
          warehouse: run.input.warehouse,
          agentId: query.agentId,
          baseline: projection.baseline,
          candidates: projection.candidates,
          savedPlans: run.input.drafts,
          candidateParametersByRank: effectiveParametersByRank,
          scenarioSelection: scenario.selection,
          eventConditionDeclaration: eventConditionDeclarationsByAgentId?.[query.agentId],
          resourceGrantDeclaration32,
          stale: false,
        },
        evaluator,
      )
      const engineDiscs = query.wEngineComparison
        ? projection.candidates[query.wEngineComparison.candidateRank - 1]?.loadouts[0]?.discs.map(
            (row) => row.disc,
          )
        : undefined
      if (query.wEngineComparison && !engineDiscs)
        throw new Error('音擎比较候选已不可用，请重新比较。')
      const wEngineComparison = projectDevelopmentWEngineComparison({
        warehouse: run.input.warehouse,
        agentId: query.agentId,
        inputFingerprint: run.snapshot.fingerprint.inputHash,
        discs: engineDiscs ?? [],
        query: {
          ...query,
          candidateParametersByRank: effectiveParametersByRank,
          scenarioSelection: scenario.selection,
          eventConditionDeclarationsByAgentId,
          resourceGrantDeclaration32,
        },
        evaluator,
      })
      const result: Awaited<
        ReturnType<CalculationQueryClient['queryDevelopmentCandidateAlternatives']>
      > = {
        contract: 'soda-development-candidate-alternatives/v1',
        comparisonContract: 'soda-explicit-development-comparison/v1',
        comparisonFingerprint: stableContentHash({
          inputFingerprint: run.snapshot.fingerprint.inputHash,
          agentId: query.agentId,
          parameters: effectiveParametersByRank,
          scenarioIdentity: scenario.identity,
          eventConditionDeclarationsIdentity,
          ...(resourceGrantDeclaration32
            ? {
                resourceGrantDeclaration32: stableContentHash(resourceGrantDeclaration32),
              }
            : {}),
          candidateSearch: projection.candidateSearch,
          candidateSearchByRank,
          comparisons: valueBenchmarks.map((row) => row.candidate.calculationFingerprint),
          ...(wEngineComparison ? { wEngineComparison: wEngineComparison.fingerprint } : {}),
        }),
        candidateParametersByRank: effectiveParametersByRank,
        ...(wEngineComparison ? { wEngineComparison } : {}),
        scenarioSelection: scenario.selection,
        scenarioIdentity: scenario.identity,
        resourceGrantDeclaration32,
        eventConditionDeclarationsByAgentId,
        eventConditionDeclarationsIdentity,
        candidateSearchByRank,
        comparisonOptions: {
          reviewedEvent32: projectReviewedIncrementalEventMetadata32(query.agentId),
          wEngines:
            wEngineComparison?.entries ??
            projectDevelopmentWEngineOptions(run.input.warehouse, query.agentId),
          potentialSupported: supportsPotentialImage(query.agentId),
        },
        runId: run.runId,
        capturedAt: run.capturedAt,
        inputFingerprint: run.snapshot.fingerprint.inputHash,
        accountId,
        agentId: query.agentId,
        sideEffect: 'read_only',
        ...projection,
        valueBenchmarks,
        presentation: projectDevelopmentCandidatePresentation(
          query.agentId,
          projection.buildIntent.recommendations.find((row) => row.agentId === query.agentId)
            ?.constraint ?? undefined,
        ),
        panelPresentation: projectDevelopmentComparisonPanels({
          warehouse: run.input.warehouse,
          drafts: run.input.drafts ?? [],
          agentId: query.agentId,
          baseline: projection.baseline,
          candidates: projection.candidates,
          candidateParametersByRank: effectiveParametersByRank,
        }),
      }
      candidateAlternatives.remember(run, resultCacheKey, result)
      return result
    },
  }
  return client
}
