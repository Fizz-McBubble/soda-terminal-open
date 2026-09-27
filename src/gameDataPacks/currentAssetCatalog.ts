import { gameData31CatalogIntake, type GameData31CatalogEntity } from './gameData31CatalogIntake'
import { currentScopeManifest, getCurrentScopeEntry } from './currentScopeManifest'
import { resolveCurrentReleasedIdentity } from './currentReleasedIdentityMap'

export type AssetEvidenceStrength = 'formal' | 'candidate' | 'missing'
export type AssetReleaseState = 'released' | 'unreleased'
export type CurrentAssetDomain = 'agent' | 'wengine' | 'bangboo' | 'drive_disc_set'

export type CurrentAssetCatalogEntry = {
  id: string
  domain: CurrentAssetDomain
  name: string
  rarity: 'S' | 'A' | 'B' | null
  specialty: string | null
  evidence: AssetEvidenceStrength
  releaseState: AssetReleaseState
  releaseAt: string | null
  sourceVersion: string
  sourceId: string
  releaseSourceId: string | null
  gaps: readonly string[]
  /** Only a product-adopted released identity may opt into account maintenance. */
  accountOwnable: boolean
}

function asRarity(value: unknown): CurrentAssetCatalogEntry['rarity'] {
  return value === 'S' || value === 'A' || value === 'B' ? value : null
}

function project(entity: GameData31CatalogEntity): CurrentAssetCatalogEntry | null {
  if (entity.domain === 'enemy_mode') return null
  const id = resolveCurrentReleasedIdentity(entity.identity.projectStableId ?? entity.id)
  // Field evidence stays with this supplement; release and ownership follow the current scope.
  const currentScope = getCurrentScopeEntry(id)
  return {
    id,
    domain: entity.domain,
    name: entity.displayName,
    rarity: asRarity(entity.fields.rarity),
    specialty: typeof entity.fields.specialty === 'string' ? entity.fields.specialty : null,
    evidence: entity.status,
    releaseState: currentScope?.releaseState ?? 'unreleased',
    releaseAt: currentScope?.releaseAt ?? null,
    sourceVersion: gameData31CatalogIntake.gameVersion,
    sourceId: entity.source.id,
    releaseSourceId: currentScope?.sourceId ?? null,
    gaps: entity.gaps,
    accountOwnable: currentScope?.accountOwnable ?? false,
  }
}

const additions = gameData31CatalogIntake.entities
  .map(project)
  .filter((entry): entry is CurrentAssetCatalogEntry => entry !== null)

function byDomain(domain: CurrentAssetDomain) {
  return additions.filter((entry) => entry.domain === domain)
}

/**
 * The sole 3.1 directory supplement. Base 3.0 entries retain their own formal
 * provenance; these entries preserve their candidate/missing and release boundary.
 */
export const currentAssetCatalog = {
  id: 'current-asset-catalog-3.1',
  gameVersion: gameData31CatalogIntake.gameVersion,
  projectionId: 'current-version-projection-3.1',
  scopeManifestId: currentScopeManifest.id,
  effectiveAsOf: currentScopeManifest.effectiveAsOf,
  agents: byDomain('agent'),
  wEngines: byDomain('wengine'),
  bangboos: byDomain('bangboo'),
  driveDiscSets: byDomain('drive_disc_set'),
} as const
