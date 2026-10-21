import {
  analyzePlanningBenchmark32Candidate,
  createPlanningBenchmark32ObjectiveAnalyzer,
  type PlanningBenchmarkBinding32,
} from '../application/privatePlanningBenchmark32'
import { preparePlanningBenchmark32 } from '../application/privatePlanningBenchmarkBinding32'
import {
  planningEventDeclarationsInputFingerprint32,
  type PlanningEventDeclarationsInput32,
} from '../application/publicPlanningEventDeclarations32'
import type { PlanningBenchmarkResult32 } from '../application/publicPlanningBenchmark32'
import { bindPlanningAnomalyLifecycleReferences32 } from '../calculation/currentPlanningAnomalyLifecycle32'
import { bindTriggerAftershockWindow32 } from '../calculation/triggerAftershockWindow32'
import {
  evaluateReviewedFunctionalCapacity32,
  type ReviewedFunctionalCapacity32,
} from '../calculation/reviewedFunctionalCapacity32'
import type { SourceBackedPlanningTeamDpsInput } from '../calculation/currentPlanningTeamDpsRuntime'
import { stableContentHash } from '../gameDataPacks/types'
import type { TeamAssignmentObjective } from '../optimizer/selectTeamObjectiveAssignment'
import {
  resolveTargetTeamWEngineRuntime,
  targetTeamObjectiveConditionsIdentity,
  type TargetTeamPlanningContextInput,
} from './targetTeamPlanningContextInput'
import type { TeamJointBuildIntent } from './buildIntent'
import type { TargetTeamObjectiveContextResolver } from './targetTeamAssignmentObjective'
import {
  preservesTeamFunctionalConstraints32,
  sourceReviewedProtectedUtilityIndices32,
} from './teamFunctionalConstraints32'

export type DeclaredEventGoal32 = {
  declarations: PlanningEventDeclarationsInput32
  sourceBindingFingerprint: string
  referenceAccountFingerprint: string
  referenceFit: {
    fingerprint: string
    loadouts: ReadonlyArray<{ agentId: string; discIds: readonly string[] }>
  }
  /** Preserve the original issued selection, including its provenance marker. */
  referenceSelectedEquipment?: PlanningBenchmarkBinding32['selectedEquipment']
  equipmentConditionAlternatives32?: PlanningBenchmarkBinding32['equipmentConditionAlternatives32']
}

export type DeclaredEventObjective32 = TeamAssignmentObjective & {
  lastEvaluationCoverageIdentity: () => string | null
}

type ObjectiveInput = Omit<TargetTeamPlanningContextInput, 'fit' | 'modifierProjection'> & {
  buildIntent?: TeamJointBuildIntent
}
type Loadouts = Parameters<TeamAssignmentObjective['evaluate']>[0]
type FunctionalSnapshot = {
  capacities: ReviewedFunctionalCapacity32[]
  utility: Map<string, number[]>
}
const key = (row: { ownerAgentId: string; eventId: string }) =>
  JSON.stringify([row.ownerAgentId, row.eventId])

function legalFit(
  input: Pick<ObjectiveInput, 'warehouse' | 'candidate'>,
  loadouts: DeclaredEventGoal32['referenceFit']['loadouts'],
  fingerprint: string,
): PlanningBenchmarkBinding32['fit'] | null {
  const members = input.candidate.memberIds
  if (
    members.length !== 3 ||
    new Set(members).size !== 3 ||
    loadouts.length !== 3 ||
    new Set(loadouts.map((row) => row.agentId)).size !== 3 ||
    !fingerprint
  )
    return null
  const used = new Set<string>()
  for (const row of loadouts) {
    if (!members.includes(row.agentId) || row.discIds.length !== 6) return null
    const slots = new Set<number>()
    for (const id of row.discIds) {
      const matches = input.warehouse.discs.filter((disc) => disc.id === id)
      if (used.has(id) || matches.length !== 1) return null
      const disc = matches[0]!
      if (!Number.isInteger(disc.slot) || disc.slot < 1 || disc.slot > 6 || slots.has(disc.slot))
        return null
      used.add(id)
      slots.add(disc.slot)
    }
  }
  return {
    status: 'ready',
    uniqueDiscCount: 18,
    memberIds: members,
    fingerprint,
    loadouts: loadouts.map((row) => ({ agentId: row.agentId, discIds: [...row.discIds] })),
  }
}

/** Reuse the producer's resolved per-occurrence operands and the same shared
 * lifecycle/window binders. No normalized schedule or invented action counts. */
