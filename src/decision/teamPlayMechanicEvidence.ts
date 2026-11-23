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
import { teamPlayBackgroundEvidence } from './teamStrengthBackgroundActions'
import { teamStrengthSourceActionSemantics } from './teamStrengthActionFacts'
import { getReviewedExternalSupportFact } from '../gameDataPacks/reviewedExternalSupportFacts'
import { remielleSupportCapabilities } from '../calculation/sourceBoundAgentSupport'
import { reviewedLumifluxMechanicsIdentity32, reviewedLumifluxMechanicsHash32 } from '../calculation/reviewedLumifluxMechanics32'
import { stableContentHash } from '../domain/stableContentHash'
import type { TeamPlayMechanismProof } from '../domain/teamPlayMechanismContract'
import { baseReferenceExpression, effectReceivers } from './teamStrengthSupportExpression'
import { capabilityFor } from './teamStrengthSupportCapabilities'
import type { Member } from './teamStrengthMemberFacts'
import type { TeamStrengthReferenceConditions } from './teamStrengthReferenceConditionsTypes'
import type { FiniteTeamPlay } from './teamFinitePlayContract'

const effectsByAgent = new Map<string, (typeof currentAgentPlanningEffectBlueprints)[number][]>()
for (const effect of currentAgentPlanningEffectBlueprints) {
  const entries = effectsByAgent.get(effect.providerAgentId) ?? []
  entries.push(effect)
  effectsByAgent.set(effect.providerAgentId, entries)
}
const effectByKey = new Map(currentAgentPlanningEffectBlueprints.map((e) => [e.effectKey, e]))
const unique = (values: string[]) => [...new Set(values)].sort()
const ordinary = (member: Member) =>
  member.actionFacts.sourceActions.find(
    (action) =>
      action.anomalyBuildup > 0 &&
      action.execution !== 'background_trigger' &&
      !/charged|frostmoon|salchow|hold/i.test(action.actionId) &&
      ['basic', 'special', 'assist', 'dodge'].includes(action.skill),
  )
