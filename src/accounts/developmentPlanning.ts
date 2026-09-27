import { database, type SodaDatabase } from '../db/databaseCore'
import { getAccountPreference, saveAccountPreference } from './repository'

const priorityKey = 'development.priority-agent-ids'
const activePlansKey = 'development.active-agent-plan-ids'

export async function getDevelopmentPriorityAgentIds(accountId: string, db?: SodaDatabase) {
  const value = await getAccountPreference(accountId, priorityKey, db)
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []
}

export async function saveDevelopmentPriorityAgentIds(
  accountId: string,
  agentIds: string[],
  db?: SodaDatabase,
) {
  const ordered = [...new Set(agentIds)]
  await saveAccountPreference(accountId, priorityKey, ordered, db)
  return ordered
}

export async function getActiveDevelopmentPlanIds(accountId: string, db?: SodaDatabase) {
  const value = await getAccountPreference(accountId, activePlansKey, db)
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {} as Record<string, string>
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  )
}

/** Current read model. v9 rows win; the legacy preference remains a rollback-only fallback. */
export async function getSavedAgentBuildIds(accountId: string, db?: SodaDatabase) {
  const storage = db ?? database
  const legacy = await getActiveDevelopmentPlanIds(accountId, storage)
  const current = await storage.accountPlanningDrafts
    .where('[accountId+kind]')
    .equals([accountId, 'agent'])
    .filter(
      (plan) =>
        plan.savedRole === 'current_reference' && plan.selection.agentIds.length === 1,
    )
    .toArray()
  return {
    ...legacy,
    ...Object.fromEntries(current.map((plan) => [plan.selection.agentIds[0], plan.id])),
  }
}

export async function getDevelopmentPlanIdForAgent(
  accountId: string,
  agentId: string,
  explicitPlanId: string | null,
  db?: SodaDatabase,
) {
  if (explicitPlanId) return explicitPlanId
  return (await getSavedAgentBuildIds(accountId, db))[agentId] ?? null
}

/** @deprecated v9 freezes new hidden activation writes; retained only to detect stale callers. */
export async function setActiveDevelopmentPlanId(
  _accountId: string,
  _agentId: string,
  _planId: string,
  _db?: SodaDatabase,
) {
  void _accountId
  void _agentId
  void _planId
  void _db
  throw new Error('旧活动方案写入已停用；请保存为养成方案。')
}
