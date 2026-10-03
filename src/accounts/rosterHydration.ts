import type { AccountRoster } from '../assault/types'
import {
  getDefaultAgentSkillLevels,
  repairLegacyMindscapeSkillLevels,
} from './agentProgressionRules'
import { normalizeWEngineInstances, withDefaultWEngineRefinement } from './publicWEngineInstances'
import {
  defaultRosterAgentIds,
  defaultRosterBangbooIds,
  rosterAgentRarity,
  rosterBangbooRarity,
  supportsRosterPotentialImage,
  resolveRosterPotentialImage,
} from './rosterFacts'
import { resolveCurrentReleasedIdentity } from '../gameDataPacks/currentReleasedIdentityMap'

/**
 * Accepted account projection for a new roster. Defaults are planning inputs, not scanned game
 * observations, and every value stays editable by the player.
 */
export function createEmptyRoster(now = new Date().toISOString()): AccountRoster {
  return {
    schemaVersion: 3,
    sourceCompleteness: 'complete',
    agents: defaultRosterAgentIds.map((agentId) => ({
      agentId,
      owned: false,
      priority: 3,
      level: 60,
      mindscape: 0,
      skills: '未录入',
      wEngine: '未录入',
      refinement: 0,
      agentVersion: '3.0',
      completeness: 'missing',
      currentEquipment: 'unknown',
      source: 'manual',
      manualSource: null,
      syncedAt: now,
      lockedFields: [],
      skillLevels: {
        basic: null,
        dodge: null,
        assist: null,
        special: null,
        chain: null,
        core: null,
      },
      wEngineDetails: { id: null, name: null, level: 60, refinement: 0 },
      wEngineCopyId: null,
      equippedDiscIds: null,
    })),
    bangboos: defaultRosterBangbooIds.map((bangbooId) => ({
      bangbooId,
      owned: false,
      level: 1,
      stars: 1,
      skillLevel: null,
      additionalAbilityLevel: null,
      manualSource: null,
    })),
    wEngines: [],
    updatedAt: now,
  }
}

/** Adds only newly introduced directory fields. Existing manual values always win. */
export function hydrateRosterDefaults(
  stored: Partial<AccountRoster>,
  now = new Date().toISOString(),
): AccountRoster {
  const defaults = createEmptyRoster(now)
  const storedWEngines = stored.wEngines ?? defaults.wEngines ?? []
  const defaultAgents = new Set(defaults.agents.map((item) => item.agentId))
  const defaultBangboos = new Set(defaults.bangboos.map((item) => item.bangbooId))
  const hydrated = normalizeWEngineInstances({
    ...defaults,
    ...stored,
    agents: [
      ...defaults.agents.map((fallback) => {
        const existing = stored.agents?.find(
          (item) => resolveCurrentReleasedIdentity(item.agentId) === fallback.agentId,
        )
        if (!existing) return fallback
        const supportsPotential = supportsRosterPotentialImage(fallback.agentId)
        const rarity = rosterAgentRarity(fallback.agentId)
        const progressionIsManual =
          existing.progressionManuallySet === true || existing.manualSource === 'manual_override'
        const shouldApplyOwnedBaseline = existing.owned && !progressionIsManual
        const defaultMindscape = shouldApplyOwnedBaseline && rarity === 'A' ? 6 : existing.mindscape
        const baselineSkillLevels = getDefaultAgentSkillLevels(rarity, defaultMindscape)
        const repairedSkillLevels = repairLegacyMindscapeSkillLevels(
          rarity,
          defaultMindscape,
          existing.skillLevels,
        )
        return {
          ...fallback,
          ...existing,
          agentId: fallback.agentId,
          mindscape: defaultMindscape,
          skillLevels: shouldApplyOwnedBaseline
            ? {
                ...baselineSkillLevels,
                core: 7,
              }
            : { ...fallback.skillLevels, ...repairedSkillLevels },
          potentialImage:
            supportsPotential && existing.owned
              ? resolveRosterPotentialImage(fallback.agentId, existing.potentialImage)
              : existing.potentialImage,
          wEngineDetails: { ...fallback.wEngineDetails, ...existing.wEngineDetails },
        }
      }),
      // A catalog downgrade or unsupported identity is not authority to delete an account fact.
      ...(stored.agents ?? [])
        .filter((item) => !defaultAgents.has(resolveCurrentReleasedIdentity(item.agentId)))
        .map((item) => ({
          ...item,
          skillLevels: { ...item.skillLevels },
          wEngineDetails: { ...item.wEngineDetails },
        })),
    ],
    bangboos: [
      ...defaults.bangboos.map((fallback) => ({
        ...fallback,
        ...stored.bangboos?.find((item) => item.bangbooId === fallback.bangbooId),
      })),
      ...(stored.bangboos ?? [])
        .filter((item) => !defaultBangboos.has(item.bangbooId))
        .map((item) => ({ ...item })),
    ],
    // Legacy copies remain readable, but hydration never creates new inventory rows.
    wEngines: storedWEngines.map((item) => ({ ...item })),
  })
  return normalizeWEngineInstances({
    ...hydrated,
    bangboos: hydrated.bangboos.map((item) =>
      defaultBangboos.has(item.bangbooId) && item.owned && item.manualSource !== 'manual_override'
        ? {
            ...item,
            level: 60,
            ...(rosterBangbooRarity(item.bangbooId) === 'S' && item.starsManuallySet !== true
              ? { stars: 1 }
              : {}),
          }
        : item,
    ),
    wEngines: hydrated.wEngines?.map((item) =>
      item.manualSource === 'manual_override' ? item : withDefaultWEngineRefinement(item),
    ),
  })
}

/** Rejects invalid explicit facts at a write boundary; migration-only absence is null. */
export function assertBangbooSkillFacts(roster: AccountRoster) {
  for (const bangboo of roster.bangboos) {
    const valid = (value: unknown, min: number, max: number) =>
      value === null ||
      (typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max)
    if (!valid(bangboo.skillLevel, 1, 10))
      throw new Error(`邦布 ${bangboo.bangbooId} 的 active-skill 等级必须为 1–10 或未确认。`)
    if (!valid(bangboo.additionalAbilityLevel, 1, 5))
      throw new Error(`邦布 ${bangboo.bangbooId} 的附加能力等级必须为 1–5 或未确认。`)
  }
}

/** Optional explicit phases remain absent in older data; invalid supplied phases never save. */
export function assertRosterAscensionFacts(roster: AccountRoster) {
  for (const agent of roster.agents) {
    for (const [field, value] of [
      ['ascension', agent.ascension],
      ['wEngineDetails.ascension', agent.wEngineDetails.ascension],
    ] as const) {
      if (value === undefined || value === null) continue
      if (!Number.isInteger(value) || value < 0 || value > 5)
        throw new Error(`代理人 ${agent.agentId} 的 ${field} 必须为 0–5 或未确认。`)
    }
  }
}
