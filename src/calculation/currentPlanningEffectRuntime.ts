import {
  planningProviderReferences32,
  teamCounts,
  effectRuntimeReferences,
  type PlanningEffectRuntimeMember,
} from './currentPlanningEffectDomain'
export {
  bindPlanningEffectRuntimePotentialReference,
  createLevel60NeutralEffectRuntimeMember,
} from './currentPlanningEffectDomain'
export type {
  PlanningEffectRuntimeStats,
  PlanningEffectRuntimeMember,
} from './currentPlanningEffectDomain'
export { evaluateInitialCritConversion32 as evaluateCurrentPlanningInitialCritConversion32 } from './currentInitialCritConversion32'
import { bindReviewedRoxyEnergyConversion32 } from './reviewedRoxyEnergyConversion32'
import { knownInactivePlanningEffect32 } from './planningKnownInactiveEffects32'
import { planningEffectObservation32 } from './currentPlanningEffectObservation32'
import {
  bindPanMeridianFlowRecipient32,
  panMeridianFlowEffectKey32,
} from './currentPlanningDamageModifiers'
import { requiredReferences, effectReceiverMetadata } from './currentPlanningEffectExpressions'
import type { CurrentAgentPlanningEffectBlueprint } from './currentAgentPlanningEffectBlueprint'
import type { PlanningEffectRuntimeStats } from './currentPlanningEffectDomain'
import { stableContentHash } from '../gameDataPacks/types'
import { reviewedInlineAbilityEffectSources } from '../gameDataPacks/reviewedTeammateActivationMinimum'
import { getCurrentAgentDecisionMechanicContract } from './currentAgentDecisionMechanicContracts'
import { evaluateCurrentAgentTeamActivation } from './currentAgentMechanicContracts'
import { compileFormationPlanningEffectBlueprints } from './currentAgentPlanningEffectBlueprint'
import {
  reviewedPotentialEffectBlueprints,
  reviewedPotentialParameterBlueprints,
} from './reviewedPotentialEffectBlueprints'
import { compileCurrentPlanningBaselineTimelineContracts } from './currentPlanningBaselineObservations'
import {
  isVerifiedFormationTimeline,
  type FormationTimeline,
} from './verifiedPlanningFormationTimeline'
export { compileCurrentPlanningFormationEffectTimeline } from './verifiedPlanningFormationTimeline'
import { compileSourceBackedPlanningInteractionContracts } from './currentPlanningInteractionMechanicIR'
import { currentNormalizedPlanningBaseline } from './currentNormalizedPlanningBaseline'
import type { PlanningEffectDisposition } from './planningCalculationContextCompiler'
import type { PlanningInteractionContract } from './planningInteractionOperators'
import {
  createPlanningExpressionDomainRuntime,
  evaluateUpstreamExpressionIr,
  extractUpstreamEffectValueIr,
  type UpstreamExpressionIR,
} from './currentUpstreamExpressionIR'

// Legacy reviewed expressions retain their source values, but only the shared
// per-event potential binding may activate them. A level is not action proof.
const potentialValueOnlyKeys = new Set(
  reviewedPotentialEffectBlueprints.map((entry) => entry.effectKey),
)

function unique(values: readonly string[]) {
  return [...new Set(values)]
}

export function evaluateCurrentPlanningFormationEffects(input: {
  memberIds: readonly [string, string, string]
  members: readonly PlanningEffectRuntimeMember[]
  baselineReferencesByAgentId?: Readonly<Record<string, Readonly<Record<string, unknown>>>>
  finalStatsByAgentId?: Readonly<Record<string, PlanningEffectRuntimeStats>>
}) {
  return evaluateFormationEffects(input, compileFormationPlanningEffectBlueprints(input.memberIds))
}

export function evaluateCurrentPlanningEffectEntries32(
  input: {
    memberIds: readonly string[]
    members: readonly PlanningEffectRuntimeMember[]
    baselineReferencesByAgentId?: Readonly<Record<string, Readonly<Record<string, unknown>>>>
    finalStatsByAgentId?: Readonly<Record<string, PlanningEffectRuntimeStats>>
  },
  entries: CurrentAgentPlanningEffectBlueprint[],
) {
  return evaluateFormationEffects(input, {
    status: 'supported',
    entries,
    blueprintHash: stableContentHash(entries),
  })
}

