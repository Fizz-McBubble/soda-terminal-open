import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import { calculateCurrentPlanningEventDamage32 } from '../calculation/currentPlanningEventDamage32'
import { currentNormalizedPlanningBaseline } from '../calculation/currentNormalizedPlanningBaseline'
import { stableContentHash } from '../gameDataPacks/types'
import { teamCounts } from '../calculation/currentPlanningEffectDomain'
import { type SourceBackedPlanningEffectBucket } from '../calculation/currentPlanningDamageModifiers'
import { compileReviewedClaretTapAction32 } from '../calculation/reviewedClaretTapAction32'
import { compileReviewedClaretHeldAction32 } from '../calculation/reviewedClaretHeldAction32'
import type { PlanningEventUsage } from '../calculation/planningCalculationContextCompiler'
import { createTeamStrengthReferenceRuntimeMember } from './teamStrengthReferenceState'
import { createTeamStrengthEquippedReferenceMember } from './teamStrengthReferenceBuild'
import type { Member } from './teamStrengthMemberFacts'
import type { PlanningEffectRuntimeMember } from '../calculation/currentPlanningEffectDomain'
import {
  bindStandardTeamReferenceSelection,
  bindStandardTeamContactEquipment,
  type StandardTeamReferenceSelectionBundle,
} from './standardTeamReferenceSelection'
import type { TeamStrengthReferenceConditions } from './teamStrengthReferenceConditionsTypes'
import { sourcePlanningAftershock32 } from '../calculation/currentPotentialEventActions32'
import { getCurrentAgentPlanningEffectBlueprint } from '../calculation/currentAgentPlanningEffectBlueprint'
import { teamStrengthBackgroundAction } from './teamStrengthBackgroundActions'
import {
  teamStrengthSourceCapacityPolicy,
  type TeamStrengthSourceCapacity,
} from './teamStrengthSourceCapacityPolicy'
const equippedCache = new Map<
  string,
  ReturnType<typeof createTeamStrengthEquippedReferenceMember>
