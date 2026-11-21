import { savedPlanStaleNotice } from '../application/publicSavedPlanStaleNotice'
import { database, type SodaDatabase } from '../db/databaseCore'
import type {
  TeamExecution,
  TeamExecutionAction,
  TeamExecutionImpact,
  TeamExecutionMember,
} from '../decision/teamExecutionProjection'
import { teamDiscCompletion } from '../domain/teamDiscCompletion'
import { getAccountRoster } from './repository'
import { getScopedId, type AccountPlanningDraft, type AccountProfile } from './types'
import type { CoreWarehouse } from './coreWarehouse'
import { resolvePlanningDiscReferences } from './planningDiscReferences'

export type SavedTeamPanelWarehouseStatus = {
  missingDiscIds: string[]
  outOfScopeDiscIds: string[]
  hasInvalidSlots: boolean
  needsTeamRecovery: boolean
  staleNotice: string | undefined
}

/** Check only the saved panel's eighteen referenced discs against current warehouse facts. */
export function inspectSavedTeamPanelWarehouse(
  plan: AccountPlanningDraft,
  warehouse: Pick<CoreWarehouse, 'discs'>,
): SavedTeamPanelWarehouseStatus {
  const referenceIds = resolvePlanningDiscReferences(plan).referenceIds
  const discById = new Map(warehouse.discs.map((disc) => [disc.id, disc]))
  const missingDiscIds = referenceIds.filter((id) => !discById.has(id))
  const outOfScopeDiscIds = referenceIds.filter((id) => {
    const disc = discById.get(id)
    return disc !== undefined && disc.rarity !== 'S'
  })
  const execution = plan.teamExecutionSnapshot
  const completion = execution
    ? teamDiscCompletion(
        plan.selection.agentIds,
        execution.members.map((member) => ({
          agentId: member.agentId,
          discIds: member.suggested.discIds,
        })),
        warehouse.discs,
      )
    : null
  const hasInvalidSlots =
    missingDiscIds.length === 0 &&
    outOfScopeDiscIds.length === 0 &&
    completion !== null &&
    !completion.complete
  if (outOfScopeDiscIds.length > 0) {
    return {
      missingDiscIds,
      outOfScopeDiscIds,
      hasInvalidSlots,
      needsTeamRecovery: true,
      staleNotice: savedPlanStaleNotice({ stale: true, reason: 'disc-rarity-outside-scope' }),
    }
  }
  if (missingDiscIds.length > 0 || hasInvalidSlots) {
    return {
      missingDiscIds,
      outOfScopeDiscIds,
      hasInvalidSlots,
      needsTeamRecovery: true,
      staleNotice: savedPlanStaleNotice({ stale: true, reason: 'unmatched' }),
    }
  }
  return {
    missingDiscIds,
    outOfScopeDiscIds,
    hasInvalidSlots,
    needsTeamRecovery: false,
    staleNotice: undefined,
  }
}

/** Only an unambiguous saved allocation can supply a three-member panel on its own. */
export function hasSavedTeamPanel(plan: AccountPlanningDraft | undefined) {
  const execution = plan?.teamExecutionSnapshot
  if (
    !plan ||
    plan.kind !== 'team' ||
    plan.teamPortfolioSnapshot ||
    !execution ||
    plan.solutionContext?.declaredLuminizeSettlement32 ||
    execution.authorComparisonMembership
  )
    return false
  const agents = new Set(plan.selection.agentIds)
  const loadouts = plan.candidateWarehouse?.loadouts
  if (
    agents.size !== 3 ||
    plan.selection.agentIds.length !== 3 ||
    execution.memberIds.length !== 3 ||
    new Set(execution.memberIds).size !== 3 ||
    execution.memberIds.some((id) => !agents.has(id)) ||
    execution.members.length !== 3 ||
    new Set(execution.members.map((member) => member.agentId)).size !== 3 ||
    loadouts?.length !== 3
  )
    return false
  return (
    execution.members.every((member) => {
      const saved = loadouts.find((row) => row.agentId === member.agentId)
      return (
        agents.has(member.agentId) &&
        saved?.discIds.length === 6 &&
        member.suggested.discIds.length === 6 &&
        member.suggested.discIds.every((id) => saved.discIds.includes(id))
      )
    }) && resolvePlanningDiscReferences(plan).consistent
  )
}

