import { currentPlanningConditionCatalogIdentity32 } from '../calculation/currentPlanningConditionCatalog32'
import { type SourceBackedPlanningEffectBucket } from '../calculation/currentPlanningDamageModifiers'
import { reviewedRoxyAttributeWindowsIdentity32 } from '../calculation/reviewedRoxyAttributeWindows32'
import { reviewedClaretTapActionIdentity32 } from '../calculation/reviewedClaretTapAction32'
import { reviewedClaretHeldActionIdentity32 } from '../calculation/reviewedClaretHeldAction32'
import { reviewedClaretFixedBenchmarkIdentity32 } from '../calculation/reviewedClaretFixedBenchmark32'
import { stableContentHash } from '../gameDataPacks/types'
import {
  teamAnomalyCapacityCoordinateIdentity,
  type TeamAnomalyCapacityCoordinates,
} from './teamStrengthAnomalyCapacityCoordinates'
import { type SupportRecipientContext } from './teamStrengthSupportCapabilities'
import type { TeamStrengthReferenceConditions } from './teamStrengthReferenceConditionsTypes'
import { reviewedRoxyEnergyConversionIdentity32 } from '../calculation/reviewedRoxyEnergyConversion32'
import { teamStrengthSourceConditionDomainsIdentity } from './teamStrengthSourceConditionDomains'
import { teamStrengthTypedAnomalyCapacityIdentity } from './teamStrengthTypedAnomalyCapacity'
import { sourceBoundStunApplicationIdentity32 } from '../calculation/sourceBoundStunApplication32'
import type { PlanningEventUsage } from '../calculation/planningCalculationContextCompiler'
import {
  resolveSourceEventQuantity32,
  sourceEventQuantityIdentity32,
} from '../calculation/sourceEventQuantity32'

export const teamStrengthSourceCapacityPolicy = {
  id: 'typed-source-action-and-event-matched-contact-capacity/v3',
  action: 'one-finite-source-action; largest-complete-Claret-tap-or-held; no-ultimate-policy',
  commonCoordinate:
    'expected-fixed-event-damage-current-target-no-stun-common-unequipped-reference',
  providerPanel: 'existing-declared-static-equipped-reference-for-contact-only',
  providerCombatPenetration: 'reviewed-unconditional-potential-before-final-PEN-conversion',
  mindscapes: 'declared-formed-key-mindscape-gates; named-potential-prepared-separately',
  contactSkill: 'each-coordinate-uses-own-reference-actor-effective-skill',
  eventQuantity: sourceEventQuantityIdentity32,
  condition: 'one-effect-source-domain-active-capacity-not-observed-uptime',
  aggregation:
    'shared-event-settlement-per-maximal-source-state-with-subset-and-validated-explicit-closure; distinct-provider-maxima',
  roxy: 'declared-wind-and-electric-historical-core-windows; current-windswept-and-match-false',
  sourceConditions: currentPlanningConditionCatalogIdentity32,
  additionalSourceConditions: teamStrengthSourceConditionDomainsIdentity,
  typedAnomalyCapacity: teamStrengthTypedAnomalyCapacityIdentity,
  anomalyCoordinates: teamAnomalyCapacityCoordinateIdentity,
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

/** Same actor, ordered events, effective levels and quantities. Panel and
 * effect inventories remain separate coordinate declarations. */
export function sourceCapacityEventPacketIdentity(events: readonly PlanningEventUsage[]) {
  if (!events.length) return null
  const quantities = events.map(resolveSourceEventQuantity32)
  if (
    quantities.some((quantity) => quantity.status !== 'supported') ||
    events.some((event) => !Number.isInteger(event.skillLevel) || event.skillLevel <= 0)
  )
    return null
  return stableContentHash(
    events.map((event, index) => ({
      agentId: event.ownerAgentId,
      eventId: event.eventId,
      skillLevel: event.skillLevel,
      occurrences: event.occurrenceCount,
      quantityUnit: quantities[index]!.status === 'supported' ? quantities[index]!.unit : null,
      durationSeconds: event.durationSeconds ?? null,
    })),
  )
}

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
  /** Retain the source formula position; channel names alone do not define units. */
  receiverPath?: string | null
  damageType?: string | null
}

export type TeamStrengthSourceCapacity = {
  identity: string
  actions: {
    agentId: string
    value: number | null
    eventIds: string[]
    family: string | null
    eventPacketIdentity: string | null
  }[]
  effects: CapacityEffect[]
  contacts: {
    eventPacketIdentity: string | null
    providerAgentId: string
    recipientAgentId: string
    effectKeys: string[]
    relativeGain: number | null
    conditions: Readonly<Record<string, unknown>>
  }[]
  gaps: { providerAgentId: string; effectKey: string; fields: string[]; sourceRefs: string[] }[]
  anomalyProficiencyGain: number
  anomalyMasteryGain: number
  anomalyCoordinates: TeamAnomalyCapacityCoordinates
  stunCapacity: number
}
export type TeamStrengthCapacityBucketRow = {
  providerAgentId: string
  recipientAgentId: string
  bucket: SourceBackedPlanningEffectBucket
  conditions: Readonly<Record<string, unknown>>
}
