import type { DriveDisc } from '../domain/schemas'
import type { CandidatePanelInput } from './candidatePanelObjective'
import type { PlanningBaseline } from '../calculation/planningDpsContract'
import type { CurrentWEngineFormulaRuntime } from '../calculation/currentWEnginePersonalPlanningEffects'
import { compileCurrentWEnginePersonalPlanningEffects } from '../calculation/currentWEnginePersonalPlanningEffects'
import { compileCurrentDriveDiscPlanningEffects } from '../calculation/currentDriveDiscPlanningEffects'
import { evaluateSourceBackedPersonalPlanningDps } from '../calculation/currentPlanningTeamDpsRuntime'
import { projectNormalizedAccountFinalStatsDetailed } from '../decision/normalizedAccountFinalStats'
import {
  getCurrentAgentEventContract,
  resolveCurrentAgentEvent,
} from '../calculation/currentAgentMechanicContracts'
import type { RosterAgent } from '../assault/types'
import type { PlanningEffectRuntimeMember } from '../calculation/currentPlanningEffectDomain'
import { contentHash } from '../evaluation/contentHash'
import { matchesEventScope } from '../calculation/currentPlanningDamageModifiers'
import { prepareReviewedPotentialEvents32 } from '../calculation/reviewedPotentialPreparedEvents32'
import { createLevel60NeutralEffectRuntimeMember } from '../calculation/currentPlanningEffectDomain'
import type { CommonAnomalyEventObservation32 } from '../calculation/currentCommonAnomalyEffects32'

export type CandidatePreparedPotentialPolicy32 = { policyId: string; sourceHash: string }

/** Extract only the shared policy/source identity. The shared identity excludes
 * panel-dependent preparation such as Burnice's energy threshold; no state from
 * this metadata probe is carried into an actual candidate evaluation. */
export function candidatePreparedPotentialPolicy32(
  agentId: string,
): CandidatePreparedPotentialPolicy32 | undefined {
  if (!getCurrentAgentEventContract(agentId)) return undefined
  const preparation = prepareReviewedPotentialEvents32({
    member: createLevel60NeutralEffectRuntimeMember(agentId),
    eventUsages: [],
  })
  return preparation
    ? { policyId: preparation.policyId, sourceHash: preparation.identity }
    : undefined
}

/** Capability discovery only; source-action-only actors need their own binder. */
export function supportsCandidateEffectiveCritObjectiveAgent(agentId: string) {
  return (
    !['agent-claret', 'agent-roxy', 'agent-koleda'].includes(agentId) &&
    Boolean(getCurrentAgentEventContract(agentId)?.eventContract.events.length)
  )
}

/** A declared event coordinate. It carries no observation of account buff uptime. */
export type CandidateEffectiveCritEvent = {
  eventId: string
  skillLevel: number
  occurrenceCount: number
  durationSeconds?: number
  sourceRefs: readonly string[]
  baselineReferences?: Readonly<Record<string, unknown>>
  commonAnomalyEvents?: readonly CommonAnomalyEventObservation32[]
  whiteWaterBallad?: {
    critWindowActive?: boolean
    attackWindowActive?: boolean
    sourceRefs: readonly string[]
  }
  wEngineRuntime?: CurrentWEngineFormulaRuntime
}

export type CandidateEffectiveCritObjective = {
  id: string
  sourceRefs: readonly string[]
  baseline: PlanningBaseline
  events: readonly CandidateEffectiveCritEvent[]
  preparedPotentialPolicy?: CandidatePreparedPotentialPolicy32
}

export type CandidateEffectiveCritProjection = {
  objectiveId: string
  objectiveHash: string
  comparisonCoverageHash: string
  status: 'applied' | 'limited' | 'unsupported'
  /** A sum of explicitly counted source events, never a complete rotation or DPS. */
  totalDamage?: number
  events: Array<{
    eventId: string
    effectiveCritRate: number
    uncappedCritRate: number
    totalDamage: number
    consumedEffectKeys: string[]
  }>
  reasons: string[]
  sourceRefs: string[]
}

export function compareCandidateEffectiveCritObjective(
  left?: CandidateEffectiveCritProjection,
  right?: CandidateEffectiveCritProjection,
) {
  // Incomparable/missing objectives never promote a fallback to an evaluated result.
  if (
    !left ||
    !right ||
    left.objectiveHash !== right.objectiveHash ||
    left.comparisonCoverageHash !== right.comparisonCoverageHash ||
    left.totalDamage === undefined ||
    right.totalDamage === undefined
  )
    return 0
  return right.totalDamage - left.totalDamage
}

