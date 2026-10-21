import {
  getCurrentAgentPlanningEffectBlueprint,
  currentAgentPlanningEffectBlueprints,
  type CurrentAgentPlanningEffectBlueprint,
} from './currentAgentPlanningEffectBlueprint'
import { stableContentHash } from '../gameDataPacks/types'
import { getCurrentWEngineStaticData } from '../gameDataPacks/currentWEngineStaticCatalog'
import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'
import { applyReviewedWEngineReceiverSemantics32 } from './reviewedWEngineReceiverSemantics32'
import { applyReviewedSpringEmbraceReceivers32 } from './reviewedSpringEmbraceReceivers32'
import { evaluateCurrentPlanningEffectEntries32 } from './currentPlanningEffectRuntime'
import {
  statReferences,
  planningObservedReferences32,
  type PlanningEffectRuntimeMember,
} from './currentPlanningEffectDomain'
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
  panMeridianFlowIncomingReference32,
} from './currentPlanningDamageModifiers'
import {
  planningRuntimeEffectBuckets32,
  planningRuntimeEffectReceipts32,
} from './currentPlanningSelfEffects32'
import { reduceObservedPlanningEffect32 } from './planningKnownInactiveEffects32'
import { bindReviewedClaretIntrinsicAction32 } from './reviewedClaretIntrinsicAction32'
import { bindReviewedPlanningConditionSemantics32 } from './reviewedPlanningConditionSemantics32'
import { bindReviewedRoxyAttributeWindows32 } from './reviewedRoxyAttributeWindows32'
import { bindReviewedRoxyPreparedTriggers32 } from './reviewedRoxyPreparedTriggers32'
import {
  bindReviewedLuciaHarmonyFinalHit32,
  isReviewedTemplateMechanicEffect32,
} from './reviewedTemplateMechanicEffects32'
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
import { bindPlanningAnomalyLifecycleReferences32 } from './currentPlanningAnomalyLifecycle32'

