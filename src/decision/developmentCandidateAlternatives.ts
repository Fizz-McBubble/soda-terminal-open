import { refineDevelopmentCandidates } from './developmentCandidateRefinement'
import type { CoreWarehouse } from '../accounts/coreFlow'
import type { DriveDisc } from '../domain/schemas'
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

export type DevelopmentCandidateAlternativesProjection =
  | {
      status: 'ready'
      baseline: DriveDisc[]
      candidates: CandidateWarehousePlan[]
      buildIntent: AgentIndependentBuildIntent
      gaps: string[]
    }
  | {
      status: 'unavailable'
      baseline: []
      candidates: []
      buildIntent: AgentIndependentBuildIntent
      gaps: string[]
    }

type DevelopmentCandidateAlternativesInput = {
  warehouse: CoreWarehouse
  developmentPriorityAgentIds: string[]
}

/** Read-only candidate comparison; candidate discs are not reserved before saving. */
export function projectDevelopmentCandidateAlternatives(
  input: DevelopmentCandidateAlternativesInput,
  agentId: string,
): DevelopmentCandidateAlternativesProjection {
  const agent = input.warehouse.roster.agents.find((item) => item.agentId === agentId)
  const panelInput = candidatePanelInputForAgent(agent)
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
      baseline: [],
      candidates: [],
      buildIntent,
      gaps: diagnostic.gaps.length ? diagnostic.gaps : ['仓库中暂未找到符合建议的完整六盘配装。'],
    }
  }
  candidates = refineDevelopmentCandidates({
    warehouse: input.warehouse,
    agentId,
    candidates,
    buildIntent,
  })
  return {
    status: 'ready',
    baseline,
    candidates,
    buildIntent,
    gaps: candidates.flatMap((candidate) => candidate.gaps),
  }
}
