import type { RosterAgent } from '../assault/types'
import type { CandidatePanelInput } from './optimizeBuild'
import { hasCandidatePanelObjective } from './candidatePanelObjective'
export function candidatePanelInputForAgent(
  agent:
    | Pick<RosterAgent, 'agentId' | 'level' | 'skillLevels' | 'wEngineDetails' | 'mindscape'>
    | undefined,
): CandidatePanelInput | undefined {
  if (
    !agent ||
    !hasCandidatePanelObjective(agent.agentId) ||
    agent.level !== 60 ||
    agent.skillLevels.core !== 7 ||
    !agent.wEngineDetails.id ||
    agent.wEngineDetails.level !== 60 ||
    !Number.isInteger(agent.wEngineDetails.refinement) ||
    agent.wEngineDetails.refinement == null ||
    agent.wEngineDetails.refinement < 1 ||
    agent.wEngineDetails.refinement > 5
  )
    return undefined
  return {
    agentId: agent.agentId,
    level: agent.level,
    ascension: 5,
    core: agent.skillLevels.core - 2,
    mindscape: agent.mindscape,
    wEngine: {
      id: agent.wEngineDetails.id,
      level: agent.wEngineDetails.level,
      ascension: 5,
      refinement: agent.wEngineDetails.refinement,
    },
  }
}