type EventScope = {
  eventId: string
  targetId?: string
  actionId: string
  skill: string
  damageType?: string
  damageTypes?: readonly string[]
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
  disabledSupportProviderIds?: readonly string[]
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
  const disabledProviders = new Set(input.disabledSupportProviderIds ?? [])
  const activeBuckets = input.buckets.filter((row) => !disabledProviders.has(row.providerAgentId))
  const references: Record<string, Record<string, unknown>> = {}
  for (const id of input.memberIds) {
    const bound = bindPlanningAnomalyLifecycleReferences32({
      references: input.baselineReferencesByAgentId?.[id],
      memberIds: input.memberIds,
      eventId: input.event.eventId,
      ownerAgentId: input.ownerAgentId,
      targetId: input.event.targetId,
      providerAgentId: id,
      providerMindscape: input.members.find((member) => member.agentId === id)?.mindscape,
    })
    if (bound.status !== 'supported') return bound
    references[id] = {
      ...planningObservedReferences32(bound.references),
      ...(common.observation === null ? {} : { windswept: common.observation }),
    }
  }
  for (const bucket of activeBuckets.filter(
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
  const scoped = activeBuckets.filter((bucket) =>
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
  const entries = new Map(
    input.entries
      .filter((entry) => !disabledProviders.has(entry.providerAgentId))
      .map((entry) => [entry.effectKey, entry]),
  )
  // The ordinary production caller historically selected only upstream IR.
  // This reviewed source conversion must participate in the same event DAG.
  if (input.memberIds.includes('agent-norma')) {
    const conversion = getCurrentAgentPlanningEffectBlueprint(
      'agent-norma:reviewed_sheer_force_attack32',
    )!
    entries.set(conversion.effectKey, conversion)
  }
  const refsFor = (entry: CurrentAgentPlanningEffectBlueprint) => {
    const extracted = extractUpstreamEffectValueIr(entry.numericExpression.expressionIr)
    if (extracted.status !== 'supported') return []
    const member = input.members.find((row) => row.agentId === entry.providerAgentId)
    const reduced =
      member &&
      reduceObservedPlanningEffect32(
        entry,
        member,
        references[entry.providerAgentId],
        input.memberIds,
      )
    return requiredReferences(
      reduced?.expression ?? (extracted.value as UpstreamExpressionIR),
    ).filter((ref) => /^(own|target)\.final\./.test(ref) || ref === 'own.combat.crit_dmg_')
  }
  const possibleRecipients = (entry: CurrentAgentPlanningEffectBlueprint) => {
    const meta = effectReceiverMetadata(entry.numericExpression.expressionIr)
    return entry.effectKey === panMeridianFlowEffectKey32
      ? input.memberIds.filter((id) => id !== entry.providerAgentId)
      : recipientIds({ ...entry, memberIds: input.memberIds, receiverPath: meta.receiverPath })
  }
  const demandedStats = () =>
    new Set(
      [...entries.values()].flatMap((entry) =>
        refsFor(entry).flatMap((ref) =>
          ref === 'own.combat.crit_dmg_'
            ? [dependency(entry.providerAgentId, 'combatCritDamage32')]
            : ref.startsWith('own.')
              ? [dependency(entry.providerAgentId, ref.slice(10))]
              : possibleRecipients(entry).map((id) => dependency(id, ref.slice(13))),
        ),
      ),
    )
  const coverage = new Map<string, Set<string>>(
    input.memberIds.flatMap((id) =>
      ['combatCritDamage32', 'sheerForce'].map(
        (stat) => [dependency(id, stat), new Set<string>()] as const,
      ),
    ),
  )
  const donorKeys = new Set<string>()
  // Inventory the actual formation's eligible producers, even when the caller
  // supplies only a consumer. A missing bucket is never a coverage receipt.
  let expanded = true
  while (expanded) {
    expanded = false
    const demanded = demandedStats()
    for (const donor of currentAgentPlanningEffectBlueprints) {
      if (
        !input.memberIds.includes(donor.providerAgentId) ||
        disabledProviders.has(donor.providerAgentId) ||
        (donor.numericExpression.sourceStatus !== 'upstream_expression_available' &&
          !isReviewedTemplateMechanicEffect32(donor))
      )
        continue
      const meta = effectReceiverMetadata(donor.numericExpression.expressionIr)
      const application = applicationForReceiver(meta.receiverPath)
      const stat =
        application === 'sheer_force'
          ? 'sheerForce'
          : application === 'crit_damage' && meta.receiverPath?.includes('.combat.')
            ? 'combatCritDamage32'
            : null
      if (!stat) continue
      const scope = {
        effectKey: donor.effectKey,
        effectId: donor.effectId,
        applicationScope: donor.applicationScope,
        action: null,
        damageType: meta.damageType,
        attribute: effectAttributeForReceiver(meta.receiverPath),
      }
      const recipients = possibleRecipients(donor).filter((id) =>
        id === input.ownerAgentId
          ? matchesEventScope(scope, input.event, input.attribute)
          : !meta.damageType && donor.applicationScope !== 'event_only',
      )
      for (const id of recipients) {
        const key = dependency(id, stat)
        const sources = coverage.get(key) ?? new Set<string>()
        sources.add(donor.effectKey)
        coverage.set(key, sources)
        if (!demanded.has(key)) continue
        donorKeys.add(donor.effectKey)
        if (!entries.has(donor.effectKey)) {
          entries.set(donor.effectKey, donor)
          expanded = true
        }
      }
    }
  }
  for (const entry of entries.values()) {
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
      if (effect?.status === 'excluded_unknown') {
        // Keep the formation's unknown-condition exclusion at the event boundary.
        // An unobserved transfer neither grants a bonus nor declares a recipient.
        semanticExclusions.push({
          effectKey: entry.effectKey,
          reason: '经络舒畅缺少条件观测；本次事件排除未知转交，未计入其增益。',
          fields: ['meridian_flow', panMeridianFlowIncomingReference32],
          sourceRefs: effect.sourceRefs,
        })
        if (donorKeys.has(entry.effectKey)) {
          const producerReceipts = planningRuntimeEffectReceipts32(
            transfer.results,
            input.memberIds,
          )
          nodes.push({
            id: entry.effectKey,
            reads: [],
            writes: possibleRecipients(entry).map((id) => dependency(id, 'sheerForce')),
            evaluate: () => ({ status: 'supported', buckets: [], producerReceipts }),
          })
          actorKeys.add(entry.effectKey)
        }
        continue
      }
      if (effect?.status !== 'supported')
        return { status: 'unsupported' as const, blockers: ['经络舒畅缺少来源绑定。'] }
      declaredRecipientAgentIds = effect.recipientAgentIds
    }
    const extracted = extractUpstreamEffectValueIr(entry.numericExpression.expressionIr)
    if (extracted.status !== 'supported') return extracted
    // Extraction returns a subtree of the already typed source root, not an evaluated scalar.
    const expression = extracted.value as UpstreamExpressionIR
    const refs = refsFor(entry)
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
    const harmony = bindReviewedLuciaHarmonyFinalHit32({
      entry,
      ownerAgentId: input.ownerAgentId,
      event: input.event,
      references: references[entry.providerAgentId],
    })
    if (harmony.status !== 'supported') return harmony
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
      !requiredReferences(expression).some(
        (ref) => /^(own|target)\.final\./.test(ref) || ref === 'own.combat.crit_dmg_',
      ) &&
      !commonDependent &&
      !intrinsic.active &&
      !semantics.active &&
      !harmony.active &&
      !roxyWindow.active &&
      !roxyTrigger.active &&
      !donorKeys.has(entry.effectKey) &&
      !panTransfer
    )
      continue
    const reviewed = getCurrentAgentPlanningEffectBlueprint(entry.effectKey)
    if (
      (entry.numericExpression.sourceStatus !== 'upstream_expression_available' &&
        !isReviewedTemplateMechanicEffect32(entry)) ||
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
    if (semantics.active && ['energy_regen_percent', 'energy_regen_flat'].includes(application))
      semanticExclusions.push({
        effectKey: entry.effectKey,
        reason: '已核验回能条件；保留功能属性依赖，当前固定伤害切片不评价回能收益。',
        fields: ['outside_direct_event_formula'],
        sourceRefs: [...entry.sourceRefs, ...semantics.sourceRefs],
      })
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
    let recipients = recipientIds({
      targetKinds: entry.targetKinds,
      providerAgentId: entry.providerAgentId,
      memberIds: input.memberIds,
      receiverPath: meta.receiverPath,
      effectKey: entry.effectKey,
      declaredRecipientAgentIds,
    })
    if (panTransfer && donorKeys.has(entry.effectKey) && !recipients.length)
      recipients = possibleRecipients(entry)
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
        ref === 'own.combat.crit_dmg_'
          ? [dependency(entry.providerAgentId, 'combatCritDamage32')]
          : ref.startsWith('own.')
            ? [dependency(entry.providerAgentId, ref.slice(10))]
            : recipients.map((id) => dependency(id, ref.slice(13))),
      ),
      writes: planningEffectWrittenStats32({
        application,
        recipientAgentIds:
          panTransfer && donorKeys.has(entry.effectKey) ? possibleRecipients(entry) : recipients,
        receiverPath: meta.receiverPath,
      }),
      evaluate: (stats) => {
        const combatCritDamage = stats[entry.providerAgentId]?.combatCritDamage32
        const result = evaluateCurrentPlanningEffectEntries32(
          {
            memberIds: input.memberIds,
            members: input.members,
            baselineReferencesByAgentId:
              intrinsic.active ||
              semantics.active ||
              roxyWindow.active ||
              roxyTrigger.active ||
              combatCritDamage !== undefined
                ? {
                    ...references,
                    [entry.providerAgentId]: {
                      ...references[entry.providerAgentId],
                      ...semantics.overrides,
                      ...roxyWindow.overrides,
                      ...roxyTrigger.overrides,
                      ...(intrinsic.active ? { crimsonInscription: true } : {}),
                      ...(combatCritDamage === undefined
                        ? {}
                        : { 'own.combat.crit_dmg_': combatCritDamage }),
                    },
                  }
                : references,
            finalStatsByAgentId: stats,
          },
          [entry],
        )
        if (result.status !== 'supported') return result
        for (const effect of result.results.filter((row) => row.status === 'excluded_unknown'))
          semanticExclusions.push({
            effectKey: effect.effectKey,
            reason: '来源效果缺少明确条件观测；本次事件未计入其增益。',
            fields: requiredReferences(expression).filter(
              (ref) =>
                !/^(dm\.|char\.|own\.(initial|final|char)\.|target\.(initial|final|char)\.|team\.common\.count)/.test(
                  ref,
                ) &&
                !Object.hasOwn(references[entry.providerAgentId] ?? {}, ref) &&
                !Object.hasOwn(semantics.overrides, ref),
            ),
            sourceRefs: effect.sourceRefs,
          })
        if (
          result.results.some((row) => row.status === 'supported' && row.active && row.todoBoundary)
        )
          return { status: 'unsupported', blockers: [`来源TODO条件未闭合：${entry.effectKey}`] }
        return {
          status: 'supported',
          producerReceipts: planningRuntimeEffectReceipts32(result.results, input.memberIds),
          buckets: planningRuntimeEffectBuckets32(result.results, input.memberIds).map(
            (bucket) => ({
              ...bucket,
              ...(harmony.active &&
              'valueOverride' in harmony &&
              harmony.valueOverride !== undefined
                ? { value: harmony.valueOverride }
                : {}),
              sourceRefs: [
                ...bucket.sourceRefs,
                ...intrinsic.sourceRefs,
                ...semantics.sourceRefs,
                ...harmony.sourceRefs,
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
    const formulaSha256 = staticSource?.source.formulaSha256
    const specialty = getCurrentAgentEventContract(provider.agentId)?.identity.specialty
    const scope = reviewed
      ? planningWEngineEffectScope(reviewed.path.split('.').slice(1).join('.'), reviewed.action)
      : null
    if (
      !reviewed ||
      !staticSource ||
      staticSource.source.provider === 'nanoka' ||
      !formulaSha256 ||
      staticSource.specialty !== (specialty === 'attack' ? 'damage' : specialty) ||
      !scope ||
      scope.application !== bucket.application ||
      scope.action !== bucket.action ||
      scope.attribute !== bucket.attribute ||
      stableContentHash(reviewed.finalStatReferences) !==
        stableContentHash(source.finalStatReferences) ||
      !bucket.sourceRefs.some((ref) => ref.endsWith(formulaSha256))
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
    producerCoverage: [...coverage].map(([stat, effectKeys]) => ({
      stat,
      effectKeys: [...effectKeys],
    })),
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
