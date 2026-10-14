import { refineDevelopmentCandidates } from './developmentCandidateRefinement'
import type { CurrentPlanningScenarioSelection32 } from '../application/publicPlanningScenarioContract'
import { searchDevelopmentDynamicCandidates } from './developmentDynamicSearch'
import type { CoreWarehouse } from '../accounts/coreFlow'
import type { DriveDisc } from '../domain/schemas'
import type { DevelopmentComparisonParameters } from './developmentValueBenchmark'
import { candidatePanelInputForAgent } from '../optimizer/optimizeAccountBuilds'
import {
  solveCandidateAgentAlternatives,
  solveCandidateWarehouse,
  type CandidateWarehousePlan,
} from '../optimizer/candidateWarehouseSolver'
import {
  compileAgentBuildIntent,
  optimizerOptionsFromBuildIntent,
  type AgentIndependentBuildIntent,
} from './buildIntent'

export type DevelopmentCandidateSearch = {
  rankingMethod: 'dynamic_objective' | 'source_and_local_refinement'
  status:
    | 'not_run'
    | NonNullable<ReturnType<typeof searchDevelopmentDynamicCandidates>['search']>['status']
  nodes: number
  evaluations: number
  exactWithinDeclaredModel: boolean
  productionGameAccuracyCertified: false
}

export type DevelopmentCandidateAlternativesProjection =
  | {
      status: 'ready'
      baseline: DriveDisc[]
      candidates: CandidateWarehousePlan[]
      buildIntent: AgentIndependentBuildIntent
      gaps: string[]
      candidateSearch?: DevelopmentCandidateSearch
    }
  | {
      status: 'unavailable'
      baseline: []
      candidates: []
      buildIntent: AgentIndependentBuildIntent
      gaps: string[]
      candidateSearch?: DevelopmentCandidateSearch
    }

type DevelopmentCandidateAlternativesInput = {
  warehouse: CoreWarehouse
  developmentPriorityAgentIds: string[]
}

/** Read-only candidate comparison; candidate discs are not reserved before saving. */
export function projectDevelopmentCandidateAlternatives(
  input: DevelopmentCandidateAlternativesInput,
  agentId: string,
  parameters?: DevelopmentComparisonParameters,
  scenarioSelection?: CurrentPlanningScenarioSelection32,
  eventConditionDeclaration?: import('../calculation/reviewedTemplateEventConditions32').ReviewedTemplateEventConditionDeclaration32,
): DevelopmentCandidateAlternativesProjection {
  const agent = input.warehouse.roster.agents.find((item) => item.agentId === agentId)
  const panelInput = candidatePanelInputForAgent(
    agent && parameters
      ? {
          ...agent,
          potentialImage: parameters.potential ?? agent.potentialImage,
          wEngineDetails: parameters.wEngine
            ? {
                id: parameters.wEngine.engineId,
                name: parameters.wEngine.engineId,
                level: parameters.wEngine.level,
                ascension: parameters.wEngine.ascension,
                refinement: parameters.wEngine.refinement,
              }
            : agent.wEngineDetails,
        }
      : agent,
  )
  const buildIntent = compileAgentBuildIntent({
    agentId,
    developmentPriorityAgentIds: input.developmentPriorityAgentIds,
    ...(panelInput ? { optimizerOptions: { panelInputsByAgent: { [agentId]: panelInput } } } : {}),
  })
  if (!agent?.owned)
    return {
      status: 'unavailable',
      baseline: [],
      candidates: [],
      buildIntent,
      gaps: ['请先将该代理人标记为已拥有。'],
    }

  const baselineIds = agent.equippedDiscIds ?? []
  const baseline = input.warehouse.discs
    .filter((disc) => baselineIds.includes(disc.id))
    .toSorted((left, right) => left.slot - right.slot)
  let candidates = solveCandidateAgentAlternatives(
    input.warehouse.discs,
    agentId,
    10,
    optimizerOptionsFromBuildIntent(buildIntent),
    buildIntent.recommendations,
  )
  candidates = refineDevelopmentCandidates({
    scenarioSelection,
    eventConditionDeclaration,
    warehouse: input.warehouse,
    agentId,
    candidates,
    buildIntent,
    parameters,
  })
  const dynamic = searchDevelopmentDynamicCandidates({
    scenarioSelection,
    eventConditionDeclaration,
    warehouse: input.warehouse,
    agentId,
    candidates,
    buildIntent,
    parameters,
  })
  candidates = dynamic.candidates
  const candidateSearch: DevelopmentCandidateSearch = {
    rankingMethod: dynamic.rankingApplied ? 'dynamic_objective' : 'source_and_local_refinement',
    status: dynamic.search?.status ?? 'not_run',
    nodes: dynamic.search?.nodes ?? 0,
    evaluations: dynamic.search?.evaluations ?? 0,
    exactWithinDeclaredModel: dynamic.search?.exactWithinDeclaredModel ?? false,
    productionGameAccuracyCertified: false,
  }
  if (!candidates.length) {
    const diagnostic = solveCandidateWarehouse(
      input.warehouse.discs,
      [agentId],
      'agent',
      optimizerOptionsFromBuildIntent(buildIntent),
      buildIntent.recommendations,
    )
    return {
      status: 'unavailable',
      candidateSearch,
      baseline: [],
      candidates: [],
      buildIntent,
      gaps: diagnostic.gaps.length ? diagnostic.gaps : ['仓库中暂未找到符合建议的完整六盘配装。'],
    }
  }
  return {
    status: 'ready',
    candidateSearch,
    baseline,
    candidates,
    buildIntent,
    gaps: candidates.flatMap((candidate) => candidate.gaps),
  }
}
