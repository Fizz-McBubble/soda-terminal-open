import {
  browserCalculationQueryProtocolVersion,
  type BrowserCalculationQueryRequest,
  type BrowserCalculationQueryResponse,
} from './browserCalculationQueryProtocol'
import type { CurrentGameDataRuntimeSelection } from '../gameDataPacks/runtimeSelection'
import type { CalculationQueryClient } from './calculationQueryContract'
import { assertBrowserCalculationRuntimeBinding } from './browserCalculationRuntimeBinding'
import { projectBrowserDevelopmentFacts } from './browserDevelopmentFactsProjection'

type WorkerScope = {
  onmessage: ((event: MessageEvent<BrowserCalculationQueryRequest>) => void) | null
  postMessage(message: BrowserCalculationQueryResponse): void
}

let runtime: CurrentGameDataRuntimeSelection | null = null
let clientPromise: Promise<CalculationQueryClient> | undefined
let loadedClient: CalculationQueryClient | undefined
let personalService:
  | ReturnType<typeof import('./personalDevelopmentService').createPersonalDevelopmentService>
  | undefined
let personalPromise: Promise<NonNullable<typeof personalService>> | undefined
const personalGenerations = new Map<string, number>()
const pendingPersonalCounts = new Map<string, number>()
function getPersonalService() {
  personalPromise ??= import('./personalDevelopmentService')
    .then(({ createPersonalDevelopmentService }) => {
      personalService = createPersonalDevelopmentService()
      return personalService
    })
    .catch((error: unknown) => {
      personalPromise = undefined
      throw error
    })
  return personalPromise
}
const runGenerations = new Map<string, number>()
const pendingRunCounts = new Map<string, number>()
async function loadCompleteRankings() {
  const { ensureFullTeamIndexes } = await import('../decision/loadFullTeamIndexes')
  await ensureFullTeamIndexes()
}

async function withTeamIndexFallback<T>(project: () => T | Promise<T>, assertCurrent: () => void) {
  try {
    return await project()
  } catch (error) {
    if (!(error instanceof Error) || error.name !== 'FullTeamIndexesRequired') throw error
    assertCurrent()
    await loadCompleteRankings()
    assertCurrent()
    return project()
  }
}

function getClient() {
  if (!clientPromise) {
    clientPromise = Promise.all([
      import('./localCalculationQueryClientCore'),
      import('../decision/accountDecisionService'),
    ])
      .then(([core, service]) => {
        loadedClient = core.createLocalCalculationQueryClientCore({
          readRuntimeSelection: async () => {
            if (!runtime) throw new Error('游戏资料版本尚未校验。')
            return runtime
          },
          calculateSnapshot: async (input, options) => {
            options?.signal?.throwIfAborted()
            const snapshotInput = {
              ...input,
              deferDiagnosticInference: true,
              deferWarehouseAnalysis: true,
              preferBoxAdmission: true,
            } as const
            return withTeamIndexFallback(
              () => service.buildAccountDecisionSnapshot(snapshotInput),
              () => options?.signal?.throwIfAborted(),
            )
          },
        })
        return loadedClient
      })
      .catch((error: unknown) => {
        clientPromise = undefined
        throw error
      })
  }
  return clientPromise
}

