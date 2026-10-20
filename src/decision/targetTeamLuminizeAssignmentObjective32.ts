import { luminizeEquipmentPreparationProtocol32 } from '../application/publicLuminizeComparison32'
import { projectTargetTeamEquipmentModifiers } from '../calculation/targetTeamEquipmentModifierProjection'
import { resolveCurrentPlanningScenario32 } from '../calculation/currentPlanningScenario32'
import { standardSubstatProbes } from '../calculation/standardSubstatProbe'
import { resolveDriveDiscMainStatValue } from '../calculation/outOfCombatPanel'
import { isReviewedPreparedMemberDamageExclusion32 } from '../calculation/reviewedPreparedTeamBenchmark32'
import {
  preservesReviewedFunctionalCapacities32,
  type ReviewedFunctionalCapacity32,
} from '../calculation/reviewedFunctionalCapacity32'
import type { StatKey } from '../domain/schemas'
import { stableContentHash } from '../gameDataPacks/types'
import type { TeamAssignmentObjective } from '../optimizer/selectTeamObjectiveAssignment'
import { compileTargetTeamPlanningContext } from './targetTeamPlanningContext'
import { compileTargetTeamPlanningMembers } from './targetTeamPlanningMembers'
import { projectAccountLuminizeEquipmentSnapshot32 } from './accountLuminizeEquipmentSnapshot32'
import type { TargetTeamPlanningContextInput } from './targetTeamPlanningContextInput'
import { targetTeamObjectiveConditionsIdentity } from './targetTeamPlanningContextInput'
import type { TeamJointBuildIntent } from './buildIntent'
import type { TargetTeamObjectiveOptions } from './targetTeamAssignmentObjective'
import { hasUnresolvedAuthorityScenario } from './teamBuildExecutionIdentity'
import { resolvePotentialImage, supportsPotentialImage } from '../assault/agentCapabilities'
import { getCandidateWarehouseConstraintForTeam } from '../gameDataPacks/candidateWarehouseConstraints'
import { targetTeamBuildDirectionConditions } from '../application/targetTeamEffectivePotentialConditions'
import { reviewedTeamMindscapeByAgentId } from '../gameDataPacks/reviewedTeamDiscConditions'

type ObjectiveInput = Omit<TargetTeamPlanningContextInput, 'fit' | 'modifierProjection'> & {
  buildIntent?: TeamJointBuildIntent
}

export const targetTeamLuminizeAssignmentObjectivePolicy32 =
  'miyabi-declared-luminize-static-volley32-v1'

/** The source caps an icefire-window combat effect at 80%. Static equipment
 * preparation has no observed icefire window or all combat buffs, so menu CR
 * may only be guarded monotonically; the cap cannot license a CR tradeoff. */
export function preservesMiyabiStaticCritInput32(baseline: number, candidate: number) {
  return (
    Number.isFinite(baseline) &&
    Number.isFinite(candidate) &&
    baseline >= 0 &&
    candidate >= 0 &&
    candidate + 1e-9 >= baseline
  )
}

export function effectiveLuminizeObjectivePotential32(
  agentId: string,
  raw: number | null | undefined,
) {
  const resolved = resolvePotentialImage(agentId, raw)
  // An agent with no potential capability contributes a neutral condition key.
  // A preserve_unknown subject instead stays unknown and fails the objective.
  return resolved ?? (supportsPotentialImage(agentId) ? null : 0)
}

