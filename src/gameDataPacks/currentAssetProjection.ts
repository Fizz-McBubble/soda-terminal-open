import { visualAssetSlots, type VisualAssetSlotId } from '../assets/visualAssetSlots'
import { getAgentCapability } from '../assault/agentCapabilities'
import { getVisualAsset } from '../assets/visualAssets'
import sourceLedger from './assetSourceLedger.v1.json'
import { gameCurrent31CatalogLedger } from './catalogLedger'
import { type GameData31CatalogEntity } from './gameData31CatalogIntake'
import { currentCatalogEntities } from './currentCatalogIntake'
import {
  getCurrentScopeCandidateEntry,
  currentScopeManifest,
  isCurrentScopeReleased,
} from './currentScopeManifest'
import { resolveCurrentReleasedIdentity } from './currentReleasedIdentityMap'
import {
  getL3VerifiedAssetEvidence,
  l3FactString,
  type L3VerifiedAssetEvidence,
} from './l3ProductionProjection'

export type CurrentAssetDomain = 'agent' | 'wengine' | 'bangboo' | 'drive_disc_set'
export type CurrentAssetEvidence = 'formal' | 'candidate' | 'missing'
export type CurrentAssetReleaseState = 'released' | 'unreleased'
export type CurrentAssetMediaStatus =
  | 'available_not_cached'
  | 'manifest_missing'
  | 'redistribution_license_unconfirmed'

export type CurrentAssetProjectionEntry = {
  /** Stable implementation identity. UI must use playerName rather than render this key. */
  stableId: string
  domain: CurrentAssetDomain
  playerName: string
  rarity: 'S' | 'A' | 'B' | null
  specialty: string | null
  attribute: string | null
  evidence: CurrentAssetEvidence
  releaseState: CurrentAssetReleaseState
  accountOwnable: boolean
  sort: {
    rarityRank: number
    releaseAt: string | null
    releaseVersion: string | null
    releaseSourceId: string | null
    sourceUrl: string | null
    sourceContentHash: string | null
  }
  potential: {
    eligible: boolean
    evidence:
      | 'formal'
      | 'licensed_wiki_direct'
      | 'reviewed_guide_direct'
      | 'pinned_formula_source_32'
      | null
    /** Source label; guide evidence keeps its archive label rather than an inferred release version. */
    sourceVersion: string | null
    sourceUrl: string | null
    sourceContentHash: string | null
  } | null
  media: {
    status: CurrentAssetMediaStatus
    cacheStatus: 'not_cached'
    licenseStatus: 'official_personal_cache_only' | 'reference_only'
    sourceUrl: string | null
  }
  /** Frozen L3 provenance for verified formal facts; candidate entries deliberately have none. */
  dataFoundation: L3VerifiedAssetEvidence | null
  gaps: readonly string[]
}

const rarityRank: Record<NonNullable<CurrentAssetProjectionEntry['rarity']>, number> = {
  S: 0,
  A: 1,
  B: 2,
}

const stableAgentSpecialties = new Set([
  'damage',
  'stun',
  'support',
  'anomaly',
  'defense',
  'rupture',
  'armorer',
])

const releaseLedger = new Map(sourceLedger.records.map((record) => [record.stableId, record]))
const mediaLedger = new Map(sourceLedger.media.map((entry) => [entry.stableId, entry]))

function asRarity(value: unknown): CurrentAssetProjectionEntry['rarity'] {
  return value === 'S' || value === 'A' || value === 'B' ? value : null
}

function releaseState(stableId: string, releaseAt: string | null): CurrentAssetReleaseState {
  const scopeEntry = getCurrentScopeCandidateEntry(stableId)
  if (scopeEntry) return scopeEntry.releaseState
  return isCurrentScopeReleased(releaseAt) ? 'released' : 'unreleased'
}

function potentialFor(stableId: string): CurrentAssetProjectionEntry['potential'] {
  if (!stableId.startsWith('agent-')) return null
  const capability = getAgentCapability(stableId)
  return {
    eligible: capability?.supportsPotentialImage === true,
    evidence: capability?.evidence ?? null,
    sourceVersion: capability?.sourceVersion ?? null,
    sourceUrl: capability?.sourceUrl ?? null,
    sourceContentHash: capability?.sourceContentHash ?? null,
  }
}

