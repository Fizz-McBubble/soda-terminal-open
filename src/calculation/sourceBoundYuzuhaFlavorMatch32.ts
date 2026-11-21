import { z } from 'zod'
import { stableContentHash } from '../gameDataPacks/types'
import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'
import type { PlanningEffectRuntimeMember } from './currentPlanningEffectDomain'
import type { PlanningEventUsage } from './planningCalculationContextCompiler'

const sourceCommit = '3456cd0f6f5bea10e168074502460dac2fcd6df4'
const formulaPath = 'libs/zzz/formula/src/data/char/sheets/Yuzuha.ts'
const formulaSha256 = '61F637F03E82BCE0B22F1FE85D3EEB4BD9ACA00B0787C74137F3ED94737CA8F6'
const statsPath = 'libs/zzz/stats/Data/Characters/Yuzuha.json'
const statsSha256 = '16E67FB546C250A94AA6407E9D306F055E3E03AEAE7C8EAD6BF6F65F363CE956'
const localizationPath = 'libs/zzz/dm-localization/assets/locales/en/char_Yuzuha_gen.json'
const localizationSha256 = '9A662C4D076F35230E5A01CA6E701EE6F9A4D25C7A9F6066B87D55E7353EFF3C'
const ownerAgentId = 'agent-yuzuha'
const applicationEventId = 'special.SweetScare'
const affectedEventIds = [
  'basic.BasicAttackSugarburstSparkles.hit-0',
  'basic.BasicAttackSugarburstSparklesMax.hit-0',
] as const

const attributes = ['physical', 'fire', 'ice', 'electric', 'ether', 'wind'] as const
type DamageAttribute32 = (typeof attributes)[number]

export const sourceBoundYuzuhaFlavorMatchPolicy32 = Object.freeze({
  schema: 'soda-source-bound-yuzuha-flavor-match32/v1',
  source: {
    repository: 'https://github.com/frzyc/genshin-optimizer',
    commit: sourceCommit,
    formulaPath,
    formulaSha256,
    statsPath,
    statsSha256,
    localizationPath,
    localizationSha256,
  },
  ownerAgentId,
  applicationEventId,
  durationFormula: '16 + specialSkillLevel * 2',
  trigger: 'first_active_team_character_hit_with_own_attribute',
  unknownFirstHit: 'unsupported_including_same_attribute',
  reapplyClearsFlavorMatch: true,
  affectedEventIds,
  anomalyDamageContribution: false,
  buildupRateIncreaseFormula: '0.07 + basicSkillLevel * 0.015',
  scope:
    'One declared target Sweet Scare application and one Sparkles occurrence; no rotation, tick, occurrence count, or DPS inference.',
})

export const sourceBoundYuzuhaFlavorMatchIdentity32 = stableContentHash(
  sourceBoundYuzuhaFlavorMatchPolicy32,
)

export function isSourceBoundYuzuhaFlavorMatchEvent32(eventId: string) {
  return (affectedEventIds as readonly string[]).includes(eventId)
}

export const sourceBoundYuzuhaFlavorMatchRefs32 = Object.freeze([
  `${sourceCommit}:${formulaPath}#sha256=${formulaSha256}`,
  `${sourceCommit}:${statsPath}#sha256=${statsSha256}`,
  `${sourceCommit}:${localizationPath}#sha256=${localizationSha256}`,
])

const nonEmptyString = z.string().trim().min(1)
const finiteNonNegative = z.number().finite().nonnegative()
const attributeSchema = z.enum(attributes)
const affectedEventIdSchema = z.enum(affectedEventIds)

const applicationSchema = z
  .object({
    applicationId: nonEmptyString,
    ownerAgentId: z.literal(ownerAgentId),
    eventId: z.literal(applicationEventId),
    targetId: nonEmptyString,
    skillLevel: z.number().int().min(1).max(16),
    atSeconds: finiteNonNegative,
    durationSeconds: z.number().finite().positive(),
  })
  .strict()

const hitSchema = z
  .object({
    hitId: nonEmptyString,
    actorAgentId: nonEmptyString,
    sourceEventId: nonEmptyString,
    attackAttribute: attributeSchema,
    applicationId: nonEmptyString,
    targetId: nonEmptyString,
    atSeconds: finiteNonNegative,
    activeCharacter: z.union([z.boolean(), z.literal('unknown')]),
    sourceRefs: z.array(nonEmptyString).min(1),
  })
  .strict()

