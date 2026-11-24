import { currentAgentPlanningEffectBlueprints } from '../calculation/currentAgentPlanningEffectBlueprint'
import { isReviewedTemplateMechanicEffect32 } from '../calculation/reviewedTemplateMechanicEffects32'
import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import { getCurrentAgentDecisionMechanicContract } from '../calculation/currentAgentDecisionMechanicContracts'
import {
  sourcePlanningAftershock32,
  sourcePlanningAftershockEligible32,
} from '../calculation/currentPotentialEventActions32'
import { requiredReferences } from '../calculation/currentPlanningEffectExpressions'
import {
  evaluateUpstreamExpressionIr,
  type UpstreamExpressionIR,
} from '../calculation/currentUpstreamExpressionIR'
import { teamStrengthSourceActionSemantics } from './teamStrengthActionFacts'
import {
  reviewedLumifluxMechanicsIdentity32,
  reviewedLumifluxMechanicsHash32,
} from '../calculation/reviewedLumifluxMechanics32'
import { baseReferenceExpression, effectReceivers } from './teamStrengthSupportExpression'
import {
  agentAnomalyAttribute as anomalyAttribute,
  compileTeamPlayMechanismProof,
  ordinaryAnomalyAction as ordinary,
  uniqueSorted as unique,
} from './teamPlayMechanismProofBuilder'
import type { Member } from './teamStrengthMemberFacts'
import type { TeamStrengthReferenceConditions } from './teamStrengthReferenceConditionsTypes'
import type { FiniteTeamPlay } from './teamFinitePlayContract'

export { compileTeamPlayMechanismProof }

const effectsByAgent = new Map<string, (typeof currentAgentPlanningEffectBlueprints)[number][]>()
for (const effect of currentAgentPlanningEffectBlueprints) {
  const entries = effectsByAgent.get(effect.providerAgentId) ?? []
  entries.push(effect)
  effectsByAgent.set(effect.providerAgentId, entries)
}

/** Check a recipient's source-backed self conversion before excluding an input stat. */
export function teamPlayContributionMatchesSystem(
  capability: string,
  system: FiniteTeamPlay['outputSystem'],
  recipient?: Member,
  conditions?: TeamStrengthReferenceConditions,
) {
  const conversions: Record<string, { input: RegExp; output: RegExp }> = {
    sheer: {
      input: /^own\.(?:initial|final)\.sheerForce$/,
      output: /^ownBuff\.combat\.atk(?:_|$)/,
    },
    health: {
      input: /^own\.(?:initial|final)\.hp$/,
      output: /^ownBuff\.combat\.(?:atk|sheerForce)/,
    },
    critical: {
      input: /^own\.(?:initial|final)\.crit_$/,
      output: /ownBuff\..*anom(?:Buildup|_mv)/i,
    },
  }
  const conversion = conversions[capability]
  if (
    recipient &&
    conversion &&
    (effectsByAgent.get(recipient.agentId) ?? []).some((effect) => {
      const level = Number(/^m([1-6])(?:_|$)/i.exec(effect.effectId)?.[1] ?? 0)
      const knownMindscape = conditions?.mindscapeByAgentId?.[recipient.agentId]
      if (level && (knownMindscape === undefined || level > knownMindscape)) return false
      return (
        effect.targetKinds.includes('self') &&
        !effect.numericExpression.todoBoundary &&
        (effect.numericExpression.sourceStatus === 'upstream_expression_available' ||
          isReviewedTemplateMechanicEffect32(effect)) &&
        !expressionGates(effect.numericExpression.expressionIr, {
          'char.mindscape': knownMindscape,
          ...conditions?.supportReferencesByAgentId?.[recipient.agentId],
        }).some((gate) => gate.status === 'conflict') &&
        requiredReferences(effect.numericExpression.expressionIr).some((key) =>
          conversion.input.test(key),
        ) &&
        effectReceivers(effect.numericExpression.expressionIr).some((receiver) =>
          conversion.output.test(receiver.path),
        )
      )
    })
  )
    return true
  if (capability.startsWith('aftershock_')) return system === 'aftershock'
  if (
    ['anomaly', 'anomaly_critical', 'anomaly_proficiency', 'anomaly_mastery'].includes(capability)
  )
    return system === 'attribute_anomaly'
  if (capability === 'critical') return system !== 'attribute_anomaly'
  if (['sharp', 'laceration'].includes(capability)) return system === 'sharp'
  if (capability === 'sheer' || capability === 'health') return system === 'rupture'
  if (capability === 'defense') return system !== 'rupture'
  return true
}

