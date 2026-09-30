import type { DriveDisc } from '../domain/schemas'
import { sampleDiscs } from '../evaluation/fixtures'

export function warehouseTestDisc(id: string, patch: Partial<DriveDisc> = {}): DriveDisc {
  return { ...sampleDiscs.treasureCandidate, id, locked: false, level: 15, ...patch }
}

export function warehouseEnhancementCandidate(
  id: string,
  level: 0 | 3 | 6 | 9 | 12 | 15,
): DriveDisc {
  return warehouseTestDisc(id, {
    setId: 'set-woodpecker-electro',
    slot: 1,
    mainStat: 'hp_flat',
    level,
    subStats: [
      { stat: 'hp_percent', value: 3 * (level / 3 + 1), upgrades: level / 3 },
      { stat: 'def_flat', value: 15, upgrades: 0 },
      { stat: 'def_percent', value: 4.8, upgrades: 0 },
      { stat: 'atk_flat', value: 19, upgrades: 0 },
    ],
  })
}

export function warehouseClearAlternative(id = 'clear-alternative'): DriveDisc {
  return warehouseTestDisc(id, {
    setId: 'set-woodpecker-electro',
    slot: 1,
    mainStat: 'hp_flat',
    subStats: [
      { stat: 'crit_rate', value: 14.4, upgrades: 5 },
      { stat: 'crit_dmg', value: 4.8, upgrades: 0 },
      { stat: 'atk_percent', value: 3, upgrades: 0 },
      { stat: 'def_flat', value: 15, upgrades: 0 },
    ],
  })
}
