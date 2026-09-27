import { getCurrentAgentDecisionMechanicContract } from '../calculation/currentAgentDecisionMechanicContracts'
import { currentEffectFactAdmission } from '../calculation/currentEffectFactAdmission'
import { remielleSupportCapabilities } from '../calculation/sourceBoundAgentSupport'
import type { UpstreamExpressionIR } from '../calculation/currentUpstreamExpressionIR'
import { getReviewedGenericEffectDisposition } from '../gameDataPacks/reviewedExternalEffectDispositions'
import {
  getReviewedExternalSupportFact,
  type ReviewedExternalSupportChannel,
} from '../gameDataPacks/reviewedExternalSupportFacts'
import { evaluateTeamPredicate, type TeamContext } from '../teamEngine/teamMethodR1'

type SupportMember = { agentId: string; specialty: string; attribute: string; hpToSheer: boolean }
const outputSpecialties = new Set(['attack', 'anomaly', 'rupture'])
const attributes = new Set(['physical', 'fire', 'ice', 'electric', 'ether', 'frost'])

type EffectReceiver = { path: string; damageType: string | null }
export function expressionReferences(expression: UpstreamExpressionIR): string[] {
  if (expression.kind === 'reference') return [expression.path]
  if (expression.kind === 'call')
    return [
      ...expression.arguments.flatMap(expressionReferences),
      ...(expression.receiver ? expressionReferences(expression.receiver) : []),
    ]
  if (expression.kind === 'property') return expressionReferences(expression.receiver)
  if (expression.kind === 'element')
    return [...expressionReferences(expression.receiver), ...expressionReferences(expression.index)]
  if (expression.kind === 'array') return expression.items.flatMap(expressionReferences)
  if (expression.kind === 'object')
    return expression.entries.flatMap((entry) => expressionReferences(entry.value))
  return []
}

export function effectReceivers(expression: UpstreamExpressionIR): EffectReceiver[] {
  if (expression.kind === 'call') {
    const own =
      ['add', 'addWithDmgType'].includes(expression.operator) &&
      expression.receiver?.kind === 'reference'
        ? [
            {
              path: expression.receiver.path,
              damageType:
                expression.operator === 'addWithDmgType' &&
                expression.arguments[0]?.kind === 'literal' &&
                typeof expression.arguments[0].value === 'string'
                  ? expression.arguments[0].value
                  : null,
            },
          ]
        : []
    return [
      ...own,
      ...expression.arguments.flatMap(effectReceivers),
      ...(expression.receiver ? effectReceivers(expression.receiver) : []),
    ]
  }
  if (expression.kind === 'property') return effectReceivers(expression.receiver)
  if (expression.kind === 'element')
    return [...effectReceivers(expression.receiver), ...effectReceivers(expression.index)]
  if (expression.kind === 'array') return expression.items.flatMap(effectReceivers)
  if (expression.kind === 'object')
    return expression.entries.flatMap((entry) => effectReceivers(entry.value))
  return []
}

type Capability =
  | 'damage'
  | 'attack'
  | 'critical'
  | 'defense'
  | 'resistance'
  | 'anomaly'
  | 'sheer'
  | 'health'
  | 'stun'

const reviewedCapability: Record<ReviewedExternalSupportChannel, Capability> = {
  attack_from_source_initial_attack: 'attack',
  combat_attack_flat: 'attack',
  all_damage_bonus: 'damage',
  enemy_stun_damage_multiplier: 'stun',
  enemy_stun_duration: 'stun',
  critical_damage_bonus: 'critical',
  electric_defense_ignore: 'defense',
}

function capabilityFor(receiver: EffectReceiver, effectId: string): Capability | null {
  const label = `${receiver.path}.${receiver.damageType ?? ''}.${effectId}`.toLowerCase()
  if (/sheerforce|sheer_dmg/.test(label)) return 'sheer'
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

function recipientCompatible(
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
  if (receiver.damageType === 'abloom' || receiver.damageType === 'aftershock') return false
  if (!outputSpecialties.has(member.specialty)) return false
  if (capability === 'sheer') return member.specialty === 'rupture'
  if (capability === 'health') return member.hpToSheer
  if (capability === 'anomaly') return member.specialty === 'anomaly'
  // Sheer attacks can crit. The anomaly feature is accumulation, so ordinary
  // crit is not automatically an amplification of that modeled channel.
  if (capability === 'critical')
    return member.specialty === 'attack' || member.specialty === 'rupture'
  // Locked common/index.ts also supplies rupture's base ATK-to-sheer conversion.
  // Sheer bypasses defense, not elemental resistance; keep those channels apart.
  if (capability === 'defense') return member.specialty !== 'rupture'
  return true
}

export function compatibleCapabilities(
  members: SupportMember[],
  abilityById: ReadonlyMap<string, boolean>,
  context: TeamContext,
) {
  const covered = new Map<Capability, Set<string>>()
  const providers = new Map<string, Set<string>>()
  let conditional = false
  const unverifiedProviders = new Set<string>()
  const reviewedProviders = new Set<string>()
  const deferredProviders = new Set<string>()
  const sourceConflictProviders = new Set<string>()
  function cover(provider: SupportMember, capability: Capability, receiver: EffectReceiver) {
    for (const target of members) {
      if (target.agentId === provider.agentId || !recipientCompatible(target, capability, receiver))
        continue
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
    const reviewed = getReviewedExternalSupportFact(provider.agentId)
    for (const effect of reviewed?.effects ?? []) {
      const gate = effect.eligibility
      if (gate.minimumMindscape > 0) continue
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
      // These are source effect identities, not agent identities. M1..M6 and
      // potential effects cannot silently enter the declared M0/P0 reference.
      if (/^(?:m[1-6](?:_|$)|potential)/i.test(effect.effectId)) continue
      if (!effect.recipients.some((recipient) => recipient !== 'self')) continue
      if (effect.effectId.startsWith('ability_') && !abilityById.get(provider.agentId)) continue
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
      conditional ||= effect.numericExpression.dependencyKinds.some(
        (kind) => kind === 'conditional_state',
      )
      for (const receiver of effectReceivers(
        effect.numericExpression.expressionIr as UpstreamExpressionIR,
      )) {
        if (!/^(?:teamBuff|notOwnBuff|enemyDebuff)\./.test(receiver.path)) continue
        const capability = capabilityFor(receiver, effect.effectId)
        if (!capability) continue
        cover(provider, capability, receiver)
      }
    }
  }
  const outputCount = members.filter((member) => outputSpecialties.has(member.specialty)).length
  return {
    coverage: (capability: Capability) =>
      (covered.get(capability)?.size ?? 0) / Math.max(1, outputCount),
    unverifiedProviders: [...unverifiedProviders].sort(),
    reviewedProviders: [...reviewedProviders].sort(),
    deferredProviders: [...deferredProviders].sort(),
    sourceConflictProviders: [...sourceConflictProviders].sort(),
    // Distinct compatible providers, not effect records or a claim that buffs
    // stack continuously. The fitted model learns this capacity's contribution.
    multiProvider:
      [...providers.values()].filter((sources) => sources.size > 1).length /
      Math.max(1, outputCount),
    conditional,
  }
}
