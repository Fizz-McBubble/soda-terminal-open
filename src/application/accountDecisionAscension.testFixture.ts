import { createEmptyRoster } from '../accounts/rosterHydration'
import { exportRosterSnapshot, rosterSnapshotSchema } from '../accounts/publicRosterSnapshot'
import type { AccountDecisionQueryInput } from './calculationQueryContract'
import { input } from './localCalculationQueryClient.testFixture'

export const ascensionAgentId = 'agent-claret'
export const ascensionEngineId = 'wengine-14161'

export function ascensionAgent(value: AccountDecisionQueryInput) {
  return value.warehouse.roster.agents.find((agent) => agent.agentId === ascensionAgentId)!
}

/** Ordinary schema-valid account facts, including the legacy copy/equipment association. */
export function ascensionInput(): AccountDecisionQueryInput {
  const value = input()
  value.warehouse.roster = createEmptyRoster('2026-10-03T00:00:00.000Z')
  Object.assign(ascensionAgent(value), {
    owned: true,
    level: 50,
    ascension: 4,
    mindscape: 0,
    progressionManuallySet: true,
    manualSource: 'manual_override',
    completeness: 'complete',
    currentEquipment: 'known',
    skillLevels: { basic: 11, dodge: 11, assist: 11, special: 11, chain: 11, core: 5 },
    wEngineDetails: {
      id: ascensionEngineId,
      name: '猩红渴望',
      level: 50,
      ascension: 4,
      refinement: 1,
    },
    wEngineCopyId: 'ascension-copy',
  })
  value.warehouse.roster.wEngines = [
    {
      copyId: 'ascension-copy',
      engineId: ascensionEngineId,
      level: 50,
      refinement: 1,
      equippedAgentId: ascensionAgentId,
      manualSource: 'manual_override',
      refinementManuallySet: true,
    },
  ]
  rosterSnapshotSchema.parse(exportRosterSnapshot(value.warehouse.roster))
  return value
}

export function ascensionPlan(accountId: string) {
  return {
    scopedId: `${accountId}:ascension-plan`,
    accountId,
    id: 'ascension-plan',
    kind: 'team' as const,
    state: 'saved' as const,
    name: '突破回归方案',
    selection: { agentIds: [ascensionAgentId], bangbooId: 'bangboo-amillion', scenario: '' },
    manualOverrides: {
      wEngineDirection: '',
      discDirection: '',
      progressionDirection: '',
      notes: '',
    },
    knowledgeRefs: [],
    warehouseRefs: [],
    comparisonCapability: 'direction' as const,
    teamEquipmentParameters: {
      wEngines: [
        {
          agentId: ascensionAgentId,
          engineId: ascensionEngineId,
          level: 50,
          ascension: 4,
          refinement: 1,
        },
      ],
      potentialByAgentId: { 'agent-koleda': 0 },
      bangbooId: 'bangboo-amillion',
      bangbooStars: 1,
      source: 'player_confirmed' as const,
    },
    createdAt: '2026-10-03T00:00:00.000Z',
    updatedAt: '2026-10-03T00:00:00.000Z',
    revision: 1,
  }
}
