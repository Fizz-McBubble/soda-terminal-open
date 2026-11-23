import { database, type SodaDatabase } from '../db/databaseCore'
import { getAccountRoster, getActiveAccount } from '../accounts/repository'
import {
  getDevelopmentPriorityAgentIds,
  getSavedAgentBuildIds,
} from '../accounts/developmentPlanning'
import { listAccountPlanningDrafts } from '../accounts/planningDraftReads'
import { resolvePlanningDiscReferences } from '../accounts/planningDiscReferences'
import { getScopedId } from '../accounts/types'
import type { DevelopmentWorkbenchFactsInput } from './publicDevelopmentWorkbenchFacts'

/**
 * Current and saved directory facts, read in a single account snapshot. This warehouse
 * contains only referenced discs and must not be used as the full search inventory.
 * Missing or invalid references stay missing for existing consumers to report.
 */
export async function loadDevelopmentDirectoryFactsInput(
  accountId: string,
  db: SodaDatabase = database,
): Promise<DevelopmentWorkbenchFactsInput> {
  return db.transaction(
    'r',
    [
      db.settings,
      db.accounts,
      db.accountRosters,
      db.accountPreferences,
      db.accountPlanningDrafts,
      db.accountDriveDiscs,
    ],
    async () => {
      const account = await getActiveAccount(db)
      if (!account || account.id !== accountId || account.status !== 'active')
        throw new Error('当前账户已切换或不可用，请重新读取养成目录。')
      const [roster, drafts, activePlanIds, developmentPriorityAgentIds] = await Promise.all([
        getAccountRoster(accountId, db),
        listAccountPlanningDrafts(accountId, db),
        getSavedAgentBuildIds(accountId, db),
        getDevelopmentPriorityAgentIds(accountId, db),
      ])
      const ids = [
        ...new Set([
          ...roster.agents
            .filter((agent) => agent.owned)
            .flatMap((agent) => agent.equippedDiscIds ?? []),
          ...drafts
            .filter(
              (plan) =>
                plan.accountId === accountId &&
                plan.kind === 'agent' &&
                plan.state === 'saved' &&
                plan.selection.agentIds.length === 1,
            )
            .flatMap((plan) => resolvePlanningDiscReferences(plan).referenceIds),
        ]),
      ]
      const records = await db.accountDriveDiscs.bulkGet(
        ids.map((id) => getScopedId(accountId, id)),
      )
      const discs = records.flatMap((disc, index) =>
        disc && disc.accountId === accountId && disc.id === ids[index] ? [disc] : [],
      )
      return {
        warehouse: { account, accountId: account.id, roster, discs },
        drafts,
        activePlanIds,
        developmentPriorityAgentIds,
      }
    },
  )
}
