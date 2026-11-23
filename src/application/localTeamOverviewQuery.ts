import { buildAccountDecisionInputFingerprint } from '../decision/accountDecisionFingerprint'
import {
  calculationQueryContractVersion,
  type AccountDecisionRun,
  type CalculationQueryClient,
  type TargetTeamWarehouseFitQueryResult,
} from './calculationQueryContract'
import { prepareRemainingBox } from './remainingBox'
import { loadBoxOverviewSelection } from './boxAdmissionQueryProjection'

export function createLocalTeamOverviewQuery(
  runs: ReadonlyMap<string, AccountDecisionRun>,
  teamFits: ReadonlyMap<string, ReadonlyMap<string, TargetTeamWarehouseFitQueryResult>>,
  requireCompiledRuntime: () => Promise<unknown>,
): CalculationQueryClient['queryTeamOverviewPresentation'] {
  return async (query, internal) => {
    if (query.contractVersion !== calculationQueryContractVersion)
      throw new Error(`Unsupported Calculation/Query contract: ${query.contractVersion}.`)
    await requireCompiledRuntime()
    const run = runs.get(query.runId)
    if (!run) throw new Error(`Account Decision run is unavailable: ${query.runId}.`)
    const { projectPrivateTeamOverview } =
      await import('../pages/privateTeamLoadoutPresentationProducer')
    const fits = (query.fitCandidateIds ?? []).map((id) => {
      const fit = teamFits.get(run.runId)?.get(id)
      if (!fit) throw new Error('队伍配装结果已失效，请重新分析。')
      return fit
    })
    let source
    if (!query.sourceRunId) {
      if (query.reservedPlanIds?.length) throw new Error('队伍展示上下文无效。')
    } else {
      source = runs.get(query.sourceRunId) ?? internal?.sourceRun
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
    }
    return projectPrivateTeamOverview(
      loadBoxOverviewSelection(run, query.selection, query.fitCandidateIds),
      query.context,
      source,
      fits,
    )
  }
}
