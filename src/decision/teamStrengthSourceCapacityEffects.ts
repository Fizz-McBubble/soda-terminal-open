import { currentAgentPlanningEffectBlueprints } from '../calculation/currentAgentPlanningEffectBlueprint'
import { getCurrentAgentDecisionMechanicContract } from '../calculation/currentAgentDecisionMechanicContracts'
import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import { projectCurrentPlanningConditionCatalog32 } from '../calculation/currentPlanningConditionCatalog32'
import {
  effectRuntimeReferences,
  planningProviderReferences32,
} from '../calculation/currentPlanningEffectDomain'
import {
  bindPlanningSkillLevelValueReferences32,
  effectReceiverMetadata,
  effectAttributeForReceiver,
  requiredReferences,
} from '../calculation/currentPlanningEffectExpressions'
import {
  createPlanningExpressionDomainRuntime,
  evaluateUpstreamExpressionIr,
  extractUpstreamEffectValueIr,
  type UpstreamExpressionIR,
} from '../calculation/currentUpstreamExpressionIR'
import {
  applicationForReceiver,
  recipientIds,
  type SourceBackedPlanningEffectBucket,
} from '../calculation/currentPlanningDamageModifiers'
import { bindReviewedRoxyAttributeWindows32 } from '../calculation/reviewedRoxyAttributeWindows32'
import { bindReviewedPlanningConditionSemantics32 } from '../calculation/reviewedPlanningConditionSemantics32'
import { isReviewedTemplateMechanicEffect32 } from '../calculation/reviewedTemplateMechanicEffects32'
import {
  capabilityFor,
  recipientCompatible,
  type SupportRecipientContext,
} from './teamStrengthSupportCapabilities'
import { baseReferenceExpression } from './teamStrengthSupportExpression'
import { bindReviewedRoxyEnergyConversion32 } from '../calculation/reviewedRoxyEnergyConversion32'
import {
  sourcePlanningAftershockCapacity32,
  sourcePlanningAftershock32,
} from '../calculation/currentPotentialEventActions32'
import { teamStrengthSourceConditionDomain } from './teamStrengthSourceConditionDomains'
import { resolvePlanningEventSheerForce32 } from '../calculation/currentSourceBoundSheerForce32'
import { resolveCurrentPlanningEventEffects32 } from '../calculation/currentPlanningEventEffectResolution32'
import type { TeamStrengthCapacityContext } from './teamStrengthSourceCapacityActions'
import type {
  CapacityEffect,
  TeamStrengthCapacityBucketRow,
} from './teamStrengthSourceCapacityPolicy'
import { bindPlanningAnomalyLifecycleReferences32 } from '../calculation/currentPlanningAnomalyLifecycle32'
import { planningAnomalyLifecycleEffectInactive32 } from '../calculation/currentPlanningAnomalyLifecycleIdentity32'
import { bindReviewedPotentialApplications } from '../calculation/potentialApplicationBinding'
const conditionCache = new Map<
  string,
  ReturnType<typeof projectCurrentPlanningConditionCatalog32>
