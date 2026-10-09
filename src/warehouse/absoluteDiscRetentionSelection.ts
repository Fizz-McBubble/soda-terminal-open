import type { QualityEvidence, QualityPolicy } from './absoluteDiscRetentionContract'

const EPS = 1e-8

/** Select complete witnesses from the caller's score-ordered usable evidence. */
export function selectRetentionWitnesses(
  usable: readonly QualityEvidence[],
  policy: QualityPolicy,
  trialGates: {
    readonly materialComplete: boolean
    readonly functionalContextComplete: boolean
    readonly cleanupCalibrated: boolean
  },
) {
  const qualityWinners = usable.filter(
    (row) => row.cutoffs && row.currentScore + EPS >= row.cutoffs.keepFrom,
  )
  const readyFunction = usable.find(
    (row) => row.functionalState === 'ready' && row.useState === 'valid',
  )
  const growingFunction = usable.find(
    (row) =>
      row.functionalState === 'needs_level' &&
      row.useState === 'valid' &&
      row.investment.remainingNodes > 0 &&
      row.investment.qualified === true,
  )
  const borderline = usable.find(
    (row) => row.cutoffs && row.currentScore + EPS >= row.cutoffs.cleanupBelow,
  )
  const trials = usable.filter(
    (row) =>
      row.cutoffs &&
      row.investment.remainingNodes > 0 &&
      row.possibleFinalScore.upper + EPS >= row.cutoffs.cleanupBelow &&
      (row.investment.qualified === true ||
        (!policy.investment && row.investment.qualified === null)),
  )
  const validTrial = trials.find((row) => row.useState === 'valid')
  const trial = validTrial ?? trials[0]
  const investmentGaps = usable.filter(
    (row) =>
      row.investment.remainingNodes > 0 &&
      row.cutoffs &&
      row.possibleFinalScore.upper + EPS >= row.cutoffs.cleanupBelow &&
      row.investment.policyBlockers?.length,
  )
  const strictLow =
    usable.length > 0 &&
    usable.every(
      (row) => row.cutoffs && row.possibleFinalScore.upper + EPS < row.cutoffs.cleanupBelow,
    )
  // Conditional quality must not displace an independent valid route, including
  // a trial only when its existing material, functional and cleanup-policy gates admit it.
  const admittedValidTrial =
    validTrial &&
    trialGates.materialComplete &&
    trialGates.functionalContextComplete &&
    trialGates.cleanupCalibrated &&
    !strictLow
  const winner =
    qualityWinners.find((row) => row.useState === 'valid') ??
    (readyFunction || growingFunction || admittedValidTrial ? undefined : qualityWinners[0])
  return { winner, readyFunction, growingFunction, borderline, trial, investmentGaps, strictLow }
}
