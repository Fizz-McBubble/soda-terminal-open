import {
  getCurrentAgentPlanningEffectBlueprint,
  type CurrentAgentPlanningEffectBlueprint,
} from './currentAgentPlanningEffectBlueprint'
import { stableContentHash } from '../gameDataPacks/types'
import { getCurrentWEngineStaticData } from '../gameDataPacks/currentWEngineStaticCatalog'
import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'
import { applyReviewedWEngineReceiverSemantics32 } from './reviewedWEngineReceiverSemantics32'
import { applyReviewedSpringEmbraceReceivers32 } from './reviewedSpringEmbraceReceivers32'
import { evaluateCurrentPlanningEffectEntries32 } from './currentPlanningEffectRuntime'
import { statReferences, type PlanningEffectRuntimeMember } from './currentPlanningEffectDomain'
import {
  effectReceiverMetadata,
  effectAttributeForReceiver,
  requiredReferences,
} from './currentPlanningEffectExpressions'
import {
  extractUpstreamEffectValueIr,
  type UpstreamExpressionIR,
} from './currentUpstreamExpressionIR'
import {
  applicationForReceiver,
  recipientIds,
  matchesEventScope,
  type SourceBackedPlanningEffectBucket,
  bindPanMeridianFlowRecipient32,
  panMeridianFlowEffectKey32,
} from './currentPlanningDamageModifiers'
import { planningRuntimeEffectBuckets32 } from './currentPlanningSelfEffects32'
import { bindReviewedClaretIntrinsicAction32 } from './reviewedClaretIntrinsicAction32'
import { bindReviewedPlanningConditionSemantics32 } from './reviewedPlanningConditionSemantics32'
import { bindReviewedRoxyAttributeWindows32 } from './reviewedRoxyAttributeWindows32'
import { bindReviewedRoxyPreparedTriggers32 } from './reviewedRoxyPreparedTriggers32'
import {
  planningEffectWrittenStats32,
  planningFinalStatAlias32,
  resolvePlanningEffectGraph32,
  type PlanningEffectGraphNode32,
} from './currentPlanningEffectGraph32'
import { bindCurrentWEngineFormulaRuntime } from './currentWEnginePersonalPlanningEffects'
import {
  getCurrentFormulaWEngineEffectEntries,
  resolveCurrentFormulaWEngineContract,
} from './currentFormulaMechanicContracts'
import { planningWEngineEffectScope } from './currentPlanningWEngineDependencies32'
import {
  compileCommonAnomalyEventEffects32,
  type CommonAnomalyEventObservation32,
} from './currentCommonAnomalyEffects32'
import {
  evaluateReviewedDriveDiscFinalNode32,
  deduplicateReviewedDriveDiscEffects32,
} from './reviewedDriveDiscEventEffects32'

type EventScope = {
  eventId: string
  actionId: string
  skill: string
  damageType?: string
  eventModifierRefs?: readonly string[]
}
const dependency = (agentId: string, stat: string) =>
  `${agentId}:${planningFinalStatAlias32[stat] ?? stat}`

