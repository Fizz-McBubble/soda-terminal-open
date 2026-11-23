import { optimizeIndependentBuilds } from './optimizeIndependentBuilds'
import {
  createCandidateWarehouseSolver,
  type CandidateWarehouseOptions,
} from './candidateWarehouseSolverCore'
import type { DriveDisc } from '../domain/schemas'
import type { CandidateWarehouseRecommendation } from '../gameDataPacks/candidateWarehouseConstraints'
export {
  candidateRecommendationForSetPlan,
  createAccountCandidateGenerationCache,
} from './candidateWarehouseSolverCore'
export type {
  CandidateWarehousePlan,
  CandidateWarehouseOptions,
} from './candidateWarehouseSolverCore'

const independent = createCandidateWarehouseSolver(optimizeIndependentBuilds)
export function solveCandidateWarehouse(
  discs: DriveDisc[],
  agentIds: string[],
  scope: 'agent',
  options: CandidateWarehouseOptions = {},
  recommendations?: readonly CandidateWarehouseRecommendation[],
) {
  if (scope !== 'agent' || agentIds.length > 1 || options.teamAssignmentObjective !== undefined)
    throw new Error('单人仓库求解仅支持零或一个代理人，且不能使用队伍目标。')
  return independent.solveCandidateWarehouse(discs, agentIds, scope, options, recommendations)
}
export function solveCandidateAgentAlternatives(
  discs: DriveDisc[],
  agentId: string,
  limit = 3,
  options: CandidateWarehouseOptions = {},
  recommendations?: readonly CandidateWarehouseRecommendation[],
) {
  if (options.teamAssignmentObjective !== undefined)
    throw new Error('单人仓库求解不能使用队伍目标。')
  return independent.solveCandidateAgentAlternatives(
    discs,
    agentId,
    limit,
    options,
    recommendations,
  )
}