>()
function sourceUsages(
  member: Member,
  standardMember: PlanningEffectRuntimeMember,
): PlanningEventUsage[] {
  // The ordinary catalog packet combines alternative special branches for
  // Claret. Select a reviewed complete held branch, preserving its three
  // legal Maim coefficient uses. Do not infer until-Gash Basic3 or six-Maim
  // resource legality from the authored benchmark.
  if (member.agentId === 'agent-claret') {
    const skillLevel = standardMember.skillLevels.special
    if (typeof skillLevel !== 'number' || !Number.isInteger(skillLevel)) return []
    const held = compileReviewedClaretHeldAction32({
      skillLevel,
      preparedState: { crimsonInscription: true, targetGash: 3 },
      conditions: {
        upwardSlashContact: true,
        completeBloodBurialContact: true,
        heldMaimContacts: 3,
        constantDamageState: true,
        uninterruptedBloodBurial: true,
      },
    })
    const tap = compileReviewedClaretTapAction32({
      skillLevel,
      preparedState: { crimsonInscription: true, targetGash: 3 },
      conditions: {
        upwardSlashContact: true,
        horizontalSlashContact: true,
        tapMaimContact: true,
        constantDamageState: true,
      },
    })
    // Both independently reviewed packets must remain valid before adopting
    // this finite common coordinate; the benchmark's larger inventory is not
    // a substitute for a complete individual action.
    return held.status === 'supported' && tap.status === 'supported' ? held.eventUsages : []
  }
  const action = member.actionFacts.damage
  if (!action || action.quantities.some((q) => q.unit !== 'coefficient_uses')) return []
  return action.eventIds.map((eventId) => ({
    ownerAgentId: member.agentId,
    eventId,
    skillLevel:
      standardMember.skillLevels[
        getCurrentAgentEventContract(member.agentId)!.eventContract.events.find(
          (row) => row.eventId === eventId,
        )!.skill
      ]!,
    occurrenceCount: 1,
    evidenceRefs: [teamStrengthSourceCapacityPolicy.id],
  }))
}
export function createTeamStrengthCapacityContext(
  members: readonly Member[],
  conditions: TeamStrengthReferenceConditions,
  standardTeamReferenceSelection?: StandardTeamReferenceSelectionBundle,
) {
  const ids = members.map((m) => m.agentId)
  const equippedReferenceCacheKey = (agentId: string) =>
    stableContentHash({
      contract: 'team-strength-equipped-reference-cache/v2',
      agentId,
      memberIds: [...ids].sort(),
      referenceConditions: conditions,
    })
  const standard = standardTeamReferenceSelection
    ? bindStandardTeamReferenceSelection(standardTeamReferenceSelection, {
        memberIds: ids,
        referenceConditions: conditions,
      })
    : undefined
  if (standard?.status === 'unsupported')
    return {
      status: 'unsupported' as const,
      standardReferenceIdentity: null,
      members,
      conditions,
      ids,
      runtime: new Map<string, PlanningEffectRuntimeMember>(),
      contactRuntime: new Map<string, PlanningEffectRuntimeMember>(),
      counts: teamCounts(ids),
      usages: new Map(ids.map((id) => [id, [] as PlanningEventUsage[]])),
      value: (id: string, buckets: SourceBackedPlanningEffectBucket[]) => {
        void [id, buckets]
        return null
      },
      contactValue: (
        _id: string,
        _buckets: SourceBackedPlanningEffectBucket[],
        _events?: PlanningEventUsage[],
        _references?: Readonly<Record<string, Readonly<Record<string, unknown>>>>,
      ) => {
        void [_id, _buckets, _events, _references]
        return null
      },
      contactUsages: (id: string, damageType?: string): PlanningEventUsage[] => {
        void [id, damageType]
        return []
      },
      gaps: ids.map((id) => ({
        providerAgentId: id,
        effectKey: `${id}:standard_reference`,
        fields: [standard.reason],
        sourceRefs: [],
      })),
    }
  const standardById = new Map(
    standard?.status === 'ready'
      ? standard.builds.map((build) => [build.runtimeMember.agentId, build])
      : [],
  )
  const contactRuntime = new Map(
    ids.map((id) => {
      const selected = standardById.get(id)
      if (selected) return [id, selected.runtimeMember] as const
      const neutral = createTeamStrengthReferenceRuntimeMember(id, conditions)
      const cacheKey = equippedReferenceCacheKey(id)
      let equipped = equippedCache.get(cacheKey)
      if (!equipped) {
        equipped = createTeamStrengthEquippedReferenceMember({
          agentId: id,
          memberIds: ids,
          referenceConditions: conditions,
        })
        equippedCache.set(cacheKey, equipped)
      }
      // A missing recipe stays explicit below; never silently compare that
      // actor's bare panel with other actors' equipped panels.
      return [id, equipped.status === 'ready' ? equipped.runtimeMember : neutral] as const
    }),
  )
  const runtime = new Map(
    ids.map((id) => [
      id,
      standardById.get(id)?.runtimeMember ??
        createTeamStrengthReferenceRuntimeMember(id, conditions),
    ]),
  )
  const equipmentExclusions = standard?.status === 'ready' ? standard.equipmentEffectExclusions : []
  const unresolvedEquipment = (rows: readonly unknown[]) =>
    rows.some(
      (row) =>
        !row ||
        typeof row !== 'object' ||
        !('resolvedInactive' in row) ||
        row.resolvedInactive !== true,
    )
  const contactEquipment = (events: readonly PlanningEventUsage[]) =>
    standard?.status === 'ready'
      ? bindStandardTeamContactEquipment(standard, events)
      : {
          status: 'ready' as const,
          buckets: [] as SourceBackedPlanningEffectBucket[],
          exclusions: [] as unknown[],
        }
  const counts = teamCounts(ids)
  const baseline = {
    ...currentNormalizedPlanningBaseline,
    enemy: { ...currentNormalizedPlanningBaseline.enemy, stunMultiplier: 1 },
  }
  const usages = new Map(
    members.map((member) => [
      member.agentId,
      standard?.status === 'ready' && standard.context.declaredEventGoal32
        ? standard.context.declaredEventGoal32.declarations.occurrences
            .filter((row) => row.ownerAgentId === member.agentId)
            .map(
              (row): PlanningEventUsage => ({
                ownerAgentId: row.ownerAgentId,
                eventId: row.eventId,
                skillLevel: runtime.get(member.agentId)!.skillLevels[
                  getCurrentAgentEventContract(member.agentId)!.eventContract.events.find(
                    (event) => event.eventId === row.eventId,
                  )!.skill
                ]!,
                occurrenceCount: 1,
                evidenceRefs: [...row.sourceRefs],
                ...(row.durationSeconds === undefined
                  ? {}
                  : { durationSeconds: row.durationSeconds, quantityUnit: 'seconds' as const }),
              }),
            )
        : sourceUsages(member, runtime.get(member.agentId)!),
    ]),
  )
  const value = (id: string, buckets: SourceBackedPlanningEffectBucket[]) => {
    const events = usages.get(id)!
    const equipment = contactEquipment(events)
    if (!events.length || equipment.status !== 'ready' || unresolvedEquipment(equipment.exclusions))
      return null
    return calculateCurrentPlanningEventDamage32({
      member: runtime.get(id)!,
      buckets: [...equipment.buckets, ...buckets],
      eventUsages: events,
      baseline,
    })
  }
  // Contact and unequipped action coordinates each use their own actor's
  // effective skills, including the common A6 cultivation projection.
  const equippedContactUsages = (id: string, events: PlanningEventUsage[]) => {
    const levels = events.map((usage) => {
      const event = getCurrentAgentEventContract(id)!.eventContract.events.find(
        (row) => row.eventId === usage.eventId,
      )
      return event ? contactRuntime.get(id)!.skillLevels[event.skill] : undefined
    })
    if (levels.some((level) => level === undefined || !Number.isInteger(level))) return []
    return events.map((usage, index) => ({ ...usage, skillLevel: levels[index]! }))
  }
  const contactUsages = (id: string, damageType?: string): PlanningEventUsage[] => {
    if (damageType === 'aftershock') {
      const member = members.find((member) => member.agentId === id)!
      const background = teamStrengthBackgroundAction(member)
      const action = background.action
      if (
        action &&
        action.quantities.every((quantity) => quantity.unit === 'coefficient_uses') &&
        action.eventIds.every(
          (eventId) =>
            sourcePlanningAftershock32({
              agentId: id,
              eventId,
              memberIds: ids,
              potential: runtime.get(id)!.potential,
            }) === true,
        )
      )
        return equippedContactUsages(
          id,
          action.eventIds.map((eventId) => ({
            ownerAgentId: id,
            eventId,
            skillLevel: 11,
            occurrenceCount: action.quantities.find((quantity) => quantity.eventId === eventId)!
              .value,
            evidenceRefs: background.sourceRefs,
          })),
        )
    }
    return equippedContactUsages(id, usages.get(id)!)
  }
  const contactValue = (
    id: string,
    buckets: SourceBackedPlanningEffectBucket[],
    events = contactUsages(id),
    sourceReferencesByAgentId?: Readonly<Record<string, Readonly<Record<string, unknown>>>>,
  ) => {
    if (
      !standardById.has(id) &&
      equippedCache.get(equippedReferenceCacheKey(id))?.status !== 'ready'
    )
      return null
    if (!events.length) return null
    const values = events.map((usage) => {
      const equipment = contactEquipment([usage])
      if (equipment.status !== 'ready' || unresolvedEquipment(equipment.exclusions)) return null
      const declaredReferences =
        'referencesByAgentId' in equipment ? equipment.referencesByAgentId : undefined
      if (
        declaredReferences &&
        sourceReferencesByAgentId &&
        Object.entries(sourceReferencesByAgentId).some(([agentId, refs]) =>
          Object.entries(refs).some(
            ([key, value]) =>
              stableContentHash(declaredReferences[agentId]?.[key]) !== stableContentHash(value),
          ),
        )
      )
        return null
      const aftershock = sourcePlanningAftershock32({
        agentId: id,
        eventId: usage.eventId,
        memberIds: ids,
        potential: runtime.get(id)!.potential,
      })
      // Bind the special source channel per counted event. Never erase an
      // Aftershock qualifier for the other contacts in a mixed action packet.
      const scoped = buckets.flatMap((bucket) =>
        bucket.damageType === 'aftershock'
          ? aftershock === true
            ? [{ ...bucket, damageType: null }]
            : []
          : [bucket],
      )
      const settled = calculateCurrentPlanningEventDamage32({
        member: contactRuntime.get(id)!,
        buckets: [...equipment.buckets, ...scoped],
        eventUsages: [usage],
        baseline,
        // Empty buckets are the explicit unbuffed contact comparator, not an
        // observation of external sources. Only an actual Sheer Force grant
        // needs the source conversion DAG; converted ATK buckets already carry
        // its result and must not be produced a second time.
        ...(id === 'agent-norma' && buckets.some((row) => row.application === 'sheer_force')
          ? {
              eventEffectContext: {
                memberIds: ids,
                members: [...contactRuntime.values()],
                entries: [
                  getCurrentAgentPlanningEffectBlueprint(
                    'agent-norma:reviewed_sheer_force_attack32',
                  )!,
                ],
                baselineReferencesByAgentId:
                  sourceReferencesByAgentId ?? conditions.supportReferencesByAgentId,
                consumedBuckets: [],
                exclusions: [],
              },
            }
          : {}),
      })
      return settled === null || !Number.isFinite(settled) ? null : settled
    })
    return values.some((value) => value === null)
      ? null
      : values.reduce<number>((sum, value) => sum + (value ?? 0), 0)
  }
  const gaps: TeamStrengthSourceCapacity['gaps'] = equipmentExclusions
    .filter((row) => unresolvedEquipment([row]))
    .map((unknownRow) => {
      const row = unknownRow as Record<string, unknown>
      return {
        providerAgentId: String(row.providerAgentId ?? row.agentId ?? 'unknown'),
        effectKey: 'standard_equipment_condition_unknown',
        fields: ['标准接触条件未证明该装备效果，保留未知。'],
        sourceRefs: Array.isArray(row.sourceRefs) ? row.sourceRefs.map(String) : [],
      }
    })
  for (const id of ids) {
    const build = standardById.get(id) ?? equippedCache.get(equippedReferenceCacheKey(id))
    if (build?.status === 'unsupported')
      gaps.push({
        providerAgentId: id,
        effectKey: `${id}:equipped_contact_reference`,
        fields: [build.reason],
        sourceRefs: [getCurrentAgentEventContract(id)!.source.formulaPath],
      })
  }

  return {
    status: 'supported' as const,
    standardReferenceIdentity: standard?.status === 'ready' ? standard.identity : null,
    members,
    conditions,
    ids,
    runtime,
    contactRuntime,
    counts,
    usages,
    value,
    contactValue,
    contactUsages,
    gaps,
  }
}
export type TeamStrengthCapacityContext = ReturnType<typeof createTeamStrengthCapacityContext>
