import { contentHash } from '../evaluation/contentHash'
import {
  currentAssetCatalog,
  type CurrentAssetCatalogEntry,
} from '../gameDataPacks/currentAssetCatalog'
import { resolveCurrentReleasedIdentity } from '../gameDataPacks/currentReleasedIdentityMap'
import { agentCatalog, bangbooCatalog } from './catalogData'

export { agentCatalog, bangbooCatalog } from './catalogData'

export const assaultDataVersion = 'zzz-assault-3.0-v1'
export const assaultModelVersion = 'account-optimizer-v1'

/** Player-facing labels for the stable agent-specialty keys in the catalog. */
export const agentSpecialtyLabels: Record<string, string> = {
  damage: '强攻',
  stun: '击破',
  anomaly: '异常',
  support: '支援',
  defense: '防护',
  rupture: '命破',
}

/** Never expose a stable catalog key when its player-facing label is not available. */
export function getAgentSpecialtyLabel(value: string | null | undefined) {
  return agentSpecialtyLabels[value ?? ''] ?? '资料待补齐'
}

export type CurrentDirectoryEntry = {
  id: string
  name: string
  rarity: 'S' | 'A' | 'B' | null
  specialty: string | null
  evidence: 'formal' | 'candidate' | 'missing'
  releaseState: 'released' | 'unreleased'
  releaseAt: string | null
  releaseSourceVersion: string | null
  sourceVersion: string
  sourceId: string
  gaps: readonly string[]
  accountOwnable: boolean
}

function formalDirectoryEntry(
  id: string,
  name: string,
  rarity: 'S' | 'A' | 'B',
  specialty: string | null,
): CurrentDirectoryEntry {
  return {
    id,
    name,
    rarity,
    specialty,
    evidence: 'formal',
    releaseState: 'released',
    releaseAt: null,
    releaseSourceVersion: null,
    sourceVersion: '3.0',
    sourceId: 'catalog-3.0-formal',
    gaps: [],
    accountOwnable: true,
  }
}

function candidateDirectoryEntry(entry: CurrentAssetCatalogEntry): CurrentDirectoryEntry {
  return { ...entry, releaseSourceVersion: entry.sourceVersion }
}

/** Current player directory only. It deliberately does not feed roster defaults or hydration. */
export const currentAgentDirectory = [
  ...agentCatalog.map(([id, name, specialty, , rarity]) =>
    formalDirectoryEntry(id, name, rarity, specialty),
  ),
  ...currentAssetCatalog.agents.map(candidateDirectoryEntry),
]

/** Current player directory only. It deliberately does not feed roster defaults or hydration. */
export const currentBangbooDirectory = [
  ...bangbooCatalog.map(([id, name, , rarity]) => formalDirectoryEntry(id, name, rarity, null)),
  ...currentAssetCatalog.bangboos.map(candidateDirectoryEntry),
]

const catalogCore = {
  schemaVersion: 1,
  gameVersion: '3.0',
  dataVersion: 'zzz-roster-catalog-3.0.0',
  status: 'review',
  catalogStatus: 'formal',
  publishedAt: '2026-06-17T00:00:00.000Z',
  updatedAt: '2026-07-03T00:00:00.000Z',
  reviewWindowDays: 7,
  coverage: {
    agents: {
      status: 'formal',
      released: agentCatalog.filter((item) => item[7] === 'released').length,
      availabilityPending: 0,
    },
    bangboos: {
      status: 'formal',
      released: bangbooCatalog.filter((item) => item[4] === 'released').length,
    },
    skills: { status: 'partial' },
    wEngines: { status: 'partial' },
    driveDiscs: { status: 'formal' },
    teamTemplates: { status: 'partial' },
    cyclesAndBuffs: { status: 'partial' },
  },
  sources: [
    {
      id: 'official-3.0',
      url: 'https://zenless.hoyoverse.com/en-us/news/164775',
      tier: 'official',
    },
    {
      id: 'hakush-characters',
      url: 'https://api.hakush.in/zzz/data/character.json',
      tier: 'structured',
    },
    {
      id: 'zzz-plugin-map',
      url: 'https://github.com/ZZZure/ZZZ-Plugin/blob/main/resources/map/PartnerId2Data.json',
      tier: 'structured',
    },
    {
      id: 'zzz-wiki-agent-list',
      url: 'https://zenless-zone-zero.fandom.com/wiki/Agent/List',
      tier: 'community',
    },
  ],
} as const

export const gameCatalogManifest = { ...catalogCore, contentHash: contentHash(catalogCore) }

export { teamTemplates } from './teamTemplates'

/**
 * Compatibility path. Roster defaults, hydration and the write-boundary validation now live in the
 * shared account layer (`accounts/rosterHydration.ts`) so the local read chain and the public
 * browser contract reuse one implementation instead of two copies.
 */
export {
  assertBangbooSkillFacts,
  createEmptyRoster,
  hydrateRosterDefaults,
} from '../accounts/rosterHydration'

export function getAgentName(agentId: string) {
  const stableId = resolveCurrentReleasedIdentity(agentId)
  return (
    currentAgentDirectory.find((entry) => resolveCurrentReleasedIdentity(entry.id) === stableId)
      ?.name ?? stableId
  )
}

export function getBangbooName(bangbooId: string) {
  return currentBangbooDirectory.find((entry) => entry.id === bangbooId)?.name ?? bangbooId
}
