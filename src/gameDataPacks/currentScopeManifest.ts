import sourceLedger from './assetSourceLedger.v1.json'
import { gameCurrent31CatalogLedger } from './catalogLedger'
import {
  getCurrentReleasedIdentity,
  resolveCurrentReleasedIdentity,
} from './currentReleasedIdentityMap'
import { type GameData31CatalogEntity } from './gameData31CatalogIntake'
import { currentCatalogEntities } from './currentCatalogIntake'
import { stableContentHash } from './types'

export type CurrentScopeDomain = 'agent' | 'wengine' | 'bangboo' | 'drive_disc_set'
export type CurrentScopeEvidence = 'formal' | 'candidate'
export type CurrentScopeReleaseState = 'released' | 'unreleased'

export type CurrentScopeManifestEntry = {
  stableId: string
  aliases: readonly string[]
  domain: CurrentScopeDomain
  displayName: string
  evidence: CurrentScopeEvidence
  releaseAt: string | null
  releaseState: CurrentScopeReleaseState
  accountOwnable: boolean
  sourceVersion: string
  sourceId: string
}

export type CurrentScopeManifest = {
  schema: 'soda-current-scope-manifest/v1'
  id: string
  gameVersion: string
  phase: 'phase_ii'
  effectiveAsOf: string
  productionCatalog: {
    sourceVersion: string
    contentHash: string
    recordCount: number
    stableEntityCount: number
  }
  entries: readonly CurrentScopeManifestEntry[]
  coverage: {
    directoryTotal: number
    releasedScope: number
    accountOwnable: number
    byDomain: Readonly<Record<CurrentScopeDomain, number>>
  }
  contentHash: string
}

const effectiveAsOf = '2026-09-30'
const accountOwnableCandidateIds = new Set([
  'agent-sigrid',
  'bangboo-ariel',
  'wengine-14158',
  'wengine-14159',
  'set-34100',
  'set-34200',
  'agent-claret',
  'agent-roxy',
  'wengine-14161',
  'wengine-14162',
  'wengine-13021',
  'wengine-13017',
  'wengine-12016',
])

function isCurrentScopeDomain(
  value: GameData31CatalogEntity['domain'],
): value is CurrentScopeDomain {
  return value !== 'enemy_mode'
}

function dateOnly(value: string | null | undefined) {
  return typeof value === 'string' ? value.slice(0, 10) : null
}

/** A missing release date remains readable, but cannot move a dated asset past the manifest. */
export function isCurrentScopeReleased(releaseAt: string | null) {
  return releaseAt !== null && releaseAt <= effectiveAsOf
}

const formalEntries: CurrentScopeManifestEntry[] = gameCurrent31CatalogLedger.entries.map(
  (entry) => {
    const release = sourceLedger.records.find((record) => record.stableId === entry.stableId)
    return {
      stableId: entry.stableId,
      aliases: [],
      domain: entry.entityType as CurrentScopeDomain,
      displayName: entry.displayName,
      evidence: 'formal',
      releaseAt: dateOnly(release?.releaseAt),
      releaseState: 'released',
      accountOwnable: true,
      sourceVersion: gameCurrent31CatalogLedger.sourceVersion,
      sourceId:
        release?.sourceUrl ??
        entry.sourceUrl ??
        `${gameCurrent31CatalogLedger.sourceVersion}:${entry.stableId}`,
    }
  },
)

const candidateEntries: CurrentScopeManifestEntry[] = currentCatalogEntities
  .filter((entity): entity is GameData31CatalogEntity & { domain: CurrentScopeDomain } =>
    isCurrentScopeDomain(entity.domain),
  )
  .map((entity) => {
    const sourceIdentity = entity.identity.projectStableId ?? entity.id
    const releasedIdentity = getCurrentReleasedIdentity(sourceIdentity)
    const stableId = releasedIdentity?.stableId ?? resolveCurrentReleasedIdentity(sourceIdentity)
    const releaseAt = dateOnly(
      typeof entity.fields.releaseAt === 'string'
        ? entity.fields.releaseAt
        : releasedIdentity?.releaseAt,
    )
    const releaseState = isCurrentScopeReleased(releaseAt) ? 'released' : 'unreleased'
    return {
      stableId,
      aliases: stableId === entity.id ? [] : [entity.id],
      domain: entity.domain,
      displayName: entity.displayName,
      evidence: 'candidate',
      releaseAt,
      releaseState,
      accountOwnable: accountOwnableCandidateIds.has(stableId) && releaseState === 'released',
      sourceVersion: entity.source.sourceVersion,
      sourceId: releasedIdentity?.sourceRefs[0] ?? entity.source.id,
    }
  })

const entriesById = new Map<string, CurrentScopeManifestEntry>()
for (const entry of [...formalEntries, ...candidateEntries]) {
  const existing = entriesById.get(entry.stableId)
  if (existing) {
    if (existing.domain !== entry.domain || existing.displayName !== entry.displayName) {
      throw new Error(`current scope identity conflict: ${entry.stableId}`)
    }
    continue
  }
  entriesById.set(entry.stableId, entry)
}

const entries = [...entriesById.values()]
const domains: CurrentScopeDomain[] = ['agent', 'wengine', 'bangboo', 'drive_disc_set']
const coverage = {
  directoryTotal: entries.length,
  releasedScope: entries.filter((entry) => entry.releaseState === 'released').length,
  accountOwnable: entries.filter((entry) => entry.accountOwnable).length,
  byDomain: Object.fromEntries(
    domains.map((domain) => [domain, entries.filter((entry) => entry.domain === domain).length]),
  ) as Record<CurrentScopeDomain, number>,
}

const manifestCore = {
  schema: 'soda-current-scope-manifest/v1' as const,
  id: 'current-scope-manifest-3.2-r1' as const,
  gameVersion: '3.2' as const,
  phase: 'phase_ii' as const,
  effectiveAsOf,
  productionCatalog: {
    sourceVersion: gameCurrent31CatalogLedger.sourceVersion,
    contentHash: gameCurrent31CatalogLedger.contentHash,
    recordCount: gameCurrent31CatalogLedger.entries.length,
    stableEntityCount: new Set(formalEntries.map((entry) => entry.stableId)).size,
  },
  entries,
  coverage,
}

export const currentScopeManifest: CurrentScopeManifest = {
  ...manifestCore,
  contentHash: stableContentHash(manifestCore),
}

export function getCurrentScopeEntry(identity: string) {
  const stableId = resolveCurrentReleasedIdentity(identity)
  return currentScopeManifest.entries.find((entry) => entry.stableId === stableId) ?? null
}

/** Candidate supplement lookup keeps a candidate lineage from inheriting formal ownership. */
export function getCurrentScopeCandidateEntry(identity: string) {
  const stableId = resolveCurrentReleasedIdentity(identity)
  return (
    candidateEntries.find(
      (entry) => entry.stableId === stableId || entry.aliases.includes(identity),
    ) ?? null
  )
}
