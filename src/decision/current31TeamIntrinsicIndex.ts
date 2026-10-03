import rawIndex from '../gameDataPacks/generated/current31-team-intrinsic-index.v1.json'
import strengthModel from '../gameDataPacks/generated/team-strength-model.3.1.json'
import { currentVersionProjection } from '../gameDataPacks/currentVersionProjection'
import {
  canApplyReviewedReferenceSupport32,
  isExistingReviewed31Formation,
  reviewedReferenceSupportContinuity32,
} from '../gameDataPacks/reviewedReferenceSupportContinuity32'
import { stableContentHash } from '../gameDataPacks/types'
import { current31TeamEngineD1Pack } from '../teamEngine/current31D1Pack'
import type { Current31MechanicValidity } from './current31TeamStrengthCalibration'
import { teamStrengthMechanicDataFingerprint } from './teamStrengthMechanicFeatures'
import type { DecisionConfidenceBand, TeamRatingBand } from './teamDecisionAuthority'

const bands = ['S+', 'S', 'A+', 'A', 'B', 'Experimental'] as const
const confidences = ['high', 'medium', 'low', 'experimental'] as const
const mechanicValidities = ['invalid', 'partial', 'valid', 'excellent'] as const
const mainstreamStatuses = ['unknown', 'confirmed'] as const
const metaAuthorities = [
  'strength_gold',
  'variant_reality_profile',
  'single_publisher_tier',
  'local_editorial_estimate',
  'model_inference',
  'recovered_preliminary',
  'none',
] as const

type MetaAuthority = (typeof metaAuthorities)[number]
type RawRow = readonly number[]
type PreparedIndex = {
  legacyReference: boolean
  contentHash: string
  agentIds: readonly string[]
  agentIndex: ReadonlyMap<string, number>
  rows: ReadonlyMap<number, RawRow>
}

export type Current31TeamIntrinsicSummary = {
  ratingStatus: 'rated' | 'hard_invalid' | 'blocked'
  ratingBand: TeamRatingBand | null
  confidence: DecisionConfidenceBand | null
  recommendationScore: number | null
  mechanicValidity: Current31MechanicValidity
  mainstreamStatus: 'unknown' | 'confirmed'
  metaAuthority: MetaAuthority
  mechanicallyClosed: boolean
  hasPreliminaryDirection: boolean
  indexContentHash: string
}

function exactArray(actual: unknown, expected: readonly string[]) {
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  )
}

