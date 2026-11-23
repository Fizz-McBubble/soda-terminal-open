import {
  teamPrimaryOutputKindLabels,
  type TeamPrimaryOutputKind,
} from '../gameDataPacks/teamOutputModuleContract'
import type { CurrentTeamSystemRanking } from './teamSystemRanking'
import type { TeamSystemClassificationBasis } from './teamSystemRankingMethod'
import { teamGenericRankingPolicy, type GenericRankingDecision } from './teamGenericRankingMethod'
import { graduatedTeamRatingBands, type GraduatedTeamRatingBand } from './graduatedTeamRatingBands'

/** Keep evidence for the selected play separate from a different ranked play. */
export function projectUnrankedTeamPlay(
  ranking: CurrentTeamSystemRanking,
  catalogued: boolean,
): CurrentTeamSystemRanking {
  const generic = ranking.genericOrder
  if (!generic) return ranking
  return {
    contract: ranking.contract,
    contentHash: ranking.contentHash,
    status: 'unsupported',
    system: null,
    systemLabel: null,
    systemRank: null,
    internalScore: null,
    classificationBasis: null,
    reason: 'mechanic_evidence_missing',
    rankScope: 'system',
    crossSystemComparable: false,
    sameCoreOutput: null,
    genericOrder: {
      contract: generic.contract,
      status: catalogued
        ? 'recommended'
        : generic.status === 'unsupported'
          ? 'unsupported'
          : 'exploration',
      band: null,
      confidence: null,
      sourceAuthority: catalogued ? 'mechanism_direction' : null,
      displayOrder: -1,
      referenceInterval: null,
    },
  }
}

/** Shared projection for an evaluated decision and its serialized reader.
 * Stable display order is carried separately from a whole-team strength claim. */
export function projectGenericRankingDecision(input: {
  decision: Omit<GenericRankingDecision, 'band'> & { band: GraduatedTeamRatingBand | null }
  contentHash: string
  system: TeamPrimaryOutputKind | null
  classificationBasis: TeamSystemClassificationBasis | null
}): CurrentTeamSystemRanking {
  const { decision, system } = input
  const common = {
    contract: 'soda-current-team-system-ranking/v3' as const,
    contentHash: input.contentHash,
    rankScope: 'system' as const,
    crossSystemComparable: false as const,
    genericOrder: {
      contract: teamGenericRankingPolicy.contract,
      status: decision.status,
      band: decision.band,
      confidence: decision.confidence,
      sourceAuthority: decision.authority,
      displayOrder: decision.displayOrder,
      referenceInterval: decision.referenceInterval ?? null,
      orderScope: 'reference_display' as const,
    },
    sameCoreOutput: null,
  }
  if (decision.status === 'unsupported' || !system)
    return {
      ...common,
      status: 'unsupported',
      system: null,
      systemLabel: null,
      systemRank: null,
      internalScore: null,
      classificationBasis: null,
      reason: 'no_classifiable_output',
    }
  const position = graduatedTeamRatingBands.findIndex((band) => band === decision.band)
  return {
    ...common,
    status: 'ranked',
    system,
    systemLabel: teamPrimaryOutputKindLabels[system],
    systemRank: position >= 0 ? position + 1 : graduatedTeamRatingBands.length + 1,
    internalScore: position >= 0 ? position + 1 : graduatedTeamRatingBands.length + 1,
    classificationBasis: input.classificationBasis ?? 'standard_direct_output',
  }
}
