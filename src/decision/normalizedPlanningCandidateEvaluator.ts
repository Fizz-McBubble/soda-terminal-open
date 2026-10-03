import type { AccountRoster } from '../assault/types'
import { compileCurrentDriveDiscPlanningEffects } from '../calculation/currentDriveDiscPlanningEffects'
import { resolvePotentialImage } from '../assault/agentCapabilities'
import { composePlanningTeamDps } from '../calculation/planningTeamDps'
import {
  compileNormalizedAgentEventSchedule,
  currentNormalizedPlanningBaseline,
} from '../calculation/currentNormalizedPlanningBaseline'
import {
  compileCurrentPlanningFormationEffectObservations,
  type PlanningEffectRuntimeMember,
} from '../calculation/currentPlanningEffectRuntime'
import { evaluateSourceBackedPlanningTeamDps } from '../calculation/currentPlanningTeamDpsRuntime'
import {
  createPlanningDpsContract,
  derivePlanningCapabilityMatrix,
  type CalculationSupport,
} from '../calculation/planningDpsContract'
import { createPlanningDpsExecution } from '../calculation/planningDpsExecution'
import {
  compilePlanningCalculationContext,
  type PlanningContextMemberAsset,
  type PlanningEventUsage,
} from '../calculation/planningCalculationContextCompiler'
import type { DriveDisc } from '../domain/schemas'
import { candidateCalculationPackage } from '../gameDataPacks/currentCalculationCandidate'
import { compileCurrentWEnginePersonalPlanningEffects } from '../calculation/currentWEnginePersonalPlanningEffects'
import { stableContentHash } from '../gameDataPacks/types'
import { compileIncremental32PlanningSourceSelection } from './incremental32PlanningSourceSelection'
import { projectTargetTeamWEngineModifiers } from '../calculation/targetTeamEquipmentModifierProjection'
import type { TeamEngineCandidate } from '../teamEngine/contracts'
import type { TeamExecution } from './teamExecutionProjection'
import { evaluateCurrentBangbooPlanningParameter } from '../calculation/currentBangbooPlanningAdapter'
import {
  accountSkillLevel,
  projectNormalizedAccountFinalStats,
} from './normalizedAccountFinalStats'
export {
  accountSkillLevel,
  projectNormalizedAccountFinalStatsDetailed,
  projectNormalizedAccountFinalStats,
} from './normalizedAccountFinalStats'

function complete(fieldId: string, sourceHash: string) {
  return {
    state: 'complete' as const,
    fields: [{ fieldId, status: 'ready' as const, reason: sourceHash }],
  }
}

