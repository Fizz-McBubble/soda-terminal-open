import {
  projectGenericRankingDecision,
  projectUnrankedTeamPlay,
} from './teamGenericRankingProjection'
import { currentVersionProjection } from '../gameDataPacks/currentVersionProjection'
import { stableContentHash } from '../gameDataPacks/types'
import { type TeamPrimaryOutputKind } from '../gameDataPacks/teamOutputModuleContract'
import {
  current31TeamIntrinsicIndexStatus,
  lookupCurrent31TeamIntrinsicDetails,
} from './current31TeamIntrinsicIndex'
import {
  genericFinitePlayIdentity,
  genericPlayClassificationBasis,
  type GenericRankingIntrinsicBinding,
} from './teamGenericPlayBinding'
import { teamStrengthMechanicDataFingerprint } from './teamStrengthMechanicFeatures'
import {
  genericRankingBands,
  genericRankingConfidences,
  genericRankingAuthorities,
  genericRankingClassificationBases,
  decodeGenericRankingProof,
  teamGenericRankingPolicy,
  hasValidGenericReferenceInterval,
  type GenericReferenceInterval,
} from './teamGenericRankingMethod'
import type { CurrentTeamSystemRanking } from './teamSystemRanking'
import type { FiniteTeamPlay } from './teamFinitePlayContract'
import {
  isAdmittedTeamPlay,
  canonicalTeamPlayIdentity,
  teamPlayMechanismFamilyKey,
  type buildTeamMechanismCatalog,
} from '../domain/teamPlayMechanismContract'
import { readTeamStartupIndex } from './teamStartupIndexEnvelope'

type Artifact = {
  contract: string
  producer: string
  gameVersion: string
  intrinsicIndexContentHash: string
  mechanicDataFingerprint: string
  policy: typeof teamGenericRankingPolicy
  agentIds: string[]
  statuses: string[]
  bands: string[]
  confidences: string[]
  authorities: string[]
  systems: TeamPrimaryOutputKind[]
  sourceRefs: string[]
  classificationBases: string[]
  /** [primaryAgentIndex, classificationBasisIndex, ...sourceRefIndices]. */
  proofs: number[][]
  playIdentities: string[]
  mechanismCatalog: ReturnType<typeof buildTeamMechanismCatalog>
  rows: number[][]
  evidence: Record<
    string,
    {
      sourceRefs: string[]
      sourceAuthority: string
      primaryOutputAgentId: string | null
      mechanismDirection?: {
        status: string
        primaryOutputAgentId: string | null
        evidenceRefs: string[]
      }
      classificationBasis:
        | 'reviewed_exact_team_output_module'
        | 'primary_special_output_family'
        | 'anomaly_output_capacity'
        | 'standard_direct_output'
        | null
      referenceInterval?: GenericReferenceInterval | null
    }
  >
  evidenceCoverage: { gradedReferences: number; compactRows: number }
  coverage: { total: number; recommended: number; exploration: number; unsupported: number }
  contentHash: string
}
const key = (ids: readonly string[]) => [...ids].sort().join('|')
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** One offline product authority. The older system-capacity artifact remains
 * diagnostic and is never the fallback for a missing/stale generic artifact. */