/** Read the saved, originally worn and currently worn discs through account-scoped keys. */
export async function loadSavedTeamPanelWarehouse(
  account: AccountProfile,
  plan: AccountPlanningDraft,
  db: SodaDatabase = database,
): Promise<CoreWarehouse> {
  const roster = await getAccountRoster(account.id, db)
  const members = new Set(plan.selection.agentIds)
  const ids = new Set([
    ...resolvePlanningDiscReferences(plan).referenceIds,
    ...plan.teamExecutionSnapshot!.members.flatMap((member) => member.current.discIds),
    ...roster.agents
      .filter((agent) => members.has(agent.agentId))
      .flatMap((agent) => agent.equippedDiscIds ?? []),
  ])
  const discs = await db.accountDriveDiscs.bulkGet(
    [...ids].map((id) => getScopedId(account.id, id)),
  )
  return {
    account,
    accountId: account.id,
    roster,
    discs: discs.filter((disc) => disc !== undefined),
  }
}

/** Project a saved read-only execution against live roster equipment without mutating history. */
export function projectSavedSnapshotExecution(
  execution: TeamExecution,
  warehouse: Pick<CoreWarehouse, 'discs' | 'roster'>,
): TeamExecution {
  const completion = teamDiscCompletion(
    execution.memberIds,
    execution.members.map((member) => ({
      agentId: member.agentId,
      discIds: member.suggested.discIds,
    })),
    warehouse.discs,
  )
  const members: TeamExecutionMember[] = execution.members.map((member) => {
    const currentAgent = warehouse.roster.agents.find((agent) => agent.agentId === member.agentId)
    const liveCurrentDiscIds = [...(currentAgent?.equippedDiscIds ?? [])]
    const suggestedDiscIds = member.suggested.discIds
    const memberComplete =
      suggestedDiscIds.length === 6 && completion.counts.get(member.agentId) === 6
    const liveImpacts: TeamExecutionImpact[] = []
    for (const owner of warehouse.roster.agents) {
      if (owner.agentId === member.agentId) continue
      const borrowed = (owner.equippedDiscIds ?? []).filter((id) => suggestedDiscIds.includes(id))
      if (borrowed.length) {
        liveImpacts.push({
          kind: 'current_equipment',
          equipment: 'drive_disc',
          assetIds: borrowed,
          agentId: owner.agentId,
          planId: null,
          planName: null,
        })
      }
    }
    let actions: TeamExecutionAction[]
    let status: TeamExecutionMember['status']
    if (!memberComplete) {
      actions = [
        {
          kind: 'missing_equipment',
          agentId: member.agentId,
          equipment: 'drive_disc',
          reason: 'Account Decision 未闭合六张不同实体盘。',
        },
      ]
      status = 'missing_equipment'
    } else if (member.status === 'needs_confirmation') {
      actions = member.actions
      status = 'needs_confirmation'
    } else if (
      liveCurrentDiscIds.length === 6 &&
      new Set(liveCurrentDiscIds).size === 6 &&
      suggestedDiscIds.every((id) => liveCurrentDiscIds.includes(id))
    ) {
      actions = [{ kind: 'keep_current_build', agentId: member.agentId }]
      status = 'ready'
    } else {
      actions = [
        {
          kind: 'change_discs',
          agentId: member.agentId,
          removeDiscIds: liveCurrentDiscIds.filter((id) => !suggestedDiscIds.includes(id)),
          equipDiscIds: suggestedDiscIds.filter((id) => !liveCurrentDiscIds.includes(id)),
        },
      ]
      if (liveImpacts.length) {
        actions.push({
          kind: 'borrow_discs',
          agentId: member.agentId,
          discIds: [...new Set(liveImpacts.flatMap((impact) => impact.assetIds))],
          fromAgentIds: [
            ...new Set(liveImpacts.flatMap((impact) => (impact.agentId ? [impact.agentId] : []))),
          ],
        })
      }
      status = 'ready'
    }
    return {
      ...member,
      current: { ...member.current, discIds: liveCurrentDiscIds },
      actions,
      impacts: liveImpacts,
      status,
    }
  })
  const status: TeamExecution['status'] = members.some(
    (member) => member.status === 'missing_equipment',
  )
    ? 'missing_equipment'
    : members.some((member) => member.status === 'needs_confirmation')
      ? 'needs_confirmation'
      : 'ready'
  return { ...execution, members, status }
}
