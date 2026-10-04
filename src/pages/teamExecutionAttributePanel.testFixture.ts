import type { DriveDisc } from '../domain/schemas'
import type { TeamExecutionMember } from '../decision/teamExecutionProjection'

export const discs: DriveDisc[] = [1, 2, 3, 4, 5, 6].map((slot) => ({
  id: `suggested-${slot}`,
  setId: 'set-swing-jazz',
  slot: slot as 1 | 2 | 3 | 4 | 5 | 6,
  level: 15,
  rarity: 'S',
  mainStat: [null, 'hp_flat', 'atk_flat', 'def_flat', 'crit_rate', 'pen_ratio', 'energy_regen'][
    slot
  ]! as DriveDisc['mainStat'],
  subStats: slot === 1 ? [{ stat: 'atk_flat', value: 42, upgrades: 2 }] : [],
  locked: false,
  favorite: false,
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  dataVersion: 'test',
}))

export function member(
  agentId: string,
  wEngine: TeamExecutionMember['suggested']['wEngine'],
): TeamExecutionMember {
  return {
    agentId,
    current: { wEngineCopyId: null, discIds: [] },
    suggested: { wEngine, discIds: discs.map((disc) => disc.id) },
    actions: [],
    impacts: [],
    status: 'ready',
  }
}
