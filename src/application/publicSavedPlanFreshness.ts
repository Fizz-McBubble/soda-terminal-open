import type { AccountPlanningDraft } from '../accounts/types'

const savedTeamFingerprintPrefix = 'saved-team/v2:'
const savedTeamPortfolioFingerprintPrefix = 'saved-team-portfolio/v1:'

export type SavedTeamPlanSnapshotFreshness =
  | { stale: false; format: 'saved-team/v2' | 'current-input' | 'legacy-matched' }
  | {
      stale: true
      reason:
        | 'missing-snapshot'
        | 'current-result-unavailable'
        | 'legacy-unverifiable'
        | 'unmatched'
    }

export type SavedTeamPortfolioSnapshotFreshness =
  | { stale: false; format: 'saved-team-portfolio/v1' }
  | {
      stale: true
      reason:
        | 'missing-snapshot'
        | 'current-result-unavailable'
        | 'legacy-unverifiable'
        | 'unmatched'
    }

export function inspectSavedTeamPortfolioPlanSnapshotFreshness(
  plan: Pick<
    AccountPlanningDraft,
    'kind' | 'solutionContext' | 'teamPortfolioSnapshot' | 'teamPortfolioBuildIntent'
  >,
  currentSavedPortfolioFingerprint: string | null | undefined,
): SavedTeamPortfolioSnapshotFreshness {
  const context = plan.solutionContext
  if (
    plan.kind !== 'team' ||
    !plan.teamPortfolioSnapshot ||
    !plan.teamPortfolioBuildIntent ||
    context?.contract !== 'soda-solution-context/v1' ||
    context.scope !== 'portfolio_joint' ||
    context.resourcePolicy !== 'cross_team_exclusive' ||
    !context.inputFingerprint
  )
    return { stale: true, reason: 'missing-snapshot' }
  if (!context.inputFingerprint.startsWith(savedTeamPortfolioFingerprintPrefix))
    return { stale: true, reason: 'legacy-unverifiable' }
  if (!currentSavedPortfolioFingerprint)
    return { stale: true, reason: 'current-result-unavailable' }
  return context.inputFingerprint === currentSavedPortfolioFingerprint
    ? { stale: false, format: 'saved-team-portfolio/v1' }
    : { stale: true, reason: 'unmatched' }
}

/** A saved team remains readable history until its current input has been verified. */
export function inspectSavedTeamPlanSnapshotFreshness(
  plan: Pick<AccountPlanningDraft, 'kind' | 'solutionContext' | 'teamEquipmentParameters'>,
  liveInputFingerprint: string | null | undefined,
  legacyCombinedFingerprint?: string,
  currentSavedTeamFingerprint?: string,
): SavedTeamPlanSnapshotFreshness {
  if (plan.kind !== 'team') return { stale: false, format: 'current-input' }
  const context = plan.solutionContext
  if (
    context?.contract !== 'soda-solution-context/v1' ||
    context.scope !== 'team_joint' ||
    context.resourcePolicy !== 'within_team_exclusive' ||
    !context.inputFingerprint
  )
    return { stale: true, reason: 'missing-snapshot' }
  if (!plan.teamEquipmentParameters) return { stale: true, reason: 'legacy-unverifiable' }
  if (context.inputFingerprint.startsWith(savedTeamFingerprintPrefix)) {
    if (!currentSavedTeamFingerprint) return { stale: true, reason: 'current-result-unavailable' }
    return context.inputFingerprint === currentSavedTeamFingerprint
      ? { stale: false, format: 'saved-team/v2' }
      : { stale: true, reason: 'unmatched' }
  }
  if (!liveInputFingerprint) return { stale: true, reason: 'current-result-unavailable' }
  if (context.inputFingerprint === liveInputFingerprint)
    return { stale: false, format: 'current-input' }
  if (!legacyCombinedFingerprint) return { stale: true, reason: 'legacy-unverifiable' }
  return context.inputFingerprint === legacyCombinedFingerprint
    ? { stale: false, format: 'legacy-matched' }
    : { stale: true, reason: 'unmatched' }
}
