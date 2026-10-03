import { z } from 'zod'
import qualification from './data/reviewed-planning-event-set32.v1.json'
import { stableContentHash } from './types'
import { getReviewedEventCapability32 } from './reviewedEventCapabilities32'
import { reviewedPlanningEventSetIdentity32 } from './reviewedPlanningEventSetIdentity32'
import { damageFormula32Identity } from '../calculation/sharpDamageCore'
import { currentPlanningConditionCatalogIdentity32 } from '../calculation/currentPlanningConditionCatalog32'
import { planningEffectResolutionIdentity32 } from '../calculation/currentPlanningEffectResolutionIdentity32'
import {
  planningBenchmarkBaseline32,
  planningBenchmarkContextPolicy32,
  type PlanningBenchmarkBinding32,
  type preparePlanningBenchmark32,
} from '../application/privatePlanningBenchmarkBinding32'
import type { PlanningEventDeclarationsInput32 } from '../application/publicPlanningEventDeclarations32'

const interval = z.tuple([z.number().int().positive(), z.number().int().positive()])
const domain = z.object({
  providerAgentId: z.string(),
  referenceKey: z.string(),
  valueKind: z.enum(['boolean', 'number', 'enum']),
  minimum: z.number().optional(),
  maximum: z.number().optional(),
  options: z.array(z.object({ value: z.union([z.string(), z.number(), z.boolean()]) })).optional(),
})
const capsuleSchema = z.object({
  schema: z.literal('soda-reviewed-planning-event-set32/v1'),
  gameVersion: z.literal('3.2'),
  upstreamCommit: z.literal('3456cd0f6f5bea10e168074502460dac2fcd6df4'),
  qualificationId: z.string().min(1),
  semanticIdentityHash: z.string().min(1),
  ready: z.literal(true),
  scope: z.object({
    memberIds: z.array(z.string()).length(3),
    eventTuples: z
      .array(z.object({ ownerAgentId: z.string(), eventId: z.string(), formulaFamily: z.string() }))
      .min(1),
    equipmentPairs: z
      .array(z.object({ claretEngineId: z.string(), roxyEngineId: z.string() }))
      .min(1),
    rinaEngineId: z.literal('wengine-12001'),
    rinaEngineIds: z.array(z.string()).optional(),
    sameRefinement: z.literal(true),
    currentWindsweptConstraint: z.literal('inactive_requires_squad_and_contamination_match_false'),
    setCounts: z.record(z.string(), z.number().int().positive()),
    loadoutDomains: z
      .array(
        z.object({
          id: z.string(),
          setCountsByAgentId: z.record(
            z.string(),
            z.record(z.string(), z.number().int().positive()),
          ),
        }),
      )
      .optional(),
    progressionBounds: z.object({
      agentLevel: interval,
      engineLevel: interval,
      coreLevel: interval,
      skillLevel: interval,
      refinement: interval,
    }),
    conditionDomains: z.array(domain),
  }),
  records: z
    .array(
      z.object({
        record: z.object({
          entity_id: z.string(),
          event_id: z.string(),
          formula_family: z.string(),
          capability: z.string(),
        }),
        verification: z.object({ ready: z.literal(true) }),
      }),
    )
    .min(1),
})
const parsed = capsuleSchema.safeParse(qualification)
const within = (value: number | null | undefined, range: readonly number[]) =>
  typeof value === 'number' && Number.isInteger(value) && value >= range[0]! && value <= range[1]!
const sameMembers = (left: readonly string[], right: readonly string[]) =>
  JSON.stringify([...left].sort()) === JSON.stringify([...right].sort())

/** Scope verification is independent of the arithmetic evaluator. Passing this
 * only qualifies named events and their actual loadouts, never a full rotation. */
