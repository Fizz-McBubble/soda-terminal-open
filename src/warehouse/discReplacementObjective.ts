import type { DriveDisc, StatKey } from '../domain/schemas'
import type { SubStatHistory } from '../evaluation/subStatHistory'
import type { RosterAgent } from '../assault/types'
import { driveDiscData } from '../data/gameData'
import { resolveDriveDiscMainStatValue } from '../calculation/outOfCombatPanel'
import { candidatePanelInputForAgent } from '../optimizer/optimizeAccountBuilds'
import { prepareCandidatePanelObjective } from '../optimizer/candidatePanelObjective'
import { optimisticCeiling } from './discEnhancementCeiling'
import { normalizedScore, realizedScore } from './discEnhancementScoring'

/** Coefficients convert actual disc stats into the adopted panel objective. */
export type DiscReplacementObjective = {
  baseAttack: number | null
  dimensions: Partial<Record<StatKey, number>>[]
}

export function prepareDiscReplacementObjective(
  agentId: string,
  agent: RosterAgent | undefined,
  discs: readonly DriveDisc[],
): DiscReplacementObjective | undefined {
  // At most six representative discs per role: never project a panel per warehouse disc.
  const anchors = [1, 2, 3, 4, 5, 6].flatMap(
    (slot) => discs.find((disc) => disc.slot === slot) ?? [],
  )
  const objective = prepareCandidatePanelObjective(
    agentId,
    anchors,
    candidatePanelInputForAgent(agent),
  )
  if (!objective.wantsPanelObjective) return undefined
  const baseAttack =
    objective.useObjective && Number.isFinite(objective.baseAttack) && objective.baseAttack > 0
      ? objective.baseAttack
      : null
  return {
    baseAttack,
    dimensions: [
      // Without a valid current panel, no guessed ATK baseline may justify a loss.
      ...(baseAttack === null
        ? [{ atk_percent: 1 }, { atk_flat: 1 }]
        : [{ atk_percent: baseAttack / 100, atk_flat: 1 }]),
      objective.requestedTarget?.priorityStat === 'energyRegen'
        ? { energy_regen: 1 }
        : { anomaly_proficiency: 1 },
    ],
  }
}

export function prepareDiscObjectiveCoverage(
  disc: DriveDisc,
  history: Extract<SubStatHistory, { status: 'known' }>,
  objective: DiscReplacementObjective | undefined,
) {
  if (!objective) return () => true
  const maxLevel = driveDiscData?.rules.maxLevelByRarity[disc.rarity ?? 'S']
  const currentMain = resolveDriveDiscMainStatValue(disc)
  const maxMain =
    maxLevel === undefined ? null : resolveDriveDiscMainStatValue({ ...disc, level: maxLevel })
  const bounds = objective.dimensions.map((coefficients, index) => {
    // Reuse the same conservative raw-value/recorded-roll bounds and legal
    // fourth-line/remaining-roll ceiling used by the ordinary role proof.
    const weights = Object.fromEntries(
      (driveDiscData?.rules.subStatStepsByRarity.S ?? []).map(({ stat, baseValue }) => [
        stat,
        (coefficients[stat] ?? 0) * baseValue,
      ]),
    )
    const ceiling = optimisticCeiling(disc, history, {
      id: `panel-objective:${index}`,
      agentId: null,
      weights,
    })
    const mainCoefficient = coefficients[disc.mainStat] ?? 0
    return {
      weights,
      mainCoefficient,
      current: normalizedScore(
        (ceiling?.realized ?? Infinity) + mainCoefficient * (currentMain?.value ?? Infinity),
      ),
      optimistic: normalizedScore(
        (ceiling?.optimistic ?? Infinity) + mainCoefficient * (maxMain?.value ?? Infinity),
      ),
    }
  })
  return (alternative: DriveDisc, future: boolean) => {
    const main = resolveDriveDiscMainStatValue(alternative)
    if (!currentMain || !maxMain || !main) return false
    return bounds.every((bound) => {
      const actual = normalizedScore(
        realizedScore(alternative, bound.weights, 'alternative') +
          bound.mainCoefficient * main.value,
      )
      return actual >= (future ? bound.optimistic : bound.current)
    })
  }
}
