import type { DriveDisc } from '../domain/schemas'
import { driveDiscData } from '../data/gameData'
import { completeScoringDiscSelection, scoringDiscRecordIssue } from '../domain/discScoringInput'
import {
  candidateConstraintToDiscProfile,
  candidateSetPlansForConstraint,
} from '../gameDataPacks/candidateWarehouseDiscProfile'
import {
  getCandidateWarehouseConstraint,
  getCandidateWarehouseConstraintForIndependentDirection,
} from '../gameDataPacks/candidateWarehouseConstraints'
import { candidateGuidanceFieldAvailable } from '../gameDataPacks/candidateWarehouseGuidanceApplicability'
import type { CandidateWarehouseConstraint } from '../gameDataPacks/candidateWarehouseConstraintTypes'
import {
  evaluateCandidateSetPlanEligibility,
  type CandidateSetPlanEligibilityContext,
} from '../gameDataPacks/candidateSetPlanEligibility'
import {
  configuredMainStats,
  createAccountOptimizerKnowledge,
  toBuildProfile,
} from '../optimizer/accountBuildCandidates'
import { resolveSetPlan } from '../optimizer/optimizeBuild'
import { actualDiscScoreVersion, scoreActualDisc } from '../optimizer/scoreActualDisc'
import { contentHash } from '../application/contentHash'
import {
  developmentDiscScoreVersion,
  type DevelopmentDiscEvaluation,
} from '../application/publicDevelopmentDiscScore'
import { discFactFromChoice } from './agentDevelopmentWorkbenchModel'
import type { AccountDiscChoice } from '../optimizer/accountBuildAllocationTypes'
import type { DevelopmentComparisonParameters } from '../decision/developmentValueBenchmarkProjection'

export { applyRecordedDevelopmentMetrics } from '../application/publicDevelopmentDiscScore'

export function developmentDiscFacts(
  agentId: string,
  discs: DriveDisc[],
  choices: AccountDiscChoice[],
) {
  return discs.map((disc) =>
    discFactFromChoice(
      agentId,
      choices.find((choice) => choice.disc.id === disc.id) ?? null,
      disc,
      '当前方案',
    ),
  )
}

export type DevelopmentDiscScoreOptions = {
  /** Only an explicitly selected direction may override the default main stats. */
  independentDirection?: DevelopmentComparisonParameters['independentDirection']
  conditionContext?: CandidateSetPlanEligibilityContext
  /** Exact adopted constraint from a captured, validated BuildIntent. */
  constraint?: CandidateWarehouseConstraint | null
}

/** Re-evaluate physical facts; cached candidate/saved scores never establish this result. */
export function evaluateDevelopmentRecordedDiscs(
  agentId: string,
  discs: DriveDisc[],
  options: DevelopmentDiscScoreOptions = {},
): DevelopmentDiscEvaluation | null {
  const constraint =
    options.constraint !== undefined
      ? options.constraint
      : options.independentDirection
        ? getCandidateWarehouseConstraintForIndependentDirection(
            agentId,
            options.independentDirection,
          )
        : getCandidateWarehouseConstraint(agentId)
  if (!constraint || constraint.agentId !== agentId) return null
  const profile = candidateConstraintToDiscProfile(constraint)
  if (
    !profile ||
    !candidateGuidanceFieldAvailable(
      constraint,
      'build.main_sub_stats',
      constraint.reviewedIndependentDirectionId,
    )
  )
    return null
  const buildProfile = toBuildProfile(profile)
  const conditionContext = options.conditionContext ?? {}
  const plans = candidateSetPlansForConstraint(constraint)
  const basisFingerprint = contentHash({
    agentId,
    version: developmentDiscScoreVersion,
    actualDiscScoreVersion,
    rules: driveDiscData?.rules ?? null,
    source: constraint.contentHash,
    gameVersion: constraint.gameVersion,
    weights: profile.statWeights,
    mainStats: profile.mainStatFit,
    setFit: profile.setFit,
    plans,
    independentDirection: options.independentDirection ?? null,
    conditionContext,
  })
  const recordIssues: DevelopmentDiscEvaluation['recordIssues'] = []
  const choices = discs.flatMap((disc) => {
    const issue = scoringDiscRecordIssue(disc, driveDiscData?.rules)
    if (issue) {
      recordIssues.push({ id: disc.id, issue })
      return []
    }
    const effective = disc.subStats.filter((stat) => (profile.statWeights[stat.stat] ?? 0) > 0)
    return [
      {
        ...scoreActualDisc(disc, buildProfile),
        effectiveLines: effective.length,
        wastedUpgrades: disc.subStats
          .filter((stat) => (profile.statWeights[stat.stat] ?? 0) <= 0)
          .reduce((sum, stat) => sum + stat.upgrades, 0),
      },
    ]
  })
  const complete = completeScoringDiscSelection(discs) && choices.length === 6
  const result: DevelopmentDiscEvaluation = {
    version: developmentDiscScoreVersion,
    basisFingerprint,
    complete,
    choices,
    recordIssues,
    setStatus: 'unavailable',
  }
  if (!complete) return result
  result.effectiveLines = choices.reduce((sum, choice) => sum + choice.effectiveLines, 0)
  result.effectiveEnhancements = choices.reduce(
    (sum, choice) => sum + choice.effectiveRolls - choice.effectiveLines,
    0,
  )
  const counts: Record<string, number> = {}
  for (const disc of discs) counts[disc.setId] = (counts[disc.setId] ?? 0) + 1
  const matching = plans.flatMap((plan) => {
    const knowledge = createAccountOptimizerKnowledge(
      {
        ...profile,
        setPlans: [
          {
            pattern: plan.pattern,
            primarySets: plan.primarySetIds,
            secondarySets: plan.secondarySetIds,
          },
        ],
      },
      configuredMainStats(profile),
    )
    const match = resolveSetPlan(counts, buildProfile, knowledge)
    if (!match) return []
    const eligibility = evaluateCandidateSetPlanEligibility(agentId, plan, conditionContext)
    const unknown =
      eligibility.status === 'condition-unknown' ||
      (plan.purpose === 'conditional' && !plan.condition) ||
      (eligibility.status === 'eligible' && eligibility.effectCoverage === 'unknown')
    const disallowed =
      plan.purpose === 'historical' ||
      plan.purpose === 'transition' ||
      eligibility.status === 'condition-not-met' ||
      eligibility.effectCoverage === 'not-covered'
    return [
      { score: match.score, state: disallowed ? 'not_met' : unknown ? 'unknown' : 'confirmed' },
    ]
  })
  const confirmed = matching.filter((match) => match.state === 'confirmed')
  const possible = matching.filter((match) => match.state === 'unknown')
  const confirmedScore = Math.max(0, ...confirmed.map((match) => match.score))
  if (possible.some((match) => match.score > confirmedScore)) {
    result.setStatus = 'condition_unknown'
    return result
  }
  result.setStatus = confirmed.length
    ? 'confirmed'
    : matching.length
      ? 'condition_not_met'
      : 'unmatched'
  result.setScore = confirmedScore
  result.totalScore =
    Math.round((choices.reduce((sum, choice) => sum + choice.score, 0) + confirmedScore) * 1000) /
    1000
  return result
}
