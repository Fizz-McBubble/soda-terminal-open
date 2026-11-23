import {
  optimizeAccountBuildsCore,
  type AccountOptimizerOptions,
} from './optimizeAccountBuildsCore'
import { searchTeamAssignments } from './searchTeamAssignments'
import { dynamicRecommendableInventory, compileDynamicCandidateLoadout } from './teamDynamicDomain'
import type { DriveDisc } from '../domain/schemas'
import type { AgentDiscProfile } from '../assault/engine'
export * from './optimizeAccountBuildsCore'
export { candidatePanelInputsForScheme } from './candidatePanelInputsForScheme'
export { candidatePanelInputForAgent } from './optimizeAccountBuildsPanelInput'

const teamRuntime = {
  searchTeamAssignments,
  dynamicRecommendableInventory,
  compileDynamicCandidateLoadout,
}
export function optimizeAccountBuilds(
  discs: DriveDisc[],
  profiles: AgentDiscProfile[],
  options: AccountOptimizerOptions = {},
) {
  return optimizeAccountBuildsCore(discs, profiles, options, teamRuntime)
}
