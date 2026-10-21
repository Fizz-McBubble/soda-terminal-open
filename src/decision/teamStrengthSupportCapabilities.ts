import { getCurrentAgentDecisionMechanicContract } from '../calculation/currentAgentDecisionMechanicContracts'
import { currentEffectFactAdmission } from '../calculation/currentEffectFactAdmission'
import { remielleSupportCapabilities } from '../calculation/sourceBoundAgentSupport'
import { getReviewedGenericEffectDisposition } from '../gameDataPacks/reviewedExternalEffectDispositions'
import {
  getReviewedExternalSupportFact,
  type ReviewedExternalSupportChannel,
} from '../gameDataPacks/reviewedExternalSupportFacts'
import { evaluateTeamPredicate, type TeamContext } from '../teamEngine/teamMethodR1'
import { currentAgentPlanningEffectBlueprints } from '../calculation/currentAgentPlanningEffectBlueprint'
import { isReviewedTemplateMechanicEffect32 } from '../calculation/reviewedTemplateMechanicEffects32'
import { sourcePlanningAftershockCapacity32 } from '../calculation/currentPotentialEventActions32'
import {
  bindPlanningEffectRuntimePotentialReference,
  planningCharacterReferences32,
  statReferences,
} from '../calculation/currentPlanningEffectDomain'
import { stableContentHash } from '../gameDataPacks/types'
import { applicationForReceiver } from '../calculation/currentPlanningDamageModifiers'
import {
  teamStrengthActionFacts,
  teamStrengthSourceActionSemantics,
} from './teamStrengthActionFacts'
import { createTeamStrengthReferenceRuntimeMember } from './teamStrengthReferenceState'
import type { TeamStrengthReferenceConditions } from './teamStrengthReferenceConditions'
import type { TeamStrengthRecipientContext } from './teamStrengthReferenceConditionsTypes'
import {
  type EffectReceiver,
  baseReferenceExpression,
  baseEffectReceivers,
  hasConditionalGate,
  effectReceivers,
  expressionReferences,
} from './teamStrengthSupportExpression'
type SupportMember = {
  agentId: string
  specialty: string
  attribute: string
  hpToSheer: boolean
  hasAftershockCapacity?: boolean
  actionFacts?: NonNullable<ReturnType<typeof teamStrengthActionFacts>>
}
const outputSpecialties = new Set(['attack', 'anomaly', 'rupture', 'armorer'])
const selfBlueprintsByAgent = new Map<
  string,
  (typeof currentAgentPlanningEffectBlueprints)[number][]
>()
for (const effect of currentAgentPlanningEffectBlueprints) {
  const rows = selfBlueprintsByAgent.get(effect.providerAgentId) ?? []
  rows.push(effect)
  selfBlueprintsByAgent.set(effect.providerAgentId, rows)
}
export const selfCapabilitySourceFingerprint = stableContentHash(
  currentAgentPlanningEffectBlueprints.map((effect) => [
    effect.effectKey,
    effect.targetKinds,
    effect.numericExpression.expressionSha256,
    effect.numericExpression.sourceStatus,
    effect.numericExpression.todoBoundary,
  ]),
)
const attributes = new Set(['physical', 'fire', 'ice', 'electric', 'ether', 'frost', 'wind'])
export type SupportRecipientContext = TeamStrengthRecipientContext

export type Capability =
  | 'damage'
  | 'attack'
  | 'critical'
  | 'anomaly_critical'
  | 'defense'
  | 'resistance'
  | 'anomaly'
  | 'anomaly_proficiency'
  | 'anomaly_mastery'
  | 'sheer'
  | 'health'
  | 'stun'
  | 'sharp'
  | 'laceration'
  | 'aftershock_damage'
  | 'aftershock_critical'
  | 'aftershock_defense'
  | 'aftershock_stun'

const reviewedCapability: Record<ReviewedExternalSupportChannel, Capability> = {
  attack_from_source_initial_attack: 'attack',
  combat_attack_flat: 'attack',
  all_damage_bonus: 'damage',
  enemy_stun_damage_multiplier: 'stun',
  enemy_stun_duration: 'stun',
  critical_damage_bonus: 'critical',
  electric_defense_ignore: 'defense',
}

