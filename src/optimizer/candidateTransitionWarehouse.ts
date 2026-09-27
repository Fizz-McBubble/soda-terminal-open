import type { AgentDiscProfile } from '../assault/engine'
import type { DriveDisc } from '../domain/schemas'
import {
  candidateConstraintToDiscProfile,
  candidateSetPlansForConstraint,
  type CandidateWarehouseConstraint,
} from '../gameDataPacks/candidateWarehouseConstraints'
import { stableContentHash } from '../gameDataPacks/types'
import { getCurrentScopeEntry } from '../gameDataPacks/currentScopeManifest'

export const transitionWarehouseNote =
  '暂未凑齐推荐组合，保留推荐主套四件，用现有同套两件过渡；副套收益未计入匹配分，不代表毕业配装。'

/** Inventory feasibility only; never promote an unspecified source set into a four-piece. */
export function candidateTransitionProfile(
  agentId: string,
  constraint: CandidateWarehouseConstraint,
  discs: readonly DriveDisc[],
): AgentDiscProfile | null {
  const source = candidateConstraintToDiscProfile(constraint)
  if (!source) return null
  const primarySets = [
    ...new Set(
      candidateSetPlansForConstraint(constraint)
        .filter((plan) => plan.pattern === '4+2')
        .flatMap((plan) => plan.primarySetIds),
    ),
  ]
  if (!primarySets.length) return null
  const slotsBySet = new Map<string, Set<number>>()
  for (const disc of discs) {
    const identity = getCurrentScopeEntry(disc.setId)
    if (
      identity?.domain !== 'drive_disc_set' ||
      identity.releaseState !== 'released' ||
      !identity.accountOwnable
    )
      continue
    if ((source.mainStatFit[String(disc.slot)]?.[disc.mainStat] ?? 0) <= 0) continue
    const slots = slotsBySet.get(disc.setId) ?? new Set<number>()
    slots.add(disc.slot)
    slotsBySet.set(disc.setId, slots)
  }
  const secondarySets = [...slotsBySet]
    .filter(([setId, slots]) => !constraint.setIds.includes(setId) && slots.size >= 2)
    .map(([setId]) => setId)
    .sort()
  if (!secondarySets.length) return null
  const setPlans = [{ pattern: '4+2' as const, primarySets, secondarySets }]
  return {
    ...source,
    agentId,
    version: `transition-${stableContentHash({ source: source.version, setPlans }).slice(0, 12)}`,
    setPlans,
    // Unknown secondary sets intentionally remain absent from setFit (= zero).
    contextRationale: [...(source.contextRationale ?? []), transitionWarehouseNote],
  }
}