/** Only evaluate explicit source gates; missing observations remain required. */
function expressionGates(
  expression: UpstreamExpressionIR,
  refs: Readonly<Record<string, unknown>>,
) {
  const gates: Array<{ referenceKeys: string[]; status: 'satisfied' | 'required' | 'conflict' }> =
    []
  const visit = (node: UpstreamExpressionIR) => {
    if (node.kind === 'call') {
      if ((node.operator === 'ifOn' || node.operator === 'ifOff') && node.receiver) {
        const referenceKeys = [...requiredReferences(node.receiver)]
        const result = evaluateUpstreamExpressionIr(node.receiver, { references: refs })
        const enabled =
          result.status === 'supported' && typeof result.value === 'boolean'
            ? node.operator === 'ifOn'
              ? result.value
              : !result.value
            : null
        gates.push({
          referenceKeys,
          status:
            enabled === null
              ? 'required'
              : enabled || node.arguments.length > 1
                ? 'satisfied'
                : 'conflict',
        })
      }
      if (node.receiver) visit(node.receiver)
      node.arguments.forEach(visit)
    } else if (node.kind === 'array') node.items.forEach(visit)
    else if (node.kind === 'object') node.entries.forEach((entry) => visit(entry.value))
    else if (node.kind === 'property') visit(node.receiver)
    else if (node.kind === 'element') {
      visit(node.receiver)
      visit(node.index)
    }
  }
  visit(expression)
  return gates
}

