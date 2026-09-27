import { database, type SodaDatabase } from '../db/databaseCore'
import { getScopedId, type AccountPlanningDraft } from './types'

export type PlanningDraftInput = Omit<
  AccountPlanningDraft,
  'scopedId' | 'accountId' | 'id' | 'createdAt' | 'updatedAt' | 'revision' | 'state'
> & { id?: string; name: string }

export type CurrentAgentBuildInput = Omit<PlanningDraftInput, 'id' | 'kind' | 'savedRole'> & {
  solutionContext: NonNullable<AccountPlanningDraft['solutionContext']> & {
    scope: 'agent_independent'
    resourcePolicy: 'advisory'
  }
}

async function assertCurrentAccount(accountId: string, db: SodaDatabase) {
  const active = await db.settings.get('active-account-id')
  if (active?.value !== accountId) throw new Error('当前账户已切换，方案没有保存。')
  const account = await db.accounts.get(accountId)
  if (!account || account.status !== 'active') throw new Error('当前账户不可用。')
}

function hasValidDeploymentOrder(
  execution: AccountPlanningDraft['teamExecutionSnapshot'] | undefined,
) {
  if (!execution?.deploymentOrder) return true
  const projectedMemberIds = execution.members.map((member) => member.agentId)
  const memberIds = execution.memberIds
  return (
    execution.deploymentOrder.length === 3 &&
    memberIds.length === 3 &&
    new Set(memberIds).size === 3 &&
    projectedMemberIds.length === 3 &&
    new Set(projectedMemberIds).size === 3 &&
    memberIds.every((agentId) => projectedMemberIds.includes(agentId)) &&
    new Set(execution.deploymentOrder).size === 3 &&
    execution.deploymentOrder.every(
      (agentId) => memberIds.includes(agentId) && projectedMemberIds.includes(agentId),
    )
  )
}

function assertDeploymentOrders(input: PlanningDraftInput) {
  const executions = [
    input.teamExecutionSnapshot,
    ...(input.teamPortfolioSnapshot?.executions ?? []),
  ]
  if (executions.some((execution) => !hasValidDeploymentOrder(execution)))
    throw new Error('队伍站位必须恰好包含执行快照中的三名不同代理人。')
}

export async function listAccountPlanningDrafts(accountId: string, db: SodaDatabase = database) {
  return db.accountPlanningDrafts.where('accountId').equals(accountId).sortBy('updatedAt')
}

export async function getAccountPlanningDraft(
  accountId: string,
  id: string,
  db: SodaDatabase = database,
) {
  return db.accountPlanningDrafts.get(getScopedId(accountId, id))
}

export async function saveAccountPlanningDraft(
  accountId: string,
  input: PlanningDraftInput,
  db: SodaDatabase = database,
  beforeSave?: (db: SodaDatabase) => Promise<void>,
) {
  return db.transaction(
    'rw',
    db.accountPlanningDrafts,
    db.accountDriveDiscs,
    db.accounts,
    db.settings,
    async () => {
      await assertCurrentAccount(accountId, db)
      await beforeSave?.(db)
      if (
        input.kind === 'team' &&
        new Set(input.selection.agentIds).size !== input.selection.agentIds.length
      ) {
        throw new Error('队伍成员不能重复，请调整后再保存。')
      }
      assertDeploymentOrders(input)
      const now = new Date().toISOString()
      const id = input.id ?? `plan-${crypto.randomUUID()}`
      const existing = await db.accountPlanningDrafts.get(getScopedId(accountId, id))
      const next: AccountPlanningDraft = {
        ...input,
        id,
        scopedId: getScopedId(accountId, id),
        accountId,
        name: input.name.trim() || '未命名方案',
        state: 'saved',
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        revision: (existing?.revision ?? 0) + 1,
      }
      await db.accountPlanningDrafts.put(next)
      return next
    },
  )
}

/** Upserts the one restorable agent reference without creating an account-level resource lock. */
export async function saveCurrentAgentBuild(
  accountId: string,
  input: CurrentAgentBuildInput,
  db: SodaDatabase = database,
) {
  return db.transaction('rw', db.accountPlanningDrafts, db.accounts, db.settings, async () => {
    await assertCurrentAccount(accountId, db)
    if (input.selection.agentIds.length !== 1)
      throw new Error('单人养成方案必须且只能包含一名代理人。')
    const agentId = input.selection.agentIds[0]
    const agentPlans = await db.accountPlanningDrafts
      .where('[accountId+kind]')
      .equals([accountId, 'agent'])
      .filter(
        (plan) => plan.selection.agentIds.length === 1 && plan.selection.agentIds[0] === agentId,
      )
      .toArray()
    const existing = agentPlans
      .filter((plan) => plan.savedRole === 'current_reference')
      .toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]
    const now = new Date().toISOString()
    const id = existing?.id ?? `agent-build-${agentId}`
    const next: AccountPlanningDraft = {
      ...input,
      id,
      kind: 'agent',
      savedRole: 'current_reference',
      scopedId: getScopedId(accountId, id),
      accountId,
      name: input.name.trim() || '养成方案',
      state: 'saved',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      revision: (existing?.revision ?? 0) + 1,
    }
    await db.accountPlanningDrafts.bulkPut([
      ...agentPlans
        .filter((plan) => plan.id !== id && plan.savedRole === 'current_reference')
        .map((plan) => ({ ...plan, savedRole: 'history' as const })),
      next,
    ])
    return next
  })
}

export async function deleteAccountPlanningDraft(
  accountId: string,
  id: string,
  db: SodaDatabase = database,
) {
  return db.transaction(
    'rw',
    [db.accountPlanningDrafts, db.accounts, db.settings, db.accountPreferences],
    async () => {
      await assertCurrentAccount(accountId, db)
      await db.accountPlanningDrafts.delete(getScopedId(accountId, id))
      const key = getScopedId(accountId, 'development.active-agent-plan-ids')
      const preference = await db.accountPreferences.get(key)
      if (
        preference?.value &&
        typeof preference.value === 'object' &&
        !Array.isArray(preference.value)
      ) {
        const entries = Object.entries(preference.value)
        const remaining = entries.filter(([, planId]) => planId !== id)
        if (remaining.length !== entries.length)
          await db.accountPreferences.put({
            ...preference,
            value: Object.fromEntries(remaining),
            updatedAt: new Date().toISOString(),
          })
      }
    },
  )
}
