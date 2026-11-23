import { currentAgentPlanningEffectBlueprints } from '../calculation/currentAgentPlanningEffectBlueprint'
import { isReviewedTemplateMechanicEffect32 } from '../calculation/reviewedTemplateMechanicEffects32'
import { applicationForReceiver } from '../calculation/currentPlanningDamageModifiers'
import {
  teamStrengthActionFacts,
  teamStrengthSourceActionSemantics,
} from './teamStrengthActionFacts'
import {
  effectReceivers,
  expressionReferences,
  type EffectReceiver,
} from './teamStrengthSupportExpression'
import type { Capability } from './teamStrengthSupportCapabilities'
export type SupportMember = {
  agentId: string
  specialty: string
  attribute: string
  hpToSheer: boolean
  hasAftershockCapacity?: boolean
  actionFacts?: NonNullable<ReturnType<typeof teamStrengthActionFacts>>
}
const outputSpecialties = new Set(['attack', 'anomaly', 'rupture', 'armorer'])
const attributes = new Set(['physical', 'fire', 'ice', 'electric', 'ether', 'frost', 'wind'])
const selfBlueprintsByAgent = new Map<
  string,
  (typeof currentAgentPlanningEffectBlueprints)[number][]
>()
for (const entry of currentAgentPlanningEffectBlueprints) {
  const rows = selfBlueprintsByAgent.get(entry.providerAgentId) ?? []
  rows.push(entry)
  selfBlueprintsByAgent.set(entry.providerAgentId, rows)
}
export function recipientCompatible(
  member: SupportMember,
  capability: Capability,
  receiver: EffectReceiver,
  effectIdentity = '',
  declaredOutput = false,
) {
  const receiverAttribute = [
    ...receiver.path.split('.'),
    ...(receiver.damageType ? [receiver.damageType] : []),
  ].find((part) => attributes.has(part))
  const effectAttribute =
    capability === 'resistance' || capability === 'defense' || capability === 'damage'
      ? effectIdentity
          .toLowerCase()
          .split(/[^a-z]+/)
          .find((part) => attributes.has(part))
      : undefined
  const requiredAttribute = receiverAttribute ?? effectAttribute
  if (requiredAttribute && requiredAttribute !== member.attribute) return false
  // A special damage channel is not interchangeable with a skill category.
  // Do not lend an Abloom/Aftershock-only buff to every ordinary attacker.
  if (receiver.damageType === 'abloom') return false
  // A stunner may have real aftershock damage. Specialty alone neither proves
  // nor disproves that source-bound action; never lend it to an ordinary attack.
  if (receiver.damageType === 'aftershock') return member.hasAftershockCapacity === true
  if (!declaredOutput && !outputSpecialties.has(member.specialty) && member.specialty !== 'stun')
    return false
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
