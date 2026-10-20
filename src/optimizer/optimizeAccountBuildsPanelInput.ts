import type { RosterAgent } from '../assault/types'
import type { CandidatePanelInput } from './optimizeBuild'
import { hasCandidatePanelObjective } from './candidatePanelObjective'
import { hasCurrentWEngineProgression } from '../decision/wEngineResolver'
import { supportsCandidateEffectiveCritObjectiveAgent } from './candidateEffectiveCritObjective'
export function candidatePanelInputForAgent(
  agent:
    | Pick<
        RosterAgent,
        | 'agentId'
        | 'level'
        | 'ascension'
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
    (!hasCandidatePanelObjective(agent.agentId) &&
      !supportsCandidateEffectiveCritObjectiveAgent(agent.agentId)) ||
    !Number.isInteger(agent.level) ||
    agent.level < 1 ||
    agent.level > 60 ||
    agent.skillLevels.core === null ||
    !Number.isInteger(agent.skillLevels.core) ||
    agent.skillLevels.core < 1 ||
    agent.skillLevels.core > 7 ||
    !agent.wEngineDetails.id ||
    !Number.isInteger(agent.wEngineDetails.level) ||
    agent.wEngineDetails.level == null ||
    agent.wEngineDetails.level < 1 ||
    agent.wEngineDetails.level > 60 ||
    !Number.isInteger(agent.wEngineDetails.refinement) ||
    agent.wEngineDetails.refinement == null ||
    agent.wEngineDetails.refinement < 1 ||
    agent.wEngineDetails.refinement > 5
  )
    return undefined
  if (agent.ascension === null || agent.wEngineDetails.ascension === null) return undefined
  const ascension = agent.ascension ?? (agent.level === 60 ? 5 : undefined)
  const engineAscension =
    agent.wEngineDetails.ascension ?? (agent.wEngineDetails.level === 60 ? 5 : undefined)
  if (
    !Number.isInteger(ascension) ||
    ascension == null ||
    ascension < 0 ||
    ascension > 5 ||
    !Number.isInteger(engineAscension) ||
    engineAscension == null ||
    engineAscension < 0 ||
    engineAscension > 5
  )
    return undefined
  if (agent.level > (ascension + 1) * 10 || agent.wEngineDetails.level > (engineAscension + 1) * 10)
    return undefined
  return {
    agentId: agent.agentId,
    level: agent.level,
    ascension,
    core: agent.skillLevels.core - 2,
    specialLevel: agent.skillLevels.special ?? undefined,
    mindscape: agent.mindscape,
    potentialImage: agent.potentialImage,
    wEngine: {
      id: agent.wEngineDetails.id,
      level: agent.wEngineDetails.level,
      ascension: engineAscension,
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
