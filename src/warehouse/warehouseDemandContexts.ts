import type { AccountRoster } from '../assault/types'
import type { AccountPlanningDraft } from '../accounts/types'
import { resolvePlanningDiscReferences } from '../accounts/planningDiscReferences'
import type { DriveDisc } from '../domain/schemas'
import {
  candidateSetPlansForConstraint,
  deriveCandidateSetPlanReadiness,
  getCandidateWarehouseConstraint,
  getCandidateWarehouseConstraintForTeam,
  type CandidateWarehouseConstraint,
} from '../gameDataPacks/candidateWarehouseConstraints'
import {
  evaluateCandidateSetPlanEligibility,
  type CandidateSetPlanEligibilityContext,
} from '../gameDataPacks/candidateSetPlanEligibility'
import {
  candidateSetPlanIdentity,
  candidateSetPlanPriority,
} from '../gameDataPacks/candidateSetPlanPolicy'
import type { CandidateSetPlan } from '../gameDataPacks/candidateSetPlans'
import {
  resolveReviewedTeamDiscDirections,
  reviewedTeamDiscDirections,
  reviewedTeamPotentialByAgentId,
} from '../gameDataPacks/reviewedTeamDiscConditions'
import { resolveCurrentReleasedIdentity } from '../gameDataPacks/currentReleasedIdentityMap'
import { stableContentHash } from '../gameDataPacks/types'

export type WarehouseDemandContext = {
  id: string
  groupId: string
  agentId: string
  demand: 'active' | 'reserve'
  constraint: CandidateWarehouseConstraint
  setPlan: CandidateSetPlan
  eligibility: 'eligible' | 'unknown'
  memberIds?: string[]
}

type Input = {
  roster: AccountRoster
  discs: DriveDisc[]
  drafts: AccountPlanningDraft[]
  priorityAgentIds?: readonly string[]
  activePlanIds?: Readonly<Record<string, string | null | undefined>>
  selectedTeamAgentIds?: readonly (readonly string[])[]
}
type DemandSource = {
  id: string
  agentIds: string[]
  memberIds?: string[]
  selectedLoadouts?: CandidateSetPlanEligibilityContext['selectedLoadouts']
}
const identities = (ids: readonly string[]) => ids.map(resolveCurrentReleasedIdentity)
const completeTrio = (ids: readonly string[]) => ids.length === 3 && new Set(ids).size === 3

