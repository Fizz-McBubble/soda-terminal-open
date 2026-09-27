import type { AccountRoster } from '../assault/types'

export function rosterFingerprintFacts(roster: AccountRoster) {
  const legacyWEngines = new Map((roster.wEngines ?? []).map((copy) => [copy.copyId, copy]))
  return {
    schemaVersion: roster.schemaVersion,
    sourceCompleteness: roster.sourceCompleteness,
    agents: [...roster.agents]
      .sort((left, right) => left.agentId.localeCompare(right.agentId))
      .map((agent) =>
        Object.fromEntries(
          Object.entries(agent).filter(
            ([key]) => !['syncedAt', 'wEngine', 'refinement', 'wEngineCopyId'].includes(key),
          ),
        ),
      ),
    legacyCurrentWEngines: [...roster.agents]
      .filter(
        (agent) =>
          (!agent.wEngineDetails.id ||
            agent.wEngineDetails.level === null ||
            agent.wEngineDetails.refinement === null ||
            agent.wEngineDetails.level <= 0 ||
            agent.wEngineDetails.refinement <= 0) &&
          Boolean(agent.wEngineCopyId),
      )
      .map((agent) => {
        const copy = legacyWEngines.get(agent.wEngineCopyId!)
        return {
          agentId: agent.agentId,
          engineId: copy?.engineId ?? null,
          level: copy?.level ?? null,
          refinement: copy?.refinement ?? null,
        }
      })
      .sort((left, right) => left.agentId.localeCompare(right.agentId)),
  }
}
