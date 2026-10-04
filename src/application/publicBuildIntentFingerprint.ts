import type { BuildIntent } from '../decision/buildIntent'
import { contentHash } from './contentHash'

/** Version identities are shared by the private solver and local backup integrity checks. */
export const actualDiscScoreVersion = 'actual-disc-values-s-standard-r1'
export const candidateSetPlanPolicyVersion = 'explicit-branch-priority-shared-four-piece-once-r2'

export function computeBuildIntentFingerprint<T extends Omit<BuildIntent, 'fingerprint'>>(
  intent: T,
) {
  return contentHash({
    ...intent,
    discScoring: actualDiscScoreVersion,
    branchPolicy: candidateSetPlanPolicyVersion,
  })
}

export function buildIntentFingerprintMatches(intent: BuildIntent) {
  const { fingerprint, ...unfingerprinted } = intent
  return Boolean(fingerprint) && fingerprint === computeBuildIntentFingerprint(unfingerprinted)
}
