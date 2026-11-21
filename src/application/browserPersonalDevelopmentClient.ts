import { browserCalculationInputFingerprint } from './browserCalculationInputFingerprint'
import { unpackPublicWarehouseActions } from './publicWarehouseActionTransport'
import {
  calculationQueryContractVersion,
  type CalculationQueryClient,
} from './calculationQueryContract'
import { type BrowserCalculationQuery } from './browserCalculationQueryProtocol'
import { personalDevelopmentInputFingerprint } from './publicPersonalDevelopment'
import { contentHash } from './contentHash'

export function createBrowserPersonalDevelopmentClient(options: {
  personalLane: boolean
  publicDevelopment: boolean
  submit: <T>(query: BrowserCalculationQuery, signal?: AbortSignal) => Promise<T>
  getPersonalClient: () => CalculationQueryClient
  release: (sessionId: string) => void
  register: (sessionId: string) => void
  has: (sessionId: string) => boolean
}): Pick<
  CalculationQueryClient,
  | 'openPersonalDevelopmentSession'
  | 'queryPersonalDevelopmentCandidates'
  | 'queryPersonalDevelopmentRoute'
  | 'releasePersonalDevelopmentSession'
  | 'hasPersonalDevelopmentSession'
> {
  const check = (query: { contractVersion: string; operationId: string }, signal?: AbortSignal) => {
    if (query.contractVersion !== calculationQueryContractVersion || !query.operationId)
      throw new Error('个人搭配请求格式无效。')
    signal?.throwIfAborted()
  }
  return {
    async openPersonalDevelopmentSession(request, requestOptions) {
      const query = structuredClone(request)
      check(query, requestOptions?.signal)
      if (!options.personalLane)
        return options.getPersonalClient().openPersonalDevelopmentSession!(query, requestOptions)
      const result = await options.submit<
        Awaited<ReturnType<NonNullable<CalculationQueryClient['openPersonalDevelopmentSession']>>>
      >(query, requestOptions?.signal)
      if (
        !result ||
        result.contract !== 'soda-personal-development-session/v1' ||
        result.sessionId !== query.sessionId ||
        result.accountId !== query.input.warehouse.accountId ||
        result.capturedAt !== query.capturedAt ||
        result.inputFingerprint !== personalDevelopmentInputFingerprint(query.input)
      )
        throw new Error('个人搭配会话与当前输入不一致。')
      options.register(query.sessionId)
      return result
    },
    async queryPersonalDevelopmentCandidates(request, requestOptions) {
      const query = structuredClone(request)
      check(query, requestOptions?.signal)
      if (!options.personalLane)
        return options.getPersonalClient().queryPersonalDevelopmentCandidates!(
          query,
          requestOptions,
        )
      const result = await options.submit<
        Awaited<
          ReturnType<NonNullable<CalculationQueryClient['queryPersonalDevelopmentCandidates']>>
        >
      >(query, requestOptions?.signal)
      if (
        !result ||
        result.sessionContract !== 'soda-personal-development-session/v1' ||
        result.sessionId !== query.sessionId ||
        result.accountId !== query.accountId ||
        result.agentId !== query.agentId ||
        result.inputFingerprint !== query.inputFingerprint ||
        result.mode !== query.mode ||
        (options.publicDevelopment &&
          result.publicProjection !== 'soda-public-personal-development/v1') ||
        !result.generationIdentity
      )
        throw new Error('个人搭配结果与当前输入不一致。')
      return result
    },
    async queryPersonalDevelopmentRoute(request, requestOptions) {
      const query = structuredClone(request)
      check(query, requestOptions?.signal)
      if (!options.personalLane)
        return options.getPersonalClient().queryPersonalDevelopmentRoute!(query, requestOptions)
      const result = await options.submit<
        Awaited<ReturnType<NonNullable<CalculationQueryClient['queryPersonalDevelopmentRoute']>>>
      >(query, requestOptions?.signal)
      if (
        !result ||
        result.contract !== 'soda-personal-development-route/v1' ||
        result.sessionId !== query.sessionId ||
        result.accountId !== query.accountId ||
        result.inputFingerprint !== query.inputFingerprint ||
        result.generationIdentity !== query.generationIdentity ||
        contentHash(result.selection) !== contentHash(query.selection)
      )
        throw new Error('个人搭配预览与当前输入不一致。')
      return result
    },
    releasePersonalDevelopmentSession(sessionId) {
      if (options.personalLane) options.release(sessionId)
      else options.getPersonalClient().releasePersonalDevelopmentSession?.(sessionId)
    },
    hasPersonalDevelopmentSession(sessionId) {
      return options.personalLane
        ? options.has(sessionId)
        : (options.getPersonalClient().hasPersonalDevelopmentSession?.(sessionId) ?? false)
    },
  }
}

export function createBrowserAccountDecisionCalculation(options: {
  release(runId: string): void
  submit<T>(query: BrowserCalculationQuery, signal?: AbortSignal): Promise<T>
  liveRuns: Set<string>
  fingerprints: Map<string, { browser: string; core: string }>
  notifyRunChange(): void
}): Pick<CalculationQueryClient, 'calculateAccountDecision'> {
  const { release, submit, liveRuns, fingerprints, notifyRunChange } = options
  return {
    async calculateAccountDecision(query) {
      release(query.runId)
      const input = structuredClone(query.input)
      const browser = browserCalculationInputFingerprint(input)
      const run = await submit<
        Awaited<ReturnType<CalculationQueryClient['calculateAccountDecision']>>
      >({
        ...query,
        input,
      })
      liveRuns.add(query.runId)
      fingerprints.set(query.runId, { browser, core: run.inputFingerprint })
      notifyRunChange()
      return {
        ...run,
        input,
        warehouseActions: run.warehouseActions
          ? unpackPublicWarehouseActions(run.warehouseActions)
          : undefined,
      }
    },
  }
}
