import {
  getL3VerifiedAssetFacts,
  l3VerifiedAssetPackage,
  type L3VerifiedAssetFact,
} from './generated/l3-7e0a160468929dccc72b/verifiedAssetFacts'
import { resolveCurrentReleasedIdentity } from './currentReleasedIdentityMap'
import {
  l3AgentDevelopmentEvidence,
  l3AgentDevelopmentEvidencePackage,
  type L3AgentDevelopmentEvidenceFact,
  type L3MiyousheCandidateClaim,
} from './generated/l3-b04c7cc7ac8ad6279074/agentDevelopmentEvidence'
import {
  getL3NoncharacterMiyousheSidecarFacts,
  l3NoncharacterMiyousheSidecarPackage,
  type L3NoncharacterMiyousheSidecarFact,
} from './generated/l3-b04c7cc7ac8ad6279074/noncharacterMiyousheSidecar'

// Resolve all historical identities through the shared bridge, not one special-cased agent.
// Keep individual records intact: matching identities does not resolve conflicting facts.
const agentEvidenceByReleasedId = new Map<string, readonly L3AgentDevelopmentEvidenceFact[]>()
for (const [sourceId, facts] of Object.entries(l3AgentDevelopmentEvidence)) {
  const stableId = resolveCurrentReleasedIdentity(sourceId)
  agentEvidenceByReleasedId.set(stableId, [
    ...(agentEvidenceByReleasedId.get(stableId) ?? []),
    ...facts,
  ])
}

/** The current consumer identity is verified against docs/data/production/current-consumer-adoption.v1.json. */
export const l3ProductionProjectionIdentity = {
  consumers: {
    asset_maintenance: {
      packageId: l3VerifiedAssetPackage.packageId,
      manifestSha256: l3VerifiedAssetPackage.manifestSha256,
      partitions: { 'asset-directory.ndjson': l3VerifiedAssetPackage.assetDirectorySha256 },
    },
    agent_development_and_top_n: {
      packageId: l3AgentDevelopmentEvidencePackage.packageId,
      manifestSha256: l3AgentDevelopmentEvidencePackage.manifestSha256,
      partitions: l3AgentDevelopmentEvidencePackage.partitions,
    },
  },
} as const

/**
 * The noncharacter facts share the agent-development package but deliberately remain a
 * read-only Candidate sidecar. They are not an asset-maintenance or BOX authority.
 */
export const l3NoncharacterMiyousheCandidateSidecarIdentity = {
  packageId: l3NoncharacterMiyousheSidecarPackage.packageId,
  manifestSha256: l3NoncharacterMiyousheSidecarPackage.manifestSha256,
  candidatePartitionSha256: l3NoncharacterMiyousheSidecarPackage.candidatePartitionSha256,
  scope: l3NoncharacterMiyousheSidecarPackage.scope,
  authority: l3NoncharacterMiyousheSidecarPackage.authority,
} as const

export type L3VerifiedAssetEvidence = {
  packageId: typeof l3VerifiedAssetPackage.packageId
  manifestSha256: typeof l3VerifiedAssetPackage.manifestSha256
  status: 'existing_verified'
  facts: Readonly<Record<string, L3VerifiedAssetFact>>
}

/** Runtime-only adapter over the generated L3 projection: it never reads L1, L2, or NDJSON. */
export function getL3VerifiedAssetEvidence(stableId: string): L3VerifiedAssetEvidence | null {
  const facts = getL3VerifiedAssetFacts(stableId)
  return facts
    ? {
        packageId: l3VerifiedAssetPackage.packageId,
        manifestSha256: l3VerifiedAssetPackage.manifestSha256,
        status: 'existing_verified',
        facts,
      }
    : null
}

export function l3FactString(evidence: L3VerifiedAssetEvidence, fieldPath: string): string | null {
  const value = evidence.facts[fieldPath]?.value
  return typeof value === 'string' ? value : null
}

export type L3AgentDevelopmentEvidenceStatus =
  | 'verified'
  | 'candidate'
  | 'gap'
  | 'mixed'
  | 'unavailable'
export type L3AgentDevelopmentEvidence = {
  packageId: typeof l3AgentDevelopmentEvidencePackage.packageId
  manifestSha256: typeof l3AgentDevelopmentEvidencePackage.manifestSha256
  status: L3AgentDevelopmentEvidenceStatus
  verifiedFacts: readonly L3AgentDevelopmentEvidenceFact[]
  candidateFacts: readonly L3AgentDevelopmentEvidenceFact[]
  gapFacts: readonly L3AgentDevelopmentEvidenceFact[]
  blockers: readonly { code: 'candidate_only' | 'data_gap'; fieldPaths: readonly string[] }[]
}

export type L3MiyousheCandidateEvidenceFact = L3AgentDevelopmentEvidenceFact & {
  readonly value: string
  readonly gameVersion: string
  readonly candidateClaim: L3MiyousheCandidateClaim
}

/** Static L3 evidence for agent development. It describes evidence, never creates panel defaults. */
export function getL3AgentDevelopmentEvidence(stableId: string): L3AgentDevelopmentEvidence | null {
  const facts = agentEvidenceByReleasedId.get(resolveCurrentReleasedIdentity(stableId))
  if (!facts) return null
  const verifiedFacts = facts.filter((fact) => fact.partition === 'verified')
  const candidateFacts = facts.filter((fact) => fact.partition === 'candidate')
  const gapFacts = facts.filter((fact) => fact.partition === 'gap')
  const active = [verifiedFacts.length > 0, candidateFacts.length > 0, gapFacts.length > 0].filter(
    Boolean,
  ).length
  const status: L3AgentDevelopmentEvidenceStatus =
    active > 1
      ? 'mixed'
      : verifiedFacts.length > 0
        ? 'verified'
        : candidateFacts.length > 0
          ? 'candidate'
          : gapFacts.length > 0
            ? 'gap'
            : 'unavailable'
  return {
    packageId: l3AgentDevelopmentEvidencePackage.packageId,
    manifestSha256: l3AgentDevelopmentEvidencePackage.manifestSha256,
    status,
    verifiedFacts,
    candidateFacts,
    gapFacts,
    blockers: [
      ...(candidateFacts.length
        ? [
            {
              code: 'candidate_only' as const,
              fieldPaths: candidateFacts.map((fact) => fact.fieldPath),
            },
          ]
        : []),
      ...(gapFacts.length
        ? [{ code: 'data_gap' as const, fieldPaths: gapFacts.map((fact) => fact.fieldPath) }]
        : []),
    ],
  }
}

/** Current 3.1 Community Candidate claims; never a Formal result or Import instruction. */
export function getL3MiyousheCandidateEvidence(
  stableId: string,
): readonly L3MiyousheCandidateEvidenceFact[] {
  return (agentEvidenceByReleasedId.get(resolveCurrentReleasedIdentity(stableId)) ?? []).filter(
    (fact): fact is L3MiyousheCandidateEvidenceFact =>
      typeof fact.value === 'string' &&
      typeof fact.gameVersion === 'string' &&
      fact.candidateClaim !== undefined,
  )
}

/** Static current-L3 sidecar for agent-development decisions; it never reads NDJSON at runtime. */
export function getL3NoncharacterMiyousheCandidateSidecar(
  stableId: string,
): readonly L3NoncharacterMiyousheSidecarFact[] {
  return getL3NoncharacterMiyousheSidecarFacts(stableId)
}
