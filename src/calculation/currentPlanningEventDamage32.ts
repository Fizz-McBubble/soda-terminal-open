import { bindCurrentPlanningHarumasaWindow32 } from './currentPlanningHarumasaEventWindow32'
import {
  getPlanningDamageEventSemantics,
  emptyModifiers,
  addModifier,
  matchesEventScope,
  type SourceBackedPlanningEffectBucket,
} from './currentPlanningDamageModifiers'
import { resolveCurrentPlanningEventEffects32 } from './currentPlanningEventEffectResolution32'
import type { CommonAnomalyEventObservation32 } from './currentCommonAnomalyEffects32'
import type { PlanningEventUsage } from './planningCalculationContextCompiler'
import {
  evaluateCurrentPlanningInitialCritConversion32,
  type PlanningEffectRuntimeMember,
} from './currentPlanningEffectRuntime'
import {
  getCurrentAgentEventContract,
  resolveCurrentAgentEvent,
} from './currentAgentMechanicContracts'
import type { PlanningBaseline } from './planningDpsContract'
import { calculateDamageFormula } from './damageFormulaDispatch'
import { isDamageFormula32Version } from './sharpDamageCore'
import { reviewedRinaCleanupDispatchGap32 } from './reviewedRinaCleanupDispatch32'
import { resolveSourceEventQuantity32 } from './sourceEventQuantity32'
import { resolvePlanningEventSheerForce32 } from './currentSourceBoundSheerForce32'
import { bindReviewedRinaPotentialTeamStats32 } from './reviewedRinaPotentialTeamStats32'
import {
  actualPlanningPotentialActionFamilies32,
  sourcePlanningAftershock32,
} from './currentPotentialEventActions32'
import { bindReviewedPotentialTeamAction32 } from './reviewedPotentialTeamAction32'
import { requiredReferences } from './currentPlanningEffectExpressions'
import {
  bindReviewedPotentialApplications,
  type PotentialApplicationBinding,
  type PotentialApplicationEvent,
} from './potentialApplicationBinding'
import { bindReviewedSupportEventDamage32 } from './reviewedSupportEventDamage32'

type DirectPotentialApplication32 =
  | 'penetration_ratio'
  | 'attack_percent'
  | 'damage_bonus'
  | 'crit_damage'
  | 'resistance_ignore'

function potentialModifierBucket32(
  effect: PotentialApplicationBinding,
  eventId: string,
  application: DirectPotentialApplication32,
): SourceBackedPlanningEffectBucket {
  const receiver = {
    penetration_ratio: 'pen_',
    attack_percent: 'atk_',
    damage_bonus: 'dmg_',
    crit_damage: 'crit_dmg_',
    resistance_ignore: 'resIgn_',
  }[application]
  return {
    bucketId: `${effect.effectKey}:event:${eventId}`,
    effectKey: effect.effectKey,
    effectId: effect.effectId,
    providerAgentId: effect.providerAgentId,
    recipientAgentIds: [effect.providerAgentId],
    receiverPath: `ownBuff.combat.${receiver}`,
    applicationScope: 'generic',
    action: null,
    attribute: null,
    damageType: null,
    application,
    value: effect.value,
    sourceRefs: [...effect.sourceRefs],
  }
}

