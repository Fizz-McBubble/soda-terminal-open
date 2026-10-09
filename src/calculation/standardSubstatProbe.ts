import { driveDiscData } from '../data/gameData'
import type { StatKey } from '../domain/schemas'

/** An ephemeral arithmetic probe, never an equipped/owned disc or an enhancement prediction. */
export type StandardSubstatProbe = { stat: StatKey; value: number }

export function standardSubstatProbes(): StandardSubstatProbe[] {
  return (driveDiscData?.rules.subStatStepsByRarity.S ?? []).flatMap(({ stat, baseValue }) =>
    Number.isFinite(baseValue) && baseValue > 0 ? [{ stat, value: baseValue }] : [],
  )
}

export function isStandardSubstatProbe(probe: StandardSubstatProbe) {
  return standardSubstatProbes().some((row) => row.stat === probe.stat && row.value === probe.value)
}
