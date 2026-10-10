import { useLiveQuery } from 'dexie-react-hooks'
import { getActiveAccount } from '../../accounts/repository'
import { database } from '../../db/databaseCore'
import { lastFullBackupPreference, type AccountState } from './dataCenterTypes'

export function useDataCenterAccountState(revision: number): AccountState {
  return (
    useLiveQuery(async () => {
      const active = await getActiveAccount()
      const accounts = await database.accounts.where('status').equals('active').toArray()
      const rawAccountSummaries = await Promise.all(
        accounts.map(async (account) => ({
          ...account,
          ...(await (async () => {
            const [
              discs,
              rosterRecord,
              evaluations,
              scanBatches,
              latestScanBatches,
              scanItems,
              optimizationResults,
              preferences,
            ] = await Promise.all([
              database.accountDriveDiscs.where('accountId').equals(account.id).count(),
              database.accountRosters.get(account.id),
              database.accountDiscEvaluations.where('accountId').equals(account.id).count(),
              database.accountScanImportBatches.where('accountId').equals(account.id).count(),
              database.accountScanImportBatches
                .where('accountId')
                .equals(account.id)
                .sortBy('updatedAt'),
              database.accountScanImportItems.where('accountId').equals(account.id).count(),
              database.accountOptimizationResults.where('accountId').equals(account.id).count(),
              database.accountPreferences.where('accountId').equals(account.id).count(),
            ])
            return {
              discs,
              agents: rosterRecord?.roster.agents.filter((agent) => agent.owned).length ?? 0,
              wEngines: rosterRecord?.roster.wEngines?.length ?? 0,
              evaluations,
              scanBatches,
              latestScanAt: latestScanBatches.at(-1)?.updatedAt ?? null,
              scanItems,
              optimizationResults,
              preferences,
            }
          })()),
        })),
      )
      const duplicateTotals = rawAccountSummaries.reduce<Record<string, number>>(
        (totals, account) => {
          totals[account.displayName] = (totals[account.displayName] ?? 0) + 1
          return totals
        },
        {},
      )
      const duplicateSeen: Record<string, number> = {}
      const accountSummaries = rawAccountSummaries.map((account) => {
        const duplicateOrdinal = (duplicateSeen[account.displayName] ?? 0) + 1
        duplicateSeen[account.displayName] = duplicateOrdinal
        return {
          ...account,
          duplicateOrdinal,
          duplicateTotal: duplicateTotals[account.displayName],
        }
      })
      if (!active)
        return {
          active: null,
          accounts: accountSummaries,
          agents: 0,
          wEngines: 0,
          discs: 0,
          lastBackup: null,
        }
      const [rosterRecord, discs, backupPreference] = await Promise.all([
        database.accountRosters.get(active.id),
        database.accountDriveDiscs.where('accountId').equals(active.id).count(),
        database.accountPreferences.get(`${active.id}:${lastFullBackupPreference}`),
      ])
      return {
        active,
        accounts: accountSummaries,
        agents: rosterRecord?.roster.agents.filter((agent) => agent.owned).length ?? 0,
        wEngines: rosterRecord?.roster.wEngines?.length ?? 0,
        discs,
        lastBackup: typeof backupPreference?.value === 'string' ? backupPreference.value : null,
      }
    }, [revision]) ?? null
  )
}
