import type { DriveDisc, StatKey } from '../domain/schemas'
import { currentAgentDirectory } from '../assault/catalog'
import { deriveSubStatHistory } from '../evaluation/subStatHistory'
import { driveDiscData } from '../data/gameData'
import { resolveDriveDiscMainStatValue } from '../calculation/outOfCombatPanel'
import { isConstraintCompatible } from './discEnhancementPotential'
import { hasConsistentDevelopmentStats, realizedScore } from './discEnhancementScoring'
import { legalSubStats } from './discEnhancementCeiling'
import type { WarehouseDemandContext } from './warehouseDemandContexts'
import { getCandidatePanelPolicy } from '../gameDataPacks/candidatePanelPolicy'

/** Account investment policy, not game damage, roll probability or a graduation standard. */
export { warehouseUsePolicyVersion } from './warehousePolicyVersion'

export type WarehouseContextQuality = {
  context: WarehouseDemandContext
  setRole: 'four_piece' | 'two_piece'
  usefulLines: number
  criticalLines: number
  effectiveRolls: number
  criticalRolls: number
  weightedRolls: number
  missedRolls: number
  functionMain: boolean
  viableNow: boolean
  admittedSeed: boolean
  premium: boolean
  worthInvestment: boolean
  stopReason: 'poor_seed' | 'failed_rolls' | null
  score: number
}

const specialties = new Map(currentAgentDirectory.map((agent) => [agent.id, agent.specialty]))
const functionalSpecialties = new Set(['support', 'stun', 'defense'])
const functionalStats = new Set<StatKey>([
  'atk_percent',
  'hp_percent',
  'def_percent',
  'impact',
  'energy_regen',
  'anomaly_mastery',
])

export function hasReliableWarehouseDiscRecord(disc: DriveDisc) {
  const maximum = driveDiscData?.rules.maxLevelByRarity[disc.rarity ?? 'S']
  return (
    deriveSubStatHistory(disc).status === 'known' &&
    maximum !== undefined &&
    disc.level <= maximum &&
    (driveDiscData?.rules.mainStatsBySlot[String(disc.slot)] ?? []).includes(disc.mainStat) &&
    resolveDriveDiscMainStatValue(disc) !== null &&
    hasConsistentDevelopmentStats(disc) &&
    new Set(disc.subStats.map((line) => line.stat)).size === disc.subStats.length &&
    disc.subStats.every((line) => legalSubStats.includes(line.stat) && line.stat !== disc.mainStat)
  )
}

export function assessWarehouseContextQuality(
  disc: DriveDisc,
  context: WarehouseDemandContext,
): WarehouseContextQuality | null {
  if (!isConstraintCompatible(disc, context.constraint)) return null
  const weights = context.constraint.subStatWeights
  const peak = Math.max(0, ...Object.values(weights).filter((value) => Number.isFinite(value)))
  if (peak <= 0) return null
  // Source priorities are relative. A long tail of weak stats must not become
  // indistinguishable from the first two recommended stats when counting rolls.
  const panelPolicy = getCandidatePanelPolicy(context.agentId)
  const attackObjective = Boolean(
    panelPolicy &&
    (!panelPolicy.requiredFourPieceSet ||
      context.setPlan.primarySetIds.includes(panelPolicy.requiredFourPieceSet)),
  )
  const useful = (stat: StatKey) =>
    (weights[stat] ?? 0) >= peak * 0.5 || (attackObjective && stat === 'atk_flat')
  const critical = (stat: StatKey) => (weights[stat] ?? 0) >= peak * 0.8
  const usefulLines = disc.subStats.filter((line) => useful(line.stat)).length
  const criticalLines = disc.subStats.filter((line) => critical(line.stat)).length
  const effectiveRolls = disc.subStats.reduce(
    (sum, line) => sum + (useful(line.stat) ? line.upgrades + 1 : 0),
    0,
  )
  const criticalRolls = disc.subStats.reduce(
    (sum, line) => sum + (critical(line.stat) ? line.upgrades + 1 : 0),
    0,
  )
  const missedRolls = disc.subStats.reduce(
    (sum, line) => sum + (useful(line.stat) ? 0 : line.upgrades),
    0,
  )
  const meaningfulWeights = Object.fromEntries(
    Object.entries(weights).filter(([stat]) => useful(stat as StatKey)),
  )
  const weightedRolls = realizedScore(disc, meaningfulWeights) / peak
  const setRole =
    context.setPlan.pattern === '4+2' && context.setPlan.primarySetIds.includes(disc.setId)
      ? 'four_piece'
      : 'two_piece'
  // A sourced functional main stat has actual value even without crit rolls.
  // This value does not depend on a cultivation flag and never applies to
  // fixed HP/ATK/DEF slots merely because a six-piece loadout is incomplete.
  const functionMain =
    disc.slot >= 4 &&
    functionalSpecialties.has(specialties.get(context.agentId) ?? '') &&
    functionalStats.has(disc.mainStat) &&
    (['impact', 'energy_regen', 'anomaly_mastery'].includes(disc.mainStat) ||
      critical(disc.mainStat))
  const objectiveRolls = attackObjective
    ? disc.subStats.reduce(
        (sum, line) =>
          sum +
          (line.stat === 'atk_percent' ||
          line.stat === 'atk_flat' ||
          (panelPolicy?.priorityStat === 'anomalyProficiency' &&
            line.stat === 'anomaly_proficiency')
            ? line.upgrades + 1
            : 0),
        0,
      )
    : 0
  const viableNow =
    functionMain ||
    (attackObjective && objectiveRolls >= 4 && criticalRolls >= 1) ||
    (disc.slot <= 3
      ? effectiveRolls >= 4 && criticalRolls >= 2 && weightedRolls >= 3
      : effectiveRolls >= 3 && criticalRolls >= 1 && weightedRolls >= 2.5)
  const admittedSeed =
    functionMain ||
    (disc.slot <= 3
      ? usefulLines >= 2 && criticalLines >= 1
      : criticalLines >= 1 || usefulLines >= 2)
  const maximum = driveDiscData?.rules.maxLevelByRarity[disc.rarity ?? 'S'] ?? 15
  const finished = disc.level >= maximum
  const failedRolls = missedRolls >= 2 && !viableNow
  const stopReason = failedRolls
    ? 'failed_rolls'
    : (!admittedSeed || finished) && !viableNow
      ? 'poor_seed'
      : null
  // Reserves need a stronger visible basis than pieces for an active build.
  // The unknown fourth line never contributes to admission or reserve quality.
  const premium = finished
    ? effectiveRolls >= 6 && criticalRolls >= 3 && weightedRolls >= 5
    : usefulLines >= 2 && criticalLines >= 2 && missedRolls < 2
  return {
    context,
    setRole,
    usefulLines,
    criticalLines,
    effectiveRolls,
    criticalRolls,
    weightedRolls,
    missedRolls,
    functionMain,
    viableNow,
    admittedSeed,
    premium,
    worthInvestment: !finished && admittedSeed && !failedRolls && (missedRolls < 2 || functionMain),
    stopReason,
    // Reuse the established actual-substat objective; main progress is a
    // practical readiness tie-break, never presented as a damage percentage.
    score: realizedScore(disc, weights) * 10 + (20 * disc.level) / maximum,
  }
}

export function warehouseQualityIsAdmitted(quality: WarehouseContextQuality) {
  return (
    quality.context.eligibility === 'eligible' &&
    (quality.context.demand === 'active'
      ? quality.viableNow || quality.worthInvestment
      : quality.premium || quality.functionMain)
  )
}