export function createGenericTeamRankingReader(
  input: unknown,
  intrinsic: GenericRankingIntrinsicBinding = {
    status: current31TeamIntrinsicIndexStatus.status,
    contentHash: current31TeamIntrinsicIndexStatus.contentHash,
    lookup: lookupCurrent31TeamIntrinsicDetails,
  },
) {
  let reason: string | null = null
  let artifact: Artifact | null = null
  let sourceContentHash: string | null = null
  const rows = new Map<string, number[]>()
  const catalogByRow = new Map<number[], number[][]>()
  const checkedCatalogBindings = new Set<string>()
  try {
    const scope = readTeamStartupIndex(input)
    const value = scope.artifact as Artifact
    const { contentHash, ...content } = value
    if (
      value.contract !== teamGenericRankingPolicy.contract ||
      value.producer !== 'soda-generic-team-ranking-producer/v1' ||
      !equal(value.policy, teamGenericRankingPolicy)
    )
      throw new Error('generic ranking method mismatch')
    if (stableContentHash(content) !== contentHash)
      throw new Error('generic ranking content mismatch')
    if (
      value.gameVersion !== currentVersionProjection.gameVersion ||
      intrinsic.status !== 'ready' ||
      value.intrinsicIndexContentHash !== intrinsic.contentHash ||
      value.mechanicDataFingerprint !== teamStrengthMechanicDataFingerprint
    )
      throw new Error('generic ranking input identity mismatch')
    if (
      !equal(value.bands, genericRankingBands) ||
      !equal(value.confidences, genericRankingConfidences) ||
      !equal(value.authorities, genericRankingAuthorities) ||
      !equal(value.classificationBases, genericRankingClassificationBases) ||
      !equal(value.statuses, ['recommended', 'exploration', 'unsupported'])
    )
      throw new Error('generic ranking dictionaries mismatch')
    if (
      !Array.isArray(value.sourceRefs) ||
      value.sourceRefs.some((ref) => typeof ref !== 'string' || !ref || ref.trim() !== ref) ||
      new Set(value.sourceRefs).size !== value.sourceRefs.length ||
      !Array.isArray(value.proofs) ||
      !Array.isArray(value.playIdentities) ||
      value.playIdentities.some(
        (identity) =>
          typeof identity !== 'string' || !/^agent-[^#]+#fnv1a-[0-9a-f]+$/.test(identity),
      ) ||
      new Set(value.playIdentities).size !== value.playIdentities.length
    )
      throw new Error('generic ranking proof dictionary invalid')
    const count = value.agentIds.length
    if (
      new Set(value.agentIds).size !== count ||
      count < 3 ||
      value.rows.length !== (scope.keys?.size ?? (count * (count - 1) * (count - 2)) / 6) ||
      (scope.indexSize !== null && scope.indexSize !== (count * (count - 1) * (count - 2)) / 6)
    )
      throw new Error('generic ranking candidate coverage mismatch')
    const proofIdentities = new Set<string>()
    const referencedSources = new Set<number>()
    for (const proof of value.proofs) {
      const [primary, basis, ...refs] = proof
      const identity = JSON.stringify(proof)
      if (
        proof.length < 2 ||
        !proof.every(Number.isInteger) ||
        primary! < -1 ||
        primary! >= count ||
        basis! < -1 ||
        basis! >= value.classificationBases.length ||
        refs.some((index) => index < 0 || index >= value.sourceRefs.length) ||
        new Set(refs).size !== refs.length ||
        proofIdentities.has(identity)
      )
        throw new Error('generic ranking compact proof invalid')
      proofIdentities.add(identity)
      refs.forEach((index) => referencedSources.add(index))
    }
    if (referencedSources.size !== value.sourceRefs.length)
      throw new Error('generic ranking orphan source reference')
    const isBasis = (basis: unknown) =>
      basis === null || genericRankingClassificationBases.some((value) => value === basis)
    for (const proof of Object.values(value.evidence)) {
      if (
        !proof ||
        !Array.isArray(proof.sourceRefs) ||
        !proof.sourceRefs.length ||
        proof.sourceRefs.some((ref) => typeof ref !== 'string' || !ref || ref.trim() !== ref) ||
        !genericRankingAuthorities.some(
          (authority) => authority !== 'mechanism_direction' && authority === proof.sourceAuthority,
        ) ||
        !(
          proof.primaryOutputAgentId === null || value.agentIds.includes(proof.primaryOutputAgentId)
        ) ||
        !isBasis(proof.classificationBasis)
      )
        throw new Error('generic ranking graded evidence invalid')
    }
    const coverage = { total: value.rows.length, recommended: 0, exploration: 0, unsupported: 0 }
    const positions = new Set<number>()
    const usedProofs = new Set<number>()
    const usedPlayIdentities = new Set<number>()
    let compactRows = 0
    for (const row of value.rows) {
      const [a, b, c, status, band, confidence, authority, system, display, proofIndex, playIndex] =
        row
      if (
        row.length !== 11 ||
        !row.every(Number.isInteger) ||
        !(a! >= 0 && a! < b! && b! < c! && c! < count) ||
        ![0, 1, 2].includes(status!) ||
        authority! < -1 ||
        authority! >= value.authorities.length ||
        system! < -1 ||
        system! >= value.systems.length ||
        display! < 0 ||
        display! >= (scope.indexSize ?? value.rows.length) ||
        positions.has(display!) ||
        proofIndex! < -1 ||
        proofIndex! >= value.proofs.length ||
        playIndex! < -1 ||
        playIndex! >= value.playIdentities.length
      )
        throw new Error('generic ranking row invalid')
      positions.add(display!)
      const ids = [value.agentIds[a!]!, value.agentIds[b!]!, value.agentIds[c!]!]
      const identity = key(ids)
      if (rows.has(identity)) throw new Error('generic ranking duplicate identity')
      if (scope.keys && !scope.keys.has(identity))
        throw new Error('startup generic ranking row is outside its scope')
      rows.set(identity, row)
      if (playIndex! >= 0) {
        if (!value.playIdentities[playIndex!]!.startsWith(`${identity}#`))
          throw new Error('generic ranking play binding member mismatch')
        usedPlayIdentities.add(playIndex!)
      }
      const compact = proofIndex! >= 0 ? value.proofs[proofIndex!]! : null
      if (compact) {
        usedProofs.add(proofIndex!)
        compactRows++
        if (compact[0]! >= 0 && !ids.includes(value.agentIds[compact[0]!]!))
          throw new Error('generic ranking proof primary outside team')
      }
      if (status === 0) {
        if (playIndex! < 0) throw new Error('generic ranking complete play binding missing')
        const proof = value.evidence[identity]
        const ungraded = genericRankingAuthorities[authority!] === 'mechanism_direction'
        if (
          (ungraded
            ? band !== -1 ||
              confidence !== -1 ||
              !compact ||
              compact.length <= 2 ||
              compact[0]! < 0 ||
              compact[1]! < 0
            : proofIndex !== -1 ||
              !genericRankingBands[band!] ||
              !genericRankingConfidences[confidence!] ||
              !proof?.sourceRefs.length ||
              proof.sourceAuthority !== genericRankingAuthorities[authority!] ||
              (proof.primaryOutputAgentId !== null && !ids.includes(proof.primaryOutputAgentId)) ||
              !proof.classificationBasis) ||
          !genericRankingAuthorities[authority!] ||
          system! < 0
        )
          throw new Error('generic ranking recommendation evidence missing')
        coverage.recommended++
      } else {
        if (band !== -1 || confidence !== -1)
          throw new Error('exploration acquired a strength tier')
        if (!compact) throw new Error('generic ranking ungraded proof missing')
        if (status === 1) coverage.exploration++
        else coverage.unsupported++
      }
    }
    for (const [identity, proof] of Object.entries(value.evidence)) {
      const row = rows.get(identity)
      if (
        !row ||
        (proof.primaryOutputAgentId !== null &&
          !row
            .slice(0, 3)
            .map((index) => value.agentIds[index])
            .includes(proof.primaryOutputAgentId))
      )
        throw new Error('generic ranking graded evidence identity mismatch')
      if (
        row[4]! >= 0 &&
        (proof.sourceAuthority === 'strength_gold' ||
          !hasValidGenericReferenceInterval({
            referenceInterval: proof.referenceInterval,
            band: genericRankingBands[row[4]!] ?? null,
            authority: proof.sourceAuthority,
            confidence: genericRankingConfidences[row[5]!] ?? null,
          }))
      )
        throw new Error('generic ranking reference interval or claim scope invalid')
    }
    if (
      usedProofs.size !== value.proofs.length ||
      usedPlayIdentities.size !== value.playIdentities.length ||
      value.evidenceCoverage?.gradedReferences !== Object.keys(value.evidence).length ||
      value.evidenceCoverage?.compactRows !== compactRows
    )
      throw new Error('generic ranking proof coverage mismatch')
    if (!equal(coverage, value.coverage) || !coverage.recommended)
      throw new Error('generic ranking coverage summary mismatch')
    const catalog = value.mechanismCatalog
    if (
      !catalog ||
      catalog.contract !== teamGenericRankingPolicy.catalogContract ||
      !Array.isArray(catalog.familyKeys) ||
      !Array.isArray(catalog.playIds) ||
      !Array.isArray(catalog.rows) ||
      [...catalog.familyKeys, ...catalog.playIds].some((id) => !/^sha256:[0-9a-f]{64}$/.test(id)) ||
      new Set(catalog.familyKeys).size !== catalog.familyKeys.length ||
      new Set(catalog.playIds).size !== catalog.playIds.length
    )
      throw new Error('generic ranking mechanism catalog invalid')
    const usedCatalogPlays = new Set<number>(),
      usedCatalogFamilies = new Set<number>()
    for (const entry of catalog.rows) {
      const [ordinal, variant, family, play] = entry
      const row = value.rows[ordinal!]
      if (
        entry.length !== 4 ||
        !entry.every(Number.isInteger) ||
        !row ||
        row[3] !== 0 ||
        variant! < 0 ||
        family! < 0 ||
        family! >= catalog.familyKeys.length ||
        play! < 0 ||
        play! >= catalog.playIds.length ||
        usedCatalogPlays.has(play!)
      )
        throw new Error('generic ranking mechanism catalog coordinate invalid')
      usedCatalogPlays.add(play!)
      usedCatalogFamilies.add(family!)
      catalogByRow.set(row, [...(catalogByRow.get(row) ?? []), entry])
    }
    if (
      usedCatalogPlays.size !== catalog.playIds.length ||
      usedCatalogFamilies.size !== catalog.familyKeys.length ||
      value.rows.some((row) => row[3] === 0 && !catalogByRow.has(row))
    )
      throw new Error('generic ranking mechanism catalog coverage invalid')
    artifact = value
    sourceContentHash = scope.fullHash ?? value.contentHash
  } catch (error) {
    reason = error instanceof Error ? error.message : 'generic ranking unavailable'
  }
  const ready = artifact
  const lookupEvidence = (ids: readonly string[]) => {
    if (!ready || ids.length !== 3 || new Set(ids).size !== 3) return null
    const row = rows.get(key(ids))
    if (!row) return null
    if (row[9]! >= 0) {
      const proof = ready.proofs[row[9]!]!
      return {
        encoding: 'interned_proof' as const,
        sourceAuthority: ready.authorities[row[6]!] ?? null,
        ...decodeGenericRankingProof(ready, proof),
      }
    }
    const proof = ready.evidence[key(ids)]!
    return {
      encoding: 'graded_object' as const,
      sourceAuthority: proof.sourceAuthority,
      primaryOutputAgentId: proof.primaryOutputAgentId,
      classificationBasis: proof.classificationBasis,
      sourceRefs: [...proof.sourceRefs],
    }
  }
  // Decode only queried recommendations. No startup expansion or runtime
  // re-solver fallback; the same immutable intrinsic details supply all facts.
  const boundDetails = (ids: readonly string[], row: number[]) => {
    if (!ready || row[10]! < 0) return null
    const details = intrinsic.lookup(ids, key(ids))
    const identity = genericFinitePlayIdentity(ready.intrinsicIndexContentHash, ids, details)
    if (!identity || identity !== ready.playIdentities[row[10]!]) return null
    const play = details!.mechanismDirection.playability!
    const catalogEntries = catalogByRow.get(row)
    if (
      !checkedCatalogBindings.has(identity) &&
      (!isAdmittedTeamPlay(play, key(ids)) ||
        !catalogEntries?.length ||
        !catalogEntries.every(([, variant, family, identity]) => {
          const archived = details!.mechanismDirection.variants?.[variant!]
          return (
            archived &&
            isAdmittedTeamPlay(archived, key(ids)) &&
            canonicalTeamPlayIdentity(archived) === ready.mechanismCatalog.playIds[identity!] &&
            teamPlayMechanismFamilyKey(archived) === ready.mechanismCatalog.familyKeys[family!]
          )
        }) ||
        !catalogEntries.some(
          (entry) => ready.mechanismCatalog.playIds[entry[3]!] === canonicalTeamPlayIdentity(play),
        ))
    )
      return null
    checkedCatalogBindings.add(identity)
    const evidence = lookupEvidence(ids)
    if (
      evidence?.primaryOutputAgentId !== play.primaryOutputAgentId ||
      ready.systems[row[7]!] !== play.outputSystem ||
      evidence.classificationBasis !== genericPlayClassificationBasis(play.outputSystem)
    )
      return null
    if (
      row[4]! < 0 &&
      row[3] === 0 &&
      !equal(evidence.sourceRefs, details!.mechanismDirection.evidenceRefs)
    )
      return null
    return details
  }
  const reader = {
    status: Object.freeze({
      status: ready ? ('ready' as const) : ('unavailable' as const),
      reason,
      contentHash: sourceContentHash,
      coverage: ready?.coverage ?? null,
      methodContract: teamGenericRankingPolicy.contract,
    }),
    lookupCatalog(ids: readonly string[]) {
      const row = rows.get(key(ids))
      if (!ready || !row || row[3] !== 0 || !boundDetails(ids, row)) return []
      return (catalogByRow.get(row) ?? []).map(([, variant, family, play]) => ({
        variantIndex: variant!,
        familyId: ready.mechanismCatalog.familyKeys[family!]!,
        playId: ready.mechanismCatalog.playIds[play!]!,
      }))
    },
    lookupEvidence(ids: readonly string[]) {
      const row = rows.get(key(ids))
      if (!row) return null
      const details = row[3] === 0 ? boundDetails(ids, row) : null
      if (row[3] === 0 && !details) return null
      const evidence = lookupEvidence(ids)
      return evidence
        ? {
            ...evidence,
            ...(details
              ? {
                  mechanismDirection: structuredClone(details.mechanismDirection),
                  formedTeamReference: structuredClone(details.formedTeamReference),
                  prerequisiteStatus: details.prerequisiteStatus,
                }
              : {}),
          }
        : null
    },
    lookup(ids: readonly string[]): CurrentTeamSystemRanking | null {
      if (!ready || ids.length !== 3 || new Set(ids).size !== 3) return null
      const row = rows.get(key(ids))
      if (!row) return null
      if (row[3] === 0 && !boundDetails(ids, row)) return null
      const [, , , status, band, confidence, authority, system, displayOrder] = row
      const evidence = lookupEvidence(ids)
      return projectGenericRankingDecision({
        contentHash: sourceContentHash!,
        system: ready.systems[system!] ?? null,
        classificationBasis:
          genericRankingClassificationBases.find(
            (basis) => basis === evidence?.classificationBasis,
          ) ?? null,
        decision: {
          key: key(ids),
          status: ready.statuses[status!] as 'recommended' | 'exploration' | 'unsupported',
          band: genericRankingBands[band!] ?? null,
          confidence: genericRankingConfidences[confidence!] ?? null,
          authority: genericRankingAuthorities[authority!] ?? '',
          displayOrder: displayOrder!,
          reason: null,
          referenceInterval:
            band! >= 0 ? (ready.evidence[key(ids)]?.referenceInterval ?? null) : null,
        },
      })
    },
    lookupForPlay(
      ids: readonly string[],
      play: FiniteTeamPlay | null | undefined,
    ): CurrentTeamSystemRanking | null {
      const ranking = reader.lookup(ids)
      if (!ranking?.genericOrder || !ready) return ranking
      const row = rows.get(key(ids))
      const details = row ? boundDetails(ids, row) : null
      const admitted = Boolean(play && isAdmittedTeamPlay(play, key(ids)))
      const playId = admitted ? canonicalTeamPlayIdentity(play!) : null
      const catalogued = Boolean(
        row &&
        playId &&
        (catalogByRow.get(row) ?? []).some(
          (entry) => ready.mechanismCatalog.playIds[entry[3]!] === playId,
        ),
      )
      if (
        ranking.genericOrder.status === 'recommended' &&
        catalogued &&
        details &&
        playId === canonicalTeamPlayIdentity(details.mechanismDirection.playability!)
      )
        return ranking
      return projectUnrankedTeamPlay(ranking, catalogued)
    },
  }
  return reader
}
