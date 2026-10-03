import { createPublicScannerEmptyRoster as createEmptyRoster } from './publicScannerAccountCreation'
import { applyRosterSnapshot, type RosterSnapshot } from './publicRosterSnapshot'
import type { AccountRoster } from '../assault/types'
import { makeWEngineCopyId } from './publicWEngineInstances'

/** Explicit backup restoration is not a partial scanner/showcase merge.
 * Requires the phase-preserving snapshot schema and unknown-identity hydration.
 * A legacy 3.1 directory-only reader is not a safe downgrade recovery reader.
 */
export function restoreBackupRoster(
  snapshot: RosterSnapshot,
  baseRoster: AccountRoster = createEmptyRoster(),
): AccountRoster {
  // Restore preserves stored identities even when a reader has no capability/directory entry.
  // This is a data recovery contract; it does not grant calculation or release applicability.
  const knownAgents = new Set(baseRoster.agents.map((agent) => agent.agentId))
  const knownBangboos = new Set(baseRoster.bangboos.map((bangboo) => bangboo.bangbooId))
  const restoreBase: AccountRoster = {
    ...baseRoster,
    agents: [
      ...baseRoster.agents,
      ...snapshot.agents
        .filter((agent) => !knownAgents.has(agent.agentId))
        .map((saved) => ({
          ...saved,
          source: 'roster_snapshot' as const,
          manualSource: saved.manualSource ?? null,
          lockedFields: [],
          skillLevels: saved.skillLevels ?? {
            basic: null,
            dodge: null,
            assist: null,
            special: null,
            chain: null,
            core: null,
          },
          wEngineDetails: saved.wEngineDetails
            ? { ...saved.wEngineDetails, id: saved.wEngineDetails.id ?? null }
            : { id: null, name: null, level: null, refinement: null },
          wEngineCopyId: saved.wEngineCopyId ?? null,
          equippedDiscIds: saved.equippedDiscIds ?? null,
        })),
    ],
    bangboos: [
      ...baseRoster.bangboos,
      ...snapshot.bangboos
        .filter((item) => !knownBangboos.has(item.bangbooId))
        .map((saved) => ({
          ...saved,
          stars: saved.stars ?? null,
          skillLevel: saved.skillLevel ?? null,
          additionalAbilityLevel: saved.additionalAbilityLevel ?? null,
          manualSource: saved.manualSource ?? null,
        })),
    ],
  }
  const restored = applyRosterSnapshot(snapshot, restoreBase)
  const incoming = new Map(snapshot.agents.map((agent) => [agent.agentId, agent]))
  const incomingBangboos = new Map(snapshot.bangboos.map((bangboo) => [bangboo.bangbooId, bangboo]))
  const ordinals = new Map<string, number>()
  return {
    ...restored,
    agents: restored.agents.map((agent) => {
      const saved = incoming.get(agent.agentId)
      if (!saved) return agent
      const restoredAgent = {
        ...agent,
        wEngine: saved.wEngine,
        refinement: saved.refinement,
        wEngineCopyId: saved.wEngineCopyId ?? null,
        wEngineDetails: saved.wEngineDetails
          ? { ...saved.wEngineDetails, id: saved.wEngineDetails.id ?? null }
          : agent.wEngineDetails,
        ...('potentialImage' in saved ? { potentialImage: saved.potentialImage } : {}),
        ...('progressionManuallySet' in saved
          ? { progressionManuallySet: saved.progressionManuallySet }
          : {}),
        ...('lockedFields' in saved ? { lockedFields: [...(saved.lockedFields ?? [])] } : {}),
      }
      // A legacy backup without this field has no lock-state evidence. Do not turn that absence
      // into an explicit empty lock list merely because the temporary restore roster has one.
      if (!('lockedFields' in saved))
        delete (restoredAgent as Partial<typeof restoredAgent>).lockedFields
      return restoredAgent as AccountRoster['agents'][number]
    }),
    bangboos: restored.bangboos.map((bangboo) => {
      const saved = incomingBangboos.get(bangboo.bangbooId)
      return saved && 'starsManuallySet' in saved
        ? { ...bangboo, starsManuallySet: saved.starsManuallySet }
        : bangboo
    }),
    wEngines: snapshot.wEngines?.map((copy) => {
      const ordinal = (ordinals.get(copy.engineId) ?? 0) + 1
      ordinals.set(copy.engineId, ordinal)
      return {
        ...copy,
        copyId: copy.copyId ?? makeWEngineCopyId(copy.engineId, ordinal),
        equippedAgentId: copy.equippedAgentId ?? null,
      }
    }),
  }
}
