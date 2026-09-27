import wEngineData from './data/wEngineCatalog.3.0.json'
import { isOfficialWEngineAvailable } from '../assets/officialVisualAssets'
import { agentCatalog } from './catalog'
import { currentAssetCatalog } from '../gameDataPacks/currentAssetCatalog'
import { sortCatalogByRarityAndRelease } from './catalogSorting'
import { supportsPotentialImage } from './agentCapabilities'
import type { RosterAgent } from './types'

export const PLANNING_AGENT_LEVEL = 60
export const NORMAL_SKILL_LEVELS = Array.from({ length: 16 }, (_, index) => index + 1)
export const CORE_SKILL_LEVELS = Array.from({ length: 7 }, (_, index) => index + 1)
export const PLANNING_NORMAL_SKILL_LEVEL = 11
export const PLANNING_CORE_SKILL_LEVEL = 7

export type AgentSpecialty = (typeof agentCatalog)[number][2]

export const wEngineCatalog = wEngineData

export const playerWEngineCatalog = {
  ...wEngineData,
  items: sortCatalogByRarityAndRelease(
    wEngineData.items.filter((item) => isOfficialWEngineAvailable(item.id)),
  ),
}

/** Directory-only 3.1 projection. Candidate records never become roster defaults. */
const currentProjectedWEngineIds = new Set(currentAssetCatalog.wEngines.map((entry) => entry.id))

export const currentWEngineDirectory = [
  ...playerWEngineCatalog.items
    .filter((item) => !currentProjectedWEngineIds.has(item.id))
    .map((item) => ({
      ...item,
      evidence: 'formal' as const,
      releaseState: 'released' as const,
      releaseAt: null,
      releaseSourceVersion: null,
      sourceVersion: wEngineData.gameVersion,
      sourceId: 'catalog-3.0-formal',
      gaps: [] as readonly string[],
      accountOwnable: true,
    })),
  ...currentAssetCatalog.wEngines.map((entry) => ({
    id: entry.id,
    externalId: entry.id.replace('wengine-', ''),
    name: entry.name,
    specialty: entry.specialty ?? 'unknown',
    rarity: entry.rarity ?? 'S',
    status: entry.evidence,
    evidence: entry.evidence,
    releaseState: entry.releaseState,
    releaseAt: entry.releaseAt,
    releaseSourceVersion: entry.sourceVersion,
    sourceVersion: entry.sourceVersion,
    sourceId: entry.sourceId,
    gaps: entry.gaps,
    accountOwnable: entry.accountOwnable,
  })),
]

export function getWEnginesForSpecialty(specialty: AgentSpecialty) {
  return sortCatalogByRarityAndRelease(
    playerWEngineCatalog.items.filter((item) => item.specialty === specialty),
  )
}

export function getAgentSpecialty(agentId: string): AgentSpecialty | null {
  return agentCatalog.find(([id]) => id === agentId)?.[2] ?? null
}

export function isPotentialImageAgent(agentId: string) {
  return supportsPotentialImage(agentId)
}

export function withPlanningDefaults(agent: RosterAgent): RosterAgent {
  const rarity = agentCatalog.find(([id]) => id === agent.agentId)?.[4]
  const progressionIsManual =
    agent.progressionManuallySet === true || agent.manualSource === 'manual_override'
  const normalSkill = rarity === 'A' ? 15 : PLANNING_NORMAL_SKILL_LEVEL
  return {
    ...agent,
    owned: true,
    level: agent.level ?? PLANNING_AGENT_LEVEL,
    mindscape: progressionIsManual ? (agent.mindscape ?? 0) : rarity === 'A' ? 6 : 0,
    potentialImage: isPotentialImageAgent(agent.agentId) ? (agent.potentialImage ?? 6) : undefined,
    skills: '规划满级',
    refinement: 0,
    skillLevels: progressionIsManual
      ? { ...agent.skillLevels }
      : {
          basic: agent.skillLevels.basic ?? normalSkill,
          dodge: agent.skillLevels.dodge ?? normalSkill,
          assist: agent.skillLevels.assist ?? normalSkill,
          special: agent.skillLevels.special ?? normalSkill,
          chain: agent.skillLevels.chain ?? normalSkill,
          core: agent.skillLevels.core ?? PLANNING_CORE_SKILL_LEVEL,
        },
    wEngineDetails: { ...agent.wEngineDetails, level: agent.wEngineDetails.level ?? 60 },
    wEngine: agent.wEngine || '待选择',
    currentEquipment: 'unknown',
    equippedDiscIds: null,
    completeness: 'partial',
    manualSource: progressionIsManual ? agent.manualSource : 'manual_initial_default',
  }
}
