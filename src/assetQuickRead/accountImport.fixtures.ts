import type { AccountDriveDisc } from '../accounts/types'
import { createEmptyRoster } from '../accounts/rosterHydration'
import { SodaDatabase } from '../db/databaseCore'
import type { AssetQuickReadCandidate } from './snapshotAdapter'

export const accountId = 'account-synthetic-alpha'
export const otherAccountId = 'account-synthetic-beta'
export const now = '2026-10-10T00:00:00.000Z'
export const earlier = '2026-10-09T00:00:00.000Z'
export const agentId = 'agent-nicole'

/** Entirely invented observation, with catalog identity only from the public current catalog. */
export function candidate(): AssetQuickReadCandidate {
  return {
    capturedAt: now,
    snapshotSha256: 'a'.repeat(64),
    protocolVersion: '3.2',
    fullInventoryVerified: false,
    counts: { discs: 1, sDiscs: 1, engines: 1, agents: 1, importableAgents: 1 },
    importable: true,
    issues: [],
    warnings: [],
    discs: {
      format: 'soda-terminal-drive-disc-import',
      formatVersion: 1,
      source: { adapter: 'asset-quick-read', capturedAt: now },
      batch: {},
      discs: [
        {
          setId: 'set-woodpecker-electro',
          slot: 1,
          level: 0,
          rarity: 'S',
          mainStat: 'hp_flat',
          subStats: [
            { stat: 'crit_rate', value: 2.4, upgrades: 0 },
            { stat: 'atk_percent', value: 3, upgrades: 0 },
            { stat: 'def_percent', value: 4.8, upgrades: 0 },
          ],
          locked: false,
          sourceId: 'asset-quick-read:880001',
        },
      ],
    },
    agents: [
      {
        agentId,
        name: '妮可',
        fields: {
          owned: true,
          level: 20,
          ascension: 1,
          mindscape: 0,
          skillLevels: { basic: 3, dodge: 3, assist: 4, special: 4, chain: 4, core: 2 },
          wEngineDetails: { id: 'wengine-13001', name: '聚宝箱', level: null, refinement: 1 },
        },
        observedFields: [
          'owned',
          'level',
          'ascension',
          'mindscape',
          'skillLevels.basic',
          'skillLevels.dodge',
          'skillLevels.assist',
          'skillLevels.special',
          'skillLevels.chain',
          'skillLevels.core',
          'wEngineDetails.id',
          'wEngineDetails.name',
          'wEngineDetails.refinement',
          'equippedDiscIds',
        ],
        equippedSourceIds: ['asset-quick-read:880001'],
      },
    ],
  }
}

export function storedDisc(id: string, source: string, scope = accountId): AccountDriveDisc {
  const incoming = candidate().discs.discs[0]
  return {
    id,
    scopedId: `${scope}:${id}`,
    accountId: scope,
    sourceLegacyId: 'synthetic-legacy',
    migratedAt: earlier,
    setId: incoming.setId!,
    slot: incoming.slot,
    level: incoming.level,
    rarity: 'S',
    mainStat: 'hp_flat',
    subStats: incoming.subStats.map((row) => ({
      ...row,
      stat: row.stat as 'crit_rate' | 'atk_percent' | 'def_percent',
    })),
    locked: true,
    favorite: true,
    tags: ['保留'],
    createdAt: earlier,
    updatedAt: earlier,
    dataVersion: 'synthetic-version',
    discVersion: `old-${id}`,
    importSource: {
      adapter: source.startsWith('asset-quick-read:') ? 'asset-quick-read' : 'synthetic-scanner',
      sourceId: source,
      capturedAt: earlier,
    },
  }
}

/** Fresh isolated database for every test; caller retains lifecycle ownership. */
export async function createQuickReadTestDatabase() {
  const db = new SodaDatabase(`asset-quick-read-test-${crypto.randomUUID()}`)
  await db.open()
  await db.accounts.bulkPut(
    [accountId, otherAccountId].map((id) => ({
      id,
      displayName: '合成测试账户',
      createdAt: earlier,
      updatedAt: earlier,
      isDefault: false,
      status: 'active' as const,
      source: 'manual' as const,
    })),
  )
  await db.settings.put({ key: 'active-account-id', value: accountId })
  await db.accountDriveDiscs.put(
    storedDisc('unrelated-physical-disc', 'asset-quick-read:889999', otherAccountId),
  )
  const roster = createEmptyRoster(earlier)
  await db.accountRosters.put({ accountId, roster, updatedAt: earlier, source: 'manual' })
  return db
}
