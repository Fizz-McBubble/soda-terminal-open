import { type Member } from './teamStrengthMemberFacts'
import { teamStrengthBackgroundActionIdentity } from './teamStrengthBackgroundActions'
import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import { getCurrentAgentDecisionMechanicContract } from '../calculation/currentAgentDecisionMechanicContracts'
import { stableContentHash } from '../gameDataPacks/types'
import { current31TeamEngineD1Pack } from '../teamEngine/current31D1Pack'
import { sourceBoundAgentSupportFingerprint } from '../calculation/sourceBoundAgentSupport'
import { reviewedExternalSupportFactsFingerprint } from '../gameDataPacks/reviewedExternalSupportFacts'
import { reviewedGenericEffectDispositionsFingerprint } from '../gameDataPacks/reviewedExternalEffectDispositions'
import { reviewedPotentialDefinitions } from '../gameDataPacks/reviewedPotentialDefinitions'
import { reviewedPotentialCalculationIdentity } from '../gameDataPacks/reviewedPotentialIdentity'
import { currentPlanningConsumerPolicyIdentity32 } from '../calculation/currentPlanningConsumerPolicyIdentity32'
import { teamStrengthMechanicConsumerIdentity } from './teamStrengthMechanicConsumerIdentity'
import { teamStrengthSourceCapacityIdentity } from './teamStrengthSourceCapacity'
import { teamStrengthReferenceStateIdentity } from './teamStrengthReferenceState'
import { teamStrengthSupportContactIdentity } from './teamStrengthSupportContributionFeatures'
import { selfCapabilitySourceFingerprint } from './teamStrengthSupportCapabilities'
import {
  teamStrengthMechanicFeatureNames,
  teamStrengthCoefficientDirections,
} from './teamStrengthMechanicFeatureContract'

export const ruleById = new Map(
  current31TeamEngineD1Pack.agentRules.map((rule) => [rule.agentId, rule]),
)

export const fieldBudget = 1.35

export const teamStrengthMechanicFeaturesVersion =
  'reference-mindscape-and-coactive-source-contact-features/v20' as const

/** Only inputs actually used here; guide rows, evidence counts and labels are excluded. */
export const teamStrengthMechanicDataFingerprint = stableContentHash({
  version: teamStrengthMechanicFeaturesVersion,
  potentialDefinitions: reviewedPotentialDefinitions.map(reviewedPotentialCalculationIdentity),
  preparedConsumerIdentity: teamStrengthMechanicConsumerIdentity(currentPlanningConsumerPolicyIdentity32),
  features: teamStrengthMechanicFeatureNames,
  coefficientDirections: teamStrengthCoefficientDirections,
  fieldBudget,
  sourceBoundAgentSupportFingerprint,
  selfCapabilitySourceFingerprint,
  reviewedExternalSupportFactsFingerprint,
  reviewedGenericEffectDispositionsFingerprint,
  reference: teamStrengthReferenceStateIdentity,
  supportContact: teamStrengthSupportContactIdentity,
  sourceCapacity: teamStrengthSourceCapacityIdentity,
  backgroundAction: teamStrengthBackgroundActionIdentity,
  agents: [...ruleById.values()]
    .sort((left, right) => left.agentId.localeCompare(right.agentId))
    .map((rule) => {
      const event = getCurrentAgentEventContract(rule.agentId)
      const decision = getCurrentAgentDecisionMechanicContract(rule.agentId)
      return {
        agentId: rule.agentId,
        identity: event?.identity,
        baseStats: event?.baseStats,
        events: event?.eventContract.events,
        fieldTimeDemand: rule.fieldTimeDemand,
        fieldTimeMode: decision?.fieldTimeContract?.mode,
        activation: {
          status: rule.additionalAbility.status,
          predicate:
            rule.additionalAbility.status === 'modeled' ? rule.additionalAbility.predicate : null,
        },
        produces: rule.produces,
        consumes: rule.consumes,
        resourceReadiness: decision?.readiness.resourceFlow,
        effects: decision?.effectContract.effects.map((effect) => ({
          effectId: effect.effectId,
          recipients: effect.recipients,
          expression: effect.numericExpression.expressionIr,
          todoBoundary: effect.numericExpression.todoBoundary,
          dependencyKinds: effect.numericExpression.dependencyKinds,
          classification: effect.numericExpression.classification,
          genericConditionalIdentifiers: effect.numericExpression.genericConditionalIdentifiers,
        })),
      }
    }),
})

export const maximum = (members: Member[], value: (member: Member) => number) =>
  members.length ? Math.max(...members.map(value)) : 0

// Preserve the second member's capacity without summing mutually exclusive
// actions into a fabricated throughput figure. No role-based tier bonus.
export const second = (members: Member[], value: (member: Member) => number) =>
  [...members].map(value).sort((left, right) => right - left)[1] ?? 0
