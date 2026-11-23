import { describe, expect, it } from 'vitest'
import type { AccountPlanningDraft } from '../accounts/types'
import { defaultTeamPortfolioPreference } from '../accounts/teamPortfolioPreference'
import { createEmptyRoster } from '../assault/catalog'
import type { DriveDisc } from '../domain/schemas'
import type { WarehouseDiscCategory } from '../warehouse/discWarehouseAnalysis'
import { createAccountDecisionRun as captureAccountDecisionRun } from '../application/accountDecisionWorldLocal'
import { createLocalCalculationQueryClientCore } from '../application/localCalculationQueryClientCore'
import { readCurrentGameDataRuntimeSelection } from '../gameDataPacks/runtimeSelection'
import { buildAccountDecisionSnapshot } from './accountDecisionService'
import {
  calculationQueryContractVersion,
  type AccountDecisionRun,
} from '../application/calculationQueryContract'
import type {
  AccountDecisionWorld,
  AccountDecisionWorldInput,
} from '../application/accountDecisionWorld'
import { projectWarehouseActions } from '../application/warehouseActionProjection'

type WarehouseReadyRun = AccountDecisionRun & {
  snapshot: AccountDecisionRun['snapshot'] & {
    warehouse: NonNullable<AccountDecisionRun['snapshot']['warehouse']>
  }
}

// Projection fixtures use the production in-process query with the already
// imported solver. Worker startup is covered independently of these assertions.
const fixtureClient = createLocalCalculationQueryClientCore({
  readRuntimeSelection: readCurrentGameDataRuntimeSelection,
  calculateSnapshot: async (input, options) => {
    options?.signal?.throwIfAborted()
    return buildAccountDecisionSnapshot(input)
  },
})

/** These fixtures exercise completed warehouse projections through the production demand query. */
async function createAccountDecisionRun(
  input: Parameters<typeof captureAccountDecisionRun>[0],
  options: Parameters<typeof captureAccountDecisionRun>[1] = {},
): Promise<WarehouseReadyRun> {
  const client = options.client ?? fixtureClient
  const run = await captureAccountDecisionRun(input, { ...options, client })
  await client.queryWarehouseActions!({
    contractVersion: calculationQueryContractVersion,
    kind: 'warehouse_actions',
    runId: run.runId,
  })
  const warehouse = run.snapshot.warehouse
  if (!warehouse) throw new Error('Expected a completed warehouse snapshot after its demand query')
  return { ...run, snapshot: { ...run.snapshot, warehouse } }
}

function disc(id: string): DriveDisc {
  return {
    id,
    setId: 'set-woodpecker-electro',
    slot: 4,
    level: 12,
    rarity: 'S',
    mainStat: 'crit_rate',
    subStats: [
      { stat: 'crit_dmg', value: 4.8, upgrades: 2 },
      { stat: 'atk_percent', value: 3, upgrades: 1 },
      { stat: 'hp_flat', value: 112, upgrades: 1 },
      { stat: 'def_flat', value: 15, upgrades: 0 },
    ],
    locked: false,
    favorite: false,
    tags: [],
    createdAt: '2026-08-29T00:00:00.000Z',
    updatedAt: '2026-08-29T00:00:00.000Z',
    dataVersion: 'test',
  }
}

function input(): AccountDecisionWorldInput {
  const roster = createEmptyRoster('2026-08-29T00:00:00.000Z')
  roster.agents = roster.agents.map((agent) =>
    agent.agentId === 'agent-nicole'
      ? { ...agent, owned: true, equippedDiscIds: ['disc-under-test'] }
      : agent,
  )
  const draft = {
    scopedId: 'account-n3-projection:plan-under-test',
    accountId: 'account-n3-projection',
    id: 'plan-under-test',
    kind: 'agent',
    name: '妮可当前方案',
    state: 'saved',
    selection: { agentIds: ['agent-nicole'], bangbooId: null, scenario: 'test' },
    manualOverrides: {
      wEngineDirection: '',
      discDirection: '',
      progressionDirection: '',
      notes: '',
    },
    knowledgeRefs: [],
    warehouseRefs: ['disc-under-test'],
    comparisonCapability: 'direction',
    createdAt: '2026-08-29T00:00:00.000Z',
    updatedAt: '2026-08-29T00:00:00.000Z',
    revision: 1,
  } satisfies AccountPlanningDraft
  return {
    warehouse: {
      accountId: 'account-n3-projection',
      account: {
        id: 'account-n3-projection',
        displayName: 'N3 projection fixture',
        createdAt: '2026-08-29T00:00:00.000Z',
        updatedAt: '2026-08-29T00:00:00.000Z',
        isDefault: true,
        status: 'active',
        source: 'manual',
      },
      discs: [disc('disc-under-test')],
      roster,
    },
    drafts: [draft],
    activePlanIds: { 'agent-nicole': draft.id },
    developmentPriorityAgentIds: ['agent-nicole'],
    preference: defaultTeamPortfolioPreference,
  }
}

async function world(
  status: 'current' | 'stale',
  category: WarehouseDiscCategory,
): Promise<Extract<AccountDecisionWorld, { run: object }> & { run: WarehouseReadyRun }> {
  const run = await createAccountDecisionRun(input(), {
    runId: 'n3-projection-run',
    capturedAt: '2026-08-29T00:00:00.000Z',
  })
  const original = run.snapshot.warehouse.decisions[0]!
  const decision = {
    ...original,
    // This fixture constructs legacy category-only snapshots. New contextual
    // producer results are exercised separately, without mixing two policies.
    absoluteRetention: undefined,
    useAssessment: undefined,
    category,
    alternatives: category === 'replaceable' ? ['physical-alternative'] : [],
    cleanupSafety: {
      ...original.cleanupSafety,
      complete: category !== 'enhance_watch',
      alternativeSafe: category === 'replaceable',
    },
  }
  return {
    status,
    run: {
      ...run,
      snapshot: {
        ...run.snapshot,
        warehouse: { ...run.snapshot.warehouse, decisions: [decision] },
      },
    },
    liveFingerprint: status === 'current' ? run.snapshot.fingerprint.inputHash : 'changed',
    nextAction: {
      label: status === 'current' ? '核对仓库执行影响' : '重新分析当前账户',
      title: 'fixture',
      description: 'fixture',
      path: '/warehouse/discs',
    },
  }
}

export {
  describe,
  expect,
  it,
  defaultTeamPortfolioPreference,
  createEmptyRoster,
  createAccountDecisionRun,
  projectWarehouseActions,
  disc,
  input,
  world,
}
export type {
  AccountPlanningDraft,
  DriveDisc,
  WarehouseDiscCategory,
  AccountDecisionWorld,
  AccountDecisionWorldInput,
}
