import Dexie from 'dexie'
import { afterEach, expect } from 'vitest'
import { defaultTeamPortfolioPreference } from '../accounts/teamPortfolioPreference'
import { createEmptyRoster } from '../assault/catalog'
import { SodaDatabase } from '../db/database'
import {
  calculationQueryContractVersion,
  type AccountDecisionQueryInput,
} from './calculationQueryContract'
import { recommendedTargetBangbooDefault } from '../decision/targetTeamEquipmentParameters'
import { createLocalCalculationQueryClient } from './localCalculationQueryClient'

export async function expectReviewedDefaultOrMissing(
  client: ReturnType<typeof createLocalCalculationQueryClient>,
  request: Parameters<typeof client.calculateTargetTeamWarehouseFit>[0],
  memberIds: readonly string[],
) {
  const expected = recommendedTargetBangbooDefault({ memberIds })
  if (!expected) {
    await expect(client.calculateTargetTeamWarehouseFit(request)).rejects.toThrow('尚无默认邦布')
    return
  }
  const fit = await client.calculateTargetTeamWarehouseFit(request)
  expect(fit.buildIntent.exactTeam.bangbooId).toBe(expected.bangbooId)
  expect(fit.effectiveEquipmentParameters?.source).toBe('source_defaults')
}

export function input(ownedAgentIds: readonly string[] = []): AccountDecisionQueryInput {
  const accountId = 'runtime-selection-account'
  return {
    warehouse: {
      accountId,
      account: {
        id: accountId,
        displayName: 'Runtime selection fixture',
        createdAt: '2026-09-06T00:00:00.000Z',
        updatedAt: '2026-09-06T00:00:00.000Z',
        isDefault: true,
        status: 'active',
        source: 'manual',
      },
      discs: [],
      roster: {
        ...createEmptyRoster('2026-09-06T00:00:00.000Z'),
        agents: createEmptyRoster('2026-09-06T00:00:00.000Z').agents.map((agent) => ({
          ...agent,
          owned: ownedAgentIds.includes(agent.agentId),
        })),
      },
    },
    drafts: [],
    activePlanIds: {},
    developmentPriorityAgentIds: [],
    preference: defaultTeamPortfolioPreference,
  }
}

export function query(runId: string, ownedAgentIds: readonly string[] = []) {
  return {
    contractVersion: calculationQueryContractVersion,
    kind: 'account_decision' as const,
    runId,
    capturedAt: '2026-09-06T00:00:00.000Z',
    input: input(ownedAgentIds),
  }
}

/** Register an independent database lifecycle for the importing test file. */
export function registerLocalCalculationQueryFixture() {
  const databases: SodaDatabase[] = []
  function createDatabase() {
    const name = `soda-local-query-runtime-${crypto.randomUUID()}`
    const database = new SodaDatabase(name)
    databases.push(database)
    return database
  }
  afterEach(async () => {
    for (const database of databases.splice(0)) {
      database.close()
      await Dexie.delete(database.name)
    }
  })
  return { createDatabase }
}