/** These are per-kit facts. No exact-team source or recommended-member list is consulted. */
export function teamPlayOutputRoutes(input: {
  member: Member
  memberIds: readonly string[]
  /** Source-qualified teammates supply ordinary anomalies to Refringe. */
  teammates?: readonly Member[]
  mindscape: number
  potential: number | null
  abilityActive: boolean
  conditions: TeamStrengthReferenceConditions
}) {
  const { member, conditions } = input
  if (!member.actionReady || !member.actionFacts.damage) return []
  const refs = {
    'char.mindscape': input.mindscape,
    ...conditions.supportReferencesByAgentId?.[member.agentId],
  }
  const selfEffects = (effectsByAgent.get(member.agentId) ?? []).filter(
    (effect) =>
      !effect.numericExpression.todoBoundary &&
      (effect.numericExpression.sourceStatus === 'upstream_expression_available' ||
        isReviewedTemplateMechanicEffect32(effect)) &&
      Number(/^m([1-6])(?:_|$)/i.exec(effect.effectId)?.[1] ?? 0) <= input.mindscape &&
      (!effect.effectId.startsWith('ability_') || input.abilityActive) &&
      !expressionGates(effect.numericExpression.expressionIr, refs).some(
        (gate) => gate.status === 'conflict',
      ) &&
      effectReceivers(
        baseReferenceExpression(
          effect.numericExpression.expressionIr,
          {
            'char.mindscape': input.mindscape,
            ...conditions.supportReferencesByAgentId?.[member.agentId],
          },
          input.abilityActive,
        ),
      ).some((r) => r.path.startsWith('ownBuff.')),
  )
  const conventional = ['attack', 'anomaly', 'rupture', 'armorer'].includes(member.specialty)
  const selfDamage = selfEffects.filter((e) =>
    effectReceivers(e.numericExpression.expressionIr).some(
      (r) =>
        /^ownBuff\./.test(r.path) &&
        !/dmg_red_/i.test(r.path) &&
        /(?:dmg_|\.atk$|\.atk_)/.test(r.path) &&
        (conventional ||
          /dmg_/.test(r.path) ||
          requiredReferences(e.numericExpression.expressionIr).some((key) =>
            /^own\.(?:initial|final)\.(?:def|hp|sheerForce)$/.test(key),
          )),
    ),
  )
  const declared = conditions.recipientContext?.primaryOutputAgentId === member.agentId
  // Nonconventional carries need their own sourced damage/conversion route, not a job label.
  if (!conventional && !selfDamage.length && !declared) return []
  const anomalyEffects = selfEffects.filter((e) =>
    effectReceivers(e.numericExpression.expressionIr).some((r) =>
      /ownBuff\.dmg\.anom_mv_mult_\./.test(r.path),
    ),
  )
  // Remielle's Luminize settles actual teammate-owned Voidflare snapshots; it
  // does not require her own action to build an ordinary attribute anomaly.
  const lumifluxSource = getCurrentAgentEventContract(member.agentId)?.source
  const luminizeAction =
    member.agentId === 'agent-remielle' &&
    lumifluxSource?.commit === reviewedLumifluxMechanicsIdentity32.source.commit &&
    lumifluxSource.formulaSha256 ===
      '75AF20EB1BA2266489D8901F948DB4AE51C73D5DE73C172F09B2349CFD503225'
      ? member.actionFacts.sourceActions.find((a) => a.actionId === 'BasicAttackRainbowsEnd')
      : undefined
  const flareOrigins = luminizeAction
    ? (input.teammates ?? []).filter(
        (m) =>
          m.agentId !== member.agentId &&
          input.memberIds.includes(m.agentId) &&
          m.actionReady &&
          anomalyAttribute(m) !== 'lumiflux' &&
          Boolean(ordinary(m)),
      )
    : []
  const refringeRoute = Boolean(luminizeAction && flareOrigins.length)
  const hasAnomaly =
    (Boolean(ordinary(member)) && (member.specialty === 'anomaly' || anomalyEffects.length > 0)) ||
    refringeRoute
  const aftershock = member.actionFacts.sourceActions.find((action) =>
    action.eventIds.some(
      (eventId) =>
        sourcePlanningAftershock32({
          agentId: member.agentId,
          eventId,
          memberIds: input.memberIds,
          potential: input.potential,
        }) === true,
    ),
  )
  const directAction = [member.actionFacts.direct, ...member.actionFacts.sourceActions].find(
    (action) =>
      action &&
      action.execution !== 'background_trigger' &&
      action.damageMultiplier > 0 &&
      teamStrengthSourceActionSemantics(action)?.family === 'direct' &&
      action.eventIds.every(
        (eventId) =>
          sourcePlanningAftershockEligible32({
            agentId: member.agentId,
            eventId,
          }) !== true,
      ),
  )
  const directAnomaly =
    member.specialty === 'anomaly' &&
    selfEffects.some(
      (effect) =>
        requiredReferences(effect.numericExpression.expressionIr).includes('own.final.crit_') &&
        effectReceivers(effect.numericExpression.expressionIr).some((r) =>
          /anomBuildup_/.test(r.path),
        ),
    )
  const fieldTime = getCurrentAgentDecisionMechanicContract(member.agentId)?.fieldTimeContract
  const fieldEvidence =
    conventional && fieldTime?.mode === 'primary_field' && directAction
      ? [`${fieldTime.source.url}#${fieldTime.source.locator}`]
      : []
  const systems: FiniteTeamPlay['outputSystem'][] = []
  if (member.actionFacts.sheer) systems.push('rupture')
  if (member.actionFacts.sharp) systems.push('sharp')
  if (aftershock) systems.push('aftershock')
  if (hasAnomaly && member.specialty === 'anomaly') systems.push('attribute_anomaly')
  // Direct damage is a separate route only where the kit exposes a direct
  // action and either the actor is a direct specialist or source conversion
  // establishes that direct and anomaly are both meaningful kit channels.
  if (
    directAction &&
    (!hasAnomaly || directAnomaly || member.specialty !== 'anomaly' || refringeRoute)
  )
    systems.push('direct_damage')
  // A sourced anomaly retrigger remains available without replacing a direct
  // actor's ordinary route as the default. Admission still requires the actual
  // packet and predicates; specialty alone never creates an output route.
  if (hasAnomaly && !systems.includes('attribute_anomaly')) systems.push('attribute_anomaly')
  return systems.map((system) => {
    const damageBasis = [...selfDamage]
      .sort(
        (a, b) =>
          expressionGates(a.numericExpression.expressionIr, refs).length -
            expressionGates(b.numericExpression.expressionIr, refs).length ||
          a.effectKey.localeCompare(b.effectKey),
      )
      .slice(0, 1)
    const basisEffects =
      system === 'attribute_anomaly'
        ? anomalyEffects
        : system === 'direct_damage'
          ? damageBasis
          : []
    const predicates = basisEffects.flatMap((effect) =>
      expressionGates(effect.numericExpression.expressionIr, refs).map((gate) => ({
        ...gate,
        effectKey: effect.effectKey,
        sourceRefs: effect.sourceRefs,
      })),
    )
    return {
      system,
      action:
        system === 'aftershock'
          ? aftershock!
          : system === 'rupture'
            ? member.actionFacts.sheer!
            : system === 'sharp'
              ? member.actionFacts.sharp!
              : system === 'direct_damage'
                ? directAction!
                : refringeRoute
                  ? luminizeAction!
                  : member.actionFacts.damage!,
      basis: unique([
        ...basisEffects.map((effect) => effect.effectKey),
        ...(system === 'direct_damage' ? fieldEvidence : []),
        ...(system === 'attribute_anomaly'
          ? refringeRoute
            ? [
                `luminize-source:${reviewedLumifluxMechanicsHash32}`,
                ...flareOrigins.flatMap((origin) =>
                  (ordinary(origin)?.eventIds ?? []).map(
                    (event) => `origin:${origin.agentId}:${event}`,
                  ),
                ),
              ]
            : ordinary(member)!.eventIds
          : []),
        ...(system === 'aftershock' ? aftershock!.eventIds : []),
      ]),
      qualified:
        system === 'direct_damage'
          ? damageBasis.length > 0 || fieldEvidence.length > 0
          : system === 'attribute_anomaly'
            ? hasAnomaly
            : system === 'aftershock'
              ? Boolean(aftershock)
              : system === 'rupture'
                ? Boolean(member.actionFacts.sheer)
                : Boolean(member.actionFacts.sharp),
      predicates,
    }
  })
}

