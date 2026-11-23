import type { AccountDecisionSnapshotCalculator } from './browserAccountDecisionWorker'
import { readCurrentGameDataRuntimeSelection } from '../gameDataPacks/runtimeSelection'
import type { CurrentGameDataRuntimeSelection } from '../gameDataPacks/runtimeSelection'
import type { CalculationQueryClient } from './calculationQueryContract'
import { calculationQueryContractVersion } from './calculationQueryContract'
import { createBrowserCalculationQueryClient } from './browserCalculationQueryClient'
import { browserCalculationInputFingerprint } from './browserCalculationInputFingerprint'
import { isCurrentDevelopmentDirectoryFacts } from './publicDevelopmentDirectoryFacts'

/** Explicit in-process composition for non-browser hosts and isolated adapters. */
export function createLocalCalculationQueryClient(
  options: {
    readRuntimeSelection?: () => Promise<CurrentGameDataRuntimeSelection>
    calculateSnapshot?: AccountDecisionSnapshotCalculator
  } = {},
): CalculationQueryClient {
  let client: CalculationQueryClient | undefined
  let loading: Promise<CalculationQueryClient> | undefined
  let personalService:
    | ReturnType<typeof import('./personalDevelopmentService').createPersonalDevelopmentService>
    | undefined
  let personalLoading: Promise<NonNullable<typeof personalService>> | undefined
  const personalTokens = new Map<string, object>()
  async function getPersonalService() {
    personalLoading ??= import('./personalDevelopmentService')
      .then(({ createPersonalDevelopmentService }) => {
        personalService = createPersonalDevelopmentService()
        return personalService
      })
      .catch((error: unknown) => {
        personalLoading = undefined
        throw error
      })
    return personalLoading
  }
  async function personalRuntime(signal?: AbortSignal) {
    signal?.throwIfAborted()
    const runtime = await (options.readRuntimeSelection ?? readCurrentGameDataRuntimeSelection)()
    if (runtime.status !== 'compiled_current') throw new Error(runtime.message)
    signal?.throwIfAborted()
  }
  const pendingRuns = new Map<string, object>()
  const fingerprints = new Map<string, { browser: string; core: string }>()
  const getClient = () => {
    if (!loading) {
      loading = Promise.all([
        import('./localCalculationQueryClientCore'),
        options.calculateSnapshot
          ? Promise.resolve(null)
          : import('./browserAccountDecisionWorker'),
      ])
        .then(([core, worker]) => {
          client = core.createLocalCalculationQueryClientCore({
            readRuntimeSelection:
              options.readRuntimeSelection ?? readCurrentGameDataRuntimeSelection,
            calculateSnapshot:
              options.calculateSnapshot ??
              worker!.createDefaultAccountDecisionSnapshotCalculator().calculateSnapshot,
          })
          return client
        })
        .catch((error: unknown) => {
          loading = undefined
          throw error
        })
    }
    return loading
  }
  return {
    async openPersonalDevelopmentSession(request, requestOptions) {
      const query = structuredClone(request)
      if (query.contractVersion !== calculationQueryContractVersion || !query.operationId)
        throw new Error('个人搭配请求格式无效。')
      const token = {}
      personalTokens.set(query.sessionId, token)
      try {
        await personalRuntime(requestOptions?.signal)
        const service = await getPersonalService()
        requestOptions?.signal?.throwIfAborted()
        if (personalTokens.get(query.sessionId) !== token) throw new Error('个人搭配会话已释放。')
        return service.open(query)
      } catch (error) {
        if (personalTokens.get(query.sessionId) === token) personalTokens.delete(query.sessionId)
        throw error
      }
    },
    async queryPersonalDevelopmentCandidates(request, requestOptions) {
      const query = structuredClone(request)
      if (query.contractVersion !== calculationQueryContractVersion || !query.operationId)
        throw new Error('个人搭配请求格式无效。')
      const token = personalTokens.get(query.sessionId)
      if (!token) throw new Error('个人搭配会话已释放。')
      await personalRuntime(requestOptions?.signal)
      const service = await getPersonalService()
      requestOptions?.signal?.throwIfAborted()
      if (personalTokens.get(query.sessionId) !== token) throw new Error('个人搭配会话已释放。')
      const result = await service.query(query)
      requestOptions?.signal?.throwIfAborted()
      if (personalTokens.get(query.sessionId) !== token) throw new Error('个人搭配会话已释放。')
      return result
    },
    async queryPersonalDevelopmentRoute(request, requestOptions) {
      const query = structuredClone(request)
      if (query.contractVersion !== calculationQueryContractVersion || !query.operationId)
        throw new Error('个人搭配请求格式无效。')
      const token = personalTokens.get(query.sessionId)
      if (!token) throw new Error('个人搭配会话已释放。')
      await personalRuntime(requestOptions?.signal)
      const service = await getPersonalService()
      requestOptions?.signal?.throwIfAborted()
      if (personalTokens.get(query.sessionId) !== token) throw new Error('个人搭配会话已释放。')
      const result = await service.route(query)
      requestOptions?.signal?.throwIfAborted()
      if (personalTokens.get(query.sessionId) !== token) throw new Error('个人搭配会话已释放。')
      return result
    },
    releasePersonalDevelopmentSession(sessionId) {
      personalTokens.delete(sessionId)
      personalService?.release(sessionId)
    },
    hasPersonalDevelopmentSession(sessionId) {
      return personalTokens.has(sessionId)
    },
    async queryDevelopmentDirectoryFacts(request, requestOptions) {
      const query = structuredClone(request)
      if (query.contractVersion !== calculationQueryContractVersion || !query.operationId)
        throw new Error('养成目录事实请求格式无效。')
      requestOptions?.signal?.throwIfAborted()
      let runtime: CurrentGameDataRuntimeSelection
      try {
        runtime = await (options.readRuntimeSelection ?? readCurrentGameDataRuntimeSelection)()
      } catch {
        throw new Error('无法读取游戏资料，请恢复与当前应用配套的资料后重新分析。')
      }
      if (runtime.status !== 'compiled_current') throw new Error(runtime.message)
      requestOptions?.signal?.throwIfAborted()
      const { projectDevelopmentDirectoryFacts } =
        await import('./developmentDirectoryFactsProjection')
      requestOptions?.signal?.throwIfAborted()
      const result = projectDevelopmentDirectoryFacts(query)
      if (!isCurrentDevelopmentDirectoryFacts(result, query))
        throw new Error('养成目录事实与当前请求不一致，请重试。')
      return result
    },
    async queryDevelopmentWorkbenchFacts(request, requestOptions) {
      const query = structuredClone(request)
      if (query.contractVersion !== calculationQueryContractVersion || !query.operationId)
        throw new Error('个人事实请求格式无效。')
      requestOptions?.signal?.throwIfAborted()
      let runtime: CurrentGameDataRuntimeSelection
      try {
        runtime = await (options.readRuntimeSelection ?? readCurrentGameDataRuntimeSelection)()
      } catch {
        throw new Error('无法读取游戏资料，请恢复与当前应用配套的资料后重新分析。')
      }
      if (runtime.status !== 'compiled_current') throw new Error(runtime.message)
      requestOptions?.signal?.throwIfAborted()
      const { projectDevelopmentWorkbenchFacts } =
        await import('./developmentWorkbenchFactsProjection')
      requestOptions?.signal?.throwIfAborted()
      return projectDevelopmentWorkbenchFacts(query)
    },
    fingerprintAccountDecisionInput(input, currentRunId) {
      const browser = browserCalculationInputFingerprint(input)
      const matched = currentRunId ? fingerprints.get(currentRunId) : undefined
      return matched?.browser === browser ? matched.core : browser
    },
    releaseAccountDecisionRun(runId) {
      pendingRuns.delete(runId)
      fingerprints.delete(runId)
      client?.releaseAccountDecisionRun?.(runId)
    },
    async calculateAccountDecision(query) {
      const captured = structuredClone(query)
      const token = {}
      pendingRuns.set(captured.runId, token)
      try {
        const local = await getClient()
        if (pendingRuns.get(captured.runId) !== token) {
          const error = new Error('已取消本次计算。')
          error.name = 'AbortError'
          throw error
        }
        const result = await local.calculateAccountDecision(captured)
        if (pendingRuns.get(captured.runId) !== token) {
          const error = new Error('已取消本次计算。')
          error.name = 'AbortError'
          throw error
        }
        fingerprints.set(captured.runId, {
          browser: browserCalculationInputFingerprint(captured.input),
          core: result.inputFingerprint,
        })
        return result
      } finally {
        if (pendingRuns.get(captured.runId) === token) pendingRuns.delete(captured.runId)
      }
    },
    async queryDecisionPortfolio(query) {
      return (await getClient()).queryDecisionPortfolio(query)
    },
    async calculateTargetTeamWarehouseFit(query, requestOptions) {
      return (await getClient()).calculateTargetTeamWarehouseFit(query, requestOptions)
    },
    async queryTeamOverviewPresentation(query, internal) {
      return (await getClient()).queryTeamOverviewPresentation(query, internal)
    },
    async queryTeamRoutePresentation(query, requestOptions) {
      return (await getClient()).queryTeamRoutePresentation(query, requestOptions)
    },
    async querySavedTeamPlanReplay(query) {
      return (await getClient()).querySavedTeamPlanReplay(query)
    },
    async querySavedTeamSolutionComponents(query) {
      return (await getClient()).querySavedTeamSolutionComponents(query)
    },
    async queryDevelopmentCandidateAlternatives(query, requestOptions) {
      return (await getClient()).queryDevelopmentCandidateAlternatives(query, requestOptions)
    },
    async queryDevelopmentWorkbenchRoute(query) {
      return (await getClient()).queryDevelopmentWorkbenchRoute(query)
    },
    async queryWarehouseActions(query, requestOptions) {
      return (await getClient()).queryWarehouseActions!(query, requestOptions)
    },
    async queryWarehouseDiscTransitionUses(query, requestOptions) {
      return (await getClient()).queryWarehouseDiscTransitionUses!(query, requestOptions)
    },
    async queryCommonAnomalySettlement32(query) {
      return (await getClient()).queryCommonAnomalySettlement32!(query)
    },
    async queryPlanningBenchmark32(query) {
      return (await getClient()).queryPlanningBenchmark32!(query)
    },
    async queryReviewedIncrementalEvent32(query) {
      return (await getClient()).queryReviewedIncrementalEvent32!(query)
    },
  }
}

// Use the existing whole-Query Worker in a browser. Standard-reference search must
// not freeze editing, account navigation or saved-plan recovery on the UI thread.
export const localCalculationQueryClient =
  typeof window !== 'undefined' && typeof Worker !== 'undefined'
    ? createBrowserCalculationQueryClient({
        readRuntimeSelection: readCurrentGameDataRuntimeSelection,
        resultProjection: 'local',
      })
    : createLocalCalculationQueryClient()
