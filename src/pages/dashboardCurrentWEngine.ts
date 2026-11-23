import { hasCurrentWEngineProgression } from '../accounts/observedAgentFacts'
import type { AccountRoster, RosterAgent } from '../assault/types'

/** Pure current-equipment presence check without pulling the full W-Engine catalog. */
export function hasRecordedCurrentWEngine(
  agent: Pick<RosterAgent, 'observedFacts' | 'wEngineDetails' | 'wEngineCopyId'> | undefined,
  legacyWEngines?: AccountRoster['wEngines'],
) {
  if (!agent) return false
  if (!hasCurrentWEngineProgression(agent)) return false
  const details = agent.wEngineDetails
  if (
    details.id &&
    details.level !== null &&
    details.refinement !== null &&
    Number.isInteger(details.level) &&
    details.level >= 0 &&
    details.level <= 60 &&
    details.refinement > 0
  )
    return true
  const copy = legacyWEngines?.find((item) => item.copyId === agent.wEngineCopyId)
  return Boolean(copy && (!details.id || details.id === copy.engineId))
}