/** One source branch per context. No roster equipment is evidence for a new solve. */
export function resolveWarehouseDemandContexts(input: Input) {
  const owned = new Map(
    input.roster.agents
      .filter((agent) => agent.owned)
      .map((agent) => [resolveCurrentReleasedIdentity(agent.agentId), agent]),
  )
  const unresolved = new Set<string>()
  let coverageComplete = true
  const sources: DemandSource[] = []
  const explicit = [...new Set(identities(input.priorityAgentIds ?? []))]
  for (const id of explicit) {
    if (owned.has(id)) sources.push({ id: `priority:${id}`, agentIds: [id] })
    else unresolved.add(id)
  }
  for (const rawMembers of input.selectedTeamAgentIds ?? []) {
    const memberIds = identities(rawMembers).sort()
    if (!completeTrio(memberIds) || memberIds.some((id) => !owned.has(id))) {
      memberIds.forEach((id) => unresolved.add(id))
      continue
    }
    sources.push({ id: `selected:${memberIds.join(',')}`, agentIds: memberIds, memberIds })
  }
  const discGroups = new Map<string, DriveDisc[]>()
  for (const disc of input.discs)
    discGroups.set(disc.id, [...(discGroups.get(disc.id) ?? []), disc])
  for (const draft of input.drafts) {
    if (draft.state !== 'saved') continue
    const members = identities(draft.selection.agentIds)
    const currentAgent =
      draft.kind === 'agent' &&
      draft.savedRole === 'current_reference' &&
      members.length === 1 &&
      input.activePlanIds?.[members[0]!] === draft.id
    if (draft.kind !== 'team' && !currentAgent) continue
    const resolved = savedSource(draft, discGroups, owned)
    if (!resolved) {
      members.forEach((id) => unresolved.add(id))
      // Saving a complete owned trio proves intent even when its old entity
      // references no longer prove the teammate's current four-piece set.
      const trios = draft.teamPortfolioSnapshot?.executions.map((team) =>
        identities(team.memberIds),
      ) ?? [members]
      if (
        draft.kind === 'team' &&
        trios.every((trio) => completeTrio(trio) && trio.every((id) => owned.has(id))) &&
        new Set(trios.flat()).size === members.length &&
        trios.flat().every((id) => members.includes(id))
      ) {
        sources.push(
          ...trios.map((trio) => ({
            id: `saved:${draft.id}:${[...trio].sort().join(',')}`,
            agentIds: trio,
            memberIds: [...trio].sort(),
          })),
        )
      }
      continue
    }
    sources.push(...resolved)
  }
  const activeAgentIds = [...new Set(sources.flatMap((source) => source.agentIds))].sort()
  for (const id of owned.keys()) {
    if (!activeAgentIds.includes(id)) sources.push({ id: `reserve:${id}`, agentIds: [id] })
  }
  const contexts: WarehouseDemandContext[] = []
  const agentStateById = Object.fromEntries(
    [...owned].map(([id, agent]) => [id, { potentialImage: agent.potentialImage }]),
  )
  for (const source of sources) {
    for (const agentId of source.agentIds) {
      const base = getCandidateWarehouseConstraint(agentId)
      if (!base || base.status !== 'candidate') {
        unresolved.add(agentId)
        coverageComplete = false
        continue
      }
      const teamContext = { memberIds: source.memberIds, agentStateById }
      const directions = resolveReviewedTeamDiscDirections(agentId, teamContext)
      // Never use a merged team constraint for retained base branches: its overrides
      // belong only to the reviewed branch, not every plan sharing this agent.
      const branches: Array<{
        constraint: CandidateWarehouseConstraint
        plan: CandidateSetPlan
        key: string
        unknown?: boolean
      }> = []
      if (!directions.length || directions.every((direction) => direction.retainBasePlans)) {
        branches.push(
          ...candidateSetPlansForConstraint(base).map((plan) => ({
            constraint: base,
            plan,
            key: 'base',
          })),
        )
      }
      if (directions.length === 1) {
        const constraint = getCandidateWarehouseConstraintForTeam(agentId, teamContext)!
        branches.push({ constraint, plan: directions[0]!.setPlan, key: directions[0]!.id })
      } else if (directions.length > 1) {
        unresolved.add(agentId)
      }
      if (!source.memberIds) {
        for (const direction of reviewedTeamDiscDirections.filter(
          (row) => row.agentId === agentId,
        )) {
          const potential = reviewedTeamPotentialByAgentId({
            memberIds: Object.keys(direction.potentialMinimumByAgentId),
            agentStateById,
          })
          if (
            Object.entries(direction.potentialMinimumByAgentId).some(
              ([id, minimum]) => owned.has(id) && potential[id]! < minimum,
            )
          )
            continue
          branches.push({
            constraint: {
              ...base,
              mainStats: { ...base.mainStats, ...direction.mainStats },
              subStatWeights: direction.subStatWeights ?? base.subStatWeights,
              sources: [...base.sources, ...(direction.additionalSources ?? [])],
              teamAndBangbooPreconditions: [
                ...base.teamAndBangbooPreconditions,
                `条件待核对：${direction.id}；${direction.source.locator.text}`,
              ],
              boundary: `${base.boundary} ${direction.boundary}`,
            },
            plan: direction.setPlan,
            key: direction.id,
            unknown: true,
          })
        }
      }
      if (!branches.length) {
        unresolved.add(agentId)
        coverageComplete = false
      }
      for (const branch of branches) {
        const plan = branch.plan
        const eligibility = evaluateCandidateSetPlanEligibility(agentId, plan, {
          memberIds: source.memberIds,
          selectedLoadouts: source.selectedLoadouts,
        })
        if (eligibility.status === 'condition-not-met') continue
        const unknown = branch.unknown || eligibility.status === 'condition-unknown'
        if (unknown) unresolved.add(agentId)
        const constraintInput = {
          ...branch.constraint,
          setPlans: [plan],
          setPlanReadiness: deriveCandidateSetPlanReadiness([plan]),
          setIds: [...new Set([...plan.primarySetIds, ...plan.secondarySetIds])],
        }
        const constraint = { ...constraintInput, contentHash: stableContentHash(constraintInput) }
        contexts.push({
          id: `${source.id}:${agentId}:${branch.key}:${candidateSetPlanIdentity(plan)}`,
          groupId: `${source.id}:${agentId}`,
          agentId,
          demand: source.id.startsWith('reserve:') ? 'reserve' : 'active',
          constraint,
          setPlan: plan,
          eligibility: unknown ? 'unknown' : 'eligible',
          ...(source.memberIds ? { memberIds: [...source.memberIds] } : {}),
        })
      }
    }
  }
  const unique = [...new Map(contexts.map((context) => [context.id, context])).values()]
  const ordered = unique.sort(
    (a, b) =>
      candidateSetPlanPriority(a.setPlan) - candidateSetPlanPriority(b.setPlan) ||
      a.id.localeCompare(b.id),
  )
  const result = {
    contexts: ordered,
    activeAgentIds,
    unresolvedAgentIds: [...unresolved].sort(),
    coverageComplete,
  }
  return {
    ...result,
    contentHash: stableContentHash({
      ...result,
      roster: [...owned].sort(([a], [b]) => a.localeCompare(b)),
      activePlanIds: input.activePlanIds ?? {},
      savedInputs: input.drafts
        .filter((draft) => draft.state === 'saved')
        .map((draft) => ({
          id: draft.id,
          kind: draft.kind,
          savedRole: draft.savedRole,
          selection: draft.selection,
          manualOverrides: draft.manualOverrides,
          solutionContext: draft.solutionContext,
          teamEquipmentParameters: draft.teamEquipmentParameters,
          warehouseRefs: draft.warehouseRefs,
        }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    }),
  }
}

/** A saved label alone is not a saved physical team. Require six unique slots per
 * member and agreement of every recorded assignment source, with no backfill. */
function savedSource(
  draft: AccountPlanningDraft,
  discs: Map<string, DriveDisc[]>,
  owned: Map<string, unknown>,
): DemandSource[] | null {
  const refs = resolvePlanningDiscReferences(draft)
  if (
    !refs.consistent ||
    !refs.referenceIds.length ||
    refs.referenceIds.some((id) => discs.get(id)?.length !== 1)
  )
    return null
  const executions =
    draft.teamPortfolioSnapshot?.executions ??
    (draft.teamExecutionSnapshot ? [draft.teamExecutionSnapshot] : [])
  const loadouts =
    draft.candidateWarehouse?.loadouts ??
    executions.flatMap((team) =>
      team.members.map((member) => ({
        agentId: member.agentId,
        discIds: member.suggested.discIds,
      })),
    )
  const memberIds = identities(draft.selection.agentIds)
  if (
    !loadouts.length ||
    new Set(memberIds).size !== memberIds.length ||
    memberIds.some((id) => !owned.has(id))
  )
    return null
  if (
    loadouts.length !== memberIds.length ||
    new Set(identities(loadouts.map((row) => row.agentId))).size !== memberIds.length
  )
    return null
  const counts: Record<string, Record<string, number>> = {}
  if (
    executions.some((team) => {
      const declared = identities(team.memberIds)
      const assigned = identities(team.members.map((member) => member.agentId))
      return (
        !completeTrio(declared) ||
        !completeTrio(assigned) ||
        assigned.some((id) => !declared.includes(id))
      )
    })
  )
    return null
  for (const loadout of loadouts) {
    const agentId = resolveCurrentReleasedIdentity(loadout.agentId)
    if (!memberIds.includes(agentId) || loadout.discIds.length !== 6) return null
    const selected = loadout.discIds.map((id) => discs.get(id)?.[0])
    if (selected.some((disc) => !disc) || new Set(selected.map((disc) => disc!.slot)).size !== 6)
      return null
    counts[agentId] = {}
    for (const disc of selected)
      counts[agentId]![disc!.setId] = (counts[agentId]![disc!.setId] ?? 0) + 1
    for (const team of executions) {
      const member = team.members.find(
        (row) => resolveCurrentReleasedIdentity(row.agentId) === agentId,
      )
      if (
        member &&
        (member.suggested.discIds.length !== 6 ||
          member.suggested.discIds.some((id) => !loadout.discIds.includes(id)))
      )
        return null
    }
  }
  const assigned = loadouts.flatMap((row) => row.discIds)
  if (
    new Set(assigned).size !== assigned.length ||
    assigned.length !== refs.referenceIds.length ||
    assigned.some((id) => !refs.referenceIds.includes(id))
  )
    return null
  const trios = executions.length
    ? executions.map((team) => identities(team.memberIds))
    : [memberIds]
  if (
    draft.kind === 'team' &&
    (trios.some((trio) => !completeTrio(trio)) ||
      trios.flat().length !== memberIds.length ||
      new Set(trios.flat()).size !== memberIds.length ||
      trios.flat().some((id) => !memberIds.includes(id)))
  )
    return null
  return trios.map((trio) => ({
    id: `saved:${draft.id}:${[...trio].sort().join(',')}`,
    agentIds: trio,
    ...(completeTrio(trio)
      ? {
          memberIds: [...trio].sort(),
          selectedLoadouts: { basis: 'confirmed-assumption' as const, setCountsByAgentId: counts },
        }
      : {}),
  }))
}
