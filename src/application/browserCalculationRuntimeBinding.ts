import type { BrowserCalculationQueryRequest } from './browserCalculationQueryProtocol'

export async function assertBrowserCalculationRuntimeBinding(
  request: Extract<BrowserCalculationQueryRequest, { kind: 'query' }>,
) {
  const { publicVersionIdentity: current } = await import('./publicVersionIdentity')
  const { runtime, resultProjection } = request
  if (
    runtime.status !== 'compiled_current' ||
    runtime.packageId !== current.packageId ||
    runtime.packageVersion !== current.packageVersion ||
    runtime.gameVersion !== current.gameVersion
  )
    throw new Error('游戏资料版本不匹配，请刷新页面后重试。')

  if (
    resultProjection === 'local' &&
    (import.meta.env.VITE_SODA_PUBLIC_BUILD === 'true' ||
      import.meta.env.VITE_SODA_COMMUNITY_BUILD === 'true')
  )
    throw new Error('当前构建不支持完整本地结果。')
}