const catalogMediaSlots = {
  agent: 'agent.factual-card',
  wengine: 'wengine.catalog-card',
  bangboo: 'bangboo.catalog-card',
  drive_disc_set: 'drive-disc-set.icon',
} as const satisfies Record<CurrentAssetDomain, VisualAssetSlotId>

function mediaFor(
  domain: CurrentAssetDomain,
  stableId: string,
  evidence: CurrentAssetEvidence,
): CurrentAssetProjectionEntry['media'] {
  // Media availability follows the catalog consumer's exact slot, not a default avatar.
  const asset = getVisualAsset(
    domain,
    stableId,
    visualAssetSlots[catalogMediaSlots[domain]].variant,
  )
  if (
    asset?.status === 'verified' &&
    asset.remoteUrl &&
    asset.cachePolicy === 'explicit-personal-cache' &&
    (asset.sourceType === 'official' || domain === 'wengine')
  ) {
    return {
      status: 'available_not_cached',
      cacheStatus: 'not_cached',
      licenseStatus:
        asset.sourceType === 'official' ? 'official_personal_cache_only' : 'reference_only',
      sourceUrl: asset.sourcePage ?? mediaLedger.get(stableId)?.sourceUrl ?? null,
    }
  }
  const declared = mediaLedger.get(stableId)
  if (declared) {
    return {
      status: declared.mediaStatus as CurrentAssetMediaStatus,
      cacheStatus: 'not_cached',
      licenseStatus:
        declared.licenseStatus as CurrentAssetProjectionEntry['media']['licenseStatus'],
      sourceUrl: declared.sourceUrl,
    }
  }
  return {
    status: evidence === 'formal' ? 'manifest_missing' : 'redistribution_license_unconfirmed',
    cacheStatus: 'not_cached',
    licenseStatus: evidence === 'formal' ? 'official_personal_cache_only' : 'reference_only',
    sourceUrl: null,
  }
}

function formalEntry(
  entry: (typeof gameCurrent31CatalogLedger.entries)[number],
): CurrentAssetProjectionEntry {
  const l3 = getL3VerifiedAssetEvidence(entry.stableId)
  if (!l3) throw new Error(`L3 verified 资产目录缺少正式资产：${entry.stableId}`)
  if (l3FactString(l3, 'release.status') !== 'released') {
    throw new Error(`L3 正式资产发布状态不成立：${entry.stableId}`)
  }
  const source = releaseLedger.get(entry.stableId)
  if (!source || (source.releaseAt === null && source.releaseVersion === null)) {
    throw new Error(`R4A 来源账本缺少正式资产排序键：${entry.stableId}`)
  }
  const domain = entry.entityType as CurrentAssetDomain
  const rarity = asRarity(l3FactString(l3, 'identity.rank')) ?? entry.rarity
  const specialty =
    domain === 'agent'
      ? (l3FactString(l3, 'identity.specialty') ?? entry.classification?.split(' / ', 1)[0] ?? null)
      : entry.classification
  if (domain === 'agent' && (!specialty || !stableAgentSpecialties.has(specialty))) {
    throw new Error(`catalogLedger 缺少正式代理人职业键：${entry.stableId}`)
  }
  return {
    stableId: entry.stableId,
    domain,
    playerName: l3FactString(l3, 'identity.name') ?? entry.displayName,
    rarity,
    specialty,
    attribute: domain === 'agent' ? l3FactString(l3, 'identity.attribute') : null,
    evidence: 'formal',
    releaseState: 'released',
    accountOwnable: true,
    sort: {
      rarityRank: rarity ? rarityRank[rarity] : 99,
      releaseAt: l3FactString(l3, 'release.date')
        ? `${l3FactString(l3, 'release.date')}T00:00:00.000Z`
        : source.releaseAt,
      releaseVersion: l3FactString(l3, 'release.game_version') ?? source.releaseVersion,
      releaseSourceId: source.sourceUrl,
      sourceUrl: source.sourceUrl,
      sourceContentHash: source.sourceContentHash,
    },
    potential: potentialFor(entry.stableId),
    media: mediaFor(domain, entry.stableId, 'formal'),
    dataFoundation: l3,
    gaps: [],
  }
}

