import type { AccountPlanningDraft } from '../accounts/types'
import type { CoreWarehouse } from '../accounts/coreFlow'
import { resolvePlanningDiscReferences } from '../accounts/planningDiscReferences'
import { getCandidateWarehouseConstraint } from '../gameDataPacks/candidateWarehouseConstraints'
import { resolveCurrentReleasedIdentity } from '../gameDataPacks/currentReleasedIdentityMap'
import { candidateTransitionProfile } from '../optimizer/candidateTransitionWarehouse'
import { optimizeAccountBuilds } from '../optimizer/optimizeAccountBuilds'
import {
  configuredMainStats,
  createAccountOptimizerKnowledge,
} from '../optimizer/accountBuildCandidates'
import { isAllowedMainStat } from '../optimizer/buildKnowledge'
import { savedDiscAgentIds } from '../warehouse/discWarehousePlanAssignments'
import { deriveSubStatHistory } from '../evaluation/subStatHistory'
import { hasConsistentDevelopmentStats } from '../warehouse/discEnhancementScoring'

export type WarehouseDiscTransitionUse = {
  agentId: string
  discIds: string[]
  referenceDiscIds: string[]
  /** Comparison within this same transition profile, not a damage estimate. */
  fixedScore: number | null
  referenceScore: number | null
  scoreDifference: number | null
  usage: Array<{ discId: string; otherAgentIds: string[]; unassignedPlanReference: boolean }>
}
export type WarehouseDiscTransitionInput = {
  warehouse: CoreWarehouse
  drafts: AccountPlanningDraft[]
}

export function compareWarehouseDiscTransitionUses(
  left: Pick<WarehouseDiscTransitionUse, 'agentId' | 'scoreDifference'>,
  right: Pick<WarehouseDiscTransitionUse, 'agentId' | 'scoreDifference'>,
) {
  const group = (difference: number | null) => (difference === null ? 2 : difference >= 0 ? 0 : 1)
  // Differences use each agent's own weights; magnitudes are not cross-agent priorities.
  return (
    group(left.scoreDifference) - group(right.scoreDifference) ||
    left.agentId.localeCompare(right.agentId)
  )
}

/** Each call checks one owned agent; the async application query yields between calls. */
export function findWarehouseDiscTransitionUse(
  input: WarehouseDiscTransitionInput,
  discId: string,
  agentId: string,
): WarehouseDiscTransitionUse | null {
  const { warehouse, drafts } = input
  if (!warehouse.roster.agents.some((agent) => agent.owned && agent.agentId === agentId))
    return null
  const constraint = getCandidateWarehouseConstraint(agentId)
  const target = warehouse.discs.find((disc) => disc.id === discId)
  if (!target || !constraint || constraint.status !== 'candidate') return null
  // Single-agent advisory matching can share physical discs with other plans.
  // Existing usage is returned explicitly, never treated as a hidden reservation.
  const discs = warehouse.discs
  if (new Set(discs.map((disc) => disc.id)).size !== discs.length) return null
  const profile = candidateTransitionProfile(agentId, constraint, discs)
  if (!profile || (profile.mainStatFit[String(target.slot)]?.[target.mainStat] ?? 0) <= 0)
    return null
  // Use the same strict fixed-disc domain as generateCandidates/optimizeBuild.
  // One owned agent's inapplicable set must not abort the entire advisory query.
  const knowledge = createAccountOptimizerKnowledge(profile, configuredMainStats(profile))
  if (
    !isAllowedMainStat(knowledge, target.slot, target.mainStat) ||
    !knowledge.setPlans.some((plan) =>
      [...plan.primarySets, ...plan.secondarySets].includes(target.setId),
    )
  )
    return null
  const options = { priorityAgentIds: [] as string[] }
  const fixed = optimizeAccountBuilds(discs, [profile], {
    ...options,
    fixedDiscByAgent: { [agentId]: discId },
  }).independent[0]
  if (!fixed) return null
  const assigned = fixed.discs.map((choice) => choice.disc)
  if (
    assigned.length !== 6 ||
    new Set(assigned.map((disc) => disc.id)).size !== 6 ||
    new Set(assigned.map((disc) => disc.slot)).size !== 6 ||
    !assigned.some((disc) => disc.id === discId)
  )
    return null
  const counts = Object.values(fixed.setCounts).sort()
  if (counts.length !== 2 || counts[0] !== 2 || counts[1] !== 4) return null
  const reference = optimizeAccountBuilds(discs, [profile], options).independent[0]
  const comparable =
    reference &&
    [...assigned, ...reference.discs.map((choice) => choice.disc)].every(
      (disc) =>
        deriveSubStatHistory(disc).status === 'known' && hasConsistentDevelopmentStats(disc),
    ) &&
    Number.isFinite(fixed.totalScore) &&
    Number.isFinite(reference.totalScore)
  return {
    agentId,
    discIds: assigned.sort((a, b) => a.slot - b.slot).map((disc) => disc.id),
    referenceDiscIds: reference?.discs.map((choice) => choice.disc.id) ?? [],
    fixedScore: comparable ? fixed.totalScore : null,
    referenceScore: comparable ? reference.totalScore : null,
    scoreDifference: comparable
      ? Math.round((fixed.totalScore - reference.totalScore) * 100) / 100
      : null,
    usage: assigned.map((disc) => {
      const plans = drafts.filter((draft) =>
        resolvePlanningDiscReferences(draft).referenceIds.includes(disc.id),
      )
      const users = [
        ...warehouse.roster.agents
          .filter((agent) => agent.owned && (agent.equippedDiscIds ?? []).includes(disc.id))
          .map((agent) => agent.agentId),
        ...plans.flatMap((draft) => savedDiscAgentIds(draft, disc.id)),
      ]
      return {
        discId: disc.id,
        otherAgentIds: [...new Set(users.map(resolveCurrentReleasedIdentity))].filter(
          (id) => id !== resolveCurrentReleasedIdentity(agentId),
        ),
        unassignedPlanReference: plans.some((draft) => !savedDiscAgentIds(draft, disc.id).length),
      }
    }),
  }
}