export const sourceBoundYuzuhaFlavorMatchDeclarationSchema32 = z
  .object({
    schema: z.literal('soda-source-bound-yuzuha-flavor-match32/v1'),
    sourceIdentityHash: z.literal(sourceBoundYuzuhaFlavorMatchIdentity32),
    ownerAgentId: z.literal(ownerAgentId),
    targetId: nonEmptyString,
    memberAgentIds: z.tuple([nonEmptyString, nonEmptyString, nonEmptyString]),
    applications: z.array(applicationSchema).min(1),
    currentApplicationId: nonEmptyString,
    event: z
      .object({
        eventId: affectedEventIdSchema,
        occurrenceId: nonEmptyString,
        atSeconds: finiteNonNegative,
      })
      .strict(),
    eligibleHitInterval: z
      .object({
        completeness: z.literal('complete'),
        startAtSeconds: finiteNonNegative,
        endAtSeconds: finiteNonNegative,
        hits: z.array(hitSchema),
      })
      .strict(),
  })
  .strict()

export type SourceBoundYuzuhaFlavorMatchDeclaration32 = z.infer<
  typeof sourceBoundYuzuhaFlavorMatchDeclarationSchema32
>

function failure(blocker: string) {
  return { status: 'unsupported' as const, blockers: [blocker] }
}

function sourceContractMatchesPolicy() {
  const contract = getCurrentAgentEventContract(ownerAgentId)
  if (
    !contract ||
    contract.source.repository !== sourceBoundYuzuhaFlavorMatchPolicy32.source.repository ||
    contract.source.commit !== sourceCommit ||
    contract.source.formulaPath !== formulaPath ||
    contract.source.formulaSha256 !== formulaSha256 ||
    contract.source.statsPath !== statsPath ||
    contract.source.statsSha256 !== statsSha256 ||
    contract.identity.attribute !== 'physical'
  )
    return false
  return affectedEventIds.every((eventId) => {
    const event = contract.eventContract.events.find((row) => row.eventId === eventId)
    return (
      event?.attribute === 'physical' &&
      event.formulaProjection === 'source_registered' &&
      event.formulaFamily === 'standard_direct_damage'
    )
  })
}

/**
 * Resolve the event attribute for one declared Sparkles occurrence. Hit order
 * comes only from the complete interval, never from a caller's isFirst flag.
 */
