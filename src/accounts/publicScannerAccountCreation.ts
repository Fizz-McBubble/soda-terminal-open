import { createAccountWithRoster } from './accountCreationCore'
import { agentCatalog, bangbooCatalog } from '../assault/catalogData'
import {
  currentReleasedIdentityMap,
  resolveCurrentReleasedIdentity,
} from '../gameDataPacks/currentReleasedIdentityMap'
import { database, type SodaDatabase } from '../db/databaseCore'
import { accountIdSchema } from './types'
import type { AccountRoster } from '../assault/types'

export function createPublicScannerEmptyRoster(now = new Date().toISOString()): AccountRoster {
  const agentIds = [
    ...new Set(
      [
        ...agentCatalog.filter((entry) => entry[7] === 'released').map(([id]) => id),
        ...currentReleasedIdentityMap.entries
          .filter(
            (entry) => entry.releaseState === 'released' && entry.stableId.startsWith('agent-'),
          )
          .map((entry) => entry.stableId),
      ].map(resolveCurrentReleasedIdentity),
    ),
  ]
  const bangbooIds = [
    ...bangbooCatalog.map(([id]) => id),
    ...currentReleasedIdentityMap.entries
      .filter((entry) => entry.releaseState === 'released' && entry.stableId.startsWith('bangboo-'))
      .map((entry) => entry.stableId),
  ]
  return {
    schemaVersion: 3,
    sourceCompleteness: 'complete',
    agents: agentIds.map((agentId) => ({
      agentId,
      owned: false,
      priority: 3,
      level: 60,
      mindscape: 0,
      skills: '未录入',
      wEngine: '未录入',
      refinement: 0,
      agentVersion: '3.0',
      completeness: 'missing',
      currentEquipment: 'unknown',
      source: 'manual',
      manualSource: null,
      syncedAt: now,
      lockedFields: [],
      skillLevels: {
        basic: null,
        dodge: null,
        assist: null,
        special: null,
        chain: null,
        core: null,
      },
      wEngineDetails: { id: null, name: null, level: 60, refinement: 0 },
      wEngineCopyId: null,
      equippedDiscIds: null,
    })),
    bangboos: bangbooIds.map((bangbooId) => ({
      bangbooId,
      owned: false,
      level: 1,
      stars: 1,
      skillLevel: null,
      additionalAbilityLevel: null,
      manualSource: null,
    })),
    wEngines: [],
    updatedAt: now,
  }
}

export async function createPublicScannerAccount(
  displayName: string,
  db: SodaDatabase = database,
  options: { id?: string; now?: Date; makeDefault?: boolean } = {},
) {
  return createAccountWithRoster(displayName, db, options, createPublicScannerEmptyRoster)
}

export async function setPublicScannerActiveAccount(
  accountId: string,
  db: SodaDatabase = database,
) {
  accountIdSchema.parse(accountId)
  const account = await db.accounts.get(accountId)
  if (!account || account.status !== 'active') throw new Error('账号不存在或已归档。')
  await db.settings.put({ key: 'active-account-id', value: accountId })
  return account
}