/** One source-bound event formula path for team and personal Planning callers. */
export function calculateCurrentPlanningEventDamage32(input: {
  member: PlanningEffectRuntimeMember
  buckets: readonly SourceBackedPlanningEffectBucket[]
  eventUsages: readonly PlanningEventUsage[]
  baseline: PlanningBaseline
  diagnosticBlockers?: string[]
  potentialEvents?: Readonly<Record<string, PotentialApplicationEvent>>
  potentialApplications?: PotentialApplicationBinding[]
  eventEffectContext?: {
    memberIds: readonly string[]
    members: readonly PlanningEffectRuntimeMember[]
    entries: Parameters<typeof resolveCurrentPlanningEventEffects32>[0]['entries']
    baselineReferencesByAgentId?: Readonly<Record<string, Readonly<Record<string, unknown>>>>
    commonAnomalyEvents?: Readonly<Record<string, readonly CommonAnomalyEventObservation32[]>>
    consumedBuckets: SourceBackedPlanningEffectBucket[]
    exclusions: Array<{ effectKey: string; reason: string; fields: string[]; sourceRefs: string[] }>
    disabledSupportProviderIds?: readonly string[]
    equipmentEffectExclusions?: readonly unknown[]
  }
}) {
  const initialCritConversion = isDamageFormula32Version(input.baseline.gameVersion)
    ? evaluateCurrentPlanningInitialCritConversion32(input.member)
    : { status: 'supported' as const, critRate: 0, sourceRefs: [] }
  if (initialCritConversion.status === 'unsupported') return Number.NaN
  const stats = input.member.finalStats
  const identity = getCurrentAgentEventContract(input.member.agentId)?.identity
  if (!identity) return null
  const damage = input.eventUsages.reduce((sum, usage) => {
    const dispatchGap = isDamageFormula32Version(input.baseline.gameVersion)
      ? reviewedRinaCleanupDispatchGap32(usage.ownerAgentId, usage.eventId)
      : null
    if (dispatchGap) {
      input.diagnosticBlockers?.push(dispatchGap)
      return Number.NaN
    }
    const quantity = resolveSourceEventQuantity32(usage)
    if (quantity.status === 'unsupported') {
      input.diagnosticBlockers?.push(`${usage.eventId}：${quantity.reason}`)
      return Number.NaN
    }
    const contract = getCurrentAgentEventContract(usage.ownerAgentId)
    const event = contract?.eventContract.events.find((item) => item.eventId === usage.eventId)
    const resolved = resolveCurrentAgentEvent({
      stableId: usage.ownerAgentId,
      eventId: usage.eventId,
      skillLevel: usage.skillLevel,
    })
    if (resolved.status !== 'supported' || !event) return Number.NaN
    const semantics = getPlanningDamageEventSemantics(
      event as { formulaFamily?: string; scalingAttribute?: string },
    )
    if (!semantics) return Number.NaN
    const eventAttribute = event.attribute ?? identity.attribute
    if (
      isDamageFormula32Version(input.baseline.gameVersion) &&
      eventAttribute !== identity.attribute &&
      (stats.damageBonus ?? 0) !== 0 &&
      stats.damageBonusesByAttribute?.[eventAttribute] === undefined
    )
      return Number.NaN
    const staticDamageBonus =
      stats.damageBonusesByAttribute?.[eventAttribute] ??
      (eventAttribute === identity.attribute
        ? (stats.damageBonus ?? 0)
        : isDamageFormula32Version(input.baseline.gameVersion)
          ? 0
          : (stats.damageBonus ?? 0))
    if (
      (isDamageFormula32Version(input.baseline.gameVersion) ||
        semantics.family !== 'direct' ||
        semantics.scalingAttribute !== 'attack') &&
      input.member.level === undefined
    )
      return Number.NaN
    const aftershock = sourcePlanningAftershock32({
      agentId: input.member.agentId,
      eventId: usage.eventId,
      memberIds: input.eventEffectContext?.memberIds ?? [input.member.agentId],
      potential: input.member.potential,
    })
    const scopedEvent = {
      ...event,
      damageTypes: [event.damageType, ...(aftershock === true ? ['aftershock'] : [])],
    }
    let actionDamageBonus = 0
    for (const bonus of stats.actionDamageBonuses ?? []) {
      const matches = bonus.actionTypes.some(
        (action) =>
          (action === 'basic' && event.skill === 'basic') ||
          (action === 'dash' && event.actionId.startsWith('DashAttack')) ||
          (action === 'aftershock' && aftershock === true),
      )
      if (matches) actionDamageBonus += bonus.value
      // Unknown source classification remains a diagnostic boundary.
      else if (
        bonus.actionTypes.some(
          (action) =>
            action !== 'basic' &&
            action !== 'dash' &&
            !(action === 'aftershock' && aftershock === false),
        )
      )
        return Number.NaN
    }
    const modifiers = emptyModifiers()
    const observed = input.potentialEvents?.[`${input.member.agentId}:${usage.eventId}`]
    // An occurrence's state is declared by its producer, but its action and
    // attribute must agree with the actual pinned damage event.
    const actualPotentialActions = [
      ...actualPlanningPotentialActionFamilies32({
        actionId: event.actionId,
        skill: event.skill,
        attribute: eventAttribute,
      }),
    ]
    if (aftershock === true) actualPotentialActions.push('aftershock')
    const matchingPotentialActions = observed?.actionFamilies.filter((family) =>
      actualPotentialActions.includes(family),
    )
    const rinaTeamStats = isDamageFormula32Version(input.baseline.gameVersion)
      ? bindReviewedRinaPotentialTeamStats32({
          memberIds: input.eventEffectContext?.memberIds ?? [input.member.agentId],
          members: input.eventEffectContext?.members ?? [input.member],
          recipientAgentId: input.member.agentId,
          eventId: usage.eventId,
          observation: observed,
          initialStatsProvenance: 'calculation_context',
        })
      : { buckets: [], applications: [] }
    input.potentialApplications?.push(...rinaTeamStats.applications)
    const teamAction = bindReviewedPotentialTeamAction32({
      members: input.eventEffectContext?.members ?? [input.member],
      recipientAgentId: input.member.agentId,
      eventId: usage.eventId,
      aftershock,
      observation: observed,
    })
    input.potentialApplications?.push(...teamAction.applications)
    const potential = bindReviewedPotentialApplications({
      member: {
        agentId: input.member.agentId,
        potential: input.member.potential,
        initialStats: input.member.initialStats,
        provenance: 'calculation_context',
      },
      event:
        observed?.eventId === usage.eventId
          ? { ...observed, actionFamilies: matchingPotentialActions ?? [] }
          : {
              eventId: usage.eventId,
              actionFamilies: [],
              providerStateKeys: [],
              targetStateKeys: [],
              sourceRefs: [`planning-baseline:${input.baseline.baselineId}:event:${usage.eventId}`],
            },
    })
    const potentialBuckets: SourceBackedPlanningEffectBucket[] = []
    // Rina's unconditional combat PEN also belongs to the provider's final
    // panel when another member's event evaluates her core conversion.
    const otherRina = input.eventEffectContext?.members.find(
      (member) => member.agentId === 'agent-rina' && member.agentId !== input.member.agentId,
    )
    if (
      otherRina &&
      input.eventEffectContext?.entries.some(
        (entry) =>
          entry.providerAgentId === otherRina.agentId &&
          requiredReferences(entry.numericExpression.expressionIr).includes('own.final.pen_'),
      )
    ) {
      const penetration = bindReviewedPotentialApplications({
        member: {
          agentId: otherRina.agentId,
          potential: otherRina.potential,
          initialStats: otherRina.initialStats,
          provenance: 'calculation_context',
        },
        event: {
          eventId: usage.eventId,
          actionFamilies: [],
          providerStateKeys: [],
          targetStateKeys: [],
          sourceRefs: [`planning-baseline:${input.baseline.baselineId}:event:${usage.eventId}`],
        },
      }).find((effect) => effect.effectId === 'potential_penetration')
      if (penetration?.status === 'applied') {
        potentialBuckets.push(
          potentialModifierBucket32(penetration, usage.eventId, 'penetration_ratio'),
        )
        input.potentialApplications?.push(penetration)
      }
    }
    for (const effect of potential) {
      if (effect.bucket === 'team_action_damage') continue
      // Rina's team conversions are admitted once above, including for her own
      // event. Self penetration remains in this existing self-effect path.
      if (
        effect.providerAgentId === 'agent-rina' &&
        (effect.effectId === 'potential_team_attack_per_penetration' ||
          effect.effectId === 'potential_team_defense_per_penetration')
      )
        continue
      // Only formula families supported by this direct-event calculator are
      // applied. Timers, anomaly and daze remain explicit exclusions, never
      // reinterpreted as an ordinary damage multiplier.
      let application: DirectPotentialApplication32 | null = null
      if (effect.status === 'applied' && effect.targetKind === 'self') {
        if (effect.effectId === 'potential_penetration') {
          application = 'penetration_ratio'
        } else if (effect.bucket === 'self_damage') {
          application = 'damage_bonus'
        } else if (effect.bucket === 'self_crit_damage' && semantics.family === 'direct') {
          application = 'crit_damage'
        } else if (effect.bucket === 'self_element_damage' && eventAttribute === 'electric') {
          application = 'damage_bonus'
        } else if (
          effect.bucket === 'self_action_resistance_ignore' &&
          ((effect.providerAgentId === 'agent-ellen' && eventAttribute === 'ice') ||
            (effect.providerAgentId === 'agent-harumasa' && eventAttribute === 'electric'))
        ) {
          application = 'resistance_ignore'
        } else if (effect.effectId === 'potential_focus_attack' && effect.bucket === 'self_stat') {
          application = 'attack_percent'
        }
      }
      if (application)
        potentialBuckets.push(potentialModifierBucket32(effect, usage.eventId, application))
      input.potentialApplications?.push(
        effect.status === 'applied' && !application
          ? {
              ...effect,
              status: 'excluded',
              eligibleEventIds: [],
              reason: '当前固定直接伤害公式未消费此效果类型。',
            }
          : effect,
      )
    }
    const initialEventInputBuckets = [
      ...input.buckets.filter(
        (bucket) =>
          ![...rinaTeamStats.buckets, ...teamAction.buckets, ...potentialBuckets].some(
            (row) => row.effectKey === bucket.effectKey,
          ),
      ),
      ...rinaTeamStats.buckets,
      ...teamAction.buckets,
      ...potentialBuckets,
    ]
    const timedWindow = bindCurrentPlanningHarumasaWindow32(
      input,
      usage,
      observed,
      scopedEvent,
      eventAttribute,
      initialEventInputBuckets,
    )
    if (timedWindow.status === 'unsupported') return Number.NaN
    const { eventInputBuckets, baselineReferencesByAgentId } = timedWindow
    const supportDamage = input.eventEffectContext
      ? bindReviewedSupportEventDamage32({
          members: input.eventEffectContext.members,
          recipientAgentId: input.member.agentId,
          eventId: usage.eventId,
          baselineReferencesByAgentId,
          disabledSupportProviderIds: input.eventEffectContext.disabledSupportProviderIds,
          equipmentEffectExclusions: input.eventEffectContext.equipmentEffectExclusions,
        })
      : { buckets: [], exclusions: [] }
    input.eventEffectContext?.exclusions.push(...supportDamage.exclusions)
    const eventEffects = input.eventEffectContext
      ? resolveCurrentPlanningEventEffects32({
          ...input.eventEffectContext,
          baselineReferencesByAgentId,
          ownerAgentId: input.member.agentId,
          event: scopedEvent,
          attribute: eventAttribute,
          buckets: [
            ...eventInputBuckets.filter(
              (bucket) => !supportDamage.buckets.some((row) => row.effectKey === bucket.effectKey),
            ),
            ...supportDamage.buckets,
          ],
          commonAnomalyObservations:
            input.eventEffectContext.commonAnomalyEvents?.[
              `${input.member.agentId}:${usage.eventId}`
            ],
        })
      : null
    if (eventEffects?.status === 'unsupported') {
      input.diagnosticBlockers?.push(
        ...eventEffects.blockers.map((reason) => `${usage.eventId}：${reason}`),
      )
      return Number.NaN
    }
    const eventBuckets =
      eventEffects?.status === 'supported' ? eventEffects.buckets : eventInputBuckets
    if (eventEffects?.status === 'supported') {
      input.eventEffectContext!.consumedBuckets.push(...eventEffects.buckets)
      input.eventEffectContext!.exclusions.push(...eventEffects.exclusions)
    }
    eventBuckets
      .filter(
        (bucket) =>
          bucket.recipientAgentIds.includes(input.member.agentId) &&
          matchesEventScope(bucket, scopedEvent, eventAttribute),
      )
      .forEach((bucket) => addModifier(modifiers, bucket))
    const source32 = isDamageFormula32Version(input.baseline.gameVersion)
    if (modifiers.flatDamage !== 0 && (!source32 || semantics.family !== 'direct')) {
      input.diagnosticBlockers?.push(
        `${usage.eventId}：附加基础伤害没有当前伤害类型的已核消费合同。`,
      )
      return Number.NaN
    }
    // common/index.ts: final = initial*(1+combatPercent)+combatFlat.
    // initial already contains all static equipment percentages and flat stats.
    const attack =
      stats.atk +
      (source32 ? input.member.initialStats.atk : stats.atk) * modifiers.attackPercent +
      modifiers.attackFlat
    const defense =
      stats.def + input.member.initialStats.def * modifiers.defensePercent + modifiers.defenseFlat
    const hp = stats.hp + input.member.initialStats.hp * modifiers.hpPercent + modifiers.hpFlat
    const sheer =
      semantics.family === 'sheer'
        ? resolvePlanningEventSheerForce32({
            member: input.member,
            attack,
            hp,
            combatSheerForce: modifiers.sheerForce,
          })
        : null
    if (sheer?.status === 'unsupported') return Number.NaN
    const resistance = Math.max(
      -1,
      Math.min(
        1,
        (input.baseline.enemy.resistance - modifiers.resistanceReduction) *
          (1 - Math.min(1, Math.max(0, modifiers.resistanceIgnore))),
      ),
    )
    try {
      return (
        sum +
        calculateDamageFormula({
          family: semantics.family,
          scalingAttribute: semantics.scalingAttribute,
          formulaVersion: isDamageFormula32Version(input.baseline.gameVersion) ? '3.2' : 'legacy',
          attackerLevel: input.member.level ?? 60,
          attack,
          defense,
          flatDamage: modifiers.flatDamage,
          sheerForce: sheer?.status === 'supported' ? sheer.sheerForce : undefined,
          lacerationDamage:
            stats.lacerationDamage === undefined
              ? undefined
              : stats.lacerationDamage + modifiers.lacerationDamage,
          sharpDamageBonus: (stats.sharpDamageBonus ?? 0) + modifiers.sharpDamageBonus,
          sheerDamageBonus: (stats.sheerDamageBonus ?? 0) + modifiers.sheerDamageBonus,
          directDamageBonus: (stats.directDamageBonus ?? 0) + modifiers.directDamageBonus,
          buffBonus: (stats.buffBonus ?? 0) + modifiers.buffBonus,
          multiplier:
            resolved.damageMultiplier *
            (modifiers.motionValueMultiplier || 1) *
            (quantity.unit === 'seconds' ? quantity.value : 1),
          hitCount: quantity.unit === 'seconds' ? 1 : quantity.value,
          critRate: stats.crit_ + modifiers.critRate + initialCritConversion.critRate,
          critDamage: stats.crit_dmg_ + modifiers.critDamage,
          damageBonus: staticDamageBonus + actionDamageBonus + modifiers.damageBonus,
          vulnerability: input.baseline.enemy.vulnerability + modifiers.vulnerability,
          defenseReduction: modifiers.defenseReduction,
          defenseIgnore: isDamageFormula32Version(input.baseline.gameVersion)
            ? modifiers.defenseIgnore
            : 0,
          penetrationRatio: stats.pen_ + modifiers.penetrationRatio,
          penetrationFlat: stats.pen ?? 0,
          enemyDefense: isDamageFormula32Version(input.baseline.gameVersion)
            ? input.baseline.enemy.defense
            : input.baseline.enemy.defense *
              (1 - Math.min(1, Math.max(0, modifiers.defenseIgnore))),
          resistance: isDamageFormula32Version(input.baseline.gameVersion)
            ? input.baseline.enemy.resistance
            : resistance,
          resistanceReduction: isDamageFormula32Version(input.baseline.gameVersion)
            ? modifiers.resistanceReduction
            : 0,
          resistanceIgnore: isDamageFormula32Version(input.baseline.gameVersion)
            ? modifiers.resistanceIgnore
            : 0,
          // Fixed stun state only: this does not simulate earlier stun or add a
          // new window. A neutral non-stunned target receives no stun bonus.
          stunMultiplier:
            input.baseline.enemy.stunMultiplier +
            (input.baseline.enemy.stunMultiplier > 1 ? modifiers.stunDamageBonus : 0),
        }).expectedDamage
      )
    } catch {
      // Invalid observations remain unsupported instead of escaping as a
      // successful zero or breaking the entire account query.
      return Number.NaN
    }
  }, 0)
  return Number.isFinite(damage) ? damage : null
}