/** Source callbacks read the same event-final panel; their outputs are admitted only once. */
export function resolveCurrentPlanningEventEffects32(input: {
  memberIds: readonly string[]
  members: readonly PlanningEffectRuntimeMember[]
  ownerAgentId: string
  event: EventScope
  attribute: string
  buckets: readonly SourceBackedPlanningEffectBucket[]
  entries: readonly CurrentAgentPlanningEffectBlueprint[]
  baselineReferencesByAgentId?: Readonly<Record<string, Readonly<Record<string, unknown>>>>
  commonAnomalyObservations?: readonly CommonAnomalyEventObservation32[]
}) {
  const common = compileCommonAnomalyEventEffects32({
    eventId: input.event.eventId,
    memberIds: input.memberIds,
    observations: input.commonAnomalyObservations,
  })
  if (common.status !== 'supported') return common
  if (
    new Set(input.memberIds).size !== input.memberIds.length ||
    !input.memberIds.includes(input.ownerAgentId) ||
    input.buckets.some((row) =>
      row.recipientAgentIds.some((id) => !input.members.some((member) => member.agentId === id)),
    )
  )
    return { status: 'unsupported' as const, blockers: ['事件效果缺少唯一真实成员或受益者。'] }
  const references = Object.fromEntries(
    input.memberIds.map((id) => [
      id,
      {
        ...input.baselineReferencesByAgentId?.[id],
        ...(common.observation === null ? {} : { windswept: common.observation }),
      },
    ]),
  )
  for (const bucket of input.buckets.filter(
    (row) => row.effectKey === panMeridianFlowEffectKey32,
  )) {
    const bound = bindPanMeridianFlowRecipient32({
      value: bucket.value,
      memberIds: input.memberIds,
      references: references[bucket.providerAgentId],
    })
    if (bound.status !== 'supported') return bound
    if (
      bucket.value !== 0 &&
      (bucket.providerAgentId !== 'agent-pan-yinhu' ||
        bucket.recipientAgentIds.length !== 1 ||
        bucket.recipientAgentIds[0] !== bound.recipientAgentIds[0])
    )
      return {
        status: 'unsupported' as const,
        blockers: ['经络舒畅事件桶与唯一入场受益者不一致。'],
      }
  }
  // Stat dependencies can use another member's unconditional combat stat, but cannot infer that member's action.
  const scoped = input.buckets.filter((bucket) =>
    bucket.recipientAgentIds.includes(input.ownerAgentId)
      ? matchesEventScope(bucket, input.event, input.attribute)
      : !bucket.action && !bucket.damageType && bucket.applicationScope !== 'event_only',
  )
  const nodes: PlanningEffectGraphNode32[] = []
  const semanticExclusions: Array<{
    effectKey: string
    reason: string
    fields: string[]
    sourceRefs: string[]
  }> = []
  const actorKeys = new Set<string>()
  for (const entry of input.entries) {
    const panTransfer = entry.effectKey === panMeridianFlowEffectKey32
    let declaredRecipientAgentIds: readonly string[] | undefined
    if (panTransfer) {
      const transfer = evaluateCurrentPlanningEffectEntries32(
        {
          memberIds: input.memberIds,
          members: input.members,
          baselineReferencesByAgentId: references,
        },
        [entry],
      )
      if (transfer.status !== 'supported') return transfer
      const effect = transfer.results.find((row) => row.effectKey === entry.effectKey)
      if (effect?.status !== 'supported')
        return { status: 'unsupported' as const, blockers: ['经络舒畅缺少来源绑定。'] }
      declaredRecipientAgentIds = effect.recipientAgentIds
    }
    const extracted = extractUpstreamEffectValueIr(entry.numericExpression.expressionIr)
    if (extracted.status !== 'supported') return extracted
    // Extraction returns a subtree of the already typed source root, not an evaluated scalar.
    const expression = extracted.value as UpstreamExpressionIR
    const refs = requiredReferences(expression).filter((ref) => /^(own|target)\.final\./.test(ref))
    // Explicit common state can activate a previously neutral character Windswept branch.
    const commonDependent =
      common.observation !== null && requiredReferences(expression).includes('windswept')
    const intrinsic = bindReviewedClaretIntrinsicAction32({
      ownerAgentId: input.ownerAgentId,
      entry,
      event: input.event,
      attribute: input.attribute,
    })
    if (intrinsic.status !== 'supported') return intrinsic
    const semantics = bindReviewedPlanningConditionSemantics32({
      entry,
      references: references[entry.providerAgentId],
      potential: input.members.find((member) => member.agentId === entry.providerAgentId)
        ?.potential,
      event: { ownerAgentId: input.ownerAgentId, eventModifierRefs: input.event.eventModifierRefs },
    })
    if (semantics.status !== 'supported') return semantics
    const roxyWindow = bindReviewedRoxyAttributeWindows32({
      entry,
      references: references[entry.providerAgentId],
      attribute: input.attribute,
      windsweptObserved: common.observation ?? undefined,
    })
    if (roxyWindow.status !== 'supported') return roxyWindow
    const roxyTrigger = bindReviewedRoxyPreparedTriggers32({
      entry,
      ownerAgentId: input.ownerAgentId,
      eventId: input.event.eventId,
      references: references[entry.providerAgentId],
    })
    if (roxyTrigger.status !== 'supported') return roxyTrigger
    if (
      !refs.length &&
      !commonDependent &&
      !intrinsic.active &&
      !semantics.active &&
      !roxyWindow.active &&
      !roxyTrigger.active &&
      !panTransfer
    )
      continue
    const reviewed = getCurrentAgentPlanningEffectBlueprint(entry.effectKey)
    if (
      entry.numericExpression.sourceStatus !== 'upstream_expression_available' ||
      !reviewed ||
      entry.providerAgentId !== reviewed.providerAgentId ||
      entry.effectId !== reviewed.effectId ||
      !input.members.some((member) => member.agentId === entry.providerAgentId) ||
      entry.numericExpression.expressionSha256 !== reviewed.numericExpression.expressionSha256 ||
      stableContentHash(entry.numericExpression.expressionIr) !==
        stableContentHash(reviewed.numericExpression.expressionIr)
    )
      return {
        status: 'unsupported' as const,
        blockers: [`事件效果表达式缺少锁定来源：${entry.effectKey}`],
      }
    const meta = effectReceiverMetadata(entry.numericExpression.expressionIr)
    const application = applicationForReceiver(meta.receiverPath)
    if (application === 'outside_direct_event_formula') {
      if (semantics.active)
        semanticExclusions.push({
          effectKey: entry.effectKey,
          reason: '已核验条件语义；当前直接伤害切片未纳入回能或其他非直接伤害域。',
          fields: ['outside_direct_event_formula'],
          sourceRefs: [...entry.sourceRefs, ...semantics.sourceRefs],
        })
      continue
    }
    const recipients = recipientIds({
      targetKinds: entry.targetKinds,
      providerAgentId: entry.providerAgentId,
      memberIds: input.memberIds,
      receiverPath: meta.receiverPath,
      effectKey: entry.effectKey,
      declaredRecipientAgentIds,
    })
    const scope = {
      effectKey: entry.effectKey,
      effectId: entry.effectId,
      applicationScope: entry.applicationScope,
      action: null,
      damageType: meta.damageType,
      attribute: effectAttributeForReceiver(meta.receiverPath),
    }
    if (
      recipients.includes(input.ownerAgentId) &&
      !matchesEventScope(scope, input.event, input.attribute)
    )
      continue
    if (
      !recipients.includes(input.ownerAgentId) &&
      (meta.damageType || entry.applicationScope === 'event_only')
    )
      continue
    actorKeys.add(entry.effectKey)
    nodes.push({
      id: entry.effectKey,
      reads: refs.flatMap((ref) =>
        ref.startsWith('own.')
          ? [dependency(entry.providerAgentId, ref.slice(10))]
          : recipients.map((id) => dependency(id, ref.slice(13))),
      ),
      writes: planningEffectWrittenStats32({ application, recipientAgentIds: recipients }),
      evaluate: (stats) => {
        const result = evaluateCurrentPlanningEffectEntries32(
          {
            memberIds: input.memberIds,
            members: input.members,
            baselineReferencesByAgentId:
              intrinsic.active || semantics.active || roxyWindow.active || roxyTrigger.active
                ? {
                    ...references,
                    [entry.providerAgentId]: {
                      ...references[entry.providerAgentId],
                      ...semantics.overrides,
                      ...roxyWindow.overrides,
                      ...roxyTrigger.overrides,
                      ...(intrinsic.active ? { crimsonInscription: true } : {}),
                    },
                  }
                : references,
            finalStatsByAgentId: stats,
          },
          [entry],
        )
        if (result.status !== 'supported') return result
        if (
          result.results.some((row) => row.status === 'supported' && row.active && row.todoBoundary)
        )
          return { status: 'unsupported', blockers: [`来源TODO条件未闭合：${entry.effectKey}`] }
        return {
          status: 'supported',
          buckets: planningRuntimeEffectBuckets32(result.results, input.memberIds).map(
            (bucket) => ({
              ...bucket,
              sourceRefs: [
                ...bucket.sourceRefs,
                ...intrinsic.sourceRefs,
                ...semantics.sourceRefs,
                ...roxyWindow.sourceRefs,
                ...roxyTrigger.sourceRefs,
              ],
            }),
          ),
        }
      },
    })
  }
  const fixed = scoped.filter(
    (bucket) =>
      !actorKeys.has(bucket.effectKey) && !bucket.sourceFormula && !bucket.sourceDiscFormula,
  )
  const uniqueFixed = deduplicateReviewedDriveDiscEffects32(fixed)
  if (uniqueFixed.status !== 'supported') return uniqueFixed
  for (const bucket of scoped.filter((row) => row.sourceDiscFormula)) {
    if (!input.members.some((member) => member.agentId === bucket.providerAgentId))
      return { status: 'unsupported' as const, blockers: ['四件套来源节点缺少真实成员。'] }
    nodes.push({
      id: `${bucket.bucketId}:${bucket.recipientAgentIds.join(',')}`,
      reads: [dependency(bucket.providerAgentId, 'crit_')],
      writes: planningEffectWrittenStats32(bucket),
      evaluate: (stats) => evaluateReviewedDriveDiscFinalNode32(bucket, stats),
    })
  }
  for (const bucket of scoped.filter((row) => row.sourceFormula)) {
    const source = bucket.sourceFormula!
    const provider = input.members.find((member) => member.agentId === bucket.providerAgentId)
    if (!provider)
      return { status: 'unsupported' as const, blockers: ['音擎来源节点缺少真实成员。'] }
    const reviewed = getCurrentFormulaWEngineEffectEntries(source.engineId).find(
      (row) => row.effectIndex === source.effectIndex,
    )
    const staticSource = getCurrentWEngineStaticData(source.engineId)
    const specialty = getCurrentAgentEventContract(provider.agentId)?.identity.specialty
    const scope = reviewed
      ? planningWEngineEffectScope(reviewed.path.split('.').slice(1).join('.'), reviewed.action)
      : null
    if (
      !reviewed ||
      !staticSource ||
      staticSource.specialty !== (specialty === 'attack' ? 'damage' : specialty) ||
      !scope ||
      scope.application !== bucket.application ||
      scope.action !== bucket.action ||
      scope.attribute !== bucket.attribute ||
      stableContentHash(reviewed.finalStatReferences) !==
        stableContentHash(source.finalStatReferences) ||
      !bucket.sourceRefs.some((ref) => ref.endsWith(staticSource.source.formulaSha256))
    )
      return {
        status: 'unsupported' as const,
        blockers: ['音擎最终属性来源描述与锁定公式不一致。'],
      }
    nodes.push({
      id: `${bucket.bucketId}:${bucket.recipientAgentIds.join(',')}`,
      reads: source.finalStatReferences.flatMap((ref) =>
        ref.startsWith('own.')
          ? [dependency(provider.agentId, ref.slice(10))]
          : bucket.recipientAgentIds.map((id) => dependency(id, ref.slice(13))),
      ),
      writes: planningEffectWrittenStats32(bucket),
      evaluate: (stats) => {
        const bound = bindCurrentWEngineFormulaRuntime({
          agentId: provider.agentId,
          engineId: source.engineId,
          member: provider,
          runtime: source.runtime,
          targetAgentId: bucket.recipientAgentIds[0],
          eventFinalStats: stats[provider.agentId],
        })
        if (bound.blockers.length) return { status: 'unsupported', blockers: bound.blockers }
        const numbers = {
          ...bound.numbers,
          ...Object.fromEntries(
            Object.entries(
              statReferences('target.final', stats[bucket.recipientAgentIds[0]!]!),
            ).filter((entry): entry is [string, number] => typeof entry[1] === 'number'),
          ),
        }
        const result = resolveCurrentFormulaWEngineContract({
          stableId: source.engineId,
          refinement: source.refinement,
          specialtyMatches: true,
          runtimePolicy: 'strict',
          runtime: { ...bound, numbers },
          effectIndices: [source.effectIndex],
        })
        if (result.status !== 'supported') return result
        const value = result.effects[0]?.value ?? 0
        return typeof value !== 'number' || !Number.isFinite(value)
          ? { status: 'unsupported', blockers: ['音擎最终属性表达式无效。'] }
          : { status: 'supported', buckets: [{ ...bucket, value }] }
      },
    })
  }
  const result = resolvePlanningEffectGraph32({
    members: input.members,
    buckets: [
      ...uniqueFixed.buckets.filter(
        (row) => row.effectKey !== 'common:anomaly:windswept_direct_dmg_',
      ),
      ...common.buckets,
    ],
    nodes,
  })
  if (result.status !== 'supported') return result
  const uniqueDiscs = deduplicateReviewedDriveDiscEffects32(result.buckets)
  if (uniqueDiscs.status !== 'supported') return uniqueDiscs
  const equipment = uniqueDiscs.buckets
    .filter((row) => row.receiverPath === null && row.damageType === null)
    .map((row) => ({ ...row, receiverPath: null, damageType: null }))
  const springReceivers = applyReviewedSpringEmbraceReceivers32(equipment)
  const receivers = applyReviewedWEngineReceiverSemantics32(springReceivers.buckets)
  return {
    ...result,
    buckets: [
      ...uniqueDiscs.buckets.filter((row) => row.receiverPath !== null || row.damageType !== null),
      ...receivers.buckets,
    ],
    exclusions: [...springReceivers.exclusions, ...receivers.exclusions, ...semanticExclusions],
  }
}