/** Only a frozen, exact source branch may select this limited comparison. */
export function frozenMiyabiLuminizeDirection32(input: ObjectiveInput) {
  const intent = input.buildIntent
  if (
    intent?.scope !== 'team_joint' ||
    intent.agentIds.length !== 3 ||
    intent.exactTeam.candidateId !== input.candidate.candidateId ||
    intent.agentIds.some((id) => !input.candidate.memberIds.includes(id)) ||
    !['agent-miyabi', 'agent-remielle'].every((id) => intent.agentIds.includes(id)) ||
    !['agent-velina', 'agent-yanagi'].some((id) => intent.agentIds.includes(id))
  )
    return null
  const direction = intent.recommendations.find((row) => row.agentId === 'agent-miyabi')?.constraint
  const conditions = targetTeamBuildDirectionConditions({
    memberIds: input.candidate.memberIds,
    roster: input.warehouse.roster,
    potentialByAgentId: input.parameters.potentialByAgentId,
  })
  const currentMindscapes = reviewedTeamMindscapeByAgentId({
    memberIds: input.candidate.memberIds,
    ...conditions,
  })
  const observedConditionsMatch = input.candidate.memberIds.every(
    (id) =>
      intent.exactTeam.agentMindscapeById?.[id] === currentMindscapes[id] &&
      intent.exactTeam.selectedDirectionIdByAgentId?.[id] ===
        conditions.selectedDirectionIdByAgentId[id],
  )
  const current = getCandidateWarehouseConstraintForTeam('agent-miyabi', {
    memberIds: input.candidate.memberIds,
    ...conditions,
  })
  return observedConditionsMatch &&
    direction?.buildObjective === 'declared_luminize_static_volley32' &&
    current?.contentHash === direction.contentHash &&
    current.reviewedTeamDirectionId
    ? current.reviewedTeamDirectionId
    : null
}