function functionalSnapshot(runtime: SourceBackedPlanningTeamDpsInput): FunctionalSnapshot | null {
  const schedule = runtime.eventSchedule32
  if (!schedule?.occurrences.length) return null
  const trigger = bindTriggerAftershockWindow32({
    schedule,
    memberIds: runtime.memberIds,
    targetId: runtime.baseline.enemy.id,
  })
  if (trigger.status !== 'supported') return null
  const capacities: ReviewedFunctionalCapacity32[] = []
  const utility = new Map(
    runtime.members.map((member) => [
      member.agentId,
      [
        member.finalStats.impact,
        member.finalStats.enerRegen,
        member.finalStats.anomMas,
        member.finalStats.anomProf,
      ],
    ]),
  )
  if ([...utility.values()].some((values) => values.some((value) => !Number.isFinite(value))))
    return null
  const owners = new Set(schedule.occurrences.map((row) => row.ownerAgentId))
  for (const occurrence of schedule.occurrences) {
    const usage = runtime.eventUsages.find((row) => key(row) === key(occurrence))
    if (!usage) return null
    const references: Record<string, Record<string, unknown>> = Object.fromEntries(
      Object.entries(occurrence.referencesByAgentId).map(([id, values]) => [id, { ...values }]),
    )
    const triggerState = trigger.states?.[occurrence.occurrenceId]
    if (triggerState) {
      references['agent-trigger'] = { ...references['agent-trigger'] }
      delete references['agent-trigger'].aftershock_hit
      if (triggerState.active !== undefined)
        references['agent-trigger'].aftershock_hit = triggerState.active
    }
    for (const [providerId, declaration] of Object.entries(
      occurrence.anomalyLifecycleByAgentId ?? {},
    )) {
      const bound = bindPlanningAnomalyLifecycleReferences32({
        references: { ...references[providerId], anomalyLifecycle32: declaration },
        memberIds: runtime.memberIds,
        providerAgentId: providerId,
        providerMindscape: runtime.members.find((member) => member.agentId === providerId)
          ?.mindscape,
        eventId: occurrence.eventId,
        ownerAgentId: occurrence.ownerAgentId,
        targetId: runtime.baseline.enemy.id,
      })
      if (bound.status !== 'supported') return null
      references[providerId] = bound.references
    }
    for (const member of runtime.members) {
      // Each actor's action capacities use only its actual declared occurrences.
      // Actors without damage events still retain shield/support/energy guards.
      if (owners.has(member.agentId) && member.agentId !== occurrence.ownerAgentId) continue
      const result = evaluateReviewedFunctionalCapacity32({
        member,
        members: runtime.members,
        eventUsages:
          member.agentId === occurrence.ownerAgentId
            ? [{ ...usage, occurrenceCount: 1, durationSeconds: occurrence.durationSeconds }]
            : [],
        potentialEvents: occurrence.potentialEvent
          ? { [`${occurrence.ownerAgentId}:${occurrence.eventId}`]: occurrence.potentialEvent }
          : undefined,
        equipmentModifierBuckets:
          occurrence.equipmentModifierBuckets ?? runtime.equipmentModifierBuckets,
        // The enclosing analyzer has already rejected all unresolved exclusions.
        equipmentExclusions: [],
        baselineReferencesByAgentId: references,
      })
      if (
        result.status !== 'supported' ||
        result.blockers.length ||
        result.capacities.some((row) => row.value === null || !Number.isFinite(row.value))
      )
        return null
      capacities.push(
        ...result.capacities.map((row) => ({
          ...row,
          key: `${occurrence.occurrenceId}:${row.key}`,
        })),
      )
    }
  }
  return { capacities, utility }
}

function runtimeDeclarationsMatch(
  context: ObjectiveInput,
  prepared: ReturnType<typeof preparePlanningBenchmark32>,
  declarations: PlanningEventDeclarationsInput32,
) {
  const explicit = context.wEngineRuntimeDeclarations
  if (!explicit?.length) return true
  const runtime = resolveTargetTeamWEngineRuntime({
    memberIds: context.candidate.memberIds,
    parameters: context.parameters,
    declarations: explicit,
  })
  if (runtime.status !== 'supported') return false
  for (const declaration of explicit) {
    // The existing producer transports engine booleans and numbers only.
    if (
      Object.keys(declaration.runtime.accumulators ?? {}).length ||
      Object.keys(declaration.runtime.recipients ?? {}).length
    )
      return false
    for (const group of ['flags', 'numbers'] as const) {
      for (const [reference, value] of Object.entries(declaration.runtime[group] ?? {})) {
        if (
          (group === 'flags' && typeof value !== 'boolean') ||
          (group === 'numbers' && (typeof value !== 'number' || !Number.isFinite(value)))
        )
          return false
        for (const occurrence of declarations.occurrences) {
          const projection = prepared.projections.get(occurrence.ownerAgentId)
          const evidence =
            projection?.evidence.filter(
              (row) =>
                row.providerAgentId === declaration.agentId &&
                row.engineId === declaration.engineId &&
                row.runtimeReference === reference,
            ) ?? []
          if (
            evidence.length !== 1 ||
            !occurrence.conditions.some(
              (condition) =>
                condition.providerAgentId === declaration.agentId &&
                condition.referenceKey === evidence[0]!.referenceKey &&
                condition.value === value,
            )
          )
            return false
        }
      }
    }
  }
  return true
}

