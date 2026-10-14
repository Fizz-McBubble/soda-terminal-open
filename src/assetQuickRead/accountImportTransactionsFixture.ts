import Dexie from 'dexie'
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, expect, vi } from 'vitest'
import { type PlanningDraftInput } from '../accounts/planningDrafts'
import type { RosterAgent } from '../assault/types'
import { SodaDatabase } from '../db/databaseCore'
import {
  confirmAssetQuickReadImport,
  prepareAssetQuickReadImport,
  readLatestAssetQuickReadRecovery,
  restoreAssetQuickReadImport,
} from './accountImport'
import {
  accountId,
  agentId,
  candidate,
  createQuickReadTestDatabase,
} from './accountImport.fixtures'
export function registerAccountImportTransactionsFixture() {
  let db: SodaDatabase
  beforeEach(async () => {
    db = await createQuickReadTestDatabase()
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    db.close()
    // The only deleted database is the uniquely created synthetic test database.
    expect(db.name.startsWith('asset-quick-read-test-')).toBe(true)
    await Dexie.delete(db.name)
  })
  async function facts() {
    return {
      accounts: await db.accounts.toArray(),
      settings: await db.settings.toArray(),
      discs: await db.accountDriveDiscs.toArray(),
      rosters: await db.accountRosters.toArray(),
      preferences: await db.accountPreferences.toArray(),
      planningDrafts: await db.accountPlanningDrafts.toArray(),
    }
  }
  async function agent() {
    return (await db.accountRosters.get(accountId))!.roster.agents.find(
      (row) => row.agentId === agentId,
    )!
  }
  async function patchAgent(patch: Partial<RosterAgent>) {
    const record = (await db.accountRosters.get(accountId))!
    const existing = record.roster.agents.find((row) => row.agentId === agentId)!
    Object.assign(existing, patch)
    await db.accountRosters.put(record)
    return structuredClone(existing)
  }
  async function apply(input = candidate()) {
    const plan = await prepareAssetQuickReadImport(accountId, input, db)
    return confirmAssetQuickReadImport(
      input,
      plan,
      { accountId, snapshotSha256: input.snapshotSha256, sameGameAccountAndCounts: true },
      db,
    )
  }

  function planningInput(id: string, warehouseRefs: string[]): PlanningDraftInput {
    return {
      id,
      kind: 'agent',
      name: `合成规划 ${id}`,
      selection: { agentIds: [agentId], bangbooId: null, scenario: 'synthetic' },
      manualOverrides: {
        wEngineDirection: '',
        discDirection: '',
        progressionDirection: '',
        notes: '',
      },
      knowledgeRefs: [],
      warehouseRefs,
      comparisonCapability: 'direction',
    }
  }

  async function expectPlanningRestoreBlocked(recoveryKey: string, planId: string) {
    const before = await facts()
    const preview = await readLatestAssetQuickReadRecovery(accountId, db)
    expect(preview).toMatchObject({ canRestore: false })
    expect(preview?.unavailableReason).toContain(planId)
    expect(preview?.unavailableReason).toContain('调整')
    await expect(
      restoreAssetQuickReadImport(accountId, recoveryKey, 'restore_asset_quick_read', db),
    ).rejects.toThrow(preview!.unavailableReason)
    expect(await facts()).toEqual(before)
  }
  return {
    get db() {
      return db
    },
    facts,
    agent,
    patchAgent,
    apply,
    planningInput,
    expectPlanningRestoreBlocked,
  }
}
export type AccountImportTransactionsFixture = ReturnType<
  typeof registerAccountImportTransactionsFixture
>
