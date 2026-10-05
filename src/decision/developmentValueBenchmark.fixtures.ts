import { createEmptyRoster } from '../assault/catalog'
import type { CoreWarehouse } from '../accounts/coreFlow'
import type { DriveDisc } from '../domain/schemas'
import type { CandidateWarehousePlan } from '../optimizer/candidateWarehouseSolver'

export function disc(
  slot: 1 | 2 | 3 | 4 | 5 | 6,
  id: string,
  attack: number,
  setId = 'set-woodpecker-electro',
): DriveDisc {
  return {
    id,
    slot,
    setId,
    level: 15,
    mainStat: (
      {
        1: 'hp_flat',
        2: 'atk_flat',
        3: 'def_flat',
        4: 'crit_rate',
        5: 'physical_dmg',
        6: 'atk_percent',
      } as const
    )[slot],
    subStats: [{ stat: 'atk_flat', value: attack, upgrades: 0 }],
    locked: false,
    favorite: false,
    tags: [],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    dataVersion: '3.1',
  }
}

export function fixture() {
  const roster = createEmptyRoster('2026-09-01T00:00:00.000Z')
  const baseline = Array.from({ length: 6 }, (_, index) =>
    disc((index + 1) as 1 | 2 | 3 | 4 | 5 | 6, `base-${index + 1}`, 1),
  )
  const stronger = Array.from({ length: 6 }, (_, index) =>
    disc((index + 1) as 1 | 2 | 3 | 4 | 5 | 6, `strong-${index + 1}`, 50),
  )
  roster.wEngines = [
    {
      copyId: 'copy-billy',
      engineId: 'wengine-12001',
      level: 60,
      refinement: 1,
      equippedAgentId: 'agent-billy',
      manualSource: 'manual_override',
    },
  ]
  roster.agents = roster.agents.map((agent) =>
    agent.agentId === 'agent-billy'
      ? {
          ...agent,
          owned: true,
          level: 60,
          skillLevels: { ...agent.skillLevels, core: 7 },
          wEngineCopyId: 'copy-billy',
          equippedDiscIds: baseline.map((item) => item.id),
        }
      : agent,
  )
  const warehouse: CoreWarehouse = {
    accountId: 'account-value-benchmark',
    account: null,
    roster,
    discs: [...baseline, ...stronger],
  }
  return { warehouse, baseline }
}

export function candidate(discs: DriveDisc[]): CandidateWarehousePlan {
  return {
    scope: 'agent',
    agentIds: ['agent-billy'],
    loadouts: [
      {
        agentId: 'agent-billy',
        discs: discs.map((disc) => ({
          disc,
          score: 1,
          mainStatScore: 1,
          subStatScore: 1,
          effectiveRolls: 1,
          effectiveLines: 1,
          wastedUpgrades: 0,
          reasons: [],
        })),
        totalScore: 6,
        setCounts: { 'set-woodpecker-electro': 6 },
        setPattern: '4+2',
        confidence: 'medium',
        scenario: 'normalized',
        contextRationale: [],
        teamAssumptions: [],
        bangbooIds: [],
        degraded: false,
        degradeReasons: [],
      },
    ],
    totalScore: 6,
    alternatives: [],
    gaps: [],
    boundary: 'fixture',
  }
}
