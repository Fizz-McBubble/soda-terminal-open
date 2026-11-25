export const teamMechanicExcludedConsumerSources = [
  '../pages/teamRecommendationOrdering.ts',
  '../pages/teamRecommendationRank.ts',
  '../decision/accountDecisionAuthority.ts',
  '../decision/accountTeamIndexReader.ts',
  '../decision/accountDecisionOrdering.ts',
  '../decision/accountCultivationMarginalYield.ts',
  '../decision/teamRecommendationScore.ts',
  '../decision/defaultTeamRecommendationSelection.ts',
  '../decision/accountDecisionRecommendationProjection.ts',
  '../decision/savedTeamBuildIntent.ts',
  '../application/localTargetTeamFitQuery.ts',
  '../gameDataPacks/currentPlayerDevelopmentGuidance33.ts',
  '../gameDataPacks/severianPlayerConditions33.ts',
] as const

/** Downstream account selection and display cannot affect upstream source-mechanic
 * qualification. The full identity still invalidates saved planning results. */
export function teamStrengthMechanicConsumerIdentity(identity: {
  contract: string
  sourceHashes: Record<string, string>
}) {
  const sourceHashes = Object.fromEntries(
    Object.entries(identity.sourceHashes).filter(
      ([path]) => !teamMechanicExcludedConsumerSources.some((excluded) => excluded === path),
    ),
  )
  return { contract: identity.contract, sourceHashes }
}