export function evaluateNormalizedPlanningCandidate(input: {
  accountId: string
  rosterHash: string
  warehouseHash: string
  planningHash: string
  capturedAt: string
  candidate: TeamEngineCandidate
  execution: TeamExecution | undefined
  roster: AccountRoster
  discs: readonly DriveDisc[]
  onUnsupportedBangboo?: (blockers: string[]) => void
}) {
  const { candidate, execution } = input
  if (!execution || execution.memberIds.join('|') !== candidate.memberIds.join('|')) return null
  if ((candidate.bangbooId ?? '') !== execution.bangbooId) return null
  const selectedStars = execution.bangbooStar
  if (candidate.bangbooId && (!selectedStars || selectedStars < 1 || selectedStars > 5)) return null
  const bangbooParameter = candidate.bangbooId
    ? evaluateCurrentBangbooPlanningParameter({
        stableId: candidate.bangbooId,
        stars: selectedStars!,
        memberIds: candidate.memberIds,
      })
    : null
  if (
    bangbooParameter &&
    (bangbooParameter.status !== 'supported' || bangbooParameter.directDamage === null)
  ) {
    input.onUnsupportedBangboo?.(bangbooParameter.blockers)
    return null
  }
  const discById = new Map(input.discs.map((disc) => [disc.id, disc]))
  const eventUsages: PlanningEventUsage[] = []
  const assets: PlanningContextMemberAsset[] = []
  const effectRuntimeMembers: PlanningEffectRuntimeMember[] = []
  for (const agentId of candidate.memberIds) {
    const rosterAgent = input.roster.agents.find(
      (agent) => agent.agentId === agentId && agent.owned,
    )
    const member = execution.members.find((item) => item.agentId === agentId)
    const selectedEngine = member?.suggested.wEngine
    const discs =
      member?.suggested.discIds
        .map((id) => discById.get(id))
        .filter((disc): disc is DriveDisc => Boolean(disc)) ?? []
    if (!rosterAgent || !selectedEngine || discs.length !== 6) return null
    const skillLevels = Object.fromEntries(
      ['basic', 'dodge', 'assist', 'special', 'chain', 'core'].map((skill) => [
        skill,
        accountSkillLevel(rosterAgent, skill),
      ]),
    )
    const schedule = compileNormalizedAgentEventSchedule({ agentId, skillLevels })
    const stats = projectNormalizedAccountFinalStats({
      agent: rosterAgent,
      engineId: selectedEngine.engineId,
      discs,
    })
    if (schedule.status === 'unsupported' || !stats) return null
    eventUsages.push(...schedule.eventUsages)
    const schemeBindingId = `scheme:${agentId}:${selectedEngine.engineId}`
    const finalStatsHash = stableContentHash({ agentId, selectedEngine, discs, stats, skillLevels })
    assets.push({
      agentId,
      level: rosterAgent.level,
      mindscape: rosterAgent.mindscape,
      potential: resolvePotentialImage(agentId, rosterAgent.potentialImage) ?? null,
      skillLevels,
      wEngine: {
        copyId: schemeBindingId,
        engineId: selectedEngine.engineId,
        level: stats.progression.engineLevel,
        refinement: selectedEngine.refinement,
      },
      discs: discs.map((disc) => ({
        id: disc.id,
        slot: disc.slot,
        setId: disc.setId,
        level: disc.level,
        statsHash: stableContentHash(disc),
      })),
      finalStatsHash,
      evidenceRefs: [
        `account:${input.accountId}:roster`,
        `account:${input.accountId}:warehouse`,
        currentNormalizedPlanningBaseline.baselineId,
      ],
    })
    effectRuntimeMembers.push({
      agentId,
      level: rosterAgent.level,
      mindscape: rosterAgent.mindscape,
      potential: resolvePotentialImage(agentId, rosterAgent.potentialImage) ?? null,
      // Formula tables index the seven core-skill nodes, whereas account skill
      // defaults use combat-skill caps. Keep the runtime input in the source
      // table's 1..7 domain and never substitute a combat-skill level here.
      coreLevel: Math.min(7, accountSkillLevel(rosterAgent, 'core')),
      skillLevels,
      initialStats: stats.initialStats,
      finalStats: stats.finalStats,
    })
  }
  if (new Set(assets.flatMap((asset) => asset.discs.map((disc) => disc.id))).size !== 18)
    return null

  const sourceSelection = compileIncremental32PlanningSourceSelection({
    members: effectRuntimeMembers,
    eventUsages,
  })
  if (sourceSelection.status !== 'supported') return null
  eventUsages.splice(0, eventUsages.length, ...sourceSelection.eventUsages)

  const discEffects = compileCurrentDriveDiscPlanningEffects({
    members: effectRuntimeMembers,
    loadouts: assets.map((asset) => ({ agentId: asset.agentId, discs: asset.discs })),
  })
  if (discEffects.status !== 'supported') return null
  const engineEffects = assets.map((asset) =>
    compileCurrentWEnginePersonalPlanningEffects({
      agentId: asset.agentId,
      engineId: asset.wEngine.engineId,
      refinement: asset.wEngine.refinement,
      member: effectRuntimeMembers.find((member) => member.agentId === asset.agentId),
      runtime: sourceSelection.runtimeByAgentId[asset.agentId],
    }),
  )
  if (engineEffects.some((effects) => effects.status !== 'supported')) return null
  const sourceTeamEquipment = sourceSelection.sourcePackets.length
    ? projectTargetTeamWEngineModifiers({
        memberIds: candidate.memberIds,
        parameters: {
          wEngines: assets.map((asset) => ({
            agentId: asset.agentId,
            engineId: asset.wEngine.engineId,
            refinement: asset.wEngine.refinement,
            level: asset.wEngine.level,
          })),
        },
        members: effectRuntimeMembers,
        runtimeByAgentId: sourceSelection.runtimeByAgentId,
      })
    : null
  if (sourceTeamEquipment && sourceTeamEquipment.status !== 'supported') return null
  const effectResult = compileCurrentPlanningFormationEffectObservations({
    memberIds: candidate.memberIds,
    members: effectRuntimeMembers,
    baselineReferencesByAgentId: sourceSelection.referencesByAgentId,
  })
  if (effectResult.status === 'unsupported') return null
  const accountSnapshot = {
    accountId: input.accountId,
    rosterHash: input.rosterHash,
    warehouseHash: input.warehouseHash,
    planningHash: input.planningHash,
    ownedAgentIds: input.roster.agents.filter((agent) => agent.owned).map((agent) => agent.agentId),
    ownedBangbooIds: input.roster.bangboos
      .filter((bangboo) => bangboo.owned)
      .map((bangboo) => bangboo.bangbooId),
    capturedAt: input.capturedAt,
    stale: false,
  }
  const context = compilePlanningCalculationContext({
    contextId: `normalized:${candidate.candidateId}:${input.planningHash}`,
    gameVersion: currentNormalizedPlanningBaseline.gameVersion,
    canonical: {
      packageId: candidateCalculationPackage.packageId,
      packageVersion: candidateCalculationPackage.packageVersion,
      gameVersion: candidateCalculationPackage.gameVersion,
      contentHash: currentNormalizedPlanningBaseline.sourcePackHash,
      status: 'candidate',
      rollbackPackageId: candidateCalculationPackage.rollbackPackageId,
    },
    accountSnapshot,
    baseline: currentNormalizedPlanningBaseline,
    memberIds: candidate.memberIds,
    bangboo: bangbooParameter
      ? {
          id: bangbooParameter.stableId,
          level: bangbooParameter.level,
          coreLevel: bangbooParameter.stars,
        }
      : null,
    assets,
    eventUsages,
    effectDispositions: effectResult.dispositions,
    interactionContracts: effectResult.contracts,
    requiredInteractionOperators: effectResult.contracts.length ? ['team_effect_resolution'] : [],
    interactionAuthorityRequirement: 'source_backed_only',
    equipmentBindingMode: 'scheme_parameters',
    scenarioId: candidate.scenarioTags.length
      ? `scenario:${candidate.scenarioTags.join('+')}`
      : 'scenario:normalized',
    constraintsHash: stableContentHash({
      candidateId: candidate.candidateId,
      execution,
      discEffects: discEffects.fingerprint,
      engineEffects,
      sourceSelection: sourceSelection.fingerprint,
      sourceTeamEquipment: sourceTeamEquipment?.directRuntime.fingerprint ?? null,
    }),
  })
  if (context.status === 'unsupported') return null

  const eventCount = eventUsages.reduce((sum, usage) => sum + usage.occurrenceCount, 0)
  const sourceBackedDamage = evaluateSourceBackedPlanningTeamDps({
    memberIds: candidate.memberIds,
    members: effectRuntimeMembers,
    eventUsages,
    baseline: currentNormalizedPlanningBaseline,
    equipmentModifierBuckets: [
      ...discEffects.buckets,
      ...(sourceTeamEquipment?.directRuntime.buckets ??
        engineEffects.flatMap((effects) =>
          effects.status === 'supported' ? effects.buckets : [],
        )),
    ],
    baselineReferencesByAgentId: sourceSelection.referencesByAgentId,
  })
  if (sourceBackedDamage.status === 'unsupported') return null
  const personalSupports: CalculationSupport[] = candidate.memberIds.map((agentId) => ({
    supportId: `normalized-personal:${agentId}`,
    kind: 'personalFormula',
    applicability: 'required',
    capabilities: ['planning_damage', 'planning_dps'],
    providerId: agentId,
    targetIds: [agentId],
    build: complete(
      `final-stats:${agentId}`,
      assets.find((asset) => asset.agentId === agentId)!.finalStatsHash,
    ),
    calculation: complete(`event-schedule:${agentId}`, context.eventScheduleHash),
    coverage: {
      activeSeconds: currentNormalizedPlanningBaseline.declaredDurationSeconds,
      eligibleEventCount: eventCount,
      coveredEventCount: eventUsages.filter((usage) => usage.ownerAgentId === agentId).length,
    },
    sourceHash: currentNormalizedPlanningBaseline.formulaHash,
  }))
  const interactionSupport: CalculationSupport = {
    supportId: `source-backed-interaction:${candidate.candidateId}`,
    kind: 'interaction',
    applicability: 'required',
    capabilities: ['planning_damage', 'planning_dps'],
    providerId: candidate.memberIds[0],
    targetIds: [...candidate.memberIds],
    build: complete('effect-owner-target-snapshot', context.effectBlueprintHash),
    calculation: complete('source-backed-effect-buckets', sourceBackedDamage.runtimeHash),
    coverage: {
      activeSeconds: currentNormalizedPlanningBaseline.declaredDurationSeconds,
      eligibleEventCount: effectResult.dispositions.length,
      coveredEventCount: effectResult.dispositions.length,
    },
    sourceHash: sourceBackedDamage.runtimeHash,
  }
  const supports: CalculationSupport[] = [...personalSupports, interactionSupport]
  if (candidate.bangbooId)
    supports.push({
      supportId: `normalized-bangboo:${candidate.bangbooId}`,
      kind: 'bangboo',
      applicability: 'required',
      capabilities: ['planning_damage', 'planning_dps'],
      providerId: candidate.bangbooId,
      targetIds: [...candidate.memberIds],
      build: complete('bangboo-scheme-binding', bangbooParameter!.fingerprint),
      calculation: complete('bangboo-normalized-event', bangbooParameter!.fingerprint),
      coverage: {
        activeSeconds: currentNormalizedPlanningBaseline.declaredDurationSeconds,
        eligibleEventCount: 1,
        coveredEventCount: 1,
      },
      sourceHash: currentNormalizedPlanningBaseline.sourcePackHash,
    })
  const planningInput = {
    schemaVersion: 'planning-dps-input-v1' as const,
    equipmentBindingMode: 'scheme_parameters' as const,
    baseline: currentNormalizedPlanningBaseline,
    accountSnapshot,
    calculationTarget: {
      targetId: candidate.candidateId,
      scope: 'team' as const,
      agentIds: [...candidate.memberIds],
      bangbooId: candidate.bangbooId,
    },
    supports,
    supportHash: stableContentHash(supports),
    solverHash: stableContentHash({
      model: currentNormalizedPlanningBaseline.baselineId,
      strategy: 'source_backed_effect_buckets_recompute_per_event',
    }),
  }
  const contract = createPlanningDpsContract(planningInput)
  const capabilities = derivePlanningCapabilityMatrix(contract)
  const baselineFingerprint = stableContentHash(contract.baseline)
  const memberExecutions = candidate.memberIds.map((agentId) =>
    createPlanningDpsExecution(contract.fingerprint, {
      status: 'supported',
      kind: 'member_in_team',
      subjectId: agentId,
      baselineFingerprint,
      declaredDurationSeconds: currentNormalizedPlanningBaseline.declaredDurationSeconds,
      capabilities,
      totalDamage: sourceBackedDamage.memberDamage.find((member) => member.agentId === agentId)!
        .totalDamage,
      planningDps:
        sourceBackedDamage.memberDamage.find((member) => member.agentId === agentId)!.totalDamage /
        currentNormalizedPlanningBaseline.declaredDurationSeconds,
    }),
  )
  const bangbooDamage = bangbooParameter?.directDamage ?? 0
  const projectionInput = {
    planning: planningInput,
    memberExecutions,
    additionalDamageBuckets: candidate.bangbooId
      ? [
          {
            bucketId: `source-backed-bangboo:${candidate.candidateId}`,
            kind: 'bangboo' as const,
            supportId: `normalized-bangboo:${candidate.bangbooId}`,
            providerId: candidate.bangbooId,
            totalDamage: bangbooDamage,
            sourceHash: currentNormalizedPlanningBaseline.sourcePackHash,
          },
        ]
      : [],
  }
  const projection = composePlanningTeamDps(projectionInput)
  if (projection.status !== 'supported') return null
  const teamExecution = createPlanningDpsExecution(contract.fingerprint, projection.result)
  const bindingCore = {
    members: assets.map((asset) => ({
      agentId: asset.agentId,
      wEngineCopyId: asset.wEngine.copyId,
      discIds: asset.discs.map((disc) => disc.id),
      finalStatsHash: asset.finalStatsHash,
    })),
    bangbooId: candidate.bangbooId,
    bangbooStars: selectedStars ?? null,
    bangbooParameterHash: bangbooParameter?.fingerprint ?? null,
  }
  return {
    candidateId: candidate.candidateId,
    planning: planningInput,
    assetBinding: { ...bindingCore, assetHash: stableContentHash(bindingCore) },
    projection,
    execution: teamExecution,
  }
}
