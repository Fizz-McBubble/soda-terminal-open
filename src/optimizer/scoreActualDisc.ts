import type { BuildProfile, DriveDisc } from '../domain/schemas'
import { driveDiscData } from '../data/gameData'
import { evaluationRules } from '../evaluation/rules'
import { resolveDriveDiscMainStatValue } from '../calculation/outOfCombatPanel'
import type { DiscContribution } from './optimizeBuild'

export { actualDiscScoreVersion } from '../application/publicBuildIntentFingerprint'
export const candidateSetFitPoints = { twoPiece: 12, fourPiece: 30 } as const

export function scoreSetFit(fit: number, count: number) {
  return fit * (count >= 4 ? candidateSetFitPoints.fourPiece : candidateSetFitPoints.twoPiece)
}

const standardSteps = new Map(
  driveDiscData?.rules.subStatStepsByRarity.S.map((rule) => [rule.stat, rule.baseValue]) ?? [],
)

function round(value: number) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000
}

/** Compare current recorded values on one S-rank scale, while keeping roll counts descriptive. */
export function scoreActualDisc(disc: DriveDisc, profile: BuildProfile): DiscContribution {
  const mainFit =
    profile.mainStatFit[String(disc.slot)]?.[disc.mainStat] ?? (disc.slot <= 3 ? 1 : 0)
  const currentMain = resolveDriveDiscMainStatValue(disc)
  const standardMain = resolveDriveDiscMainStatValue({
    ...disc,
    rarity: 'S',
    level: driveDiscData?.rules.maxLevelByRarity.S ?? 15,
  })
  const mainStatScore =
    currentMain && standardMain && standardMain.value > 0
      ? mainFit * 20 * (currentMain.value / standardMain.value)
      : 0
  const hits = disc.subStats
    .map((subStat) => ({
      ...subStat,
      weight: profile.statWeights[subStat.stat] ?? 0,
      rolls: subStat.upgrades + 1,
      valueUnits: subStat.value / (standardSteps.get(subStat.stat) ?? Infinity),
    }))
    .filter((hit) => hit.weight > 0)
  const subStatScore = hits.reduce((sum, hit) => sum + hit.valueUnits * hit.weight * 10, 0)
  return {
    disc,
    score: round(mainStatScore + subStatScore),
    mainStatScore: round(mainStatScore),
    subStatScore: round(subStatScore),
    effectiveRolls: hits.reduce((sum, hit) => sum + hit.rolls, 0),
    reasons: [
      ...(mainFit > 0 ? [`${evaluationRules.stats[disc.mainStat].label}主词条适配`] : []),
      ...hits
        .sort((left, right) => right.weight * right.valueUnits - left.weight * left.valueUnits)
        .slice(0, 2)
        .map((hit) => `${evaluationRules.stats[hit.stat].label} ${hit.rolls} 次有效词条`),
    ],
  }
}