export function capabilityFor(receiver: EffectReceiver, effectId: string): Capability | null {
  const label = `${receiver.path}.${receiver.damageType ?? ''}.${effectId}`.toLowerCase()
  if (receiver.damageType === 'aftershock') {
    if (/crit/.test(receiver.path)) return 'aftershock_critical'
    if (/defRed|defIgn/.test(receiver.path)) return 'aftershock_defense'
    if (/daze|stun_/.test(receiver.path)) return 'aftershock_stun'
    if (/dmg_/.test(receiver.path)) return 'aftershock_damage'
    return null
  }
  if (/laceration/.test(label)) return 'laceration'
  if (/sharp/.test(label)) return 'sharp'
  if (/sheerforce|sheer_dmg/.test(label)) return 'sheer'
  if (/anom_crit/.test(label)) return 'anomaly_critical'
  if (/anomprof/.test(label)) return 'anomaly_proficiency'
  if (/anommas/.test(label)) return 'anomaly_mastery'
  if (/anom|disorder/.test(label)) return 'anomaly'
  if (/crit/.test(label)) return 'critical'
  if (/resred|resign/.test(label)) return 'resistance'
  if (/defred|defign|\.pen_/.test(label)) return 'defense'
  if (/daze|\.stun_|\.impact/.test(label)) return 'stun'
  if (/\.atk(?:_|\.|$)/.test(label)) return 'attack'
  if (/\.hp(?:_|\.|$)/.test(label)) return 'health'
  if (/dmg_|dmginc|dmgbonus/.test(label)) return 'damage'
  return null
}

export function recipientCompatible(
  member: SupportMember,
  capability: Capability,
  receiver: EffectReceiver,
) {
  const requiredAttribute = [
    ...receiver.path.split('.'),
    ...(receiver.damageType ? [receiver.damageType] : []),
  ].find((part) => attributes.has(part))
  if (requiredAttribute && requiredAttribute !== member.attribute) return false
  // A special damage channel is not interchangeable with a skill category.
  // Do not lend an Abloom/Aftershock-only buff to every ordinary attacker.
  if (receiver.damageType === 'abloom') return false
  // A stunner may have real aftershock damage. Specialty alone neither proves
  // nor disproves that source-bound action; never lend it to an ordinary attack.
  if (receiver.damageType === 'aftershock') return member.hasAftershockCapacity === true
  if (!outputSpecialties.has(member.specialty) && member.specialty !== 'stun') return false
  const actions = member.actionFacts ?? teamStrengthActionFacts({ agentId: member.agentId })
  if (!actions?.damage) return false
  const direct = teamStrengthSourceActionSemantics(actions?.direct ?? null)
  const sheer = teamStrengthSourceActionSemantics(actions?.sheer ?? null)
  const sharp = teamStrengthSourceActionSemantics(actions?.sharp ?? null)
  if (capability === 'sharp' || capability === 'laceration') return sharp?.family === 'sharp'
  if (capability === 'attack')
    return direct?.scalingAttribute === 'attack' || sheer?.family === 'sheer'
  if (capability === 'sheer') {
    if (sheer?.family === 'sheer') return true
    // Sheer Force can feed a sourced personal conversion on a non-Rupture
    // actor (Norma). This admits the stat grant, never Sheer DMG bonuses.
    return (
      receiver.path.endsWith('.sheerForce') &&
      direct?.scalingAttribute === 'attack' &&
      (selfBlueprintsByAgent.get(member.agentId) ?? []).some(
        (entry) =>
          isReviewedTemplateMechanicEffect32(entry) &&
          !entry.numericExpression.todoBoundary &&
          entry.targetKinds.includes('self') &&
          effectReceivers(entry.numericExpression.expressionIr).some(
            (effect) => effect.path === 'ownBuff.combat.atk',
          ) &&
          expressionReferences(entry.numericExpression.expressionIr).includes(
            'own.final.sheerForce',
          ),
      )
    )
  }
  if (capability === 'health') return member.hpToSheer
  if (
    ['anomaly', 'anomaly_critical', 'anomaly_proficiency', 'anomaly_mastery'].includes(capability)
  )
    return member.specialty === 'anomaly'
  // The typed core uses rate/damage for direct and sheer; sharp uses crit
  // rate for its laceration checks but never ordinary crit damage.
  // An Anomaly-specialty actor may have both ordinary direct damage and an
  // independent anomaly channel; neither critical rule is borrowed by the other.
  if (capability === 'critical')
    return (
      direct?.family === 'direct' ||
      sheer?.family === 'sheer' ||
      (sharp?.family === 'sharp' && applicationForReceiver(receiver.path) === 'crit_rate')
    )
  // Locked common/index.ts also supplies rupture's base ATK-to-sheer conversion.
  // Sheer bypasses defense, not elemental resistance; keep those channels apart.
  if (capability === 'defense') return direct?.family === 'direct' || sharp?.family === 'sharp'
  return true
}

