import type { BuildIntent } from '../decision/buildIntent'
import { contentHash } from './contentHash'

/** Version identities are shared by the private solver and local backup integrity checks. */
export const actualDiscScoreVersion = 'actual-disc-values-s-standard-r1'
export const candidateSetPlanPolicyVersion =
  'legal-slot-menu-white-qualified-nonstacking-four-piece-r4'

export function computeBuildIntentFingerprint<T extends Omit<BuildIntent, 'fingerprint'>>(
  intent: T,
) {
  return contentHash({
    ...intent,
    discScoring: actualDiscScoreVersion,
    branchPolicy: candidateSetPlanPolicyVersion,
  })
}

export function buildIntentFingerprintMatches(
  intent: BuildIntent,
  allowHistoricalSnapshot = false,
) {
  const { fingerprint, ...unfingerprinted } = intent
  if (!fingerprint) return false
  if (fingerprint === computeBuildIntentFingerprint(unfingerprinted)) return true
  // Preserve issued snapshots as history without giving them current solver eligibility.
  return (
    allowHistoricalSnapshot &&
    [
      'explicit-branch-priority-r1',
      'explicit-branch-priority-shared-four-piece-once-r2',
      'legal-slot-fixed-branch-priority-shared-four-piece-once-r3',
    ].some(
      (branchPolicy) =>
        fingerprint ===
        contentHash({
          ...unfingerprinted,
          discScoring: actualDiscScoreVersion,
          branchPolicy,
        }),
    )
  )
}