export function bindSourceBoundYuzuhaFlavorMatch32(input: {
  declaration: unknown
  usage: PlanningEventUsage
  member: PlanningEffectRuntimeMember
  memberIds: readonly string[]
  members: readonly PlanningEffectRuntimeMember[]
  targetId: string
}) {
  if (!isSourceBoundYuzuhaFlavorMatchEvent32(input.usage.eventId))
    return { status: 'not_applicable' as const }
  const parsed = sourceBoundYuzuhaFlavorMatchDeclarationSchema32.safeParse(input.declaration)
  if (!parsed.success) return failure('yuzuha_flavor_match_declaration_invalid_or_tampered32')
  const declaration = parsed.data
  if (!sourceContractMatchesPolicy()) return failure('yuzuha_flavor_match_source_changed32')
  if (
    input.usage.ownerAgentId !== ownerAgentId ||
    input.member.agentId !== ownerAgentId ||
    declaration.ownerAgentId !== ownerAgentId ||
    declaration.event.eventId !== input.usage.eventId ||
    declaration.targetId !== input.targetId
  )
    return failure('yuzuha_flavor_match_owner_event_or_target_mismatch32')
  if (input.usage.occurrenceCount !== 1)
    return failure('yuzuha_flavor_match_requires_single_occurrence32')

  const declaredMembers = new Set(declaration.memberAgentIds)
  const suppliedMembers = new Set(input.memberIds)
  const suppliedRuntimeMembers = new Set(input.members.map((member) => member.agentId))
  if (
    declaredMembers.size !== 3 ||
    suppliedMembers.size !== 3 ||
    suppliedRuntimeMembers.size !== 3 ||
    input.members.length !== 3 ||
    !declaredMembers.has(ownerAgentId) ||
    [...declaredMembers].some(
      (agentId) => !suppliedMembers.has(agentId) || !suppliedRuntimeMembers.has(agentId),
    ) ||
    [...suppliedMembers].some((agentId) => !declaredMembers.has(agentId))
  )
    return failure('yuzuha_flavor_match_exact_three_members_mismatch32')

  if (
    new Set(declaration.applications.map((row) => row.applicationId)).size !==
      declaration.applications.length ||
    declaration.applications.some(
      (row, index) =>
        row.targetId !== declaration.targetId ||
        (index > 0 && row.atSeconds <= declaration.applications[index - 1]!.atSeconds),
    )
  )
    return failure('yuzuha_flavor_match_application_order_or_target_invalid32')

  const currentApplication = declaration.applications.at(-1)!
  if (declaration.currentApplicationId !== currentApplication.applicationId)
    return failure('yuzuha_flavor_match_current_application_mismatch32')
  const yuzuha = input.members.find((member) => member.agentId === ownerAgentId)!
  const basicSkillLevel = input.usage.skillLevel
  if (
    !Number.isInteger(basicSkillLevel) ||
    basicSkillLevel < 1 ||
    basicSkillLevel > 16 ||
    input.member.skillLevels.basic !== basicSkillLevel ||
    yuzuha.skillLevels.basic !== basicSkillLevel
  )
    return failure('yuzuha_flavor_match_basic_skill_mismatch32')
  if (
    yuzuha.skillLevels.special !== currentApplication.skillLevel ||
    currentApplication.durationSeconds !== 16 + currentApplication.skillLevel * 2
  )
    return failure('yuzuha_flavor_match_application_skill_or_duration_mismatch32')

  const expiresAtSeconds = currentApplication.atSeconds + currentApplication.durationSeconds
  if (
    declaration.event.atSeconds < currentApplication.atSeconds ||
    declaration.event.atSeconds >= expiresAtSeconds
  )
    return failure('yuzuha_flavor_match_sparkles_occurrence_outside_application32')

  const interval = declaration.eligibleHitInterval
  if (
    interval.startAtSeconds !== currentApplication.atSeconds ||
    interval.endAtSeconds !== declaration.event.atSeconds ||
    new Set(interval.hits.map((row) => row.hitId)).size !== interval.hits.length ||
    interval.hits.some(
      (hit, index) =>
        hit.atSeconds < interval.startAtSeconds ||
        hit.atSeconds > interval.endAtSeconds ||
        (index > 0 && hit.atSeconds <= interval.hits[index - 1]!.atSeconds),
    )
  )
    return failure('yuzuha_flavor_match_complete_hit_interval_invalid32')

  for (const hit of interval.hits) {
    if (
      hit.applicationId !== currentApplication.applicationId ||
      hit.targetId !== declaration.targetId ||
      !declaredMembers.has(hit.actorAgentId)
    )
      return failure('yuzuha_flavor_match_hit_target_or_application_mismatch32')
    const actorContract = getCurrentAgentEventContract(hit.actorAgentId)
    const sourceEvent = actorContract?.eventContract.events.find(
      (event) => event.eventId === hit.sourceEventId,
    )
    if (
      !actorContract ||
      !sourceEvent ||
      sourceEvent.attribute !== hit.attackAttribute ||
      sourceEvent.formulaProjection !== 'source_registered'
    )
      return failure('yuzuha_flavor_match_hit_source_event_or_attribute_invalid32')
  }

  const triggeringHit = interval.hits.find((hit) => {
    if (hit.activeCharacter === false) return false
    const actor = getCurrentAgentEventContract(hit.actorAgentId)
    return actor?.identity.attribute === hit.attackAttribute
  })
  // A possibly active first hit also leaves its receipt identity unresolved,
  // even if a later confirmed hit would yield the same attribute.
  if (triggeringHit?.activeCharacter === 'unknown')
    return failure('yuzuha_flavor_match_first_hit_active_unknown32')
  const attribute: DamageAttribute32 = triggeringHit?.attackAttribute ?? 'physical'
  return {
    status: 'supported' as const,
    applied: triggeringHit !== undefined,
    attribute,
    ownerAgentId,
    targetId: declaration.targetId,
    applicationId: currentApplication.applicationId,
    triggeringHitId: triggeringHit?.hitId ?? null,
    expiresAtSeconds,
    anomalyDamageContribution: false as const,
    buildupRateIncrease: 0.07 + basicSkillLevel * 0.015,
    sourceRefs: [...sourceBoundYuzuhaFlavorMatchRefs32, ...(triggeringHit?.sourceRefs ?? [])],
  }
}

/** Consumer adapter: a missing declaration or unrelated event keeps the
 * historical base attribute; an explicit damaged declaration fails closed. */
export function resolveSourceBoundYuzuhaFlavorMatchAttribute32(input: {
  declaration: unknown
  baseAttribute: string
  usage: PlanningEventUsage
  eventUsages: readonly PlanningEventUsage[]
  member: PlanningEffectRuntimeMember
  memberIds: readonly string[]
  members: readonly PlanningEffectRuntimeMember[]
  targetId: string
  diagnosticBlockers?: string[]
}) {
  if (
    input.declaration === undefined ||
    !isSourceBoundYuzuhaFlavorMatchEvent32(input.usage.eventId)
  )
    return input.baseAttribute
  if (
    input.usage.occurrenceCount !== 1 ||
    input.eventUsages.filter(
      (row) => row.ownerAgentId === input.usage.ownerAgentId && row.eventId === input.usage.eventId,
    ).length !== 1
  ) {
    input.diagnosticBlockers?.push(
      `${input.usage.eventId}:yuzuha_flavor_match_requires_unique_single_occurrence32`,
    )
    return null
  }
  const bound = bindSourceBoundYuzuhaFlavorMatch32(input)
  if (bound.status === 'unsupported') {
    input.diagnosticBlockers?.push(
      ...bound.blockers.map((reason) => `${input.usage.eventId}：${reason}`),
    )
    return null
  }
  return bound.status === 'supported' ? bound.attribute : input.baseAttribute
}
