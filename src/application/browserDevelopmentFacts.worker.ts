import {
  browserCalculationQueryProtocolVersion,
  type BrowserCalculationQueryRequest,
  type BrowserCalculationQueryResponse,
} from './browserCalculationQueryProtocol'
import { assertBrowserCalculationRuntimeBinding } from './browserCalculationRuntimeBinding'
import { projectBrowserDevelopmentFacts } from './browserDevelopmentFactsProjection'

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<BrowserCalculationQueryRequest>) => Promise<void>) | null
  postMessage(message: BrowserCalculationQueryResponse): void
}

// The facts lane has no captured runs or sessions to release.
scope.onmessage = async ({ data: request }) => {
  if (request.kind !== 'query') return
  const response = {
    protocolVersion: browserCalculationQueryProtocolVersion,
    requestId: request.requestId,
  } as const
  try {
    if (request.protocolVersion !== browserCalculationQueryProtocolVersion)
      throw new Error('计算版本不匹配，请刷新页面后重试。')
    const { query, resultProjection } = request
    if (
      query.kind !== 'development_directory_facts' &&
      query.kind !== 'development_workbench_facts'
    )
      throw new Error('当前通道不支持该养成请求。')
    await assertBrowserCalculationRuntimeBinding(request)
    const result = await projectBrowserDevelopmentFacts(query, resultProjection)
    scope.postMessage({ ...response, status: 'succeeded', result })
  } catch (error) {
    scope.postMessage({
      ...response,
      status: 'failed',
      error: error instanceof Error ? error.message : '个人事实读取失败。',
    })
  }
}

scope.postMessage({
  protocolVersion: browserCalculationQueryProtocolVersion,
  requestId: 0,
  status: 'ready',
})
