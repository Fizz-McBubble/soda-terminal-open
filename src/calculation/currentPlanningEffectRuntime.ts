import {
  bindPlanningEffectRuntimePotentialReference,
  teamCounts,
  statReferences,
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
import { evaluateInitialCritConversion32 } from './currentInitialCritConversion32'
import { bindReviewedRoxyEnergyConversion32 } from './reviewedRoxyEnergyConversion32'
import { requiredReferences, effectReceiverMetadata } from './currentPlanningEffectExpressions'
import type { CurrentAgentPlanningEffectBlueprint } from './currentAgentPlanningEffectBlueprint'
import type { PlanningEffectRuntimeStats } from './currentPlanningEffectDomain'
import { stableContentHash } from '../gameDataPacks/types'
import { reviewedInlineAbilityEffectSources } from '../gameDataPacks/reviewedTeammateActivationMinimum'
import { getCurrentAgentDecisionMechanicContract } from './currentAgentDecisionMechanicContracts'
import {
  evaluateCurrentAgentTeamActivation,
  getCurrentAgentEventContract,
} from './currentAgentMechanicContracts'
import { compileFormationPlanningEffectBlueprints } from './currentAgentPlanningEffectBlueprint'
import {
  reviewedPotentialEffectBlueprints,
  reviewedPotentialParameterBlueprints,
} from './reviewedPotentialEffectBlueprints'
import { compileCurrentPlanningBaselineTimelineContracts } from './currentPlanningBaselineObservations'
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

/** Typed runtime wrapper around the same pure panel conversion. */
export function evaluateCurrentPlanningInitialCritConversion32(
  member: PlanningEffectRuntimeMember,
) {
  return evaluateInitialCritConversion32({
    agentId: member.agentId,
    initialStats: member.initialStats,
  })
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
            baseReferences: bindPlanningEffectRuntimePotentialReference({
              agentId,
              potential: provider.potential,
              references: {
                ...contract.effectContract.runtimeDefaults.references,
                'char.mindscape': provider.mindscape,
                'char.core': Math.max(0, provider.coreLevel - 1),
                'char.basic': Math.max(0, (provider.skillLevels.basic ?? 1) - 1),
                'char.dodge': Math.max(0, (provider.skillLevels.dodge ?? 1) - 1),
                'char.assist': Math.max(0, (provider.skillLevels.assist ?? 1) - 1),
                'char.special': Math.max(0, (provider.skillLevels.special ?? 1) - 1),
                'char.chain': Math.max(0, (provider.skillLevels.chain ?? 1) - 1),
                'team.common.count': {},
                ...Object.fromEntries(
                  Object.entries(counts.attribute).map(([key, value]) => [
                    `team.common.count.${key}`,
                    value,
                  ]),
                ),
                ...statReferences('own.initial', provider.initialStats),
                ...statReferences('own.final', provider.finalStats),
                ...(input.baselineReferencesByAgentId?.[agentId] ?? {}),
                ...(provider.level === undefined ? {} : { 'char.lvl': provider.level }),
                ...(input.finalStatsByAgentId?.[agentId]
                  ? statReferences('own.final', input.finalStatsByAgentId[agentId])
                  : {}),
                'char.specialty': getCurrentAgentEventContract(agentId)?.identity.specialty,
              },
            }),
          },
        ] as const,
      ]
    }),
  )
  const evaluatedEntries = entries.map((blueprint) => {
    const provider = memberById.get(blueprint.providerAgentId)!
    const target =
      input.members.find((member) => member.agentId !== blueprint.providerAgentId) ?? provider
    const extracted = extractUpstreamEffectValueIr(blueprint.numericExpression.expressionIr)
    if (extracted.status === 'unsupported')
      return {
        effectKey: blueprint.effectKey,
        status: 'unsupported' as const,
        blockers: extracted.blockers,
      }
    const expression = extracted.value as UpstreamExpressionIR
    const metadata = effectReceiverMetadata(blueprint.numericExpression.expressionIr)
    const isUnboundGenericPlaceholder =
      blueprint.numericExpression.sourceStatus === 'declarative_baseline_input' &&
      !parameterKeys.has(blueprint.effectKey) &&
      !potentialValueOnlyKeys.has(blueprint.effectKey)
    if (isUnboundGenericPlaceholder) {
      const provided = input.baselineReferencesByAgentId?.[blueprint.providerAgentId] ?? {}
      const required = new Set(requiredReferences(expression))
      const selectedReferences = Object.keys(provided).filter((reference) =>
        required.has(reference),
      )
      if (selectedReferences.length > 0)
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
      blockedByReviewedAbility ? { kind: 'literal', value: 0 } : expression,
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
          blockedByReviewedAbility ? { kind: 'literal', value: 0 } : expression,
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

export function compileCurrentPlanningFormationEffectObservations(input: {
  memberIds: readonly [string, string, string]
  members: readonly PlanningEffectRuntimeMember[]
  baselineReferencesByAgentId?: Readonly<Record<string, Readonly<Record<string, unknown>>>>
}) {
  const blueprints = compileFormationPlanningEffectBlueprints(input.memberIds)
  const runtime = evaluateFormationEffects(input, blueprints)
  if (runtime.status === 'unsupported') return runtime
  const timeline = compileCurrentPlanningBaselineTimelineContracts(input.memberIds)
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
          'The upstream generic conditional has no reviewed source-bound selection, so its value is unknown and excluded from this comparison.',
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
    const targetAgentId = blueprint.targetKinds.includes('active_agent') ? activeAgentId : null
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
    const recipientAgentIds = blueprint.targetKinds.includes('self')
      ? [result.providerAgentId]
      : blueprint.targetKinds.includes('active_agent')
        ? [activeAgentId]
        : [...input.memberIds]
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