export function qualifyReviewedPlanningEventSet32(
  input: PlanningBenchmarkBinding32,
  prepared: ReturnType<typeof preparePlanningBenchmark32>,
  declarations: PlanningEventDeclarationsInput32,
) {
  const gaps: string[] = []
  if (!parsed.success)
    return { allowed: false, gaps: ['具名事件集模型证据尚未通过全部验证。'], evidenceRefs: [] }
  const capsule = parsed.data
  const semanticIdentityHash = stableContentHash({
    condition: currentPlanningConditionCatalogIdentity32,
    effects: planningEffectResolutionIdentity32,
    formula: damageFormula32Identity,
    baseline: planningBenchmarkBaseline32,
    contextPolicy: planningBenchmarkContextPolicy32,
  })
  if (capsule.semanticIdentityHash !== semanticIdentityHash)
    gaps.push('具名事件集来源或公式已变化，需重新核验模型证据。')
  const scope = capsule.scope
  if (!sameMembers(input.fit.memberIds, scope.memberIds))
    gaps.push('当前三人不属于已独立复核的具名事件集范围。')
  const actors = new Map(prepared.actorBindings.map((row) => [row.agentId, row]))
  const claret = actors.get('agent-claret'),
    roxy = actors.get('agent-roxy'),
    rina = actors.get('agent-rina')
  if (
    !scope.equipmentPairs.some(
      (pair) =>
        pair.claretEngineId === claret?.wEngine.id && pair.roxyEngineId === roxy?.wEngine.id,
    ) ||
    !(scope.rinaEngineIds ?? [scope.rinaEngineId]).includes(rina?.wEngine.id ?? '')
  )
    gaps.push('当前音擎组合尚未完成具名事件集的独立复核。')
  if (new Set(prepared.actorBindings.map((row) => row.wEngine.refinement)).size !== 1)
    gaps.push('本次已核验范围要求三名成员使用相同精炼档位。')
  const loadoutDomains = scope.loadoutDomains ?? [
    {
      id: 'three-static-two-piece-sets',
      setCountsByAgentId: Object.fromEntries(scope.memberIds.map((id) => [id, scope.setCounts])),
    },
  ]
  if (
    !loadoutDomains.some((loadout) =>
      prepared.actorBindings.every((actor) => {
        const counts = loadout.setCountsByAgentId[actor.agentId]
        return (
          counts &&
          actor.discs.length === 6 &&
          Object.values(counts).reduce((sum, count) => sum + count, 0) === 6 &&
          Object.entries(counts).every(
            ([setId, count]) => actor.discs.filter((disc) => disc.setId === setId).length === count,
          )
        )
      }),
    )
  )
    gaps.push('当前三人的实际套装组合尚未完成具名事件集独立复核。')
  for (const actor of prepared.actorBindings) {
    if (actor.mindscape !== 0 || actor.potential !== 0)
      gaps.push(`${actor.agentId}的影画或潜能超出本次M0/潜能关闭核验范围。`)
    if (
      !within(actor.level, scope.progressionBounds.agentLevel) ||
      !within(actor.wEngine.level, scope.progressionBounds.engineLevel) ||
      !within(actor.skillLevels.core, scope.progressionBounds.coreLevel) ||
      !within(actor.wEngine.refinement, scope.progressionBounds.refinement)
    )
      gaps.push(`${actor.agentId}的等级、核心或精炼超出已核验范围。`)
  }
  for (const occurrence of declarations.occurrences) {
    const tuple = scope.eventTuples.find(
      (row) => row.ownerAgentId === occurrence.ownerAgentId && row.eventId === occurrence.eventId,
    )
    const event = getReviewedEventCapability32(occurrence.ownerAgentId, occurrence.eventId)
    if (
      !tuple ||
      !event ||
      !within(
        prepared.metadata?.events.find(
          (row) =>
            row.ownerAgentId === occurrence.ownerAgentId && row.eventId === occurrence.eventId,
        )?.skillLevel,
        scope.progressionBounds.skillLevel,
      )
    ) {
      gaps.push(`${occurrence.ownerAgentId}/${occurrence.eventId}尚未获得当前配装域的模型资格。`)
      continue
    }
    for (const capability of [
      'formal_event_damage_ready',
      'formal_event_set_ready',
      'formal_loadout_ready',
    ])
      if (
        !capsule.records.some(
          ({ record }) =>
            record.entity_id === tuple.ownerAgentId &&
            record.event_id === tuple.eventId &&
            record.formula_family === tuple.formulaFamily &&
            record.capability === capability,
        )
      )
        gaps.push(`${tuple.ownerAgentId}/${capability}缺少通过验证的能力记录。`)
    for (const value of occurrence.conditions) {
      const declaredDomain = scope.conditionDomains.find(
        (row) =>
          row.providerAgentId === value.providerAgentId && row.referenceKey === value.referenceKey,
      )
      if (
        !declaredDomain ||
        (declaredDomain.valueKind === 'boolean'
          ? typeof value.value !== 'boolean'
          : declaredDomain.valueKind === 'number'
            ? !within(typeof value.value === 'number' ? value.value : null, [
                declaredDomain.minimum!,
                declaredDomain.maximum!,
              ])
            : !declaredDomain.options?.some((option) => option.value === value.value))
      )
        gaps.push(`${value.providerAgentId}/${value.referenceKey}超出已核验条件域。`)
    }
    if (
      occurrence.windswept === 'inactive' &&
      occurrence.conditions.some(
        (value) =>
          value.providerAgentId === 'agent-roxy' &&
          ['roxySquadWindswept32', 'roxyContaminationMatchesEvent32'].includes(
            value.referenceKey,
          ) &&
          value.value === true,
      )
    )
      gaps.push('未激活风蚀且声明当前额外能力有效的组合尚未完成数值核验。')
  }
  return {
    allowed: gaps.length === 0,
    gaps: [...new Set(gaps)],
    evidenceRefs: [
      capsule.qualificationId,
      reviewedPlanningEventSetIdentity32.regressionHash,
      semanticIdentityHash,
    ],
  }
}
