import { getScopedId, type AccountDriveDisc, type AccountProfile } from './types'
import { createEmptyRoster } from '../assault/catalog'
import { currentWEngineDirectory, withPlanningDefaults } from '../assault/planningCatalog'
import { database, type SodaDatabase } from '../db/database'
import type { DriveDisc } from '../domain/schemas'
import { getCandidateWarehouseConstraint } from '../gameDataPacks/candidateWarehouseConstraints'
import { n2AcceptanceAccountId, n2AcceptanceAccountName } from './acceptanceAccountRecoveryEntry'

export {
  n2AcceptanceAccountId,
  n2AcceptanceAccountName,
  n2AcceptanceRecoveryQuery,
  isN2AcceptanceRecoveryAvailable,
} from './acceptanceAccountRecoveryEntry'

const activeAccountKey = 'active-account-id'
const baselineTimestamp = '2026-08-26T00:00:00.000Z'

function fixtureMainStat(
  slot: 1 | 2 | 3 | 4 | 5 | 6,
  constraint: NonNullable<ReturnType<typeof getCandidateWarehouseConstraint>>,
) {
  if (slot === 4) return constraint.mainStats['4']?.[0] ?? 'crit_rate'
  if (slot === 5) return constraint.mainStats['5']?.[0] ?? 'physical_dmg'
  if (slot === 6) return constraint.mainStats['6']?.[0] ?? 'atk_percent'
  return slot === 1 ? 'hp_flat' : slot === 2 ? 'atk_flat' : 'def_flat'
}

function acceptanceDisc(
  id: string,
  slot: 1 | 2 | 3 | 4 | 5 | 6,
  setId: string,
  mainStat: DriveDisc['mainStat'],
): DriveDisc {
  return {
    id,
    setId,
    slot,
    level: 15,
    rarity: 'S',
    mainStat,
    subStats: [
      { stat: 'crit_dmg', value: 19.2, upgrades: 3 },
      { stat: 'atk_percent', value: 9, upgrades: 2 },
      { stat: 'anomaly_proficiency', value: 9, upgrades: 0 },
      { stat: 'pen', value: 9, upgrades: 0 },
    ],
    locked: false,
    favorite: false,
    tags: ['验收基线'],
    discVersion: 'n2-product-review-r1',
    importBatchId: 'n2-product-review-r1',
    importFingerprint: id,
    importSource: {
      adapter: 'n2-acceptance-recovery',
      sourceId: 'n2-product-review-r1',
      capturedAt: baselineTimestamp,
    },
    createdAt: baselineTimestamp,
    updatedAt: baselineTimestamp,
    dataVersion: '3.1',
  }
}

export function buildN2AcceptanceBaseline() {
  const roster = createEmptyRoster(baselineTimestamp)
  // N2 was accepted against the frozen 57-agent catalog. Later releases belong
  // to the current N4 fixture and must not silently rewrite this recovery golden.
  roster.agents = roster.agents.filter((agent) => agent.agentId !== 'agent-sigrid')
  roster.agents = roster.agents.map(withPlanningDefaults)
  roster.bangboos = roster.bangboos.map((bangboo) => ({
    ...bangboo,
    owned: true,
    level: 60,
    manualSource: 'manual_initial_default',
  }))
  roster.wEngines = currentWEngineDirectory
    .filter((engine) => engine.releaseState === 'released' && engine.accountOwnable)
    .map((engine) => ({
      copyId: `n2-acceptance-${engine.id}`,
      engineId: engine.id,
      level: 60,
      refinement: 1,
      equippedAgentId: null,
      manualSource: 'manual_initial_default' as const,
      refinementManuallySet: false,
    }))
  roster.updatedAt = baselineTimestamp

  const constraints = roster.agents.flatMap((agent) => {
    const constraint = getCandidateWarehouseConstraint(agent.agentId)
    return constraint ? [constraint] : []
  })
  if (!constraints.length) throw new Error('当前生产数据没有可用于验收仓库的 Build Intent。')
  const baseDiscs = constraints.flatMap((constraint, agentIndex) =>
    Array.from({ length: 6 }, (_, offset) => {
      const slot = (offset + 1) as 1 | 2 | 3 | 4 | 5 | 6
      return acceptanceDisc(
        `n2-acceptance-base-${agentIndex}-${slot}`,
        slot,
        constraint.setIds[offset < 4 ? 0 : 1] ?? constraint.setIds[0]!,
        fixtureMainStat(slot, constraint),
      )
    }),
  )
  const discs = Array.from({ length: 400 }, (_, index) => ({
    ...baseDiscs[index % baseDiscs.length]!,
    id: `n2-acceptance-disc-${index + 1}`,
    importFingerprint: `n2-acceptance-disc-${index + 1}`,
  }))
  return { roster, discs }
}

export async function restoreN2AcceptanceAccount(db: SodaDatabase = database) {
  const baseline = buildN2AcceptanceBaseline()
  const restoredAt = new Date().toISOString()
  const existing = await db.accounts.get(n2AcceptanceAccountId)
  const account: AccountProfile = existing
    ? {
        ...existing,
        displayName: n2AcceptanceAccountName,
        updatedAt: restoredAt,
        status: 'active',
      }
    : {
        id: n2AcceptanceAccountId,
        displayName: n2AcceptanceAccountName,
        createdAt: restoredAt,
        updatedAt: restoredAt,
        isDefault: false,
        status: 'active',
        source: 'manual',
      }
  const scopedDiscs: AccountDriveDisc[] = baseline.discs.map((disc) => ({
    ...disc,
    scopedId: getScopedId(n2AcceptanceAccountId, disc.id),
    accountId: n2AcceptanceAccountId,
    sourceLegacyId: null,
    migratedAt: null,
  }))

  await db.transaction(
    'rw',
    [db.accounts, db.settings, db.accountRosters, db.accountDriveDiscs],
    async () => {
      await db.accounts.put(account)
      await db.accountRosters.put({
        accountId: n2AcceptanceAccountId,
        roster: baseline.roster,
        updatedAt: restoredAt,
        source: 'manual',
      })
      await db.accountDriveDiscs.where('accountId').equals(n2AcceptanceAccountId).delete()
      await db.accountDriveDiscs.bulkPut(scopedDiscs)
      await db.settings.put({ key: activeAccountKey, value: n2AcceptanceAccountId })
    },
  )

  return {
    account,
    counts: {
      agents: baseline.roster.agents.filter((agent) => agent.owned).length,
      wEngines: baseline.roster.wEngines?.length ?? 0,
      bangboos: baseline.roster.bangboos.filter((bangboo) => bangboo.owned).length,
      driveDiscs: baseline.discs.length,
    },
    created: !existing,
  }
}
