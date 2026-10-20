import { currentPlanningConditionCatalogIdentity32 } from '../calculation/currentPlanningConditionCatalog32'
import { type SourceBackedPlanningEffectBucket } from '../calculation/currentPlanningDamageModifiers'
import { reviewedRoxyAttributeWindowsIdentity32 } from '../calculation/reviewedRoxyAttributeWindows32'
import { reviewedClaretTapActionIdentity32 } from '../calculation/reviewedClaretTapAction32'
import { reviewedClaretHeldActionIdentity32 } from '../calculation/reviewedClaretHeldAction32'
import { reviewedClaretFixedBenchmarkIdentity32 } from '../calculation/reviewedClaretFixedBenchmark32'
import { stableContentHash } from '../gameDataPacks/types'
import { type SupportRecipientContext } from './teamStrengthSupportCapabilities'
import type { TeamStrengthReferenceConditions } from './teamStrengthReferenceConditionsTypes'
import { reviewedRoxyEnergyConversionIdentity32 } from '../calculation/reviewedRoxyEnergyConversion32'
import { teamStrengthSourceConditionDomainsIdentity } from './teamStrengthSourceConditionDomains'
import { teamStrengthTypedAnomalyCapacityIdentity } from './teamStrengthTypedAnomalyCapacity'
import { sourceBoundStunApplicationIdentity32 } from '../calculation/sourceBoundStunApplication32'

export const teamStrengthSourceCapacityPolicy = {
  id: 'typed-source-action-and-per-effect-contact-capacity/v1',
  action: 'one-finite-source-action; largest-complete-Claret-tap-or-held; no-ultimate-policy',
  commonCoordinate:
    'expected-fixed-event-damage-current-target-no-stun-common-unequipped-reference',
  providerPanel: 'existing-declared-static-equipped-reference-for-contact-only',
  condition: 'one-effect-source-domain-active-capacity-not-observed-uptime',
  aggregation:
    'shared-event-settlement-per-identical-source-condition-state; distinct-provider-maxima',
  roxy: 'declared-wind-and-electric-historical-core-windows; current-windswept-and-match-false',
  sourceConditions: currentPlanningConditionCatalogIdentity32,
  additionalSourceConditions: teamStrengthSourceConditionDomainsIdentity,
  typedAnomalyCapacity: teamStrengthTypedAnomalyCapacityIdentity,
  nonStunnedContact: sourceBoundStunApplicationIdentity32,
  roxyWindows: reviewedRoxyAttributeWindowsIdentity32,
  roxyEnergyConversion: reviewedRoxyEnergyConversionIdentity32,
  claretTap: reviewedClaretTapActionIdentity32,
  claretHeld: reviewedClaretHeldActionIdentity32,
  claretAuthoredBenchmark: reviewedClaretFixedBenchmarkIdentity32,
} as const

export const teamStrengthSourceCapacityIdentity = stableContentHash(
  teamStrengthSourceCapacityPolicy,
)

export function resolveTeamStrengthRecipientContext(
  ids: readonly string[],
  conditions?: TeamStrengthReferenceConditions,
): SupportRecipientContext {
  if (conditions?.recipientContext) return conditions.recipientContext
  if (!ids.includes('agent-roxy')) return {}
  return {
    roxyWindowsByRecipientId: Object.fromEntries(
      ids.map((id) => [
        id,
        {
          wind: true,
          electric: true,
          squadWindswept: false,
          contaminationMatches: false,
          windsweptObserved: false,
        },
      ]),
    ),
  }
}

export type CapacityEffect = {
  providerAgentId: string
  recipientAgentId: string
  effectKey: string
  application: SourceBackedPlanningEffectBucket['application']
  value: number
  relativeGain: number | null
  sourceRefs: string[]
  conditions: Readonly<Record<string, unknown>>
  channel: string
}

export type TeamStrengthSourceCapacity = {
  identity: string
  actions: { agentId: string; value: number | null; eventIds: string[]; family: string | null }[]
  effects: CapacityEffect[]
  contacts: {
    providerAgentId: string
    recipientAgentId: string
    effectKeys: string[]
    relativeGain: number | null
    conditions: Readonly<Record<string, unknown>>
  }[]
  gaps: { providerAgentId: string; effectKey: string; fields: string[]; sourceRefs: string[] }[]
  primarySupportGain: number
  secondarySupportGain: number
  anomalyProficiencyGain: number
  anomalyMasteryGain: number
  anomalyDamageCapacity: number
  anomalyBuildupCapacity: number
  stunCapacity: number
}
export type TeamStrengthCapacityBucketRow = {
  providerAgentId: string
  recipientAgentId: string
  bucket: SourceBackedPlanningEffectBucket
  conditions: Readonly<Record<string, unknown>>
}