function evaluateFormationEffects(
  input: Parameters<typeof evaluateCurrentPlanningEffectEntries32>[0],
  blueprints: ReturnType<typeof compileFormationPlanningEffectBlueprints>,
) {
  const blockers: string[] = []
  for (const member of input.members) {
    if (
      member.potential != null &&
      (!Number.isInteger(member.potential) || member.potential < 0 || member.potential > 6)
    )
      blockers.push(`潜能等级须为0至6的整数：${member.agentId}`)
  }
  const memberById = new Map(input.members.map((member) => [member.agentId, member]))
  if (memberById.size !== input.members.length) blockers.push('效果运行时成员重复。')
  input.memberIds.forEach((agentId) => {
    if (!memberById.has(agentId)) blockers.push(`效果运行时缺少成员：${agentId}`)
  })
  if (blueprints.status === 'unsupported') blockers.push(...blueprints.blockers)
  if (blockers.length) return { status: 'unsupported' as const, blockers: unique(blockers) }

  const counts = teamCounts(input.memberIds)
  const parameters = reviewedPotentialParameterBlueprints.filter((entry) =>
    input.memberIds.includes(entry.providerAgentId),
  )
  const parameterKeys = new Set(parameters.map((entry) => entry.effectKey))
  const entries = [...(blueprints.status === 'supported' ? blueprints.entries : []), ...parameters]
  const providerRuntimeByAgentId = new Map(
    input.memberIds.flatMap((agentId) => {
      const provider = memberById.get(agentId)!
      const contract = getCurrentAgentDecisionMechanicContract(agentId)
      if (!contract) return []
      const activation = evaluateCurrentAgentTeamActivation({
        stableId: agentId,
        memberIds: input.memberIds,
        agentState: { mindscape: provider.mindscape, potentialImage: provider.potential },
      })
      return [
        [
          agentId,
          {
            activation,
            baseReferences: planningProviderReferences32({
              member: provider,
              sourceReferences: contract.effectContract.runtimeDefaults.references,
              attributeCounts: counts.attribute,
              observations: input.baselineReferencesByAgentId?.[agentId],
              finalStats: input.finalStatsByAgentId?.[agentId],
            }),
          },
        ] as const,
      ]
    }),
  )
  const evaluatedEntries = entries.map((blueprint) => {
    const provider = memberById.get(blueprint.providerAgentId)!
    if (blueprint.numericExpression.todoBoundary?.startsWith('reconciliation_drift:'))
      return {
        effectKey: blueprint.effectKey,
        status: 'unsupported' as const,
        blockers: [blueprint.numericExpression.todoBoundary],
      }
    const provided = input.baselineReferencesByAgentId?.[blueprint.providerAgentId] ?? {}
    const requiredExplicit = blueprint.numericExpression.requiredExplicitRuntimeReferences ?? []
    if (
      requiredExplicit.length &&
      !knownInactivePlanningEffect32(blueprint, provider, provided, input.memberIds)
    ) {
      const sourceDefaults = getCurrentAgentDecisionMechanicContract(provider.agentId)!
        .effectContract.runtimeDefaults.references
      const missing = requiredExplicit.filter((reference) => {
        const value = provided[reference]
        const maximum =
          reference === 'elation'
            ? Number(sourceDefaults['dm.ability.stacks'])
            : Number.POSITIVE_INFINITY
        return (
          !Object.hasOwn(provided, reference) ||
          typeof value !== 'number' ||
          !Number.isInteger(value) ||
          value < 0 ||
          value > maximum ||
          Number.isNaN(maximum)
        )
      })
      if (missing.length)
        return {
          effectKey: blueprint.effectKey,
          status: 'unsupported' as const,
          blockers: [`缺少合法的明确观测，不能用中性零值代替：${missing.join(', ')}`],
        }
    }
    const target =
      input.members.find((member) => member.agentId !== blueprint.providerAgentId) ?? provider
    const extracted = extractUpstreamEffectValueIr(blueprint.numericExpression.expressionIr)
    if (extracted.status === 'unsupported')
      return {
        effectKey: blueprint.effectKey,
        status: 'unsupported' as const,
        blockers: extracted.blockers,
      }
    const metadata = effectReceiverMetadata(blueprint.numericExpression.expressionIr)
    const observation = planningEffectObservation32({
      entry: blueprint,
      expression: extracted.value as UpstreamExpressionIR,
      member: provider,
      memberIds: input.memberIds,
      references: provided,
    })
    const expression = observation.expression
    const isUnboundGenericPlaceholder =
      blueprint.numericExpression.sourceStatus === 'declarative_baseline_input' &&
      !parameterKeys.has(blueprint.effectKey) &&
      !potentialValueOnlyKeys.has(blueprint.effectKey)
    if (isUnboundGenericPlaceholder || observation.missing.length) {
      const provided = input.baselineReferencesByAgentId?.[blueprint.providerAgentId] ?? {}
      const required = new Set(requiredReferences(expression))
      const selectedReferences = Object.keys(provided).filter((reference) =>
        required.has(reference),
      )
      if (isUnboundGenericPlaceholder && selectedReferences.length > 0)
        return {
          effectKey: blueprint.effectKey,
          status: 'unsupported' as const,
          blockers: [`通用占位效果缺少具体来源事实，不能选择：${selectedReferences.join(', ')}`],
        }
      return {
        effectKey: blueprint.effectKey,
        providerAgentId: blueprint.providerAgentId,
        effectId: blueprint.effectId,
        applicationScope: blueprint.applicationScope ?? 'generic',
        targetKinds: blueprint.targetKinds,
        receiverPath: metadata.receiverPath,
        damageType: metadata.damageType,
        status: 'excluded_unknown' as const,
        active: false as const,
        todoBoundary: blueprint.numericExpression.todoBoundary,
        sourceRefs: blueprint.sourceRefs,
      }
    }
    const providerRuntime = providerRuntimeByAgentId.get(blueprint.providerAgentId)
    if (!providerRuntime)
      return {
        effectKey: blueprint.effectKey,
        status: 'unsupported' as const,
        blockers: [`效果运行时缺少机制合同：${provider.agentId}`],
      }
    const rawReferences = effectRuntimeReferences({
      target: input.finalStatsByAgentId?.[target.agentId]
        ? { ...target, finalStats: input.finalStatsByAgentId[target.agentId] }
        : target,
      baseReferences: providerRuntime.baseReferences,
      requiredReferences: requiredReferences(expression),
    })
    const conversion = bindReviewedRoxyEnergyConversion32({
      agentId: provider.agentId,
      effectId: blueprint.effectId,
      coreLevel: provider.coreLevel,
      source: getCurrentAgentDecisionMechanicContract(provider.agentId)!.effectContract.source,
      expressionSha256: blueprint.numericExpression.expressionSha256,
      references: rawReferences,
    })
    if (conversion.status !== 'supported') return { effectKey: blueprint.effectKey, ...conversion }
    const references = conversion.references
    const reviewedAbilitySource = reviewedInlineAbilityEffectSources[blueprint.effectKey]
    const blockedByReviewedAbility =
      reviewedAbilitySource &&
      providerRuntime.activation.status === 'supported' &&
      !providerRuntime.activation.active
    const evaluated = evaluateUpstreamExpressionIr(
      blockedByReviewedAbility || observation.inactive ? { kind: 'literal', value: 0 } : expression,
      createPlanningExpressionDomainRuntime({
        references,
        teamCounts: { specialty: counts.specialty, faction: counts.faction },
        gates: {
          ability:
            providerRuntime.activation.status === 'supported' && providerRuntime.activation.active,
          directStrike: Boolean(references.directStrike),
          besiege: Boolean(references.besiege),
          besiegeDisplay: Boolean(references.besiegeDisplay),
        },
      }),
    )
    if (evaluated.status === 'unsupported')
      return {
        effectKey: blueprint.effectKey,
        status: 'unsupported' as const,
        blockers: evaluated.blockers,
      }
    const boundRecipient =
      blueprint.effectKey === panMeridianFlowEffectKey32
        ? bindPanMeridianFlowRecipient32({
            value: evaluated.value,
            memberIds: input.memberIds,
            references: provided,
          })
        : null
    if (boundRecipient?.status === 'unsupported')
      return { effectKey: blueprint.effectKey, ...boundRecipient }
    const recipientValues: Array<{ agentId: string; value: unknown }> = []
    if (requiredReferences(expression).some((ref) => ref.startsWith('target.'))) {
      for (const recipient of input.members) {
        const recipientReferences = effectRuntimeReferences({
          target: input.finalStatsByAgentId?.[recipient.agentId]
            ? { ...recipient, finalStats: input.finalStatsByAgentId[recipient.agentId] }
            : recipient,
          baseReferences: providerRuntime.baseReferences,
          requiredReferences: requiredReferences(expression),
        })
        const recipientResult = evaluateUpstreamExpressionIr(
          blockedByReviewedAbility || observation.inactive
            ? { kind: 'literal', value: 0 }
            : expression,
          createPlanningExpressionDomainRuntime({
            references: recipientReferences,
            teamCounts: { specialty: counts.specialty, faction: counts.faction },
            gates: {
              ability:
                providerRuntime.activation.status === 'supported' &&
                providerRuntime.activation.active,
              directStrike: Boolean(recipientReferences.directStrike),
              besiege: Boolean(recipientReferences.besiege),
              besiegeDisplay: Boolean(recipientReferences.besiegeDisplay),
            },
          }),
        )
        if (recipientResult.status === 'unsupported')
          return {
            effectKey: blueprint.effectKey,
            status: 'unsupported' as const,
            blockers: recipientResult.blockers,
          }
        recipientValues.push({ agentId: recipient.agentId, value: recipientResult.value })
      }
    }
    return {
      effectKey: blueprint.effectKey,
      providerAgentId: blueprint.providerAgentId,
      effectId: blueprint.effectId,
      applicationScope: blueprint.applicationScope ?? 'generic',
      targetKinds: blueprint.targetKinds,
      receiverPath: metadata.receiverPath,
      damageType: metadata.damageType,
      status: 'supported' as const,
      value: evaluated.value,
      recipientAgentIds: boundRecipient?.recipientAgentIds,
      recipientValues,
      active:
        !potentialValueOnlyKeys.has(blueprint.effectKey) &&
        ((typeof evaluated.value === 'number' && evaluated.value !== 0) ||
          recipientValues.some((row) => typeof row.value === 'number' && row.value !== 0)),
      todoBoundary: blueprint.numericExpression.todoBoundary,
      sourceRefs: reviewedAbilitySource
        ? [...blueprint.sourceRefs, reviewedAbilitySource]
        : [...blueprint.sourceRefs, ...conversion.sourceRefs],
    }
  })
  // Numeric source parameters are visible to shared consumers but cannot
  // enter effect windows or ordinary damage until their semantics are bound.
  const potentialParameters = evaluatedEntries.filter((entry) => parameterKeys.has(entry.effectKey))
  const results = evaluatedEntries.filter((entry) => !parameterKeys.has(entry.effectKey))
  const runtimeBlockers = evaluatedEntries.flatMap((result) =>
    result.status === 'unsupported'
      ? result.blockers.map((blocker) => `${result.effectKey}: ${blocker}`)
      : [],
  )
  return runtimeBlockers.length
    ? { status: 'unsupported' as const, blockers: unique(runtimeBlockers), results }
    : {
        status: 'supported' as const,
        results,
        potentialParameters,
        runtimeHash: stableContentHash({
          memberIds: input.memberIds,
          results,
          potentialParameters,
        }),
      }
}

