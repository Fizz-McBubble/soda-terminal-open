import type { DriveDisc } from '../domain/schemas'
import { getCandidateWarehouseProfiles } from '../optimizer/candidateWarehouseSolver'
import {
  configuredMainStats,
  createAccountOptimizerKnowledge,
  toBuildProfile,
} from '../optimizer/accountBuildCandidates'
import { resolveSetPlan } from '../optimizer/optimizeBuild'
import { scoreActualDisc } from '../optimizer/scoreActualDisc'
import { discFactFromChoice } from './agentDevelopmentWorkbenchModel'
import type { GoldenWorkbenchData } from '../features/agentDevelopmentGolden'
import type { AccountDiscChoice } from '../optimizer/optimizeAccountBuilds'

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

export function applyRecordedDevelopmentMetrics(
  status: GoldenWorkbenchData['warehouseAnalysis'],
  evaluation: ReturnType<typeof evaluateDevelopmentRecordedDiscs>,
) {
  if (!evaluation || evaluation.choices.length !== 6) return
  status.totalScore =
    evaluation.totalScore === undefined ? undefined : Math.round(evaluation.totalScore * 10) / 10
  status.effectiveLines = evaluation.choices.reduce((sum, choice) => sum + choice.effectiveLines, 0)
  status.effectiveEnhancements = evaluation.choices.reduce(
    (sum, choice) => sum + choice.effectiveRolls - choice.effectiveLines,
    0,
  )
}

/** Evaluate only the displayed physical discs; never search or replace saved references. */
export function evaluateDevelopmentRecordedDiscs(agentId: string, discs: DriveDisc[]) {
  const profile = getCandidateWarehouseProfiles(
    [agentId],
    [...new Set(discs.map((disc) => disc.setId))],
  )[0]
  if (!profile) return null
  const buildProfile = toBuildProfile(profile)
  const choices = discs.map((disc) => {
    const effective = disc.subStats.filter((stat) => (profile.statWeights[stat.stat] ?? 0) > 0)
    return {
      ...scoreActualDisc(disc, buildProfile),
      effectiveLines: effective.length,
      wastedUpgrades: disc.subStats
        .filter((stat) => (profile.statWeights[stat.stat] ?? 0) <= 0)
        .reduce((sum, stat) => sum + stat.upgrades, 0),
    }
  })
  const complete =
    discs.length === 6 &&
    new Set(discs.map((disc) => disc.id)).size === 6 &&
    new Set(discs.map((disc) => disc.slot)).size === 6
  const counts: Record<string, number> = {}
  for (const disc of discs) counts[disc.setId] = (counts[disc.setId] ?? 0) + 1
  const setPlan = complete
    ? resolveSetPlan(
        counts,
        buildProfile,
        createAccountOptimizerKnowledge(profile, configuredMainStats(profile)),
      )
    : null
  return {
    choices,
    totalScore: setPlan
      ? Math.round(
          (choices.reduce((sum, choice) => sum + choice.score, 0) + setPlan.score) * 1000,
        ) / 1000
      : undefined,
  }
}