export async function calculateBrowserQueryResponse(
  request: BrowserCalculationQueryRequest,
): Promise<BrowserCalculationQueryResponse | null> {
  if (request.kind === 'prepare_account_decision') {
    if (request.protocolVersion !== browserCalculationQueryProtocolVersion) return null
    // Share the same module loads as the next query. Preparation carries no account input.
    await Promise.all([
      getClient(),
      import('./publicVersionIdentity'),
      import('./calculationQueryDispatch'),
      import('./publicCalculationTransport'),
    ]).catch(() => undefined)
    return null
  }
  if (request.kind === 'release_personal') {
    if (pendingPersonalCounts.has(request.sessionId))
      personalGenerations.set(
        request.sessionId,
        (personalGenerations.get(request.sessionId) ?? 0) + 1,
      )
    personalService?.release(request.sessionId)
    return null
  }
  if (request.kind === 'release') {
    const runId = request.runId
    if (pendingRunCounts.has(runId)) runGenerations.set(runId, (runGenerations.get(runId) ?? 0) + 1)
    loadedClient?.releaseAccountDecisionRun?.(runId)
    return null
  }
  const response = {
    protocolVersion: browserCalculationQueryProtocolVersion,
    requestId: request.requestId,
  } as const
  if (request.protocolVersion !== browserCalculationQueryProtocolVersion)
    return { ...response, status: 'failed', error: '计算版本不匹配，请刷新页面后重试。' }
  const runId = 'runId' in request.query ? request.query.runId : null
  if (runId) pendingRunCounts.set(runId, (pendingRunCounts.get(runId) ?? 0) + 1)
  if (runId && request.query.kind === 'account_decision')
    runGenerations.set(runId, (runGenerations.get(runId) ?? 0) + 1)
  const generation = runId ? (runGenerations.get(runId) ?? 0) : null
  const released = () => runId !== null && (runGenerations.get(runId) ?? 0) !== generation
  const personalId = 'sessionId' in request.query ? request.query.sessionId : null
  if (personalId)
    pendingPersonalCounts.set(personalId, (pendingPersonalCounts.get(personalId) ?? 0) + 1)
  if (personalId && request.query.kind === 'personal_development_open')
    personalGenerations.set(personalId, (personalGenerations.get(personalId) ?? 0) + 1)
  const personalGeneration = personalId ? (personalGenerations.get(personalId) ?? 0) : null
  const personalReleased = () =>
    personalId !== null && (personalGenerations.get(personalId) ?? 0) !== personalGeneration
  try {
    await assertBrowserCalculationRuntimeBinding(request)
    if (released()) return { ...response, status: 'failed', error: '本次分析已释放。' }
    runtime = request.runtime
    if (
      request.query.kind === 'personal_development_open' ||
      request.query.kind === 'personal_development_candidates' ||
      request.query.kind === 'personal_development_route'
    ) {
      if (!['local', 'public-development'].includes(request.resultProjection ?? ''))
        throw new Error('当前构建不支持个人搭配结果。')
      const { calculationQueryContractVersion } = await import('./calculationQueryContract')
      if (
        request.query.contractVersion !== calculationQueryContractVersion ||
        !request.query.operationId
      )
        throw new Error('个人搭配请求格式无效。')
      const service = await getPersonalService()
      if (personalReleased()) throw new Error('个人搭配会话已释放。')
      const result =
        request.query.kind === 'personal_development_open'
          ? service.open(request.query)
          : request.query.kind === 'personal_development_candidates'
            ? await service.query(request.query)
            : await service.route(request.query)
      if (personalReleased()) throw new Error('个人搭配会话已释放。')
      if (request.resultProjection === 'public-development') {
        const transport = await import('./publicPersonalDevelopmentTransport')
        if (personalReleased()) throw new Error('个人搭配会话已释放。')
        if (request.query.kind === 'personal_development_candidates')
          return {
            ...response,
            status: 'succeeded',
            result: transport.projectPublicPersonalCandidates(
              result as import('./publicPersonalDevelopment').PersonalDevelopmentCandidatesResult,
            ),
          }
        if (request.query.kind === 'personal_development_route')
          return {
            ...response,
            status: 'succeeded',
            result: transport.projectPublicPersonalRoute(
              result as import('./publicPersonalDevelopment').PersonalDevelopmentRoute,
            ),
          }
        const session = result as import('./publicPersonalDevelopment').PersonalDevelopmentSession
        return {
          ...response,
          status: 'succeeded',
          result: {
            contract: session.contract,
            sessionId: session.sessionId,
            accountId: session.accountId,
            inputFingerprint: session.inputFingerprint,
            capturedAt: session.capturedAt,
          },
        }
      }
      return { ...response, status: 'succeeded', result }
    }
    if (
      request.query.kind === 'development_workbench_facts' ||
      request.query.kind === 'development_directory_facts'
    ) {
      return {
        ...response,
        status: 'succeeded',
        result: await projectBrowserDevelopmentFacts(request.query, request.resultProjection),
      }
    }
    const [client, { dispatchCalculationQuery }, publicTransport] = await Promise.all([
      getClient(),
      import('./calculationQueryDispatch'),
      request.resultProjection === 'local'
        ? Promise.resolve(null)
        : import('./publicCalculationTransport'),
    ])
    const query = request.query
    if (
      query.kind === 'saved_team_solution_components' ||
      query.kind === 'decision_portfolio'
    )
      await loadCompleteRankings()
    const assertCurrent = () => {
      if (released()) throw new Error('本次分析已释放。')
    }
    assertCurrent()
    const result = await withTeamIndexFallback(
      () =>
        dispatchCalculationQuery(client, query, {
          transform: (kind, value) =>
            request.resultProjection !== 'local' &&
            (kind === 'account_decision' ||
              kind === 'warehouse_actions' ||
              kind === 'common_anomaly_settlement32' ||
              kind === 'planning_benchmark32')
              ? publicTransport!.projectPublicCalculationResult(kind, value)
              : value,
        }),
      assertCurrent,
    )
    assertCurrent()
    return { ...response, status: 'succeeded', result }
  } catch (error) {
    return {
      ...response,
      status: 'failed',
      error: error instanceof Error ? error.message : '计算失败。',
    }
  } finally {
    if (runId) {
      const remaining = (pendingRunCounts.get(runId) ?? 1) - 1
      if (remaining) pendingRunCounts.set(runId, remaining)
      else {
        pendingRunCounts.delete(runId)
        runGenerations.delete(runId)
      }
    }
    if (personalId) {
      const remaining = (pendingPersonalCounts.get(personalId) ?? 1) - 1
      if (remaining) pendingPersonalCounts.set(personalId, remaining)
      else {
        pendingPersonalCounts.delete(personalId)
        personalGenerations.delete(personalId)
      }
    }
  }
}

const workerScope = self as unknown as WorkerScope
workerScope.onmessage = (event) => {
  void calculateBrowserQueryResponse(event.data).then((response) => {
    if (response) workerScope.postMessage(response)
  })
}
// Module imports may take seconds to evaluate. A query sent before this handler exists can be
// lost in a module Worker, so the page dispatches only after this explicit readiness message.
workerScope.postMessage({
  protocolVersion: browserCalculationQueryProtocolVersion,
  requestId: 0,
  status: 'ready',
})