export function createTargetTeamLuminizeAssignmentObjective32(
  input: ObjectiveInput,
  directionId: string,
  options?: TargetTeamObjectiveOptions,
): TeamAssignmentObjective {
  const scenario = resolveCurrentPlanningScenario32(input.scenarioSelection)
  const modifierProjection = projectTargetTeamEquipmentModifiers({
    baseline: scenario.baseline,
    memberIds: input.candidate.memberIds,
    parameters: input.parameters,
  })
  const selectedPotential = Object.fromEntries(
    input.candidate.memberIds.map((agentId) => [
      agentId,
      effectiveLuminizeObjectivePotential32(
        agentId,
        input.parameters.potentialByAgentId?.[agentId] ??
          input.warehouse.roster.agents.find((row) => row.agentId === agentId)?.potentialImage,
      ),
    ]),
  )
  const frozenPotentialMatches = input.candidate.memberIds.every(
    (agentId) =>
      input.buildIntent?.exactTeam.agentPotentialById[agentId] === selectedPotential[agentId],
  )
  const actualProgressionKnown = input.candidate.memberIds.every((agentId) => {
    const member = input.warehouse.roster.agents.find((row) => row.agentId === agentId)
    return (
      member?.owned === true &&
      Number.isInteger(member.mindscape) &&
      member.mindscape >= 0 &&
      member.mindscape <= 6 &&
      frozenMiyabiLuminizeDirection32(input) === directionId &&
      frozenPotentialMatches &&
      Number.isInteger(selectedPotential[agentId]) &&
      selectedPotential[agentId]! >= 0 &&
      selectedPotential[agentId]! <= 6
    )
  })
  let baseline:
    | {
        damage: number
        memberStats: Map<
          string,
          { impact: number; energy: number; mastery: number; proficiency: number }
        >
        miyabiStaticCritInput: number
        miyabiCritDamage: number
        directDamageByAgentId: Map<string, number> | null
        capacities: ReviewedFunctionalCapacity32[] | null
      }
    | undefined
  let baselineContext: TargetTeamPlanningContextInput | undefined
  let hintProbeEvaluations = 0
  const rates = new Map<StatKey, number | null>()
  const hintValues = new Map<string, number>()

  const evaluate = (assignments: Parameters<TeamAssignmentObjective['evaluate']>[0]) => {
    if (!actualProgressionKnown || assignments.length !== 3) return null
    const loadouts = assignments.map((loadout) => ({
      agentId: loadout.agentId,
      discIds: loadout.discs.map((choice) => choice.disc.id),
    }))
    if (
      loadouts.some(
        (row) => !input.candidate.memberIds.includes(row.agentId) || row.discIds.length !== 6,
      ) ||
      new Set(loadouts.map((row) => row.agentId)).size !== 3 ||
      new Set(loadouts.flatMap((row) => row.discIds)).size !== 18
    )
      return null
    const context:
      | (TargetTeamPlanningContextInput & { buildIntent?: TeamJointBuildIntent })
      | null = options?.contextResolver
      ? options.contextResolver.resolve(assignments)
      : {
          ...input,
          modifierProjection,
          fit: {
            status: 'ready',
            memberIds: input.candidate.memberIds,
            loadouts,
            uniqueDiscCount: 18,
            fingerprint: stableContentHash(loadouts),
          },
        }
    if (
      !context ||
      targetTeamObjectiveConditionsIdentity(context) !==
        targetTeamObjectiveConditionsIdentity(input) ||
      context.fit.status !== 'ready' ||
      context.fit.uniqueDiscCount !== 18 ||
      stableContentHash(context.fit.loadouts) !== stableContentHash(loadouts) ||
      context.candidate.candidateId !== input.candidate.candidateId ||
      frozenMiyabiLuminizeDirection32(context) !== directionId ||
      context.candidate.memberIds.some((id) => {
        const original = input.warehouse.roster.agents.find((row) => row.agentId === id)
        const current = context.warehouse.roster.agents.find((row) => row.agentId === id)
        return (
          !current?.owned ||
          stableContentHash([current.mindscape, current.skillLevels, current.potentialImage]) !==
            stableContentHash([
              original?.mindscape,
              original?.skillLevels,
              original?.potentialImage,
            ])
        )
      }) ||
      assignments.some((row) =>
        row.discs.some(
          ({ disc }) =>
            stableContentHash(disc) !==
            stableContentHash(context.warehouse.discs.find((item) => item.id === disc.id)),
        ),
      )
    )
      return null
    const currentScenario = resolveCurrentPlanningScenario32(context.scenarioSelection)
    if (currentScenario.identity !== scenario.identity) return null
    const members = compileTargetTeamPlanningMembers(context)
    if (
      members.blockers.length ||
      members.effectRuntimeMembers.length !== 3 ||
      members.assets.length !== 3
    )
      return null
    const snapshot = projectAccountLuminizeEquipmentSnapshot32({
      members: members.effectRuntimeMembers,
      memberIds: context.candidate.memberIds,
      options: context.parameters.luminizeComparison32 ?? luminizeEquipmentPreparationProtocol32,
      baseline: scenario.baseline,
      assetBindingFingerprint: stableContentHash({
        rosterHash: context.rosterHash,
        warehouseHash: context.warehouseHash,
        assets: members.assets,
        parameters: context.parameters,
        scenario: scenario.identity,
      }),
      sourceRefs: [scenario.identity, ...members.assets.flatMap((row) => row.evidenceRefs)],
    })
    if (snapshot.status !== 'supported' || snapshot.totalDamage === null) return null
    const memberStats = new Map(
      members.effectRuntimeMembers.map((row) => [
        row.agentId,
        {
          impact: row.finalStats.impact,
          energy: row.finalStats.enerRegen,
          mastery: row.finalStats.anomMas,
          proficiency: row.finalStats.anomProf,
        },
      ]),
    )
    const miyabi = members.effectRuntimeMembers.find((row) => row.agentId === 'agent-miyabi')!
    // This is the static equipment panel input, not the source effect's combat
    // CR or an observed icefire window. Protect it even above the source cap.
    const staticCritInput = miyabi.finalStats.crit_
    if (
      !Number.isFinite(staticCritInput) ||
      !Number.isFinite(miyabi.finalStats.crit_dmg_) ||
      [...memberStats.values()].some((row) =>
        Object.values(row).some((value) => !Number.isFinite(value)),
      )
    )
      return null
    const direct = hasUnresolvedAuthorityScenario(context.candidate)
      ? null
      : compileTargetTeamPlanningContext(context)
    const directDamageByAgentId =
      direct?.status === 'supported' &&
      direct.memberFunctionalCapacities32.every((row) => row.status === 'supported') &&
      direct.coverage.excludedEffects.every(
        (effect) =>
          effect.reason === 'static_condition_not_met' ||
          (direct.includedScope === 'three_members' &&
            isReviewedPreparedMemberDamageExclusion32(effect)),
      )
        ? new Map(direct.memberDamage.map((row) => [row.agentId, row.totalDamage]))
        : null
    const capacities =
      directDamageByAgentId !== null && direct?.status === 'supported'
        ? direct.memberFunctionalCapacities32.flatMap((row) => row.capacities)
        : null
    if (!baseline) {
      baseline = {
        damage: snapshot.totalDamage,
        memberStats,
        miyabiStaticCritInput: staticCritInput,
        miyabiCritDamage: miyabi.finalStats.crit_dmg_,
        directDamageByAgentId,
        capacities,
      }
      baselineContext = context
    } else {
      const tolerance = 1e-9
      if (
        !preservesMiyabiStaticCritInput32(baseline.miyabiStaticCritInput, staticCritInput) ||
        miyabi.finalStats.crit_dmg_ + tolerance < baseline.miyabiCritDamage ||
        (baseline.directDamageByAgentId !== null &&
          (directDamageByAgentId === null ||
            [...baseline.directDamageByAgentId].some(
              ([agentId, damage]) =>
                !Number.isFinite(damage) ||
                !Number.isFinite(directDamageByAgentId.get(agentId)) ||
                directDamageByAgentId.get(agentId)! + tolerance < damage,
            ) ||
            !baseline.capacities ||
            !capacities ||
            !preservesReviewedFunctionalCapacities32(baseline.capacities, capacities)))
      )
        return null
      for (const [agentId, original] of baseline.memberStats) {
        const current = memberStats.get(agentId)
        if (
          !current ||
          current.impact + tolerance < original.impact ||
          current.energy + tolerance < original.energy ||
          current.mastery + tolerance < original.mastery ||
          current.proficiency + tolerance < original.proficiency
        )
          return null
      }
    }
    return snapshot.totalDamage
  }

  return {
    domain: 'game_legal_inventory',
    fingerprint: stableContentHash({
      policy: targetTeamLuminizeAssignmentObjectivePolicy32,
      contextResolverIdentity: options?.contextResolver?.identity ?? null,
      wEngineRuntimeDeclarations: input.wEngineRuntimeDeclarations ?? null,
      directionId,
      buildIntentFingerprint: input.buildIntent?.fingerprint,
      candidate: input.candidate,
      rosterHash: input.rosterHash,
      warehouseHash: input.warehouseHash,
      planningHash: input.planningHash,
      parameters: input.parameters,
      selectedPotential,
      memberProgression: input.warehouse.roster.agents
        .filter((row) => input.candidate.memberIds.includes(row.agentId))
        .map((row) => ({
          agentId: row.agentId,
          mindscape: row.mindscape,
          potentialImage: row.potentialImage,
          skillLevels: row.skillLevels,
        })),
      scenario: scenario.identity,
      protocol: input.parameters.luminizeComparison32 ?? luminizeEquipmentPreparationProtocol32,
    }),
    baselineDiscIdsByAgent: Object.fromEntries(
      input.candidate.memberIds.flatMap((agentId) => {
        const ids = input.warehouse.roster.agents.find(
          (agent) => agent.agentId === agentId,
        )?.equippedDiscIds
        return ids?.length === 6 ? [[agentId, ids]] : []
      }),
    ),
    evaluate,
    hintProbeEvaluations: () => hintProbeEvaluations,
    visitHint: (disc, agentId) => {
      if (!baselineContext || !baseline || agentId !== 'agent-miyabi') return 0
      if (!rates.size) {
        for (const probe of standardSubstatProbes()) {
          const projected = compileTargetTeamPlanningMembers({
            ...baselineContext,
            statProbesByAgentId: { [agentId]: probe },
          })
          hintProbeEvaluations++
          const snapshot = projected.blockers.length
            ? null
            : projectAccountLuminizeEquipmentSnapshot32({
                members: projected.effectRuntimeMembers,
                memberIds: input.candidate.memberIds,
                options:
                  input.parameters.luminizeComparison32 ?? luminizeEquipmentPreparationProtocol32,
                baseline: scenario.baseline,
                assetBindingFingerprint: stableContentHash(projected.assets),
                sourceRefs: [scenario.identity],
              })
          rates.set(
            probe.stat,
            snapshot?.status === 'supported' && snapshot.totalDamage !== null
              ? (snapshot.totalDamage - baseline.damage) / probe.value
              : null,
          )
        }
      }
      if (!hintValues.has(disc.id)) {
        const main = resolveDriveDiscMainStatValue(disc)
        const lines = [
          ...disc.subStats,
          ...(main ? [{ stat: disc.mainStat, value: main.value }] : []),
        ]
        hintValues.set(
          disc.id,
          lines.reduce((sum, line) => {
            const rate = rates.get(line.stat)
            return rate === null || rate === undefined || !Number.isFinite(rate)
              ? sum
              : sum + line.value * rate
          }, 0),
        )
      }
      return hintValues.get(disc.id)!
    },
  }
}
