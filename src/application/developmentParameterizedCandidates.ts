import { stableContentHash } from '../gameDataPacks/types'
import type {
  DevelopmentCandidateAlternativesProjection,
  DevelopmentCandidateSearch,
} from '../decision/developmentCandidateAlternatives'
import type { DevelopmentCandidateRankingEntry } from '../decision/developmentCandidateRanking'
import type { DevelopmentComparisonParameters } from '../decision/developmentValueBenchmark'

/** Bind a rank to its declared personal parameters; different parameter rows remain unranked. */
export function projectDevelopmentParameterizedCandidates({
  baseProjection,
  explicit,
  initialDirectionParameters,
  generate,
}: {
  baseProjection: DevelopmentCandidateAlternativesProjection
  explicit: Record<number, DevelopmentComparisonParameters>
  initialDirectionParameters?: DevelopmentComparisonParameters
  generate: (
    parameters: DevelopmentComparisonParameters,
  ) => DevelopmentCandidateAlternativesProjection
}) {
  const projection = {
    ...baseProjection,
    candidates: [...baseProjection.candidates],
  }
  const candidateSearchByRank: Record<number, DevelopmentCandidateSearch> = {}
  if (
    Object.keys(explicit).some(
      (rank) =>
        !Number.isInteger(Number(rank)) ||
        Number(rank) < 1 ||
        Number(rank) > projection.candidates.length,
    )
  )
    throw new Error('显式比较参数必须绑定本次存在的候选序号。')
  // A rank is one comparison scenario. Regenerate its legal six-disc search
  // under the exact chosen engine/potential, preserving the other scenarios.
  const generated = new Map<string, DevelopmentCandidateAlternativesProjection>()
  const initialDirectionKey = initialDirectionParameters
    ? stableContentHash(initialDirectionParameters)
    : undefined
  if (initialDirectionParameters) generated.set(initialDirectionKey!, baseProjection)
  const effectiveOverrides: Record<number, DevelopmentComparisonParameters> = Object.fromEntries(
    Object.entries(explicit).map(([rank, parameters]) => [
      rank,
      initialDirectionParameters ? { ...initialDirectionParameters, ...parameters } : parameters,
    ]),
  )
  for (const [rank, parameters] of Object.entries(effectiveOverrides)) {
    const key = stableContentHash(parameters)
    if (!generated.has(key)) generated.set(key, generate(parameters))
    const sourceIndex = key === initialDirectionKey ? Number(rank) - 1 : 0
    const candidate = generated.get(key)!.candidates[sourceIndex]
    if (candidate) {
      projection.candidates[Number(rank) - 1] = candidate
      const search = generated.get(key)!.candidateSearch
      if (search) {
        const ranking = search.candidateRanking
        const entry = ranking?.entries[sourceIndex]
        if (ranking && entry) {
          const entries: DevelopmentCandidateRankingEntry[] = [
            {
              ...entry,
              candidateRank: Number(rank),
              groupRank: null,
              groupSize: 1,
              comparable: false,
              basis: {
                kind: 'unranked' as const,
                reason: 'parameter_bound_projection_mismatch' as const,
                direction: null,
                tieBreakers: [],
              },
            },
          ]
          candidateSearchByRank[Number(rank)] = {
            rankingMethod: 'parameter_bound_unranked',
            status: search.status,
            nodes: search.nodes,
            evaluations: search.evaluations,
            exactWithinDeclaredModel: search.exactWithinDeclaredModel,
            productionGameAccuracyCertified: search.productionGameAccuracyCertified,
            ...(search.diagnostics ? { diagnostics: search.diagnostics } : {}),
            candidateRanking: {
              ...ranking,
              entries,
              identity: stableContentHash({
                contract: ranking.contract,
                version: ranking.version,
                candidateRarityScope: ranking.candidateRarityScope,
                source: ranking.source,
                comparisonParametersIdentity: ranking.comparisonParametersIdentity,
                entries,
              }),
            },
          }
        } else {
          candidateSearchByRank[Number(rank)] = {
            rankingMethod: 'parameter_bound_unranked',
            status: search.status,
            nodes: search.nodes,
            evaluations: search.evaluations,
            exactWithinDeclaredModel: search.exactWithinDeclaredModel,
            productionGameAccuracyCertified: search.productionGameAccuracyCertified,
            ...(search.diagnostics ? { diagnostics: search.diagnostics } : {}),
          }
        }
      }
    }
  }
  if (Object.keys(explicit).length && projection.candidateSearch) {
    const search = projection.candidateSearch
    projection.candidateSearch = {
      rankingMethod: 'parameter_bound_unranked',
      status: search.status,
      nodes: search.nodes,
      evaluations: search.evaluations,
      exactWithinDeclaredModel: search.exactWithinDeclaredModel,
      productionGameAccuracyCertified: search.productionGameAccuracyCertified,
    }
  }

  const effectiveParametersByRank: Record<number, DevelopmentComparisonParameters> =
    initialDirectionParameters
      ? Object.fromEntries(
          projection.candidates.map((_, index) => [index + 1, initialDirectionParameters]),
        )
      : {}
  Object.assign(effectiveParametersByRank, effectiveOverrides)
  return { projection, candidateSearchByRank, effectiveParametersByRank }
}
