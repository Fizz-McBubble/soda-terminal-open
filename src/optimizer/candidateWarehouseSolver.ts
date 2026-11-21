import { optimizeAccountBuilds } from './optimizeAccountBuilds'
import { createCandidateWarehouseSolver } from './candidateWarehouseSolverCore'
export {
  candidateConstraintForAgent,
  getCandidateWarehouseProfiles,
} from './candidateWarehouseProfiles'
export {
  solveExactTeamWarehouseFitOracle,
  type ExactTeamWarehouseFitOracleResult,
} from './exactTeamWarehouseFitOracle'
export {
  candidateRecommendationForSetPlan,
  createAccountCandidateGenerationCache,
} from './candidateWarehouseSolverCore'
export type {
  CandidateWarehousePlan,
  CandidateWarehouseOptions,
} from './candidateWarehouseSolverCore'

export const {
  solveCandidateWarehouse,
  solveCandidateAgentAlternatives,
  solveCandidateTeamAlternatives,
} = createCandidateWarehouseSolver(optimizeAccountBuilds)