function prepareIndex(): { index: PreparedIndex | null; reason: string | null } {
  try {
    if (!rawIndex || typeof rawIndex !== 'object') throw new Error('artifact is not an object')
    const artifact = rawIndex as unknown as Record<string, unknown>
    if (artifact.contract !== 'soda-current31-team-intrinsic-index/v1')
      throw new Error('contract mismatch')
    const { contentHash, ...content } = artifact
    if (typeof contentHash !== 'string' || stableContentHash(content) !== contentHash)
      throw new Error('content hash mismatch')
    if (
      artifact.gameVersion !== currentVersionProjection.gameVersion &&
      !canApplyReviewedReferenceSupport32({
        targetVersion: currentVersionProjection.gameVersion,
        sourceReviewVersion: String(artifact.gameVersion),
        sourceKind: 'intrinsicIndex',
        sourceContentHash: contentHash,
      })
    )
      throw new Error('game version mismatch')
    const legacyReference = artifact.gameVersion !== currentVersionProjection.gameVersion
    if (!legacyReference) {
      const currentIdentity = Object.fromEntries(
        [
          'gameVersion',
          'packageId',
          'packageVersion',
          'adoptionId',
          'adoptionContentHash',
          'sourceCommit',
          'scopeContentHash',
        ].map((key) => [
          key,
          currentVersionProjection[key as keyof typeof currentVersionProjection],
        ]),
      )
      if (stableContentHash(artifact.currentIdentity) !== stableContentHash(currentIdentity))
        throw new Error('current adoption identity mismatch')
    }
    if (
      !Array.isArray(artifact.agentIds) ||
      !artifact.agentIds.every((id) => typeof id === 'string')
    )
      throw new Error('agent dictionary is invalid')
    const agentIds = artifact.agentIds as string[]
    const currentAgentIds = current31TeamEngineD1Pack.agentRules
      .map((rule) => rule.agentId)
      .sort((left, right) => left.localeCompare(right))
    if (!exactArray(agentIds, currentAgentIds)) throw new Error('agent dictionary is stale')
    const dictionaries = artifact.dictionaries as Record<string, unknown> | undefined
    if (
      !dictionaries ||
      !exactArray(dictionaries.bands, bands) ||
      !exactArray(dictionaries.confidences, confidences) ||
      !exactArray(dictionaries.mechanicValidities, mechanicValidities) ||
      !exactArray(dictionaries.mainstreamStatuses, mainstreamStatuses) ||
      !exactArray(dictionaries.metaAuthorities, metaAuthorities)
    )
      throw new Error('value dictionaries are invalid')
    const fingerprints = artifact.runtimeFingerprints as Record<string, unknown> | undefined
    if (
      !fingerprints ||
      fingerprints.roster !== stableContentHash(currentAgentIds) ||
      fingerprints.mechanicData !== teamStrengthMechanicDataFingerprint ||
      fingerprints.strengthModel !== stableContentHash(strengthModel)
    )
      throw new Error('runtime fingerprint mismatch')
    if (!Array.isArray(artifact.rows)) throw new Error('rows are missing')
    const expectedRows = (agentIds.length * (agentIds.length - 1) * (agentIds.length - 2)) / 6
    if (artifact.rows.length !== expectedRows) throw new Error('row coverage mismatch')
    const rows = new Map<number, RawRow>()
    for (const raw of artifact.rows) {
      if (!Array.isArray(raw) || raw.length !== 11 || !raw.every(Number.isInteger))
        throw new Error('row shape is invalid')
      const [first, second, third] = raw
      if (!(first! < second! && second! < third! && third! < agentIds.length))
        throw new Error('row identity is invalid')
      const key = first! * agentIds.length * agentIds.length + second! * agentIds.length + third!
      if (rows.has(key)) throw new Error('duplicate row identity')
      rows.set(key, raw)
    }
    return {
      index: {
        legacyReference,
        contentHash,
        agentIds,
        agentIndex: new Map(agentIds.map((id, index) => [id, index])),
        rows,
      },
      reason: null,
    }
  } catch (error) {
    return { index: null, reason: error instanceof Error ? error.message : 'unknown index error' }
  }
}

const prepared = prepareIndex()

export const current31TeamIntrinsicIndexStatus = Object.freeze({
  status: prepared.index ? ('ready' as const) : ('fallback' as const),
  reason: prepared.reason,
  contentHash: prepared.index?.contentHash ?? null,
  referenceContinuity: prepared.index?.legacyReference
    ? reviewedReferenceSupportContinuity32
    : null,
})

export function lookupCurrent31TeamIntrinsicSummary(
  memberIds: readonly [string, string, string],
): Current31TeamIntrinsicSummary | null {
  const index = prepared.index
  if (!index || new Set(memberIds).size !== 3) return null
  if (index.legacyReference && !isExistingReviewed31Formation(memberIds)) return null
  const positions = memberIds
    .map((id) => index.agentIndex.get(id))
    .sort((left, right) => left! - right!)
  if (positions.some((position) => position === undefined)) return null
  const [first, second, third] = positions as [number, number, number]
  const row = index.rows.get(
    first * index.agentIds.length * index.agentIds.length + second * index.agentIds.length + third,
  )
  if (!row) return null
  const [, , , status, band, confidence, score, validity, mainstream, authority, flags] = row
  if (
    status! < 0 ||
    status! > 2 ||
    band! < -1 ||
    band! >= bands.length ||
    confidence! < -1 ||
    confidence! >= confidences.length ||
    validity! < 0 ||
    validity! >= mechanicValidities.length ||
    mainstream! < 0 ||
    mainstream! >= mainstreamStatuses.length ||
    authority! < 0 ||
    authority! >= metaAuthorities.length
  )
    return null
  return {
    ratingStatus: status === 0 ? 'rated' : status === 1 ? 'hard_invalid' : 'blocked',
    ratingBand: band === -1 ? null : bands[band!]!,
    confidence: confidence === -1 ? null : confidences[confidence!]!,
    recommendationScore: score === -1 ? null : score!,
    mechanicValidity: mechanicValidities[validity!]!,
    mainstreamStatus: mainstreamStatuses[mainstream!]!,
    metaAuthority: metaAuthorities[authority!]!,
    mechanicallyClosed: Boolean(flags! & 1),
    hasPreliminaryDirection: Boolean(flags! & 2),
    indexContentHash: index.contentHash,
  }
}
