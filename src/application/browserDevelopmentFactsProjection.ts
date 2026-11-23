import { calculationQueryContractVersion } from './calculationQueryContract'
import type { BrowserCalculationQueryRequest } from './browserCalculationQueryProtocol'

type Query = Extract<BrowserCalculationQueryRequest, { kind: 'query' }>
type FactsQuery = Extract<
  Query['query'],
  { kind: 'development_directory_facts' | 'development_workbench_facts' }
>

/** Both transports read the same facts and use the same public projection. */
export async function projectBrowserDevelopmentFacts(
  query: FactsQuery,
  resultProjection: Query['resultProjection'],
) {
  if (resultProjection !== 'local' && resultProjection !== 'public-development')
    throw new Error('当前构建不支持个人事实结果。')
  if (query.contractVersion !== calculationQueryContractVersion || !query.operationId)
    throw new Error('个人事实请求格式无效。')
  if (query.kind === 'development_directory_facts') {
    const { projectDevelopmentDirectoryFacts } =
      await import('./developmentDirectoryFactsProjection')
    const result = projectDevelopmentDirectoryFacts(query)
    if (resultProjection === 'local') return result
    const { projectPublicDirectoryFacts } = await import('./publicPersonalDevelopmentTransport')
    return projectPublicDirectoryFacts(result)
  }
  const { projectDevelopmentWorkbenchFacts } = await import('./developmentWorkbenchFactsProjection')
  const result = projectDevelopmentWorkbenchFacts(query)
  if (resultProjection === 'local') return result
  const { projectPublicDevelopmentFacts } = await import('./publicPersonalDevelopmentTransport')
  return projectPublicDevelopmentFacts(result)
}
