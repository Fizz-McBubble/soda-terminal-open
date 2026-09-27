import sourceLedger from '../gameDataPacks/assetSourceLedger.v1.json'
import { reviewedPotentialDefinitions } from '../gameDataPacks/reviewedPotentialDefinitions'
import {
  isPotentialGuideReference,
  reviewedPotentialGuideReferences,
  type PotentialGuideReference,
} from '../gameDataPacks/reviewedPotentialGuideReferences'
import type { PlayerBuildSource } from '../gameDataPacks/playerBuildProfiles'

/**
 * Agent-only maintenance capabilities.  This is deliberately separate from
 * progression values: potential is an independent overlay and never changes
 * mindscape or ordinary skill defaults.
 */
export type AgentCapability = {
  supportsPotentialImage: boolean
  /** Source label, which can be an archive label rather than an introduced version. */
  sourceVersion: string | null
  evidence: 'formal' | 'licensed_wiki_direct' | 'reviewed_guide_direct'
  sourceUrl: string | null
  sourceContentHash: string | null
}

type ReviewedPotentialGuideEntry = {
  value: PotentialGuideReference
  source: PlayerBuildSource
}

function isVerifiedPotentialGuideEntry(entry: unknown): entry is ReviewedPotentialGuideEntry {
  if (!entry || typeof entry !== 'object') return false
  const candidate = entry as Partial<ReviewedPotentialGuideEntry>
  const source = candidate.source
  return (
    isPotentialGuideReference(candidate.value) &&
    source?.verified === true &&
    typeof source.url === 'string' &&
    source.url.trim().length > 0 &&
    typeof source.contentHash === 'string' &&
    /^[a-f0-9]{64}$/i.test(source.contentHash)
  )
}

const formalPotentialImageCapabilities: Readonly<Record<string, AgentCapability>> = {
  'agent-ellen': {
    supportsPotentialImage: true,
    sourceVersion: '3.0',
    evidence: 'formal',
    sourceUrl: null,
    sourceContentHash: null,
  },
  'agent-soldier-11': {
    supportsPotentialImage: true,
    sourceVersion: '3.0',
    evidence: 'formal',
    sourceUrl: null,
    sourceContentHash: null,
  },
}

const wikiPotentialImageCapabilities: Readonly<Record<string, AgentCapability>> =
  Object.fromEntries(
    sourceLedger.potentialEligibility.map((entry) => [
      entry.stableId,
      {
        supportsPotentialImage: true,
        sourceVersion: entry.sourceVersion,
        evidence: entry.evidence as Extract<AgentCapability['evidence'], 'licensed_wiki_direct'>,
        sourceUrl: entry.sourceUrl,
        sourceContentHash: entry.sourceContentHash,
      } satisfies AgentCapability,
    ]),
  )

const reviewedGuidePotentialImageCapabilities: Readonly<Record<string, AgentCapability>> =
  Object.fromEntries(
    Object.entries(reviewedPotentialGuideReferences).flatMap(([agentId, entry]) => {
      if (!isVerifiedPotentialGuideEntry(entry)) return []
      return [
        [
          agentId,
          {
            supportsPotentialImage: true,
            // This is deliberately the guide's archive label, not an inferred introduction version.
            sourceVersion: entry.source.sourceVersion,
            evidence: 'reviewed_guide_direct',
            sourceUrl: entry.source.url,
            sourceContentHash: entry.source.contentHash,
          } satisfies AgentCapability,
        ],
      ]
    }),
  )

/**
 * The typed catalog enumerates every non-empty potentialParams subject in the
 * locked current snapshot. Its archived guide source is eligibility evidence,
 * not a Formal numeric claim. Formal and licensed-ledger evidence still wins
 * in the final precedence merge below.
 */
const catalogPotentialImageCapabilities: Readonly<Record<string, AgentCapability>> =
  Object.fromEntries(
    reviewedPotentialDefinitions.map((definition) => [
      definition.agentId,
      {
        supportsPotentialImage: true,
        sourceVersion: definition.source.sourceVersion,
        evidence: 'reviewed_guide_direct',
        sourceUrl: definition.source.url,
        sourceContentHash: definition.source.contentHash,
      } satisfies AgentCapability,
    ]),
  )

/** Formal and licensed-wiki records remain authoritative if evidence overlaps. */
const potentialImageCapabilities: Readonly<Record<string, AgentCapability>> = {
  ...reviewedGuidePotentialImageCapabilities,
  ...catalogPotentialImageCapabilities,
  ...wikiPotentialImageCapabilities,
  ...formalPotentialImageCapabilities,
}

export function getAgentCapability(agentId: string): AgentCapability | null {
  return potentialImageCapabilities[agentId] ?? null
}

export function supportsPotentialImage(agentId: string): boolean {
  return getAgentCapability(agentId)?.supportsPotentialImage === true
}

/**
 * Keeps an account's explicit potential observation intact while supplying the
 * planning default only to agents confirmed by the capability ledger.  A
 * missing value is not itself a scanned observation.
 */
export function resolvePotentialImage(
  agentId: string,
  value: number | null | undefined,
): number | undefined {
  if (value !== null && value !== undefined) return value
  return supportsPotentialImage(agentId) ? 6 : undefined
}
