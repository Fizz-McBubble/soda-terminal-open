import type { RosterAgent } from '../assault/types'
import type { CurrentBuildTargetPanelContext } from '../gameDataPacks/currentBuildAuthority'

/** Actual recorded operands only. A recommendation never fills an unknown
 * current skill, mindscape or equipment parameter in a displayed target. */
export function developmentBuildContext(agent: RosterAgent): CurrentBuildTargetPanelContext {
  return {
    agentLevel: agent.level,
    coreLevel: agent.skillLevels.core,
    specialLevel: agent.skillLevels.special,
    mindscape: agent.mindscape,
    engineId: agent.wEngineDetails.id,
    engineRefinement: agent.wEngineDetails.refinement,
  }
}