>()
const entriesById = new Map<string, (typeof currentAgentPlanningEffectBlueprints)[number][]>()
for (const entry of currentAgentPlanningEffectBlueprints) {
  const rows = entriesById.get(entry.providerAgentId) ?? []
  rows.push(entry)
  entriesById.set(entry.providerAgentId, rows)
}
function domains(id: string) {
  let result = conditionCache.get(id)
  if (!result) {
    result = projectCurrentPlanningConditionCatalog32({ subjectAgentId: id, memberIds: [id] })
    conditionCache.set(id, result)
  }
  return result
}
function booleanGates(expression: UpstreamExpressionIR): Set<string> {
  const result = new Set<string>()
  const visit = (node: UpstreamExpressionIR) => {
    if (node.kind === 'call') {
      if (['ifOn', 'ifOff'].includes(node.operator) && node.receiver?.kind === 'reference')
        result.add(node.receiver.path)
      if (
        node.operator === 'cmpEq' &&
        node.arguments[0]?.kind === 'reference' &&
        node.arguments[1]?.kind === 'literal' &&
        typeof node.arguments[1].value === 'boolean'
      )
        result.add(node.arguments[0].path)
      if (node.receiver) visit(node.receiver)
      node.arguments.forEach(visit)
    } else if (node.kind === 'array') node.items.forEach(visit)
    else if (node.kind === 'object') node.entries.forEach((entry) => visit(entry.value))
    else if (node.kind === 'element') {
      visit(node.receiver)
      visit(node.index)
    } else if (node.kind === 'property') visit(node.receiver)
  }
  visit(expression)
  return result
}
export function projectTeamStrengthSourceEffects(
  context: TeamStrengthCapacityContext,
  abilityById: ReadonlyMap<string, boolean>,
  recipientContext: SupportRecipientContext,
) {
  const { members, conditions, ids, runtime, contactRuntime, counts, contactValue, gaps } = context
  const effects: CapacityEffect[] = []
  const bucketRows: TeamStrengthCapacityBucketRow[] = []
  const deferred: {
    entry: (typeof currentAgentPlanningEffectBlueprints)[number]
    recipientAgentId: string
    conditions: Record<string, unknown>
    sourceRefs: string[]
    channel: string
  }[] = []
  for (const provider of members) {
    // Single-actor recipes make both panels stable under a third-member swap.
    const equippedActor = contactRuntime.get(provider.agentId)!
    // The reference declares supported P6. Rina's unconditional combat PEN
    // feeds her core conversion before it reaches a teammate, just as it does
    // in the event calculator. Initial PEN remains unchanged for conversions
    // explicitly defined on the initial panel.
    const providerEvent = context.contactUsages(provider.agentId)[0]
    const penetration = providerEvent
      ? bindReviewedPotentialApplications({
          member: {
            agentId: provider.agentId,
            potential: equippedActor.potential,
            initialStats: equippedActor.initialStats,
            provenance: 'calculation_context',
          },
          event: {
            eventId: providerEvent.eventId,
            actionFamilies: [],
            providerStateKeys: [],
            targetStateKeys: [],
            sourceRefs: providerEvent.evidenceRefs,
          },
        }).find(
          (effect) => effect.effectId === 'potential_penetration' && effect.status === 'applied',
        )
      : undefined
    const actor = penetration
      ? {
          ...equippedActor,
          finalStats: {
            ...equippedActor.finalStats,
            pen_: equippedActor.finalStats.pen_ + penetration.value,
          },
        }
      : equippedActor
    const contract = getCurrentAgentDecisionMechanicContract(provider.agentId)!
    const projection = domains(provider.agentId)
    const boundLifecycle = bindPlanningAnomalyLifecycleReferences32({
      references: conditions.supportReferencesByAgentId?.[provider.agentId],
      memberIds: ids,
      providerAgentId: provider.agentId,
      providerMindscape: actor.mindscape,
    })
    if (boundLifecycle.status !== 'supported') {
      gaps.push({
        providerAgentId: provider.agentId,
        effectKey: `${provider.agentId}:anomaly_lifecycle`,
        fields: boundLifecycle.blockers,
        sourceRefs: [],
      })
      continue
    }
    for (const entry of entriesById.get(provider.agentId) ?? []) {
      // Named potential effects belong to their prepared-event consumer.
      // Mindscapes instead follow this actor's declared reference investment;
      // excluding every M1..M6 effect silently erased the A6 team grants.
      if (/^potential/i.test(entry.effectId)) continue
      const minimumMindscape = /^m([1-6])(?:_|$)/i.exec(entry.effectId)
      if (minimumMindscape && actor.mindscape < Number(minimumMindscape[1])) continue
      if (
        (entry.numericExpression.sourceStatus !== 'upstream_expression_available' &&
          !isReviewedTemplateMechanicEffect32(entry)) ||
        entry.numericExpression.todoBoundary
      )
        continue
      if (entry.effectId.startsWith('ability_') && !abilityById.get(provider.agentId)) continue
      const extracted = extractUpstreamEffectValueIr(entry.numericExpression.expressionIr)
      if (extracted.status !== 'supported') continue
      const sourceReferences = planningProviderReferences32({
        member: actor,
        sourceReferences: contract.effectContract.runtimeDefaults.references,
        attributeCounts: counts.attribute,
      })
      if (provider.specialty === 'rupture') {
        const sheer = resolvePlanningEventSheerForce32({
          member: actor,
          attack: actor.finalStats.atk,
          hp: actor.finalStats.hp,
          combatSheerForce: 0,
        })
        if (sheer.status === 'supported')
          sourceReferences['own.final.sheerForce'] = sheer.sheerForce
      }
      const conversion = bindReviewedRoxyEnergyConversion32({
        agentId: provider.agentId,
        effectId: entry.effectId,
        coreLevel: actor.coreLevel,
        source: contract.effectContract.source,
        expressionSha256: entry.numericExpression.expressionSha256,
        references: sourceReferences,
      })
      if (conversion.status !== 'supported') {
        gaps.push({
          providerAgentId: provider.agentId,
          effectKey: entry.effectKey,
          fields: conversion.blockers,
          sourceRefs: [...entry.sourceRefs],
        })
        continue
      }
      const initialReferences = conversion.references
      const expression = planningAnomalyLifecycleEffectInactive32(
        entry.effectKey,
        boundLifecycle.references,
      )
        ? ({ kind: 'literal', value: 0 } as UpstreamExpressionIR)
        : baseReferenceExpression(
            bindPlanningSkillLevelValueReferences32({
              expression: extracted.value as UpstreamExpressionIR,
              provider: actor,
            }),
            initialReferences,
            abilityById.get(provider.agentId) === true,
          )
      const booleanReferences = booleanGates(expression)
      const metadata = effectReceiverMetadata(entry.numericExpression.expressionIr)
      const channel =
        metadata.receiverPath &&
        capabilityFor(
          { path: metadata.receiverPath, damageType: metadata.damageType },
          entry.effectId,
        )
      if (!channel) continue
      for (const target of members.map((member) => ({
        ...member,
        hasAftershockCapacity: sourcePlanningAftershockCapacity32({
          agentId: member.agentId,
          memberIds: ids,
          potential: runtime.get(member.agentId)!.potential ?? 0,
        }),
      }))) {
        const isSelf = target.agentId === provider.agentId
        if (
          isSelf
            ? !entry.targetKinds.some((kind) => kind === 'self' || kind === 'team')
            : entry.targetKinds.every((kind) => kind === 'self')
        )
          continue
        if (
          !recipientCompatible(target, channel, {
            path: metadata.receiverPath!,
            damageType: metadata.damageType,
          })
        )
          continue
        const declared: Record<string, unknown> = {}
        const conditionRefs: string[] = [
          ...conversion.sourceRefs,
          ...boundLifecycle.sourceRefs,
          ...(requiredReferences(extracted.value as UpstreamExpressionIR).includes('own.final.pen_')
            ? (penetration?.sourceRefs ?? [])
            : []),
        ]
        const missing: string[] = []
        const explicit = boundLifecycle.references
        for (const ref of requiredReferences(expression)) {
          if (/^(?:dm\.|char\.|own\.|target\.|team\.)/.test(ref)) continue
          const sourceDomain = teamStrengthSourceConditionDomain(provider.agentId, ref)
          const catalogDomain = projection.defs.find((def) => def.referenceKey === ref)
          // The expanded display catalog also contains the common anomaly
          // clock. Its range does not override the event-observation policy:
          // elapsed time cannot be replaced by the catalog maximum.
          const domain =
            sourceDomain && 'explicitOnly' in sourceDomain && sourceDomain.explicitOnly
              ? sourceDomain
              : (catalogDomain ?? sourceDomain)
          if (domain) conditionRefs.push(...domain.sourceRefs)
          if (Object.hasOwn(explicit, ref)) {
            const chosen = explicit[ref]
            const valid =
              (ref === 'polarityDisorder.value' &&
                explicit.yanagiPolarityTrigger32 === true &&
                chosen === 1) ||
              (domain?.valueKind === 'number'
                ? typeof chosen === 'number' &&
                  Number.isFinite(chosen) &&
                  chosen >= domain.minimum! &&
                  chosen <= domain.maximum! &&
                  (!('integerOnly' in domain) ||
                    !domain.integerOnly ||
                    Number.isInteger(chosen) ||
                    (ref === 'anomTimePassed' && boundLifecycle.lifecycle?.active === true))
                : domain?.valueKind === 'enum'
                  ? domain.options?.some((option) => option.value === chosen) === true
                  : (domain?.valueKind === 'boolean' || booleanReferences.has(ref)) &&
                    typeof chosen === 'boolean')
            if (valid) declared[ref] = chosen
            else missing.push(`invalid_source_condition:${ref}`)
            continue
          }
          // This envelope activates one sourced effect at its bounded domain,
          // never a made-up time series. Ambiguous enum states remain unknown.
          if (domain && 'explicitOnly' in domain && domain.explicitOnly) missing.push(ref)
          else if (domain?.valueKind === 'boolean') declared[ref] = true
          else if (domain?.valueKind === 'number' && Number.isFinite(domain.maximum))
            declared[ref] = domain.maximum
          else if (domain?.options?.length === 1) declared[ref] = domain.options[0]!.value
          else if (booleanReferences.has(ref)) declared[ref] = true
          else missing.push(ref)
        }
        if (provider.agentId === 'agent-pan-yinhu')
          declared.panMeridianFlowIncomingAgentId32 = target.agentId
        if (provider.agentId === 'agent-rina') {
          const semantic = bindReviewedPlanningConditionSemantics32({
            entry,
            potential: actor.potential,
            references: {
              drusillaNotReturned32: explicit.drusillaNotReturned32 ?? true,
              anastellaNotReturned32: explicit.anastellaNotReturned32 ?? true,
            },
          })
          if (semantic.status === 'supported' && semantic.active) {
            Object.assign(declared, semantic.overrides)
            conditionRefs.push(...semantic.sourceRefs)
          } else if (semantic.status === 'unsupported') missing.push(...semantic.blockers)
        }
        const attr = getCurrentAgentEventContract(target.agentId)!.identity.attribute
        if (provider.agentId === 'agent-roxy') {
          const window = recipientContext.roxyWindowsByRecipientId?.[target.agentId]
          const bound = bindReviewedRoxyAttributeWindows32({
            entry,
            attribute: attr,
            windsweptObserved: window?.windsweptObserved,
            references: window
              ? {
                  roxyCoreWindowWind32: window.wind,
                  roxyCoreWindowElectric32: window.electric,
                  roxySquadWindswept32: window.squadWindswept,
                  roxyContaminationMatchesEvent32: window.contaminationMatches,
                }
              : {},
          })
          if (bound.status !== 'supported') {
            missing.push(...bound.blockers)
          } else if (bound.active) {
            Object.assign(declared, bound.overrides)
            conditionRefs.push(...bound.sourceRefs)
          } else if (
            ['core_crit_dmg_', 'core_laceration_dmg_', 'ability_direct_dmg_'].includes(
              entry.effectId,
            )
          )
            missing.push('roxy_per_recipient_historical_and_current_windows')
        }
        const unresolved = missing.filter((field) => !Object.hasOwn(declared, field))
        if (unresolved.length) {
          gaps.push({
            providerAgentId: provider.agentId,
            effectKey: entry.effectKey,
            fields: unresolved,
            sourceRefs: [...entry.sourceRefs, ...conditionRefs],
          })
          continue
        }
        const references = effectRuntimeReferences({
          target: contactRuntime.get(target.agentId)!,
          requiredReferences: requiredReferences(expression),
          baseReferences: planningProviderReferences32({
            member: actor,
            sourceReferences: contract.effectContract.runtimeDefaults.references,
            attributeCounts: counts.attribute,
            observations: declared,
          }),
        })
        if (
          requiredReferences(expression).includes('own.combat.crit_dmg_') ||
          entry.effectKey === 'agent-norma:reviewed_sheer_force_attack32'
        ) {
          deferred.push({
            entry,
            recipientAgentId: target.agentId,
            conditions: declared,
            sourceRefs: [...entry.sourceRefs, ...conditionRefs],
            channel,
          })
          continue
        }
        const result = evaluateUpstreamExpressionIr(
          expression,
          createPlanningExpressionDomainRuntime({
            references,
            teamCounts: { specialty: counts.specialty, faction: counts.faction },
            gates: {
              ability: abilityById.get(provider.agentId) === true,
              directStrike: false,
              besiege: false,
              besiegeDisplay: false,
            },
          }),
        )
        if (
          result.status !== 'supported' ||
          typeof result.value !== 'number' ||
          !Number.isFinite(result.value)
        ) {
          gaps.push({
            providerAgentId: provider.agentId,
            effectKey: entry.effectKey,
            fields:
              result.status === 'unsupported' ? result.blockers : ['non_numeric_source_effect'],
            sourceRefs: [...entry.sourceRefs],
          })
          continue
        }
        const bucket: SourceBackedPlanningEffectBucket = {
          bucketId: entry.effectKey,
          effectKey: entry.effectKey,
          effectId: entry.effectId,
          applicationScope: entry.applicationScope,
          providerAgentId: provider.agentId,
          recipientAgentIds:
            entry.effectKey === 'agent-pan-yinhu:core_sheerForce'
              ? [target.agentId]
              : recipientIds({ ...entry, memberIds: ids, receiverPath: metadata.receiverPath }),
          receiverPath: metadata.receiverPath,
          damageType: metadata.damageType,
          action: null,
          attribute: effectAttributeForReceiver(metadata.receiverPath),
          application:
            channel === 'aftershock_defense' && /\.defIgn_/.test(metadata.receiverPath ?? '')
              ? 'defense_ignore'
              : applicationForReceiver(metadata.receiverPath),
          value: result.value,
          sourceRefs: [...entry.sourceRefs, ...conditionRefs],
        }
        const packet = context.contactUsages(target.agentId, bucket.damageType ?? undefined)
        const before = contactValue(target.agentId, [], packet)
        const after = contactValue(target.agentId, [bucket], packet, {
          ...conditions.supportReferencesByAgentId,
          [provider.agentId]: {
            ...conditions.supportReferencesByAgentId?.[provider.agentId],
            ...declared,
          },
        })
        const relativeGain =
          before !== null && before > 0 && after !== null ? Math.max(0, after / before - 1) : null
        effects.push({
          providerAgentId: provider.agentId,
          recipientAgentId: target.agentId,
          effectKey: entry.effectKey,
          application: bucket.application,
          receiverPath: metadata.receiverPath,
          damageType: metadata.damageType,
          value: result.value,
          relativeGain,
          sourceRefs: bucket.sourceRefs,
          conditions: declared,
          channel,
        })
        bucketRows.push({
          providerAgentId: provider.agentId,
          recipientAgentId: target.agentId,
          bucket,
          conditions: declared,
        })
      }
    }
  }

  // Consume the same event graph as production after the source-bound stat
  // grants have been produced. No second combat/final or Sheer Force formula.
  for (const row of deferred) {
    const providerId = row.entry.providerAgentId
    const producerReferences: Record<string, Record<string, unknown>> = Object.fromEntries(
      Object.entries(conditions.supportReferencesByAgentId ?? {}).map(([id, refs]) => [
        id,
        { ...refs },
      ]),
    )
    for (const grant of bucketRows.filter((grant) => grant.recipientAgentId === providerId))
      producerReferences[grant.providerAgentId] = {
        ...producerReferences[grant.providerAgentId],
        ...grant.conditions,
      }
    producerReferences[providerId] = { ...producerReferences[providerId], ...row.conditions }
    const incoming = bucketRows
      .filter(
        (grant) =>
          grant.recipientAgentId === providerId &&
          (providerId === 'agent-norma'
            ? grant.bucket.application === 'sheer_force'
            : grant.bucket.application === 'crit_damage'),
      )
      .map((grant) => ({ ...grant.bucket, recipientAgentIds: [grant.recipientAgentId] }))
    const target = members.find((member) => member.agentId === row.recipientAgentId)!
    const metadata = effectReceiverMetadata(row.entry.numericExpression.expressionIr)
    const packet = context.contactUsages(target.agentId, metadata.damageType ?? undefined)
    const eventIds = packet.map((usage) => usage.eventId)
    let produced = false
    for (const eventId of eventIds) {
      const contract = getCurrentAgentEventContract(target.agentId)!
      const event = contract.eventContract.events.find((event) => event.eventId === eventId)!
      const aftershock = sourcePlanningAftershock32({
        agentId: target.agentId,
        eventId,
        memberIds: ids,
        potential: runtime.get(target.agentId)!.potential,
      })
      const settled = resolveCurrentPlanningEventEffects32({
        memberIds: ids,
        members: [...contactRuntime.values()],
        ownerAgentId: target.agentId,
        event: {
          ...event,
          damageTypes: [event.damageType, ...(aftershock === true ? ['aftershock'] : [])],
        },
        attribute: event.attribute ?? contract.identity.attribute,
        buckets: incoming,
        entries: [row.entry],
        baselineReferencesByAgentId: producerReferences,
      })
      if (settled.status !== 'supported') {
        gaps.push({
          providerAgentId: providerId,
          effectKey: row.entry.effectKey,
          fields: settled.blockers,
          sourceRefs: row.sourceRefs,
        })
        break
      }
      const bucket = settled.buckets.find(
        (bucket) =>
          bucket.effectKey === row.entry.effectKey &&
          bucket.recipientAgentIds.includes(target.agentId),
      )
      if (
        !bucket &&
        settled.producerReceipts.some(
          (receipt) =>
            receipt.effectKey === row.entry.effectKey &&
            receipt.recipientAgentId === target.agentId &&
            receipt.status === 'known_zero' &&
            receipt.value === 0,
        )
      ) {
        // Only a real source evaluation receipt proves zero. Execution order
        // and an empty bucket list do not prove upstream coverage.
        effects.push({
          providerAgentId: providerId,
          recipientAgentId: target.agentId,
          effectKey: row.entry.effectKey,
          application: applicationForReceiver(metadata.receiverPath),
          receiverPath: metadata.receiverPath,
          damageType: metadata.damageType,
          value: 0,
          relativeGain: 0,
          sourceRefs: row.sourceRefs,
          conditions: row.conditions,
          channel: row.channel,
        })
        produced = true
        break
      }
      if (!bucket) continue
      const scoped = { ...bucket, recipientAgentIds: [target.agentId] }
      const before = contactValue(target.agentId, [], packet)
      const after = contactValue(target.agentId, [scoped], packet)
      effects.push({
        providerAgentId: providerId,
        recipientAgentId: target.agentId,
        effectKey: row.entry.effectKey,
        application: bucket.application,
        receiverPath: metadata.receiverPath,
        damageType: metadata.damageType,
        value: bucket.value,
        relativeGain:
          before !== null && before > 0 && after !== null ? Math.max(0, after / before - 1) : null,
        sourceRefs: [...row.sourceRefs, ...bucket.sourceRefs],
        conditions: row.conditions,
        channel: row.channel,
      })
      bucketRows.push({
        providerAgentId: providerId,
        recipientAgentId: target.agentId,
        bucket: scoped,
        conditions: row.conditions,
      })
      produced = true
      break
    }
    if (!produced && !gaps.some((gap) => gap.effectKey === row.entry.effectKey))
      gaps.push({
        providerAgentId: providerId,
        effectKey: row.entry.effectKey,
        fields: ['source_effect_not_applicable_to_counted_contact'],
        sourceRefs: row.sourceRefs,
      })
  }

  return { effects, bucketRows }
}
