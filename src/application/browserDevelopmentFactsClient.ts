import type {
  CalculationQueryClient,
  DevelopmentDirectoryFactsQuery,
  DevelopmentWorkbenchFactsQuery,
} from './calculationQueryContract'
import { calculationQueryContractVersion } from './calculationQueryContract'
import type { BrowserCalculationQuery } from './browserCalculationQueryProtocol'
import { isCurrentDevelopmentDirectoryFacts } from './publicDevelopmentDirectoryFacts'
import {
  DevelopmentWorkbenchFactsIdentityMismatch,
  developmentWorkbenchFactsFingerprint,
} from './publicDevelopmentWorkbenchFacts'
import { contentHash } from './contentHash'

export function createWorker() {
  return new Worker(new URL('./browserDevelopmentFacts.worker.ts', import.meta.url), {
    type: 'module',
  })
}

/** Reuses the caller's channel and abort policy; it does not own a queue or a Worker. */
export function createBrowserDevelopmentFactsClient(options: {
  factsLane: boolean
  submit: <T>(query: BrowserCalculationQuery, signal?: AbortSignal) => Promise<T>
  getFactsClient: () => CalculationQueryClient
  abortError: () => Error
}): Pick<
  CalculationQueryClient,
  'queryDevelopmentDirectoryFacts' | 'queryDevelopmentWorkbenchFacts'
> {
  return {
    async queryDevelopmentDirectoryFacts(request: DevelopmentDirectoryFactsQuery, requestOptions) {
      const query = structuredClone(request)
      if (query.contractVersion !== calculationQueryContractVersion || !query.operationId)
        throw new Error('养成目录事实请求格式无效。')
      if (requestOptions?.signal?.aborted) throw options.abortError()
      if (!options.factsLane)
        return options.getFactsClient().queryDevelopmentDirectoryFacts!(query, requestOptions)
      const result = await options.submit<
        Awaited<ReturnType<NonNullable<CalculationQueryClient['queryDevelopmentDirectoryFacts']>>>
      >(query, requestOptions?.signal)
      if (!isCurrentDevelopmentDirectoryFacts(result, query))
        throw new Error('养成目录事实与当前请求不一致，请重试。')
      return result
    },
    async queryDevelopmentWorkbenchFacts(request: DevelopmentWorkbenchFactsQuery, requestOptions) {
      const query = structuredClone(request)
      if (query.contractVersion !== calculationQueryContractVersion || !query.operationId)
        throw new Error('个人事实请求格式无效。')
      if (requestOptions?.signal?.aborted) throw options.abortError()
      if (!options.factsLane)
        return options.getFactsClient().queryDevelopmentWorkbenchFacts!(query, requestOptions)
      const result = await options.submit<
        Awaited<ReturnType<NonNullable<CalculationQueryClient['queryDevelopmentWorkbenchFacts']>>>
      >(query, requestOptions?.signal)
      if (
        !result ||
        result.contract !== 'soda-development-workbench-facts/v1' ||
        result.authority !== 'not_evaluated' ||
        result.accountId !== (query.input.warehouse.accountId ?? '') ||
        result.inputFingerprint !== developmentWorkbenchFactsFingerprint(query) ||
        contentHash(result.selection) !== contentHash(query.selection)
      )
        throw new DevelopmentWorkbenchFactsIdentityMismatch(
          '个人事实结果与当前请求不一致，请重试。',
        )
      return result
    },
  }
}