export function compatibleCapabilities(
  inputMembers: SupportMember[],
  abilityById: ReadonlyMap<string, boolean>,
  context: TeamContext,
  recipientContext: SupportRecipientContext = {},
  referenceConditions?: TeamStrengthReferenceConditions,
) {
  const memberIds = inputMembers.map((member) => member.agentId)
  const references = referenceConditions ?? {
    potentialByAgentId: Object.fromEntries(
      memberIds.flatMap((id) => {
        const potential = context.agentStateById?.[id]?.potentialImage
        return typeof potential === 'number' ? [[id, potential]] : []
      }),
    ),
    evidenceRefs: [],
  }
  const runtimeById = new Map(
    memberIds.map((id) => [id, createTeamStrengthReferenceRuntimeMember(id, references)]),
  )
  const members = inputMembers.map((member) => ({
    ...member,
    hasAftershockCapacity: sourcePlanningAftershockCapacity32({
      agentId: member.agentId,
      memberIds,
      potential: runtimeById.get(member.agentId)!.potential ?? 0,
    }),
  }))
  const covered = new Map<Capability, Set<string>>()
  const selfCovered = new Map<string, Set<string>>()
  const providers = new Map<string, Set<string>>()
  let conditional = false
  const unverifiedProviders = new Set<string>()
  const reviewedProviders = new Set<string>()
  const deferredProviders = new Set<string>()
  const sourceConflictProviders = new Set<string>()
  const attributeConditionalRecipients = new Set<string>()
  function cover(provider: SupportMember, capability: Capability, receiver: EffectReceiver) {
    for (const target of members) {
      if (target.agentId === provider.agentId || !recipientCompatible(target, capability, receiver))
        continue
      // Roxy.ts represents these as generic receivers, but the original 3.2
      // description requires Wind or the actual Contamination/Cleanse attribute.
      // Composition alone cannot establish the latter runtime state.
      if (
        provider.agentId === 'agent-roxy' &&
        (capability === 'critical' ||
          capability === 'laceration' ||
          receiver.path.includes('direct_dmg_')) &&
        !roxyRecipientWindowCompatible(target, capability, recipientContext)
      ) {
        attributeConditionalRecipients.add(target.agentId)
        continue
      }
      const outputCapability = capability === 'health' ? 'sheer' : capability
      const targets = covered.get(outputCapability) ?? new Set<string>()
      targets.add(target.agentId)
      covered.set(outputCapability, targets)
      const key = `${outputCapability}:${target.agentId}`
      const sources = providers.get(key) ?? new Set<string>()
      sources.add(provider.agentId)
      providers.set(key, sources)
    }
  }
  for (const provider of members) {
    const runtime = runtimeById.get(provider.agentId)!
    const reference = bindPlanningEffectRuntimePotentialReference({
      agentId: provider.agentId,
      potential: runtime.potential,
      references: {
        ...planningCharacterReferences32(runtime),
        ...statReferences('own.initial', runtime.initialStats),
      },
    })
    // Use the reconciled production blueprint. Some retained source catalog
    // entries are generic slots; only their pinned original IR proves capacity.
    for (const effect of selfBlueprintsByAgent.get(provider.agentId) ?? []) {
      if (
        /^potential/i.test(effect.effectId) ||
        Number(/^m([1-6])(?:_|$)/i.exec(effect.effectId)?.[1] ?? 0) > runtime.mindscape ||
        !effect.targetKinds.some(
          (kind) => kind === 'self' || kind === 'team' || kind === 'enemy',
        ) ||
        (effect.numericExpression.sourceStatus !== 'upstream_expression_available' &&
          !isReviewedTemplateMechanicEffect32(effect)) ||
        Boolean(effect.numericExpression.todoBoundary) ||
        (effect.effectId.startsWith('ability_') && !abilityById.get(provider.agentId))
      )
        continue
      const specialized = baseReferenceExpression(
        effect.numericExpression.expressionIr,
        reference,
        abilityById.get(provider.agentId) === true,
      )
      const registered = isReviewedTemplateMechanicEffect32(effect)
      for (const receiver of effectReceivers(specialized)) {
        if (registered && /^(?:teamBuff|notOwnBuff|enemyDebuff)\./.test(receiver.path)) {
          const external = capabilityFor(receiver, effect.effectId)
          if (external) {
            cover(provider, external, receiver)
            conditional ||= hasConditionalGate(specialized)
          }
        }
        if (!/^(?:ownBuff|teamBuff)\./.test(receiver.path)) continue
        const channel = /\.anom_crit(?:_|_dmg_)/.test(receiver.path)
          ? 'anomaly_critical'
          : capabilityFor(receiver, effect.effectId)
        if (!channel || channel === 'health' || channel === 'stun') continue
        if (
          channel === 'anomaly_critical'
            ? provider.specialty !== 'anomaly' ||
              (receiver.path.endsWith('.physical') && provider.attribute !== 'physical')
            : !recipientCompatible(provider, channel, receiver)
        )
          continue
        const recipients = selfCovered.get(channel) ?? new Set<string>()
        recipients.add(provider.agentId)
        selfCovered.set(channel, recipients)
        conditional ||=
          effect.numericExpression.dependencyKinds.includes('conditional_state') ||
          hasConditionalGate(specialized)
      }
    }
    const reviewed = getReviewedExternalSupportFact(provider.agentId)
    for (const effect of reviewed?.effects ?? []) {
      const gate = effect.eligibility
      if (gate.minimumMindscape > runtime.mindscape) continue
      if (gate.teamPredicate && !evaluateTeamPredicate(gate.teamPredicate, context)) continue
      if (
        gate.additionalAbilityRequired &&
        !gate.teamPredicate &&
        !abilityById.get(provider.agentId)
      )
        continue
      // This feature is conditional capacity, never current combat activation,
      // duration-weighted damage, or an initial-panel contribution.
      conditional ||= gate.requiresCombatTrigger || gate.runtimeStateIds.length > 0
      reviewedProviders.add(provider.agentId)
      cover(provider, reviewedCapability[effect.channel], {
        path: effect.recipientAttribute
          ? `sourceBound.external.${effect.recipientAttribute}`
          : 'sourceBound.external',
        damageType: null,
      })
    }
    if (provider.agentId === 'agent-remielle') {
      const facts = remielleSupportCapabilities()
      if (facts.damage)
        cover(provider, 'damage', { path: 'teamBuff.combat.common_dmg_', damageType: null })
      if (facts.attack && abilityById.get(provider.agentId))
        cover(provider, 'attack', { path: 'teamBuff.combat.atk', damageType: null })
      conditional = true
    }
    const effects = getCurrentAgentDecisionMechanicContract(provider.agentId)?.effectContract
      .effects
    for (const effect of effects ?? []) {
      // S0 excludes unavailable mindscapes; A6 must retain its sourced grants.
      // Named potential effects still belong to the prepared-event path.
      if (/^potential/i.test(effect.effectId)) continue
      if (Number(/^m([1-6])(?:_|$)/i.exec(effect.effectId)?.[1] ?? 0) > runtime.mindscape) continue
      if (effect.effectId.startsWith('ability_') && !abilityById.get(provider.agentId)) continue
      if (!effect.recipients.some((recipient) => recipient !== 'self')) continue
      if (currentEffectFactAdmission(effect) !== 'source_expression') {
        const disposition = getReviewedGenericEffectDisposition(provider.agentId, effect.effectId)
        if (disposition) {
          if (disposition.disposition === 'typed_external_effect_pending_consumer')
            deferredProviders.add(provider.agentId)
          if (disposition.targetVersionStatus === 'released_page_conflict')
            sourceConflictProviders.add(provider.agentId)
          // A reviewed personal effect or a typed but unmodeled event cannot
          // turn a generic writable slot into team damage or enemy DEF loss.
          continue
        }
        // Remielle's retained source facts supersede these two generic slots;
        // the DEF slot is not M0 global reduction (M2 anomaly-only ignore).
        if (
          !(
            provider.agentId === 'agent-remielle' &&
            ['team_dmg_', 'enemy_defRed_'].includes(effect.effectId)
          )
        )
          unverifiedProviders.add(provider.agentId)
        continue
      }
      const adopted = (selfBlueprintsByAgent.get(provider.agentId) ?? []).find(
        (blueprint) => blueprint.effectId === effect.effectId,
      )
      if (
        !adopted ||
        adopted.numericExpression.sourceStatus !== 'upstream_expression_available' ||
        adopted.numericExpression.todoBoundary
      ) {
        deferredProviders.add(provider.agentId)
        continue
      }
      // Both personal and external capacities consume the same reconciled
      // adopted expression; the raw contract above is retained for diagnostics.
      conditional ||= adopted.numericExpression.dependencyKinds.some(
        (kind) => kind === 'conditional_state',
      )
      for (const receiver of baseEffectReceivers(
        adopted.numericExpression.expressionIr,
        reference,
        abilityById.get(provider.agentId) === true,
      )) {
        if (!/^(?:teamBuff|notOwnBuff|enemyDebuff)\./.test(receiver.path)) continue
        const capability = capabilityFor(receiver, effect.effectId)
        if (!capability) continue
        cover(provider, capability, receiver)
      }
    }
  }
  const outputCount = members.filter((member) => outputSpecialties.has(member.specialty)).length
  const aftershockCount = members.filter((member) => member.hasAftershockCapacity).length
  const recipientCount = (capability: Capability) =>
    capability.startsWith('aftershock_')
      ? aftershockCount
      : Math.max(outputCount, covered.get(capability)?.size ?? 0)
  return {
    coverage: (capability: Capability) =>
      (covered.get(capability)?.size ?? 0) / Math.max(1, recipientCount(capability)),
    selfCoverage: (capability: string) =>
      (selfCovered.get(capability)?.size ?? 0) /
      Math.max(1, capability.startsWith('aftershock_') ? aftershockCount : outputCount),
    unverifiedProviders: [...unverifiedProviders].sort(),
    reviewedProviders: [...reviewedProviders].sort(),
    deferredProviders: [...deferredProviders].sort(),
    sourceConflictProviders: [...sourceConflictProviders].sort(),
    attributeConditionalRecipients: [...attributeConditionalRecipients].sort(),
    // Distinct compatible providers, not effect records or a claim that buffs
    // stack continuously. The fitted model learns this capacity's contribution.
    multiProvider:
      [...providers.values()].filter((sources) => sources.size > 1).length /
      Math.max(1, outputCount),
    conditional,
  }
}

function roxyRecipientWindowCompatible(
  target: SupportMember,
  capability: Capability,
  context: SupportRecipientContext,
) {
  const window = context.roxyWindowsByRecipientId?.[target.agentId]
  if (!window)
    return (
      target.attribute === 'wind' ||
      context.contaminationAttributes?.includes(target.attribute) === true
    )
  if (capability === 'critical' || capability === 'laceration')
    return target.attribute === 'wind'
      ? window.wind
      : target.attribute === 'electric' && window.wind && window.electric
  return (
    window.windsweptObserved &&
    window.squadWindswept &&
    (target.attribute === 'wind' || window.contaminationMatches)
  )
}

export { expressionReferences, effectReceivers } from './teamStrengthSupportExpression'