function completeDeclaredResult(
  result: Omit<PlanningBenchmarkResult32, 'resultFingerprint'>,
  declarations: PlanningEventDeclarationsInput32,
) {
  return (
    result.status === 'declared_event_benchmark' &&
    result.formalCycleReady === false &&
    result.gaps.length === 0 &&
    result.totalDamage !== null &&
    Number.isFinite(result.totalDamage) &&
    result.inputFingerprint === planningEventDeclarationsInputFingerprint32(declarations) &&
    result.eventResults.length === declarations.occurrences.length &&
    result.eventResults.every((row) => Number.isFinite(row.totalDamage)) &&
    // An equal list of unknown effects is still unknown, not zero contribution.
    result.excludedEffects.every(
      (row) => row.reason === 'static_condition_not_met' && row.sourceRefs.length > 0,
    )
  )
}

function coverageIdentity(
  result: Omit<PlanningBenchmarkResult32, 'resultFingerprint'>,
  snapshot: FunctionalSnapshot,
  equipmentComparison = false,
) {
  return stableContentHash({
    declarations: result.inputFingerprint,
    vocabulary: equipmentComparison
      ? (result.metadata?.sourceFingerprint ?? null)
      : result.metadata,
    duration: result.declaredDurationSeconds,
    events: result.eventResults.map((row) => ({
      occurrenceId: row.occurrenceId,
      ownerAgentId: row.ownerAgentId,
      eventId: row.eventId,
      atSeconds: row.atSeconds,
      durationSeconds: row.durationSeconds,
      snapshotAtSeconds: row.snapshotAtSeconds,
      sourceRefs: row.sourceRefs,
    })),
    // completeDeclaredResult already rejects every unknown/excluded dependency.
    // Known inactive effects of different equipment need not have identical IDs.
    exclusions: equipmentComparison ? [] : result.excludedEffects,
    functions: snapshot.capacities.map(({ key, kind, contextKey }) => ({ key, kind, contextKey })),
  })
}