export function compileCurrentPlanningFormationEffectObservations(
  input: {
    memberIds: readonly [string, string, string]
    members: readonly PlanningEffectRuntimeMember[]
    baselineReferencesByAgentId?: Readonly<Record<string, Readonly<Record<string, unknown>>>>
  },
  reusedTimeline?: FormationTimeline,
) {
  if (reusedTimeline !== undefined && !isVerifiedFormationTimeline(reusedTimeline, input.memberIds))
    return {
      status: 'unsupported' as const,
      blockers: ['PlanningBaseline timeline 复用需要同一已验证成员绑定与未改写来源合同。'],
    }
  const blueprints = compileFormationPlanningEffectBlueprints(input.memberIds)
  const runtime = evaluateFormationEffects(input, blueprints)
  if (runtime.status === 'unsupported') return runtime
  const timeline =
    reusedTimeline ?? compileCurrentPlanningBaselineTimelineContracts(input.memberIds)
  if (timeline.status === 'unsupported') return timeline
  if (blueprints.status === 'unsupported') return blueprints
  const blueprintByKey = new Map(blueprints.entries.map((entry) => [entry.effectKey, entry]))
  const fieldTime = timeline.contracts.find(
    (contract) => contract.operator === 'field_time_opportunity_cost',
  )
  if (fieldTime?.operator !== 'field_time_opportunity_cost')
    return { status: 'unsupported' as const, blockers: ['PlanningBaseline 缺 field-time 合同。'] }
  const activeAgentId = fieldTime.allocations.toSorted(
    (left, right) => right.activeSeconds - left.activeSeconds,
  )[0]!.agentId
  const baselineRef = `planning-baseline:${currentNormalizedPlanningBaseline.baselineId}:effects`
  const dispositions: PlanningEffectDisposition[] = []
  const contracts: PlanningInteractionContract[] = []
  const blockers: string[] = []
  for (const result of runtime.results) {
    if (result.status === 'unsupported') {
      blockers.push(...result.blockers.map((blocker) => `${result.effectKey}: ${blocker}`))
      continue
    }
    const blueprint = blueprintByKey.get(result.effectKey)!
    if (result.status === 'excluded_unknown') {
      dispositions.push({
        effectKey: result.effectKey,
        disposition: 'excluded_unknown',
        activeSeconds: 0,
        targetAgentId: null,
        reason:
          'The source effect has no explicit condition observation or reviewed source-bound selection; its value remains unknown in this comparison.',
        evidenceRefs: unique([...result.sourceRefs, baselineRef]),
      })
      continue
    }
    if (result.active && result.todoBoundary) {
      blockers.push(
        `${result.effectKey}: 上游 TODO 条件被选中，必须显式补齐 declarative contract。`,
      )
      continue
    }
    const targetAgentId =
      result.recipientAgentIds?.[0] ??
      (blueprint.targetKinds.includes('active_agent') ? activeAgentId : null)
    const evidenceRefs = unique([...result.sourceRefs, baselineRef])
    dispositions.push({
      effectKey: result.effectKey,
      disposition: result.active ? 'included' : 'excluded',
      activeSeconds: result.active ? currentNormalizedPlanningBaseline.declaredDurationSeconds : 0,
      targetAgentId,
      reason: result.active
        ? 'The neutral fixed-event baseline resolves this source expression to a non-zero value for the full declared comparison window.'
        : 'The neutral fixed-event baseline leaves this condition inactive or the account gate evaluates to zero.',
      evidenceRefs,
    })
    if (!result.active) continue
    const recipientAgentIds =
      result.recipientAgentIds ??
      (blueprint.targetKinds.includes('self')
        ? [result.providerAgentId]
        : blueprint.targetKinds.includes('active_agent')
          ? [activeAgentId]
          : [...input.memberIds])
    contracts.push({
      contractId: `${currentNormalizedPlanningBaseline.baselineId}:${result.effectKey}`,
      operator: 'team_effect_resolution',
      authority: 'source_backed',
      sourceRefs: evidenceRefs,
      effectKey: result.effectKey,
      ownerAgentId: result.providerAgentId,
      recipientAgentIds: unique(recipientAgentIds),
      snapshotPolicy: 'recompute_per_event',
      value: result.value as number,
      durationSeconds: currentNormalizedPlanningBaseline.declaredDurationSeconds,
      windows: [
        {
          startSeconds: 0,
          endSeconds: currentNormalizedPlanningBaseline.declaredDurationSeconds,
        },
      ],
    })
  }
  if (blockers.length) return { status: 'unsupported' as const, blockers: unique(blockers) }
  const requiredOperators = contracts.length > 0 ? (['team_effect_resolution'] as const) : []
  const compilation = compileSourceBackedPlanningInteractionContracts({
    memberIds: input.memberIds,
    contracts,
    requiredOperators,
  })
  if (compilation.status === 'unsupported') return compilation
  return {
    status: 'supported' as const,
    dispositions,
    contracts,
    sourceCompilation: compilation,
    effectObservationHash: stableContentHash({ dispositions, contracts }),
  }
}
