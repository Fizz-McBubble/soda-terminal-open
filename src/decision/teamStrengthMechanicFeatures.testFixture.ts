import {
  extractTeamStrengthMechanicFeatures,
  type TeamStrengthMechanicFeatureName,
} from './teamStrengthMechanicFeatures'

export function value(ids: readonly string[], name: TeamStrengthMechanicFeatureName) {
  const result = extractTeamStrengthMechanicFeatures(ids)
  return result.values[result.featureNames.indexOf(name)]!
}
