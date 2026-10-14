import type { calculateCurrentPlanningEventDamage32 } from './currentPlanningEventDamage32'
import type { PlanningEventUsage } from './planningCalculationContextCompiler'
import type { PotentialApplicationEvent } from './potentialApplicationBinding'
import {
  matchesEventScope,
  type SourceBackedPlanningEffectBucket,
} from './currentPlanningDamageModifiers'
import { resolveReviewedHarumasaGleamingEdgeWindow32 } from './reviewedPotentialSourceClosure32'
import { evaluateCurrentPlanningEffectEntries32 } from './currentPlanningEffectRuntime'
import { getCurrentAgentPlanningEffectBlueprint } from './currentAgentPlanningEffectBlueprint'
import { planningRuntimeEffectBuckets32 } from './currentPlanningSelfEffects32'
import { stableContentHash } from '../gameDataPacks/types'

/** Rebind the existing scalar core buckets only under the exact event's timed proof. */
export function bindCurrentPlanningHarumasaWindow32(
  input: Parameters<typeof calculateCurrentPlanningEventDamage32>[0],
  usage: PlanningEventUsage,
  observed: PotentialApplicationEvent | undefined,
  scopedEvent: Parameters<typeof matchesEventScope>[1],
  eventAttribute: Parameters<typeof matchesEventScope>[2],
  eventInputBuckets: SourceBackedPlanningEffectBucket[],
) {
  let baselineReferencesByAgentId = input.eventEffectContext?.baselineReferencesByAgentId
  if (input.member.agentId === 'agent-harumasa' && observed?.temporalProof) {
    const actorReferences = { ...baselineReferencesByAgentId?.[input.member.agentId] }
    const stacks = actorReferences.gleaming_edge
    const window =
      observed.eventId === usage.eventId
        ? resolveReviewedHarumasaGleamingEdgeWindow32({
            potential: input.member.potential,
            ...observed.temporalProof,
          })
        : { status: 'unknown' as const, active: null, reason: 'timer_event_identity_mismatch' }
    if (
      window.status === 'known' &&
      typeof stacks === 'number' &&
      Number.isInteger(stacks) &&
      stacks >= 0 &&
      stacks <= 6
    ) {
      if (!window.active) actorReferences.gleaming_edge = 0
    } else {
      delete actorReferences.gleaming_edge
      input.diagnosticBlockers?.push(
        `${usage.eventId}:gleaming_edge:${window.status === 'unknown' ? window.reason : 'invalid_explicit_stack_observation'}`,
      )
    }
    baselineReferencesByAgentId = {
      ...baselineReferencesByAgentId,
      [input.member.agentId]: actorReferences,
    }
    // These existing scalar core effects have no final-stat dependency, so
    // the event dependency graph otherwise carries their prepared buckets.
    // Re-evaluate only these two source effects under the timed observation.
    // The timer does not create a second bonus or mutate formation state.
    if (input.eventEffectContext) {
      const coreKeys = new Set([
        'agent-harumasa:core_dash_crit_dmg_',
        'agent-harumasa:core_ult_crit_dmg_',
      ])
      const coreEntries = input.eventEffectContext.entries
        .filter((entry) => coreKeys.has(entry.effectKey))
        .map((entry) => getCurrentAgentPlanningEffectBlueprint(entry.effectKey)!)
      const core = evaluateCurrentPlanningEffectEntries32(
        {
          memberIds: input.eventEffectContext.memberIds,
          members: input.eventEffectContext.members,
          baselineReferencesByAgentId,
        },
        coreEntries,
      )
      if (core.status === 'unsupported') {
        input.diagnosticBlockers?.push(...core.blockers)
        return { status: 'unsupported' as const }
      }
      const timingRef = `source-window:${stableContentHash({ agentId: input.member.agentId, potential: input.member.potential, eventId: usage.eventId, proof: observed.temporalProof, stacks })}`
      const timedBuckets = planningRuntimeEffectBuckets32(
        core.results,
        input.eventEffectContext.memberIds,
      ).map((bucket) => ({
        ...bucket,
        sourceRefs: [
          ...bucket.sourceRefs,
          timingRef,
          ...('sourceRefs' in window ? (window.sourceRefs ?? []) : []),
        ],
      }))
      eventInputBuckets = [
        ...eventInputBuckets.filter(
          (bucket) =>
            !(bucket.providerAgentId === input.member.agentId && coreKeys.has(bucket.effectKey)),
        ),
        ...timedBuckets,
      ]
      for (const effect of core.results) {
        if (
          effect.status !== 'excluded_unknown' ||
          !matchesEventScope(
            {
              applicationScope: coreEntries.find((entry) => entry.effectKey === effect.effectKey)
                ?.applicationScope,
              effectId: effect.effectId,
              damageType: effect.damageType,
              action: null,
              attribute: null,
            },
            scopedEvent,
            eventAttribute,
          )
        )
          continue
        input.eventEffectContext.exclusions.push({
          effectKey: effect.effectKey,
          reason: '锋芒计时或层数缺少合法来源观测；本次事件未计入核心暴伤。',
          fields: ['gleaming_edge'],
          sourceRefs: [...effect.sourceRefs, timingRef],
        })
      }
    }
  }

  return { status: 'supported' as const, eventInputBuckets, baselineReferencesByAgentId }
}