/** Source-bound teammate anomaly preparation, not a claim of a proc or ownership. */
export function resolveOrdinaryAnomalyContribution(input: {
  primary: Member
  member: Member
  abilityActive: boolean
  mindscape: number
  conditions: TeamStrengthReferenceConditions
}) {
  const { primary, member, conditions } = input
  if (primary.agentId === member.agentId) return null
  const action = ordinary(member)
  if (!action) return null
  const attribute = anomalyAttribute(member)
  const refs = {
    'char.mindscape': input.mindscape,
    ...conditions.supportReferencesByAgentId?.[primary.agentId],
  }
  const matching = (effectsByAgent.get(primary.agentId) ?? []).filter((effect) => {
    if (
      effect.numericExpression.todoBoundary ||
      !(
        effect.numericExpression.sourceStatus === 'upstream_expression_available' ||
        isReviewedTemplateMechanicEffect32(effect)
      ) ||
      Number(/^m([1-6])(?:_|$)/i.exec(effect.effectId)?.[1] ?? 0) > input.mindscape ||
      (effect.effectId.startsWith('ability_') && !input.abilityActive)
    )
      return false
    const receivers = effectReceivers(effect.numericExpression.expressionIr)
    const keys = requiredReferences(effect.numericExpression.expressionIr)
    // Team anomaly settlement is explicitly source-qualified by element. An
    // ordinary self-only stat grant does not establish a teammate relation.
    const partySettlement =
      receivers.some((r) => r.path === `teamBuff.dmg.anom_mv_mult_.${attribute}`) &&
      keys.includes(`${attribute}_anomaly_inflicted`)
    // Locked Anton ability denotes a Shock retrigger, not generic anomaly
    // eligibility. This is a source-effect identity, never a team whitelist.
    const source = getCurrentAgentEventContract(primary.agentId)?.source
    const retrigger =
      effect.effectKey === 'agent-anton:ability_electric_anom_mv_mult_' &&
      source?.formulaSha256 ===
        'B121F7C2FE9C3CB57C4008FFC64C7070EC208E2614CD6A1998D0F455E8BB6221' &&
      attribute === 'electric' &&
      receivers.some((r) => r.path === 'ownBuff.dmg.anom_mv_mult_.electric')
    return (
      (partySettlement || retrigger) &&
      !expressionGates(effect.numericExpression.expressionIr, refs).some(
        (gate) => gate.status === 'conflict',
      )
    )
  })
  if (!matching.length) return null
  const source = getCurrentAgentEventContract(member.agentId)?.source
  if (!source) return null
  const predicates = matching.flatMap((effect) =>
    expressionGates(effect.numericExpression.expressionIr, refs).map((gate) => ({
      ...gate,
      effectKey: effect.effectKey,
      sourceRefs: effect.sourceRefs,
    })),
  )
  return {
    action,
    attribute,
    effectKeys: unique(matching.map((effect) => effect.effectKey)),
    referenceKeys: unique(predicates.flatMap((predicate) => predicate.referenceKeys)),
    predicates,
    sourceRefs: unique([
      `${source.formulaPath}#${source.formulaSha256}`,
      ...matching.flatMap((effect) => effect.sourceRefs),
    ]),
  }
}
