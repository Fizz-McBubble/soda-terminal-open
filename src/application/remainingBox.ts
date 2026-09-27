import type { AccountDecisionQueryInput } from './calculationQueryContract'
import type { AccountPlanningDraft } from '../accounts/types'
import { contentHash } from './contentHash'
import { savedPlanDisplayName } from './savedPlanDisplayName'
import type { SodaDatabase } from '../db/database'
import { getScopedId } from '../accounts/types'

export function remainingBoxPlanReservation(
  plan: AccountPlanningDraft,
  input: AccountDecisionQueryInput,
) {
  const snapshot = plan.teamExecutionSnapshot
  const members = plan.selection.agentIds
  const discs = snapshot?.physicalDiscIds ?? []
  const available = new Map(input.warehouse.discs.map((disc) => [disc.id, disc]))
  const same = (a: readonly string[], b: readonly string[]) =>
    a.length === b.length && a.every((id) => b.includes(id))
  if (
    plan.accountId !== input.warehouse.accountId ||
    plan.kind !== 'team' ||
    plan.state !== 'saved' ||
    !snapshot ||
    new Set(members).size !== 3 ||
    members.length !== 3 ||
    !same(members, snapshot.memberIds) ||
    snapshot.members.length !== 3 ||
    new Set(snapshot.members.map((member) => member.agentId)).size !== 3 ||
    !same(
      members,
      snapshot.members.map((member) => member.agentId),
    ) ||
    discs.length !== 18 ||
    new Set(discs).size !== 18 ||
    !same(
      discs,
      snapshot.members.flatMap((member) => member.suggested.discIds),
    ) ||
    members.some(
      (id) => !input.warehouse.roster.agents.some((agent) => agent.agentId === id && agent.owned),
    ) ||
    discs.some((id) => !available.has(id)) ||
    snapshot.members.some((member) => {
      const ids = member.suggested.discIds
      const saved = plan.candidateWarehouse?.loadouts.find(
        (loadout) => loadout.agentId === member.agentId,
      )
      return (
        !members.includes(member.agentId) ||
        ids.length !== 6 ||
        new Set(ids.map((id) => available.get(id)?.slot)).size !== 6 ||
        !saved ||
        !same(ids, saved.discIds)
      )
    })
  )
    throw new Error(
      `“${savedPlanDisplayName(plan)}”的成员或 18 张驱动盘不完整，请先打开该方案核对。`,
    )
  return {
    planId: plan.id,
    name: savedPlanDisplayName(plan),
    memberIds: [...members],
    discIds: [...discs],
    fingerprint: contentHash(plan),
  }
}

export type RemainingBoxReservation = ReturnType<typeof remainingBoxPlanReservation>

/** A detached query input. Historical alternatives never reserve resources implicitly. */
export function prepareRemainingBox(input: AccountDecisionQueryInput, planIds: readonly string[]) {
  if (!planIds.length) throw new Error('先选择要保留配装的已保存队伍。')
  const reservations = [...new Set(planIds)].map((id) => {
    const plan = input.drafts.find((item) => item.id === id)
    if (!plan) throw new Error('所选方案已不存在，请重新选择。')
    return remainingBoxPlanReservation(plan, input)
  })
  const members = reservations.flatMap((item) => item.memberIds)
  const discs = reservations.flatMap((item) => item.discIds)
  if (new Set(members).size !== members.length || new Set(discs).size !== discs.length)
    throw new Error('所选队伍共用了成员或驱动盘，请只保留互不冲突的队伍。')
  const reservedMembers = new Set(members)
  const reservedDiscs = new Set(discs)
  const next = structuredClone(input)
  next.warehouse.discs = next.warehouse.discs.filter((disc) => !reservedDiscs.has(disc.id))
  next.warehouse.roster.agents = next.warehouse.roster.agents.filter(
    (agent) => !reservedMembers.has(agent.agentId),
  )
  next.drafts = next.drafts.filter(
    (plan) =>
      plan.kind === 'agent' && plan.selection.agentIds.every((id) => !reservedMembers.has(id)),
  )
  next.activePlanIds = Object.fromEntries(
    Object.entries(next.activePlanIds).filter(([id]) => !reservedMembers.has(id)),
  )
  next.developmentPriorityAgentIds = next.developmentPriorityAgentIds.filter(
    (id) => !reservedMembers.has(id),
  )
  next.preference = {
    ...next.preference,
    teamCount: 1,
    templateIds: [],
    fixedAgentIds: [],
    fixedBangbooIds: [],
    planIdsByAgent: {},
    favoriteAgentIds: next.preference.favoriteAgentIds.filter((id) => !reservedMembers.has(id)),
  }
  if (
    next.warehouse.roster.agents.filter((agent) => agent.owned).length < 3 ||
    next.warehouse.discs.length < 18
  )
    throw new Error('剩余成员不足 3 位或驱动盘不足 18 张，请减少保留的队伍。')
  return { input: next, reservations }
}

export function verifyRemainingBoxReservation(
  input: AccountDecisionQueryInput,
  reservations: readonly RemainingBoxReservation[],
) {
  const current = prepareRemainingBox(
    input,
    reservations.map((item) => item.planId),
  ).reservations
  if (current.some((item, index) => item.fingerprint !== reservations[index]?.fingerprint))
    throw new Error('保留的队伍已发生变化，请返回重新选择并分析。')
}

/** Runs inside the existing draft-save transaction; original teams are never written. */
export async function verifyRemainingBoxReservationInTransaction(
  db: SodaDatabase,
  accountId: string,
  reservations: readonly RemainingBoxReservation[],
) {
  for (const reservation of reservations) {
    const current = await db.accountPlanningDrafts.get(getScopedId(accountId, reservation.planId))
    if (!current || contentHash(current) !== reservation.fingerprint)
      throw new Error('保留的队伍已发生变化，请返回重新选择并分析。')
    const discs = await db.accountDriveDiscs.where('accountId').equals(accountId).toArray()
    if (reservation.discIds.some((id) => !discs.some((disc) => disc.id === id)))
      throw new Error('保留队伍的驱动盘已变化，请重新分析。')
  }
}