/** A bound finite event sum, never complete-cycle DPS or a source-native rating. */
export function createTargetTeamDeclaredEventObjective32(
  input: ObjectiveInput,
  options?: { contextResolver?: TargetTeamObjectiveContextResolver },
): DeclaredEventObjective32 {
  const conditionsIdentity = targetTeamObjectiveConditionsIdentity(input)
  const goal = input.declaredEventGoal32 ? structuredClone(input.declaredEventGoal32) : undefined
  const declarations = goal?.declarations
  const referenceFit = goal
    ? legalFit(input, goal.referenceFit.loadouts, goal.referenceFit.fingerprint)
    : null
  const makeBinding = (
    context: ObjectiveInput,
    fit: PlanningBenchmarkBinding32['fit'],
    reference = false,
  ): PlanningBenchmarkBinding32 => ({
    runId: `declared-objective:${input.planningHash}`,
    candidateId: input.candidate.candidateId,
    capturedAt: context.capturedAt,
    accountFingerprint: goal!.referenceAccountFingerprint,
    warehouse: context.warehouse,
    fit,
    selectedEquipment:
      reference && goal!.referenceSelectedEquipment !== undefined
        ? goal!.referenceSelectedEquipment
        : context.parameters,
    ...(goal!.equipmentConditionAlternatives32
      ? { equipmentConditionAlternatives32: goal!.equipmentConditionAlternatives32 }
      : {}),
  })
  const referenceAnalysis =
    referenceFit &&
    declarations &&
    goal?.referenceAccountFingerprint &&
    goal.sourceBindingFingerprint
      ? analyzePlanningBenchmark32Candidate(
          makeBinding(input, referenceFit, true),
          declarations,
          goal.sourceBindingFingerprint,
        )
      : null
  const baseline =
    referenceAnalysis?.runtimeInput32 &&
    declarations &&
    referenceFit &&
    runtimeDeclarationsMatch(
      input,
      preparePlanningBenchmark32(makeBinding(input, referenceFit, true)),
      declarations,
    ) &&
    completeDeclaredResult(referenceAnalysis.result, declarations)
      ? functionalSnapshot(referenceAnalysis.runtimeInput32)
      : null
  const baselineDuration = referenceAnalysis?.result.declaredDurationSeconds
  const analyzeObjective =
    declarations && referenceAnalysis?.result.metadata
      ? createPlanningBenchmark32ObjectiveAnalyzer(declarations, referenceAnalysis.result.metadata)
      : null
  const baselineCoverage =
    baseline && referenceAnalysis
      ? coverageIdentity(
          referenceAnalysis.result,
          baseline,
          Boolean(goal?.equipmentConditionAlternatives32),
        )
      : null
  let lastCoverage: string | null = null
  return {
    lastEvaluationCoverageIdentity: () => lastCoverage,
    domain: 'game_legal_inventory',
    baselineDiscIdsByAgent: referenceFit
      ? Object.fromEntries(referenceFit.loadouts.map((row) => [row.agentId, row.discIds]))
      : {},
    fingerprint: stableContentHash({
      policy: 'declared-event-team-objective32/v1',
      goal: goal ?? null,
      warehouseHash: input.warehouseHash,
      rosterHash: input.rosterHash,
      parameters: input.parameters,
      wEngineRuntimeDeclarations: input.wEngineRuntimeDeclarations ?? null,
      resolverIdentity: options?.contextResolver?.identity ?? null,
    }),
    evaluate(assignments: Loadouts) {
      lastCoverage = null
      if (!baseline || !declarations || !goal) return null
      const resolvedContext = options?.contextResolver?.resolve(assignments)
      const context = options?.contextResolver ? resolvedContext : input
      if (
        !context ||
        context.candidate.candidateId !== input.candidate.candidateId ||
        context.warehouse.accountId !== input.warehouse.accountId ||
        targetTeamObjectiveConditionsIdentity(context) !== conditionsIdentity ||
        stableContentHash(context.candidate.memberIds) !==
          stableContentHash(input.candidate.memberIds)
      )
        return null
      const loadouts = assignments.map((row) => ({
        agentId: row.agentId,
        discIds: row.discs.map((choice) => choice.disc.id),
      }))
      const fit = legalFit(
        context,
        loadouts,
        resolvedContext ? resolvedContext.fit.fingerprint : stableContentHash(loadouts),
      )
      if (
        !fit ||
        assignments.some((row) =>
          row.discs.some(
            ({ disc }) =>
              stableContentHash(disc) !==
              stableContentHash(context.warehouse.discs.find((item) => item.id === disc.id)),
          ),
        )
      )
        return null
      if (
        resolvedContext &&
        (resolvedContext.fit.status !== 'ready' ||
          resolvedContext.fit.uniqueDiscCount !== 18 ||
          stableContentHash(resolvedContext.fit.loadouts) !== stableContentHash(fit.loadouts) ||
          stableContentHash(resolvedContext.fit.memberIds) !== stableContentHash(fit.memberIds))
      )
        return null
      const binding = makeBinding(context, fit)
      if (!analyzeObjective) return null
      // Only the internal asset binding changes. The confirmed vocabulary and
      // declaration fingerprint are never rewritten to make another set fit.
      const analysis = analyzeObjective(binding)
      if (!runtimeDeclarationsMatch(context, analysis.prepared, declarations)) return null
      if (
        !completeDeclaredResult(analysis.result, declarations) ||
        analysis.result.declaredDurationSeconds !== baselineDuration ||
        !analysis.runtimeInput32
      )
        return null
      const candidate = functionalSnapshot(analysis.runtimeInput32)
      if (
        !candidate ||
        coverageIdentity(
          analysis.result,
          candidate,
          Boolean(goal.equipmentConditionAlternatives32),
        ) !== baselineCoverage ||
        !preservesTeamFunctionalConstraints32({
          baselineCapacities: baseline.capacities,
          candidateCapacities: candidate.capacities,
          baselineUtility: baseline.utility,
          candidateUtility: candidate.utility,
          protectedUtilityIndicesByAgentId: new Map(
            [...baseline.utility.keys()].map((id) => [
              id,
              sourceReviewedProtectedUtilityIndices32(id),
            ]),
          ),
        })
      )
        return null
      lastCoverage = baselineCoverage
      return analysis.result.totalDamage
    },
  }
}
