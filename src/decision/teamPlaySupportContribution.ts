import { currentAgentPlanningEffectBlueprints } from '../calculation/currentAgentPlanningEffectBlueprint'
import { evaluateCurrentPlanningEffectEntries32 } from '../calculation/currentPlanningEffectRuntime'
import { requiredReferences } from '../calculation/currentPlanningEffectExpressions'
import { getReviewedExternalSupportFact } from '../gameDataPacks/reviewedExternalSupportFacts'
import {
  remielleSupportCapabilities,
  sourceBoundAgentSupport,
} from '../calculation/sourceBoundAgentSupport'
import type { PlanningEffectRuntimeMember } from '../calculation/currentPlanningEffectDomain'
import type { TeamStrengthReferenceConditions } from './teamStrengthReferenceConditionsTypes'
import type { TeamPlayContribution } from './teamFinitePlayContract'

const byKey = new Map(
  currentAgentPlanningEffectBlueprints.map((effect) => [effect.effectKey, effect]),
)
type Contact = { providerAgentId: string; recipientAgentId: string; effectIdentity: string }

/** Structural support capacity establishes a possible link, not an active buff.
 * Explicit declarations are evaluated by the existing production effect runtime. */
export function resolveTeamPlaySupportContribution(input: {
  memberIds: readonly string[]
  members: readonly PlanningEffectRuntimeMember[]
  providerAgentId: string
  recipientAgentId: string
  contacts: readonly Contact[]
  conditions: TeamStrengthReferenceConditions
  sourceRefs: string[]
}) {
  const effects = input.contacts
    .map((contact) => byKey.get(`${contact.providerAgentId}:${contact.effectIdentity}`))
    .filter((effect) => effect !== undefined)
  const keys = [
    ...new Set(
      effects.flatMap((effect) => requiredReferences(effect.numericExpression.expressionIr)),
    ),
  ].filter((key) => !/^(?:dm\.|own\.|target\.|char\.|party\.|team\.|eq:|ne:)/.test(key))
  const provided = input.conditions.supportReferencesByAgentId?.[input.providerAgentId]
  const evaluated =
    provided && effects.length
      ? evaluateCurrentPlanningEffectEntries32(
          {
            memberIds: input.memberIds,
            members: input.members,
            baselineReferencesByAgentId: input.conditions.supportReferencesByAgentId,
          },
          effects,
        )
      : null
  const results = evaluated?.status === 'supported' ? evaluated.results : []
  const admitted = effects.filter((effect) => {
    const row = results.find((result) => result.effectKey === effect.effectKey)
    if (!row) return true
    if (row.status === 'unsupported') return false
    if (row.status === 'excluded_unknown') return true
    return (
      row.status === 'supported' &&
      row.active &&
      (!row.recipientAgentIds || row.recipientAgentIds.includes(input.recipientAgentId))
    )
  })
  // A reviewed external channel is distinct from the actor's formula. Keep its
  // pinned reviewed identity, not a fabricated formula effect key or magnitude.
  const external = getReviewedExternalSupportFact(input.providerAgentId)
  const externalContacts = input.contacts.filter(
    (contact) =>
      contact.providerAgentId === input.providerAgentId &&
      contact.recipientAgentId === input.recipientAgentId &&
      !byKey.has(`${contact.providerAgentId}:${contact.effectIdentity}`),
  )
  const externalEffects =
    external?.effects.filter((effect) =>
      externalContacts.some((contact) => contact.effectIdentity === effect.channel),
    ) ?? []
  // These channels are already admitted by compatibleCapabilities from the
  // pinned Remielle facts. They are conditional source contributions, not
  // blueprint effects or evidence that a combat state was activated.
  const remielle = input.providerAgentId === 'agent-remielle' ? remielleSupportCapabilities() : null
  const sourceBoundChannels = remielle
    ? externalContacts.flatMap((contact) =>
        (contact.effectIdentity === 'attack' &&
          remielle.attack &&
          provided?.battlefield_entered !== false) ||
        (contact.effectIdentity === 'common_damage' &&
          remielle.damage &&
          provided?.phase_flow_active !== false)
          ? [contact.effectIdentity]
          : [],
      )
    : []
  const effectKeys = [
    ...admitted.map((effect) => effect.effectKey),
    ...externalEffects.map((effect) => `${input.providerAgentId}:reviewed:${effect.channel}`),
    ...new Set(
      sourceBoundChannels.map((channel) => `${input.providerAgentId}:source-bound:${channel}`),
    ),
  ]
  if (!effectKeys.length) return null
  const sourceRefs = [
    ...new Set([
      ...input.sourceRefs,
      ...admitted.flatMap((effect) => effect.sourceRefs),
      ...(externalEffects.length
        ? [`${external!.targetVersionReview.url}#${external!.sourceEvidenceHash}`]
        : []),
      ...(sourceBoundChannels.length ? [sourceBoundAgentSupport.sourceUrl] : []),
    ]),
  ]
  const link: TeamPlayContribution = {
    providerAgentId: input.providerAgentId,
    recipientAgentId: input.recipientAgentId,
    role: 'support',
    effectKeys,
    eventIds: [],
    sourceRefs,
    state:
      admitted.length &&
      !externalEffects.length &&
      !sourceBoundChannels.length &&
      admitted.every((effect) =>
        results.some(
          (row) => row.effectKey === effect.effectKey && row.status === 'supported' && row.active,
        ),
      )
        ? 'active'
        : 'conditional',
  }
  return {
    link,
    referenceKeys: [
      ...new Set([
        ...keys,
        ...(sourceBoundChannels.includes('attack') ? ['battlefield_entered'] : []),
        ...(sourceBoundChannels.includes('common_damage') ? ['phase_flow_active'] : []),
      ]),
    ],
  }
}
