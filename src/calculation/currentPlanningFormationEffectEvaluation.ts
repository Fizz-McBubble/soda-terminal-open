import {
  planningProviderReferences32,
  teamCounts,
  effectRuntimeReferences,
  planningObservedReferences32,
} from './currentPlanningEffectDomain'
import { bindReviewedRoxyEnergyConversion32 } from './reviewedRoxyEnergyConversion32'
import { knownInactivePlanningEffect32 } from './planningKnownInactiveEffects32'
import {
  isReviewedTemplateMechanicEffect32,
  validateReviewedTemplateMechanicObservations32,
} from './reviewedTemplateMechanicEffects32'
import { planningEffectObservation32 } from './currentPlanningEffectObservation32'
import {
  bindPanMeridianFlowRecipient32,
  panMeridianFlowEffectKey32,
} from './currentPlanningDamageModifiers'
import {
  bindPlanningSkillLevelValueReferences32,
  requiredReferences,
  effectReceiverMetadata,
} from './currentPlanningEffectExpressions'
import { stableContentHash } from '../gameDataPacks/types'
import { reviewedInlineAbilityEffectSources } from '../gameDataPacks/reviewedTeammateActivationMinimum'
import { getCurrentAgentDecisionMechanicContract } from './currentAgentDecisionMechanicContracts'
import { evaluateCurrentAgentTeamActivation } from './currentAgentMechanicContracts'
import { compileFormationPlanningEffectBlueprints } from './currentAgentPlanningEffectBlueprint'
import {
  reviewedPotentialEffectBlueprints,
  reviewedPotentialParameterBlueprints,
} from './reviewedPotentialEffectBlueprints'
import {
  createPlanningExpressionDomainRuntime,
  evaluateUpstreamExpressionIr,
  extractUpstreamEffectValueIr,
  type UpstreamExpressionIR,
} from './currentUpstreamExpressionIR'
import type { evaluateCurrentPlanningEffectEntries32 } from './currentPlanningEffectRuntime'
import { bindPlanningAnomalyLifecycleReferences32 } from './currentPlanningAnomalyLifecycle32'
// Legacy expressions retain source values; only the shared per-event potential
// binding activates them. A level is not proof that an action occurred.
const potentialValueOnlyKeys = new Set(
  reviewedPotentialEffectBlueprints.map((entry) => entry.effectKey),
)

export function unique(values: readonly string[]) {
  return [...new Set(values)]
}

export function evaluateFormationEffects(
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

  const lifecycleSources = new Map<string, string[]>()
  const observedReferences: Record<string, Record<string, unknown>> = {}
  for (const agentId of input.memberIds) {
    const bound = bindPlanningAnomalyLifecycleReferences32({
      references: input.baselineReferencesByAgentId?.[agentId],
      memberIds: input.memberIds,
      providerAgentId: agentId,
      providerMindscape: memberById.get(agentId)?.mindscape,
    })
    if (bound.status !== 'supported')
      return { status: 'unsupported' as const, blockers: bound.blockers }
    observedReferences[agentId] = bound.references
    lifecycleSources.set(agentId, bound.sourceRefs)
  }
  input = { ...input, baselineReferencesByAgentId: observedReferences }

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
    const provided = planningObservedReferences32(
      input.baselineReferencesByAgentId?.[blueprint.providerAgentId],
    )
    const observationValidity = validateReviewedTemplateMechanicObservations32({
      entry: blueprint,
      references: provided,
    })
    if (observationValidity.status !== 'supported')
      return {
        effectKey: blueprint.effectKey,
        status: 'unsupported' as const,
        blockers: observationValidity.blockers,
      }
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
    // Reconciled IR already encodes any effective-level offset against the
    // generic zero-based skill references.
    const expression =
      blueprint.numericExpression.originalSource ||
      // Lucia's Harmony source expression deliberately consumes its
      // zero-based `char.special` coordinate. Binding the effective UI level
      // here would add one table step (4,900 instead of 4,600 at Lv5).
      blueprint.effectKey === 'agent-lucia:exSpecial_harmony_dmg_'
        ? observation.expression
        : bindPlanningSkillLevelValueReferences32({
            expression: observation.expression,
            provider,
          })
    const isUnboundGenericPlaceholder =
      blueprint.numericExpression.sourceStatus === 'declarative_baseline_input' &&
      !isReviewedTemplateMechanicEffect32(blueprint) &&
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
        missing: observation.missing,
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
    // Formation evaluation precedes the event DAG. A missing final-stat
    // producer must remain unknown here so that the actual event can resolve it.
    const missingFinal = requiredReferences(expression).filter(
      (ref) =>
        /^(own|target)\.final\./.test(ref) &&
        (typeof rawReferences[ref] !== 'number' || !Number.isFinite(rawReferences[ref])),
    )
    if (!observation.inactive && missingFinal.length)
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
        missing: missingFinal,
        todoBoundary: blueprint.numericExpression.todoBoundary,
        sourceRefs: blueprint.sourceRefs,
      }
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
      sourceRefs: [
        ...blueprint.sourceRefs,
        ...(reviewedAbilitySource ? [reviewedAbilitySource] : conversion.sourceRefs),
        ...(lifecycleSources.get(blueprint.providerAgentId) ?? []),
      ],
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
