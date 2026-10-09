import type { CurrentAgentPlanningEffectBlueprint } from './currentAgentPlanningEffectBlueprint'
import {
  effectAttributeForReceiver,
  effectReceiverMetadata,
} from './currentPlanningEffectExpressions'
import { matchesEventScope } from './currentPlanningDamageModifiers'

/** Functional objectives obey the same source action/attribute restrictions as damage. */
export function matchesFunctionalEffectScope32(
  entry: CurrentAgentPlanningEffectBlueprint,
  event: Parameters<typeof matchesEventScope>[1],
  attribute: string,
) {
  const meta = effectReceiverMetadata(entry.numericExpression.expressionIr)
  return matchesEventScope(
    {
      action: null,
      effectId: entry.effectId,
      applicationScope: entry.applicationScope,
      damageType: meta.damageType,
      attribute: effectAttributeForReceiver(meta.receiverPath),
    },
    event,
    attribute,
  )
}
