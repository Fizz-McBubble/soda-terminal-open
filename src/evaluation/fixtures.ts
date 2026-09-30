import type { DriveDisc } from '../domain/schemas'

const timestamp = '2026-06-11T00:00:00.000Z'

export const sampleDiscs = {
  treasureCandidate: {
    id: 'sample-treasure-candidate',
    setId: 'set-woodpecker-electro',
    slot: 4,
    level: 15,
    mainStat: 'crit_rate',
    subStats: [
      { stat: 'crit_dmg', value: 19.2, upgrades: 3 },
      { stat: 'atk_percent', value: 9, upgrades: 2 },
      { stat: 'anomaly_proficiency', value: 9, upgrades: 0 },
      { stat: 'pen', value: 9, upgrades: 0 },
    ],
    locked: false,
    favorite: false,
    tags: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    dataVersion: '2.0',
  },
  potentialCandidate: {
    id: 'sample-potential-candidate',
    setId: 'set-woodpecker-electro',
    slot: 5,
    level: 6,
    mainStat: 'physical_dmg',
    subStats: [
      { stat: 'crit_rate', value: 4.8, upgrades: 1 },
      { stat: 'crit_dmg', value: 4.8, upgrades: 0 },
      { stat: 'atk_percent', value: 3, upgrades: 0 },
      { stat: 'def_flat', value: 15, upgrades: 0 },
    ],
    locked: false,
    favorite: false,
    tags: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    dataVersion: '2.0',
  },
  dismantleCandidate: {
    id: 'sample-dismantle-candidate',
    setId: 'set-swing-jazz',
    slot: 4,
    level: 15,
    mainStat: 'def_percent',
    subStats: [
      { stat: 'hp_flat', value: 224, upgrades: 1 },
      { stat: 'def_flat', value: 45, upgrades: 2 },
      { stat: 'atk_flat', value: 38, upgrades: 1 },
      { stat: 'hp_percent', value: 6, upgrades: 1 },
    ],
    locked: false,
    favorite: false,
    tags: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    dataVersion: '2.0',
  },
} satisfies Record<string, DriveDisc>
