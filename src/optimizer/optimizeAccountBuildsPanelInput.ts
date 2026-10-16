import type { RosterAgent } from '../assault/types'
import type { CandidatePanelInput } from './optimizeBuild'
import { hasCandidatePanelObjective } from './candidatePanelObjective'
import { hasCurrentWEngineProgression } from '../decision/wEngineResolver'
export function candidatePanelInputForAgent(
  agent:
    | Pick<
        RosterAgent,
        | 'agentId'
        | 'level'
        | 'skillLevels'
        | 'wEngineDetails'
        | 'mindscape'
        | 'potentialImage'
        | 'observedFacts'
      >
    | undefined,
): CandidatePanelInput | undefined {
  if (
    !agent ||
    !hasCurrentWEngineProgression(agent) ||
    !hasCandidatePanelObjective(agent.agentId) ||
    agent.level !== 60 ||
    agent.skillLevels.core !== 7 ||
    !agent.wEngineDetails.id ||
    agent.wEngineDetails.level !== 60 ||
    (agent.wEngineDetails.ascension !== undefined && agent.wEngineDetails.ascension !== 5) ||
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
    potentialImage: agent.potentialImage,
    wEngine: {
      id: agent.wEngineDetails.id,
      level: agent.wEngineDetails.level,
      ascension: 5,
      refinement: agent.wEngineDetails.refinement,
    },
  }
}

/** Scheme operands are explicit hypothetical equipment, never current item observations. */
export function candidatePanelInputForSchemeAgent(
  agent: RosterAgent,
  engine: { engineId: string; refinement: number; level?: number; ascension?: number | null },
): CandidatePanelInput | undefined {
  return candidatePanelInputForAgent({
    ...agent,
    observedFacts: undefined,
    wEngineDetails: {
      id: engine.engineId,
      name: null,
      level: engine.level ?? 60,
      ascension: engine.ascension === undefined ? 5 : engine.ascension,
      refinement: engine.refinement,
    },
  })
}
