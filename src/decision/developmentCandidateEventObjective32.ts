import type { RosterAgent } from '../assault/types'
import { hasCompleteAgentSkillLevels } from '../accounts/agentProgressionRules'
import { compileNormalizedAgentEventSchedule } from '../calculation/currentNormalizedPlanningBaseline'
import {
  resolveCurrentPlanningScenario32,
  type CurrentPlanningScenarioSelection32,
} from '../calculation/currentPlanningScenario32'
import { prepareReviewedTemplateEvents32 } from '../calculation/reviewedTemplatePreparedEvents32'
import type { ReviewedTemplateEventConditionDeclaration32 } from '../calculation/reviewedTemplateEventConditions32'
import { getCandidateWarehouseConstraint } from '../gameDataPacks/candidateWarehouseConstraints'
import { stableContentHash } from '../gameDataPacks/types'
import type { CandidatePanelInput } from '../optimizer/candidatePanelObjective'
import {
  candidatePreparedPotentialPolicy32,
  type CandidateEffectiveCritObjective,
} from '../optimizer/candidateEffectiveCritObjective'

/** Compile the same declared personal event/window used by the comparison.
 * No guide panel ceiling, buff uptime, or missing skill level is inferred. */
export function developmentCandidateEventObjective32(input: {
  agent: RosterAgent | undefined
  panelInput: CandidatePanelInput | undefined
  scenarioSelection?: CurrentPlanningScenarioSelection32
  eventConditionDeclaration?: ReviewedTemplateEventConditionDeclaration32
}): CandidateEffectiveCritObjective | undefined {
  const { agent, panelInput } = input
  if (
    !agent?.owned ||
    !panelInput ||
    panelInput.agentId !== agent.agentId ||
    !hasCompleteAgentSkillLevels(agent.skillLevels)
  )
    return undefined
  const constraint = getCandidateWarehouseConstraint(agent.agentId)
  if (
    !constraint ||
    !['crit_rate', 'crit_dmg'].some(
      (key) => Number(constraint.subStatWeights[key as 'crit_rate' | 'crit_dmg']) > 0,
    )
  )
    return undefined
  const schedule = compileNormalizedAgentEventSchedule({
    agentId: agent.agentId,
    skillLevels: agent.skillLevels,
  })
  if (schedule.status !== 'supported') return undefined
  const scenario = resolveCurrentPlanningScenario32(input.scenarioSelection)
  const preparation = prepareReviewedTemplateEvents32({
    member: { agentId: agent.agentId },
    eventUsages: schedule.eventUsages,
    conditionDeclaration: input.eventConditionDeclaration
      ? {
          ...input.eventConditionDeclaration,
          enemyStunned:
            input.eventConditionDeclaration.enemyStunned === undefined
              ? scenario.enemyStunned
              : input.eventConditionDeclaration.enemyStunned,
        }
      : undefined,
  })
  // Other action families retain their existing producers; their absence is
  // not permission to invent a generic conditional damage event.
  if (!preparation?.sourceRefs.length || preparation.conditionPreparation?.status === 'unsupported')
    return undefined
  const sourceRefs = [
    ...new Set([
      ...preparation.sourceRefs,
      ...schedule.eventUsages.flatMap((event) => event.evidenceRefs),
      `comparison-policy:${preparation.policyId}`,
    ]),
  ]
  const events = schedule.eventUsages.map((event) => ({
    eventId: event.eventId,
    skillLevel: event.skillLevel,
    occurrenceCount: event.occurrenceCount,
    ...(event.durationSeconds === undefined ? {} : { durationSeconds: event.durationSeconds }),
    sourceRefs: [...event.evidenceRefs],
    baselineReferences: { ...preparation.baselineReferences },
    ...(preparation.commonAnomalyEvents?.[`${agent.agentId}:${event.eventId}`]
      ? {
          commonAnomalyEvents: preparation.commonAnomalyEvents[`${agent.agentId}:${event.eventId}`],
        }
      : {}),
    ...(preparation.conditionPreparation
      ? { whiteWaterBallad: preparation.conditionPreparation.whiteWaterBalladPreparation }
      : {}),
  }))
  const preparedPotentialPolicy = candidatePreparedPotentialPolicy32(agent.agentId)
  const payload = {
    sourceRefs,
    baseline: scenario.baseline,
    events,
    ...(preparedPotentialPolicy ? { preparedPotentialPolicy } : {}),
  }
  return {
    id: `personal-source-window:${stableContentHash({
      agentId: agent.agentId,
      scenario: scenario.identity,
      preparation: preparation.identity,
      payload,
    })}`,
    ...payload,
  }
}