// The locked Miyabi sheet owns Frost, a separate anomaly from ordinary Ice.
const anomalyAttribute = (member: Member) =>
  getCurrentAgentEventContract(member.agentId)?.upstreamKey === 'Miyabi'
    ? 'frost'
    : member.attribute

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
  const luminizeAction = member.agentId === 'agent-remielle' &&
    lumifluxSource?.commit === reviewedLumifluxMechanicsIdentity32.source.commit &&
    lumifluxSource.formulaSha256 === '75AF20EB1BA2266489D8901F948DB4AE51C73D5DE73C172F09B2349CFD503225'
    ? member.actionFacts.sourceActions.find((a) => a.actionId === 'BasicAttackRainbowsEnd')
    : undefined
  const flareOrigins = luminizeAction ? (input.teammates ?? []).filter((m) =>
    m.agentId !== member.agentId && input.memberIds.includes(m.agentId) && m.actionReady &&
    anomalyAttribute(m) !== 'lumiflux' && Boolean(ordinary(m))) : []
  const refringeRoute = Boolean(luminizeAction && flareOrigins.length)
  const hasAnomaly =
    (Boolean(ordinary(member)) && (member.specialty === 'anomaly' || anomalyEffects.length > 0)) || refringeRoute
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
  if (directAction && (!hasAnomaly || directAnomaly || member.specialty !== 'anomaly' || refringeRoute))
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
                : (refringeRoute ? luminizeAction! : member.actionFacts.damage!),
      basis: unique([
        ...basisEffects.map((effect) => effect.effectKey),
        ...(system === 'direct_damage' ? fieldEvidence : []),
        ...(system === 'attribute_anomaly'
          ? refringeRoute
            ? [`luminize-source:${reviewedLumifluxMechanicsHash32}`, ...flareOrigins.flatMap((origin) =>
                (ordinary(origin)?.eventIds ?? []).map((event) => `origin:${origin.agentId}:${event}`))]
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

/** Compile typed source joins for admission; required preparation is never claimed active. */
export function compileTeamPlayMechanismProof(
  play: FiniteTeamPlay,
  primaryRoute: {
    basis: string[]
    qualified: boolean
    predicates?: Array<{
      effectKey: string
      referenceKeys: string[]
      status: 'satisfied' | 'required' | 'conflict'
      sourceRefs: string[]
    }>
  },
  memberById: ReadonlyMap<string, Member>,
  conditions: TeamStrengthReferenceConditions,
): TeamPlayMechanismProof {
  const requirements: TeamPlayMechanismProof['requirements'] = []
  const primary = play.primaryOutputAgentId
  const roleChecks = play.roles.map((role) => {
    const links = play.contributions.filter((link) => link.providerAgentId === role.agentId)
    const effects = unique(links.flatMap((link) => link.effectKeys))
    // A lone M4 party buff is an incidental grant, not this actor's complete support job.
    const supportBasis = effects.filter((key) => !/:(?:m[1-6])(?:_|$)/i.test(key))
    const member = memberById.get(role.agentId)!
    const matchesAction = (
      predicate: (action: Member['actionFacts']['sourceActions'][number]) => boolean,
    ) =>
      member.actionFacts.sourceActions.some(
        (action) =>
          predicate(action) &&
          role.eventIds.length > 0 &&
          role.eventIds.every((event) => action.eventIds.includes(event)),
      )
    const supportedEffects = supportBasis.filter((key) => {
      const effect = effectByKey.get(key)
      if (effect)
        return (
          effect.providerAgentId === role.agentId &&
          effect.targetKinds.some((target) => target !== 'self') &&
          !effect.numericExpression.todoBoundary &&
          effectReceivers(effect.numericExpression.expressionIr).length > 0
        )
      const reviewed = getReviewedExternalSupportFact(role.agentId)
      if (reviewed?.effects.some((entry) => key === `${role.agentId}:reviewed:${entry.channel}`))
        return true
      if (role.agentId !== 'agent-remielle') return false
      const facts = remielleSupportCapabilities()
      return (
        (key === `${role.agentId}:source-bound:attack` && facts.attack) ||
        (key === `${role.agentId}:source-bound:common_damage` && facts.damage)
      )
    })
    const background = role.role === 'background_output' ? teamPlayBackgroundEvidence(member) : null
    const qualified =
      role.role === 'primary_output'
        ? primaryRoute.qualified
        : role.role === 'support'
          ? supportedEffects.length > 0
          : role.role === 'stun'
            ? matchesAction((action) => action.dazeMultiplier > 0)
            : role.role === 'ordinary_anomaly'
              ? matchesAction(
                  (action) =>
                    action.anomalyBuildup > 0 &&
                    !/charged|frostmoon|salchow|hold/i.test(action.actionId) &&
                    ['basic', 'special', 'assist', 'dodge'].includes(action.skill),
                )
              : role.role === 'background_output'
                ? Boolean(background) &&
                  role.eventIds.length > 0 &&
                  role.eventIds.every((event) => background!.eventIds.includes(event))
                : false
    const channels = unique(
      supportBasis.flatMap((key) => {
        const effect = effectByKey.get(key)
        return effect
          ? effectReceivers(effect.numericExpression.expressionIr).map(
              (r) => capabilityFor(r, effect.effectId) ?? `${r.path}:${r.damageType ?? 'all'}`,
            )
          : [key.split(':').slice(1).join(':')]
      }),
    )
    return {
      agentId: role.agentId,
      role: role.role,
      qualified,
      basis: unique(
        role.role === 'primary_output'
          ? [...primaryRoute.basis, ...role.eventIds]
          : [...supportBasis, ...role.eventIds],
      ),
      channels: [
        ...channels,
        ...(role.role === 'stun' ? ['stun_window'] : []),
        ...(role.role === 'background_output' ? ['background_output'] : []),
        ...(role.role === 'ordinary_anomaly'
          ? [`anomaly:${anomalyAttribute(memberById.get(role.agentId)!)}`]
          : []),
      ],
    }
  })
  for (const role of play.roles) {
    const member = memberById.get(role.agentId)!
    const links = play.contributions.filter((link) => link.providerAgentId === role.agentId)
    const effects = unique(links.flatMap((link) => link.effectKeys))
    const eventKeys = [...role.eventIds]
    const bindings = unique([...eventKeys, ...effects])
    const base = {
      agentId: role.agentId,
      sourceRefs: role.sourceRefs,
      referenceKeys: [] as string[],
    }
    if (eventKeys.length)
      requirements.push({ ...base, kind: 'action', status: 'satisfied', bindingKeys: eventKeys })
    if (role.agentId === primary) {
      requirements.push({
        ...base,
        kind: 'primary_route',
        status: primaryRoute.qualified ? 'satisfied' : 'unknown',
        bindingKeys: unique([...eventKeys, ...primaryRoute.basis]),
      })
      for (const predicate of primaryRoute.predicates ?? [])
        requirements.push({
          ...base,
          kind: 'primary_route',
          status: predicate.status,
          bindingKeys: [predicate.effectKey],
          referenceKeys: predicate.referenceKeys,
          sourceRefs: predicate.sourceRefs,
        })
    }
    for (const link of links) {
      if (link.effectKeys.length)
        requirements.push({
          ...base,
          kind: 'effect',
          status: link.state === 'active' ? 'satisfied' : 'required',
          bindingKeys: link.effectKeys,
          recipientAgentId: link.recipientAgentId,
          sourceRefs: link.sourceRefs,
        })
      requirements.push({
        ...base,
        kind: 'recipient',
        status: 'satisfied',
        bindingKeys: bindings,
        recipientAgentId: link.recipientAgentId,
      })
      requirements.push({
        ...base,
        kind: role.role === 'background_output' ? 'resource' : 'field_handoff',
        status: 'required',
        bindingKeys: eventKeys.length ? eventKeys : effects,
        recipientAgentId: link.recipientAgentId,
      })
    }
    const resource = getCurrentAgentDecisionMechanicContract(role.agentId)?.resourceContract
    const sourceIdentity = getCurrentAgentEventContract(role.agentId)!.source
    const sourceEvents = getCurrentAgentEventContract(role.agentId)!.eventContract.events.filter(
      (event) => eventKeys.includes(event.eventId),
    )
    // A source-declared zero consumption stays zero without inventing a raw-unit scale.
    // This covers the existing normal Phoenix packet, not charged/EX preparation.
    const sourceZeroConsumption =
      sourceEvents.length > 0 &&
      sourceEvents.length === eventKeys.length &&
      sourceEvents.every((event) => {
        const explicit = event as typeof event & {
          resourceParameters?: { sp_consume?: { operator?: { kind: string; value?: number } } }
          formulaBinding?: { requiredState?: unknown }
        }
        return (
          explicit.formulaBinding?.requiredState === null &&
          explicit.resourceParameters?.sp_consume?.operator?.kind === 'constant' &&
          explicit.resourceParameters.sp_consume.operator.value === 0
        )
      })
    const resourceBinding = resource?.resourceFlow
      ? [
          `resource-flow:${sourceIdentity.formulaSha256}:${stableContentHash(resource.resourceFlow)}`,
        ]
      : sourceZeroConsumption
        ? eventKeys.map(
            (event) => `source-zero-consumption:${sourceIdentity.formulaSha256}:${event}`,
          )
        : []
    const state = conditions.supportReferencesByAgentId?.[role.agentId] ?? {}
    for (const condition of play.conditions.filter((c) => c.agentId === role.agentId)) {
      const kind = condition.kind === 'trigger' ? 'action' : condition.kind
      const originMembers =
        condition.kind === 'original_anomaly' && role.agentId === primary
          ? [...memberById.values()].filter(
              (candidate) =>
                member.agentId === 'agent-remielle' && anomalyAttribute(member) === 'lumiflux'
                  ? candidate.agentId !== member.agentId && candidate.actionReady && anomalyAttribute(candidate) !== 'lumiflux' && Boolean(ordinary(candidate))
                  : anomalyAttribute(candidate) === anomalyAttribute(member) && Boolean(ordinary(candidate)),
            )
          : [member]
      const anomalyEvents = originMembers.flatMap((origin) =>
        (ordinary(origin)?.eventIds ?? []).map((event) => `origin:${origin.agentId}:${event}`),
      )
      const anomalySources = originMembers.flatMap((origin) => {
        const source = getCurrentAgentEventContract(origin.agentId)?.source
        return source ? [`${source.formulaPath}#${source.formulaSha256}`] : []
      })
      // Bind a condition to the facts of its own kind. Source reference keys
      // remain predicates, not replacement event IDs or assumed true states.
      const backgroundEvidence =
        role.role === 'background_output' ? teamPlayBackgroundEvidence(member) : null
      const backgroundBinding =
        backgroundEvidence &&
        eventKeys.length > 0 &&
        eventKeys.every((event) => backgroundEvidence.eventIds.includes(event))
          ? eventKeys.map((event) => `background-preparation:${role.agentId}:${event}`)
          : []
      const actualBindings =
        kind === 'original_anomaly'
          ? anomalyEvents
          : kind === 'resource'
            ? [...resourceBinding, ...backgroundBinding]
            : kind === 'action'
              ? [...eventKeys, ...effects]
              : kind === 'recipient'
                ? effects
                : eventKeys
      if (!condition.referenceKeys.length && actualBindings.length)
        condition.referenceKeys = unique(actualBindings)
      const declared = condition.referenceKeys
        .map((key) => state[key])
        .filter((value) => typeof value === 'boolean')
      const status = !actualBindings.length
        ? 'unknown'
        : declared.includes(false)
          ? 'conflict'
          : 'required'
      requirements.push({
        ...base,
        kind,
        recipientAgentId: kind === 'recipient' ? primary : undefined,
        status,
        bindingKeys: unique(actualBindings),
        referenceKeys: [...condition.referenceKeys],
        sourceRefs:
          kind === 'original_anomaly'
            ? unique([...condition.sourceRefs, ...anomalySources])
            : condition.sourceRefs,
      })
    }
    // Key states are part of the exact branch identity even when they do not change presentation.
    const reference = {
      mindscape: conditions.mindscapeByAgentId?.[role.agentId],
      potential: conditions.potentialByAgentId[role.agentId],
      state,
    }
    for (const r of requirements.filter((r) => r.agentId === role.agentId))
      r.referenceKeys.push(`reference:${stableContentHash(reference)}`)
  }
  return { contract: 'team-play-mechanism/v1', roleChecks, requirements }
}