function candidateEntry(entity: GameData31CatalogEntity): CurrentAssetProjectionEntry | null {
  if (entity.domain === 'enemy_mode') return null
  const stableId = resolveCurrentReleasedIdentity(entity.identity.projectStableId ?? entity.id)
  const currentScope = getCurrentScopeCandidateEntry(stableId)
  const releaseAt = currentScope?.releaseAt ?? null
  const rarity = asRarity(entity.fields.rarity)
  const currentReleaseState = releaseState(stableId, releaseAt)
  return {
    stableId,
    domain: entity.domain,
    playerName: entity.displayName,
    rarity,
    specialty: typeof entity.fields.specialty === 'string' ? entity.fields.specialty : null,
    attribute: typeof entity.fields.attribute === 'string' ? entity.fields.attribute : null,
    evidence: entity.status,
    releaseState: currentReleaseState,
    accountOwnable: currentScope?.accountOwnable ?? false,
    sort: {
      rarityRank: rarity ? rarityRank[rarity] : 99,
      releaseAt,
      releaseVersion: entity.source.sourceVersion,
      releaseSourceId: currentScope?.sourceId ?? null,
      sourceUrl: entity.source.url,
      sourceContentHash: entity.source.contentHash,
    },
    potential: potentialFor(stableId),
    media: mediaFor(entity.domain, stableId, entity.status),
    dataFoundation: null,
    gaps: entity.gaps,
  }
}

function versionOrdinal(value: string | null) {
  const match = value?.match(/^(\d+)\.(\d+)$/)
  return match ? [Number(match[1]), Number(match[2])] : [-1, -1]
}

function sortCurrentAssets(entries: readonly CurrentAssetProjectionEntry[]) {
  return [...entries].sort((left, right) => {
    if (left.sort.rarityRank !== right.sort.rarityRank)
      return left.sort.rarityRank - right.sort.rarityRank
    const [leftMajor, leftMinor] = versionOrdinal(left.sort.releaseVersion)
    const [rightMajor, rightMinor] = versionOrdinal(right.sort.releaseVersion)
    if (leftMajor !== rightMajor) return rightMajor - leftMajor
    if (leftMinor !== rightMinor) return rightMinor - leftMinor
    if (left.sort.releaseAt !== right.sort.releaseAt)
      return (right.sort.releaseAt ?? '').localeCompare(left.sort.releaseAt ?? '')
    return 0
  })
}

const formal = gameCurrent31CatalogLedger.entries.map(formalEntry)
const candidate = currentCatalogEntities
  .map(candidateEntry)
  .filter((entry): entry is CurrentAssetProjectionEntry => entry !== null)

const deduplicated = new Map<string, CurrentAssetProjectionEntry>()
for (const entry of [...formal, ...candidate]) {
  const existing = deduplicated.get(entry.stableId)
  if (existing) {
    if (existing.playerName !== entry.playerName || existing.domain !== entry.domain)
      throw new Error(`current 资产身份冲突：${entry.stableId}`)
    continue
  }
  deduplicated.set(entry.stableId, entry)
}

const entries = sortCurrentAssets([...deduplicated.values()])

function byDomain(domain: CurrentAssetDomain) {
  return entries.filter((entry) => entry.domain === domain)
}

/**
 * The only current catalog projection. It combines the R4A formal source ledger
 * with the installed 3.1 intake while keeping candidate and media boundaries explicit.
 */
export const currentAssetProjection = {
  id: 'current-asset-projection-3.2-r1',
  gameVersion: '3.2',
  scopeManifestId: currentScopeManifest.id,
  effectiveAsOf: currentScopeManifest.effectiveAsOf,
  entries,
  agents: byDomain('agent'),
  wEngines: byDomain('wengine'),
  bangboos: byDomain('bangboo'),
  driveDiscSets: byDomain('drive_disc_set'),
} as const
