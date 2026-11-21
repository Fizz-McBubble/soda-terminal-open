import type { BrowserCalculationQuery } from './browserCalculationQueryProtocol'
import type { CalculationQueryClient } from './calculationQueryContract'
import { acceptReviewedIncrementalEventResult32 } from './publicReviewedIncrementalEvent32'
import { acceptCommonAnomalySettlementQuery32 } from './publicCommonAnomalySettlementQuery32'
import { acceptPlanningBenchmarkResult32 } from './publicPlanningBenchmark32'
import { planningEventDeclarationsInputFingerprint32 } from './publicPlanningEventDeclarations32'

export function createBrowserPlanningQueries(
  submit: <T>(query: BrowserCalculationQuery) => Promise<T>,
): Pick<
  CalculationQueryClient,
  'queryCommonAnomalySettlement32' | 'queryPlanningBenchmark32' | 'queryReviewedIncrementalEvent32'
> {
  return {
    async queryCommonAnomalySettlement32(request) {
      const query = structuredClone(request)
      return acceptCommonAnomalySettlementQuery32(await submit(query), query)
    },
    async queryReviewedIncrementalEvent32(query) {
      return acceptReviewedIncrementalEventResult32(await submit(query), query.runId, query.input)
    },
    async queryPlanningBenchmark32(request) {
      const query = structuredClone(request)
      if (query.declarations && !query.sourceBindingFingerprint)
        throw new Error('请先获取当前配装的事件声明来源，再提交计算。')
      return acceptPlanningBenchmarkResult32(await submit(query), {
        runId: query.runId,
        candidateId: query.candidateId,
        fitFingerprint: query.fitFingerprint,
        accountFingerprint: query.accountFingerprint,
        inputFingerprint: query.declarations
          ? planningEventDeclarationsInputFingerprint32(query.declarations)
          : null,
        sourceBindingFingerprint: query.sourceBindingFingerprint,
      })
    },
  }
}