/** Share the account's exact growth/static projection and existing event formula.
 * Each event rebuilds conditional equipment and self effects independently. */
export function projectCandidateEffectiveCritObjective(
  objective: CandidateEffectiveCritObjective,
  panelInput: CandidatePanelInput | undefined,
  discs: DriveDisc[],
): CandidateEffectiveCritProjection {
  const objectiveHash = contentHash(objective)
  const reasons: string[] = []
  const sourceRefs = new Set(objective.sourceRefs)
  const events: CandidateEffectiveCritProjection['events'] = []
  const unsupported = (reason: string): CandidateEffectiveCritProjection => ({
    objectiveId: objective.id,
    objectiveHash,
    comparisonCoverageHash: contentHash([...reasons, reason]),
    status: 'unsupported',
    events: [],
    reasons: [...new Set([...reasons, reason])],
    sourceRefs: [...sourceRefs],
  })
  if (
    !objective.id.trim() ||
    !objective.sourceRefs.length ||
    objective.sourceRefs.some((ref) => !ref.trim()) ||
    !objective.events.length
  )
    return unsupported('固定事件目标缺少身份、来源或事件。')
  if (!panelInput || panelInput.mindscape === undefined)
    return unsupported('固定事件目标缺少实际成长、影画或音擎输入。')
  const agent: RosterAgent = {
    agentId: panelInput.agentId,
    owned: true,
    priority: 0,
    level: panelInput.level,
    ascension: panelInput.ascension,
    mindscape: panelInput.mindscape,
    potentialImage: panelInput.potentialImage,
    skillLevels: {
      basic: null,
      dodge: null,
      assist: null,
      special: null,
      chain: null,
      core: panelInput.core + 2,
    },
    wEngineDetails: { ...panelInput.wEngine, name: null },
    skills: '',
    wEngine: '',
    refinement: panelInput.wEngine.refinement,
    agentVersion: objective.baseline.gameVersion,
    completeness: 'partial',
    currentEquipment: 'unknown',
    source: 'manual',
    manualSource: null,
    syncedAt: '',
    lockedFields: [],
    wEngineCopyId: null,
    equippedDiscIds: null,
  }
  const projection = projectNormalizedAccountFinalStatsDetailed({
    agent,
    engineId: panelInput.wEngine.id,
    discs,
  })
  if (projection.status !== 'supported') return unsupported(projection.reasons.join('；'))
  let totalDamage = 0
  for (const event of objective.events) {
    if (
      !event.sourceRefs.length ||
      event.sourceRefs.some((ref) => !ref.trim()) ||
      !Number.isFinite(event.occurrenceCount) ||
      event.occurrenceCount <= 0
    )
      return unsupported('固定事件缺少来源或合法次数。')
    const resolved = resolveCurrentAgentEvent({
      stableId: panelInput.agentId,
      eventId: event.eventId,
      skillLevel: event.skillLevel,
    })
    if (resolved.status !== 'supported') return unsupported('目标事件或实际技能等级不受支持。')
    const sourceContract = getCurrentAgentEventContract(agent.agentId)!
    const sourceEvent = sourceContract.eventContract.events.find(
      (row) => row.eventId === event.eventId,
    )!
    const member: PlanningEffectRuntimeMember = {
      agentId: agent.agentId,
      level: agent.level,
      mindscape: agent.mindscape,
      potential: agent.potentialImage,
      coreLevel: panelInput.core + 2,
      skillLevels: { [sourceEvent.skill]: event.skillLevel, core: panelInput.core + 2 },
      statBasis32: 'out_of_combat',
      initialStats: projection.stats.initialStats,
      finalStats: projection.stats.finalStats,
    }
    const discEffects = compileCurrentDriveDiscPlanningEffects({
      members: [member],
      loadouts: [{ agentId: member.agentId, discs }],
      ...(event.whiteWaterBallad
        ? {
            preparedWhiteWaterByAgentId: {
              [member.agentId]: event.whiteWaterBallad,
            },
          }
        : {}),
    })
    const engineEffects = compileCurrentWEnginePersonalPlanningEffects({
      agentId: member.agentId,
      engineId: panelInput.wEngine.id,
      refinement: panelInput.wEngine.refinement,
      member,
      runtime: event.wEngineRuntime,
    })
    if (discEffects.blockers.length || engineEffects.status !== 'supported')
      return unsupported([...discEffects.blockers, ...engineEffects.blockers].join('；'))
    const eventUsages = [
      {
        ownerAgentId: member.agentId,
        eventId: event.eventId,
        skillLevel: event.skillLevel,
        occurrenceCount: event.occurrenceCount,
        ...(event.durationSeconds === undefined ? {} : { durationSeconds: event.durationSeconds }),
        evidenceRefs: [...event.sourceRefs],
      },
    ]
    // Prepare against this six-disc initial panel every time. A policy/source
    // declaration enables the existing window, never a frozen derived flag.
    const potentialPreparation = objective.preparedPotentialPolicy
      ? prepareReviewedPotentialEvents32({ member, eventUsages })
      : null
    if (
      objective.preparedPotentialPolicy &&
      (!potentialPreparation ||
        potentialPreparation.policyId !== objective.preparedPotentialPolicy.policyId ||
        potentialPreparation.identity !== objective.preparedPotentialPolicy.sourceHash)
    )
      return unsupported('潜能事件准备协议或来源已变化，需重新生成比较目标。')
    const result = evaluateSourceBackedPersonalPlanningDps({
      member,
      baseline: objective.baseline,
      eventUsages,
      ...(potentialPreparation ? { potentialEvents: potentialPreparation.potentialEvents } : {}),
      baselineReferences: {
        ...potentialPreparation?.baselineReferences,
        ...event.baselineReferences,
      },
      ...(event.commonAnomalyEvents
        ? {
            commonAnomalyEvents: {
              [`${member.agentId}:${event.eventId}`]: event.commonAnomalyEvents,
            },
          }
        : {}),
      equipmentModifierBuckets: [...discEffects.buckets, ...engineEffects.buckets],
    })
    if (result.status !== 'supported') return unsupported(result.blockers.join('；'))
    for (const exclusion of [
      ...discEffects.exclusions,
      ...engineEffects.exclusions,
      ...result.sourceEffectExclusions,
    ]) {
      if ('resolvedInactive' in exclusion && exclusion.resolvedInactive === true) continue
      reasons.push(
        `${event.eventId}:${'effectKey' in exclusion ? exclusion.effectKey : exclusion.setId}:${exclusion.reason}`,
      )
    }
    for (const ref of [
      ...event.sourceRefs,
      ...Object.values(potentialPreparation?.potentialEvents ?? {}).flatMap(
        (item) => item.sourceRefs,
      ),
      ...(event.commonAnomalyEvents?.flatMap((item) => item.sourceRefs) ?? []),
      ...result.effectBuckets.flatMap((item) => item.sourceRefs),
      ...discEffects.buckets.flatMap((item) => item.sourceRefs),
      ...engineEffects.buckets.flatMap((item) => item.sourceRefs),
    ])
      sourceRefs.add(ref)
    const uncappedCritRate =
      member.finalStats.crit_ +
      (result.initialCritConversion?.status === 'supported'
        ? result.initialCritConversion.critRate
        : 0) +
      result.effectBuckets
        .filter(
          (item) =>
            item.application === 'crit_rate' &&
            item.recipientAgentIds.includes(member.agentId) &&
            matchesEventScope(
              item,
              {
                actionId: sourceEvent.actionId,
                skill: sourceEvent.skill,
                damageType: resolved.damageType ?? undefined,
                eventModifierRefs: resolved.eventModifierRefs,
              },
              resolved.attribute ?? sourceContract.identity.attribute,
            ),
        )
        .reduce((sum, item) => sum + item.value, 0)
    events.push({
      eventId: event.eventId,
      uncappedCritRate,
      effectiveCritRate: Math.min(1, Math.max(0, uncappedCritRate)),
      totalDamage: result.totalDamage,
      consumedEffectKeys: [...new Set(result.effectBuckets.map((item) => item.effectKey))],
    })
    totalDamage += result.totalDamage
  }
  return {
    objectiveId: objective.id,
    objectiveHash,
    comparisonCoverageHash: contentHash([...new Set(reasons)].sort()),
    status: reasons.length ? 'limited' : 'applied',
    totalDamage,
    events,
    reasons: [...new Set(reasons)],
    sourceRefs: [...sourceRefs],
  }
}
