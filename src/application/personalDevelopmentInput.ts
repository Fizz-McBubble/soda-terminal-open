import { database } from '../db/databaseCore'
import { getActiveAccount } from '../accounts/repository'
import { loadCoreWarehouseForAccount } from '../accounts/coreWarehouse'
import { listAccountPlanningDrafts } from '../accounts/planningDraftReads'
import {
  getDevelopmentPriorityAgentIds,
  getSavedAgentBuildIds,
} from '../accounts/developmentPlanning'
import { getTeamPortfolioPreference } from '../accounts/teamPortfolioPreference'
import type { AccountDecisionQueryInput } from './calculationQueryContract'

/** One read-only transaction captures the real account, full warehouse and planning inputs. */
export async function loadPersonalDevelopmentInput(): Promise<AccountDecisionQueryInput | null> {
  return database.transaction(
    'r',
    [
      database.settings,
      database.accounts,
      database.accountDriveDiscs,
      database.accountRosters,
      database.accountPlanningDrafts,
      database.accountPreferences,
    ],
    async () => {
      const account = await getActiveAccount(database)
      if (!account) return null
      const warehouse = await loadCoreWarehouseForAccount(account, database)
      const [drafts, activePlanIds, developmentPriorityAgentIds, preference] = await Promise.all([
        listAccountPlanningDrafts(account.id, database),
        getSavedAgentBuildIds(account.id, database),
        getDevelopmentPriorityAgentIds(account.id, database),
        getTeamPortfolioPreference(account.id, database),
      ])
      return { warehouse, drafts, activePlanIds, developmentPriorityAgentIds, preference }
    },
  )
}
