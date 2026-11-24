import { currentAgentPlanningEffectBlueprints } from '../calculation/currentAgentPlanningEffectBlueprint'
import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import { getCurrentAgentDecisionMechanicContract } from '../calculation/currentAgentDecisionMechanicContracts'
import { remielleSupportCapabilities } from '../calculation/sourceBoundAgentSupport'
import { stableContentHash } from '../domain/stableContentHash'
import type { TeamPlayMechanismProof } from '../domain/teamPlayMechanismContract'
import { getReviewedExternalSupportFact } from '../gameDataPacks/reviewedExternalSupportFacts'
import type { FiniteTeamPlay } from './teamFinitePlayContract'
import { teamPlayBackgroundEvidence } from './teamStrengthBackgroundActions'
import type { Member } from './teamStrengthMemberFacts'
import type { TeamStrengthReferenceConditions } from './teamStrengthReferenceConditionsTypes'
import { capabilityFor } from './teamStrengthSupportCapabilities'
import { effectReceivers } from './teamStrengthSupportExpression'

export const effectByKey = new Map(
  currentAgentPlanningEffectBlueprints.map((effect) => [effect.effectKey, effect]),
)
export const uniqueSorted = (values: string[]) => [...new Set(values)].sort()

export const ordinaryAnomalyAction = (member: Member) =>
  member.actionFacts.sourceActions.find(
    (action) =>
      action.anomalyBuildup > 0 &&
      action.execution !== 'background_trigger' &&
      !/charged|frostmoon|salchow|hold/i.test(action.actionId) &&
      ['basic', 'special', 'assist', 'dodge'].includes(action.skill),
  )

// The locked Miyabi sheet owns Frost, a separate anomaly from ordinary Ice.
export const agentAnomalyAttribute = (member: Member) =>
  getCurrentAgentEventContract(member.agentId)?.upstreamKey === 'Miyabi'
    ? 'frost'
    : member.attribute

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
    const effects = uniqueSorted(links.flatMap((link) => link.effectKeys))
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
    const channels = uniqueSorted(
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
      basis: uniqueSorted(
        role.role === 'primary_output'
          ? [...primaryRoute.basis, ...role.eventIds]
          : [...supportBasis, ...role.eventIds],
      ),
      channels: [
        ...channels,
        ...(role.role === 'stun' ? ['stun_window'] : []),
        ...(role.role === 'background_output' ? ['background_output'] : []),
        ...(role.role === 'ordinary_anomaly'
          ? [`anomaly:${agentAnomalyAttribute(memberById.get(role.agentId)!)}`]
          : []),
      ],
    }
  })
  for (const role of play.roles) {
    const member = memberById.get(role.agentId)!
    const links = play.contributions.filter((link) => link.providerAgentId === role.agentId)
    const effects = uniqueSorted(links.flatMap((link) => link.effectKeys))
    const eventKeys = [...role.eventIds]
    const bindings = uniqueSorted([...eventKeys, ...effects])
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
        bindingKeys: uniqueSorted([...eventKeys, ...primaryRoute.basis]),
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
          ? [...memberById.values()].filter((candidate) =>
              member.agentId === 'agent-remielle' && agentAnomalyAttribute(member) === 'lumiflux'
                ? candidate.agentId !== member.agentId &&
                  candidate.actionReady &&
                  agentAnomalyAttribute(candidate) !== 'lumiflux' &&
                  Boolean(ordinaryAnomalyAction(candidate))
                : agentAnomalyAttribute(candidate) === agentAnomalyAttribute(member) &&
                  Boolean(ordinaryAnomalyAction(candidate)),
            )
          : [member]
      const anomalyEvents = originMembers.flatMap((origin) =>
        (ordinaryAnomalyAction(origin)?.eventIds ?? []).map(
          (event) => `origin:${origin.agentId}:${event}`,
        ),
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
        condition.referenceKeys = uniqueSorted(actualBindings)
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
        bindingKeys: uniqueSorted(actualBindings),
        referenceKeys: [...condition.referenceKeys],
        sourceRefs:
          kind === 'original_anomaly'
            ? uniqueSorted([...condition.sourceRefs, ...anomalySources])
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
