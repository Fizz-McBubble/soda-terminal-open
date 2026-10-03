import { z } from 'zod'

const finite = z.number().finite()

/** Shared final attacker factors for declared anomaly snapshots.
 * All fields are explicit; this contract contains no account or source IR. */
export const publicAnomalySnapshotStatsSchema32 = z
  .object({
    attackerLevel: finite.int().min(1).max(60),
    attack: finite.positive(),
    anomalyProficiency: finite.nonnegative(),
    anomalyBaseBonus: finite,
    flatAnomalyDamage: finite,
    anomalyCritRate: finite,
    anomalyCritDamage: finite,
    damageBonus: finite,
    buffBonus: finite,
    directDamageBonus: finite,
    defenseIgnore: finite,
    penetrationRatio: finite,
    penetrationFlat: finite.nonnegative(),
    resistanceIgnore: finite,
  })
  .strict()
