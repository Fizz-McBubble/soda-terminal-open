import { database, type SodaDatabase } from '../db/databaseCore'
import { getAccountRoster, getActiveAccount } from '../accounts/repository'
import {
  getDevelopmentPriorityAgentIds,
  getSavedAgentBuildIds,
} from '../accounts/developmentPlanning'
import { listAccountPlanningDrafts } from '../accounts/planningDraftReads'
import { resolvePlanningDiscReferences } from '../accounts/planningDiscReferences'
import {
  comparePersonalCurrentReferences,
  isPersonalCurrentReference,
  isPersonalSavedAgentPlan,
} from '../accounts/personalCurrentReference'
import { getScopedId, type AccountPlanningDraft } from '../accounts/types'
import type { CoreWarehouse } from '../accounts/coreWarehouse'

/** Scoped display facts only. This partial warehouse must never be used for warehouse search. */
export type DevelopmentWorkbenchFactsInput = {
  warehouse: CoreWarehouse
  drafts: AccountPlanningDraft[]
  activePlanIds: Record<string, string | null | undefined>
  developmentPriorityAgentIds: string[]
}

function selectedPlan(input: {
  drafts: AccountPlanningDraft[]
  agentId: string
  requestedPlanId: string | null
  activePlanId: string | null | undefined
  preferEquipped: boolean
}) {
  if (input.preferEquipped) return undefined
  const selectedId = input.requestedPlanId || input.activePlanId
  if (selectedId)
    return input.drafts.find(
      (plan) => plan.id === selectedId && isPersonalSavedAgentPlan(plan, input.agentId),
    )
  return input.drafts
    .filter((plan) => isPersonalCurrentReference(plan, input.agentId))
    .toSorted(comparePersonalCurrentReferences)[0]
}

/**
 * Read one active account's workbench inputs under one read snapshot. Missing disc IDs are
 * intentionally not synthesized: the existing route resolver reports missing references.
 * Callers must discard this result if their account/route selection changes.
 */
export async function loadDevelopmentWorkbenchFactsInput(
  input: {
    accountId: string
    agentId: string
    requestedPlanId: string | null
    preferEquipped?: boolean
  },
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
      if (!account || account.id !== input.accountId || account.status !== 'active')
        throw new Error('当前账户已切换或不可用，请重新读取养成资料。')
      const [roster, drafts, activePlanIds, developmentPriorityAgentIds] = await Promise.all([
        getAccountRoster(input.accountId, db),
        listAccountPlanningDrafts(input.accountId, db),
        getSavedAgentBuildIds(input.accountId, db),
        getDevelopmentPriorityAgentIds(input.accountId, db),
      ])
      const agent = roster.agents.find((entry) => entry.agentId === input.agentId)
      const plan = selectedPlan({
        drafts,
        agentId: input.agentId,
        requestedPlanId: input.requestedPlanId,
        activePlanId: activePlanIds[input.agentId],
        preferEquipped: input.preferEquipped === true,
      })
      const ids = [
        ...new Set([
          ...(agent?.equippedDiscIds ?? []),
          ...(plan ? resolvePlanningDiscReferences(plan).referenceIds : []),
        ]),
      ]
      const records = await db.accountDriveDiscs.bulkGet(
        ids.map((id) => getScopedId(input.accountId, id)),
      )
      const discs = records.flatMap((disc, index) =>
        disc && disc.accountId === input.accountId && disc.id === ids[index] ? [disc] : [],
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
