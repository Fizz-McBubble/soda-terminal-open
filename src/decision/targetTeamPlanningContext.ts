import { compileTargetTeamPlanningCoverage } from './targetTeamPlanningCoverage'
import type { CoreWarehouse } from '../accounts/coreFlow'
import { compileCurrentDriveDiscPlanningEffects } from '../calculation/currentDriveDiscPlanningEffects'
import { resolvePotentialImage, supportsPotentialImage } from '../assault/agentCapabilities'
import { summarizeSourceResourceProduction32 } from '../calculation/sourceResourceProduction32'
import {
  summarizeSourceMechanismResourceGrants32,
  type SourceResourceGrantDeclaration32,
} from '../calculation/sourceMechanismResourceGrants32'
import {
  compileNormalizedAgentEventSchedule,
  currentNormalizedPlanningBaseline,
} from '../calculation/currentNormalizedPlanningBaseline'
import { type PlanningEffectRuntimeMember } from '../calculation/currentPlanningEffectRuntime'
import { mergePlanningReferenceMaps32 } from '../calculation/currentPlanningEffectDomain'
import { compileCurrentPlanningInteractionBundle } from '../calculation/currentPlanningInteractionBundle'
import { evaluateSourceBackedPlanningTeamDps } from '../calculation/currentPlanningTeamDpsRuntime'
import {
  compilePlanningCalculationContext,
  type PlanningContextMemberAsset,
  type PlanningEventUsage,
} from '../calculation/planningCalculationContextCompiler'
import {
  projectTargetTeamEquipmentModifiers,
  type TargetTeamEquipmentModifierProjection,
} from '../calculation/targetTeamEquipmentModifierProjection'
import { candidateCalculationPackage } from '../gameDataPacks/currentCalculationCandidate'
import { usesIncremental32Capabilities } from '../gameDataPacks/incremental32AffectedCapabilities'
import {
  incremental32RecoveryPolicy,
  incremental32RecoveryReason,
} from '../gameDataPacks/incremental32RecoveryPolicy'
import { stableContentHash } from '../gameDataPacks/types'
import {
  hasUnresolvedAuthorityScenario,
  type TeamBuildExecutionIdentity,
} from './teamBuildExecutionIdentity'
import {
  accountSkillLevel,
  projectNormalizedAccountFinalStatsDetailed,
} from './normalizedPlanningCandidateEvaluator'
import type { TargetTeamEquipmentParameterSelection } from './targetTeamAccountBoundBenchmark'
import type { TargetTeamWarehouseFit } from './targetTeamWarehouseFit'
import { compileTargetTeamKoledaFixedConditions32 } from './targetTeamKoledaFixedConditions32'
import { compileIncremental32PlanningSourceSelection } from './incremental32PlanningSourceSelection'
import { qualifyReviewedPreparedTeamBenchmark32 } from '../calculation/reviewedPreparedTeamBenchmark32'
import type { StandardSubstatProbe } from '../calculation/standardSubstatProbe'
import { evaluateReviewedFunctionalCapacity32 } from '../calculation/reviewedFunctionalCapacity32'

const unique = (values: readonly string[]) => [...new Set(values)]

export function compileTargetTeamPlanningContext(input: {
  warehouse: CoreWarehouse
  candidate: TeamBuildExecutionIdentity
  fit: Pick<
    TargetTeamWarehouseFit,
    'status' | 'uniqueDiscCount' | 'memberIds' | 'loadouts' | 'fingerprint'
  >
  parameters: TargetTeamEquipmentParameterSelection
  modifierProjection: TargetTeamEquipmentModifierProjection
  rosterHash: string
  warehouseHash: string
  planningHash: string
  capturedAt: string
  /** Internal, read-only sensitivity probe; never a saved physical loadout. */
  statProbesByAgentId?: Readonly<Record<string, StandardSubstatProbe>>
  /** Explicit independent fixture conditions, never populated from source UI
   * defaults or promoted to a player/account observation. */
  calibrationObservations?: {
    authority: 'independent_calibration'
    id: string
    referencesByAgentId: Readonly<Record<string, Readonly<Record<string, unknown>>>>
    resourceGrantDeclaration32?: SourceResourceGrantDeclaration32
  }
}) {
  const blockers: string[] = []
  const unresolvedScenario = hasUnresolvedAuthorityScenario(input.candidate)
  const unresolvedScenarioBlocker =
    '来源精确队伍未提供可计算的场景条件；不得将空条件规范化为 CalculationContext。'
  const recoveryPaused =
    incremental32RecoveryPolicy.enabled &&
    usesIncremental32Capabilities({
      members: input.fit.memberIds.map((agentId) => ({
        agentId,
        potential:
          input.parameters.potentialByAgentId?.[agentId] ??
          input.warehouse.roster.agents.find((agent) => agent.agentId === agentId)?.potentialImage,
      })),
      equipmentIds: input.parameters.wEngines.map((parameter) => parameter.engineId),
      hasKoledaDeclaration:
        input.fit.memberIds.includes('agent-koleda') &&
        input.parameters.koledaFixedEventConditions32 !== undefined,
    })
  const unavailableBlockers = [
    ...(recoveryPaused ? [incremental32RecoveryReason] : []),
    ...(unresolvedScenario ? [unresolvedScenarioBlocker] : []),
  ]
  // Source-qualified condition metadata remains editable even when the team's
  // combat scenario is unresolved. The numeric gate remains below, before any
  // CalculationContext or equipment-effect evaluation is constructed.
  if (unavailableBlockers.length && !input.fit.memberIds.includes('agent-koleda')) {
    return {
      status: 'unsupported' as const,
      blockers: unavailableBlockers,
      fingerprint: stableContentHash({
        candidateId: input.candidate.candidateId,
        provenance: input.candidate.provenance,
        scenarioTags: input.candidate.scenarioTags,
        blockers: unavailableBlockers,
      }),
    }
  }
  if (input.fit.status !== 'ready' || input.fit.uniqueDiscCount !== 18)
    blockers.push('目标 CalculationContext 需要三名成员各六张、合计 18 张不同实体盘。')
  const discById = new Map(input.warehouse.discs.map((disc) => [disc.id, disc]))
  const parameterByAgentId = new Map(
    input.parameters.wEngines.map((parameter) => [parameter.agentId, parameter]),
  )
  const eventUsages: PlanningEventUsage[] = []
  const assets: PlanningContextMemberAsset[] = []
  const effectRuntimeMembers: PlanningEffectRuntimeMember[] = []

  for (const agentId of input.fit.memberIds) {
    const agent = input.warehouse.roster.agents.find(
      (item) => item.agentId === agentId && item.owned,
    )
    const parameter = parameterByAgentId.get(agentId)
    const loadout = input.fit.loadouts.find((item) => item.agentId === agentId)
    const discs =
      loadout?.discIds
        .map((discId) => discById.get(discId))
        .filter((disc): disc is NonNullable<typeof disc> => Boolean(disc)) ?? []
    if (!agent) blockers.push(`目标成员不在当前账号已拥有代理人中：${agentId}`)
    if (!parameter) blockers.push(`目标成员缺少方案音擎参数：${agentId}`)
    if (discs.length !== 6) blockers.push(`目标成员缺少六张实体盘：${agentId}`)
    if (!agent || !parameter || discs.length !== 6) continue
    const skillLevels = Object.fromEntries(
      ['basic', 'dodge', 'assist', 'special', 'chain', 'core'].map((skill) => [
        skill,
        accountSkillLevel(agent, skill),
      ]),
    )
    const schedule = compileNormalizedAgentEventSchedule({ agentId, skillLevels })
    const selectedPotential = input.parameters.potentialByAgentId?.[agentId] ?? agent.potentialImage
    if (
      input.parameters.potentialByAgentId?.[agentId] !== undefined &&
      (!supportsPotentialImage(agentId) ||
        !Number.isInteger(selectedPotential) ||
        Number(selectedPotential) < 0 ||
        Number(selectedPotential) > 6)
    )
      blockers.push(`${agentId} 的显式潜能参数无效。`)
    const projection = projectNormalizedAccountFinalStatsDetailed({
      agent: {
        ...agent,
        potentialImage: selectedPotential,
        wEngineDetails: {
          id: parameter.engineId,
          name: parameter.engineId,
          level: parameter.level ?? 60,
          ascension: parameter.ascension,
          refinement: parameter.refinement,
        },
      },
      engineId: parameter.engineId,
      discs,
      ...(input.statProbesByAgentId?.[agentId]
        ? { statProbe: input.statProbesByAgentId[agentId] }
        : {}),
    })
    const stats = projection.status === 'supported' ? projection.stats : null
    if (schedule.status === 'unsupported') blockers.push(...schedule.blockers)
    if (projection.status === 'unsupported')
      blockers.push(...projection.reasons.map((reason) => `${agentId}：${reason}`))
    if (schedule.status === 'unsupported' || !stats) continue
    eventUsages.push(...schedule.eventUsages)
    const finalStatsHash = stableContentHash({ agentId, parameter, discs, stats, skillLevels })
    assets.push({
      agentId,
      level: agent.level,
      mindscape: agent.mindscape,
      potential: resolvePotentialImage(agentId, selectedPotential) ?? null,
      skillLevels,
      wEngine: {
        copyId: `scheme:${agentId}:${parameter.engineId}`,
        engineId: parameter.engineId,
        level: parameter.level ?? 60,
        refinement: parameter.refinement,
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
        `account:${input.warehouse.accountId ?? 'legacy-local'}:roster`,
        `account:${input.warehouse.accountId ?? 'legacy-local'}:warehouse`,
        input.modifierProjection.fingerprint,
      ],
    })
    effectRuntimeMembers.push({
      agentId,
      level: agent.level,
      mindscape: agent.mindscape,
      potential: resolvePotentialImage(agentId, selectedPotential) ?? null,
      coreLevel: Math.min(7, accountSkillLevel(agent, 'core')),
      skillLevels,
      initialStats: stats.initialStats,
      finalStats: stats.finalStats,
    })
  }
  if (blockers.length)
    return {
      status: 'unsupported' as const,
      blockers: unique(blockers),
      fingerprint: stableContentHash({ input, blockers: unique(blockers) }),
    }

  const sourceSelection = compileIncremental32PlanningSourceSelection({
    members: effectRuntimeMembers,
    eventUsages,
  })
  if (sourceSelection.status !== 'supported')
    return {
      status: 'unsupported' as const,
      blockers: sourceSelection.blockers,
      fingerprint: sourceSelection.fingerprint,
    }
  eventUsages.splice(0, eventUsages.length, ...sourceSelection.eventUsages)

  const sourceReferences = mergePlanningReferenceMaps32(
    sourceSelection.referencesByAgentId,
    input.calibrationObservations?.referencesByAgentId,
  )

  const koledaConditions = compileTargetTeamKoledaFixedConditions32({
    members: effectRuntimeMembers,
    eventUsages,
    baseline: currentNormalizedPlanningBaseline,
    accountBindingHash: stableContentHash({
      accountId: input.warehouse.accountId ?? 'legacy-local',
      rosterHash: input.rosterHash,
      warehouseHash: input.warehouseHash,
    }),
    declaration: input.parameters.koledaFixedEventConditions32,
    preparedReferences32: sourceSelection.referencesByAgentId['agent-koleda'],
  })
  const koledaMetadata = koledaConditions.metadata
    ? { koledaFixedEventConditionsMetadata32: koledaConditions.metadata }
    : {}
  if (unavailableBlockers.length)
    return {
      status: 'unsupported' as const,
      blockers: unavailableBlockers,
      fingerprint: stableContentHash({
        candidateId: input.candidate.candidateId,
        provenance: input.candidate.provenance,
        scenarioTags: input.candidate.scenarioTags,
        blockers: unavailableBlockers,
      }),
      ...koledaMetadata,
    }
  if (koledaConditions.status === 'unsupported')
    return {
      status: 'unsupported' as const,
      blockers: koledaConditions.blockers,
      fingerprint: stableContentHash({ input, blockers: koledaConditions.blockers }),
      ...koledaMetadata,
    }

  const observedReferences = mergePlanningReferenceMaps32(
    sourceReferences,
    koledaConditions.references,
  )
  const modifierProjection = projectTargetTeamEquipmentModifiers({
    memberIds: input.fit.memberIds,
    parameters: input.parameters,
    members: effectRuntimeMembers,
    runtimeByAgentId: sourceSelection.runtimeByAgentId,
    bangbooScope: sourceSelection.preparedTeamConditions
      ? 'excluded_from_member_model'
      : 'included',
    wEngineLevelsByAgentId: Object.fromEntries(
      input.parameters.wEngines.map((row) => [row.agentId, row.level ?? 60]),
    ),
  })
  if (modifierProjection.status !== 'supported')
    return {
      status: 'unsupported' as const,
      blockers: modifierProjection.blockers,
      fingerprint: modifierProjection.fingerprint,
      ...koledaMetadata,
    }
  const discEffects = compileCurrentDriveDiscPlanningEffects({
    members: effectRuntimeMembers,
    preparedQuickAssist: sourceSelection.preparedTeamConditions?.discPreparation.quickAssist,
    loadouts: assets.map((asset) => ({ agentId: asset.agentId, discs: asset.discs })),
  })
  if (discEffects.status !== 'supported')
    return {
      status: 'unsupported' as const,
      blockers: discEffects.blockers,
      fingerprint: discEffects.fingerprint,
      ...koledaMetadata,
    }
  const interactions = compileCurrentPlanningInteractionBundle({
    memberIds: [...input.fit.memberIds],
    members: effectRuntimeMembers,
    baselineReferencesByAgentId: observedReferences,
  })
  if (interactions.status === 'unsupported')
    return {
      status: 'unsupported' as const,
      blockers: unique(interactions.blockers),
      fingerprint: stableContentHash({ input, blockers: unique(interactions.blockers) }),
      ...koledaMetadata,
    }
  const accountSnapshot = {
    accountId: input.warehouse.accountId ?? 'legacy-local',
    rosterHash: input.rosterHash,
    warehouseHash: input.warehouseHash,
    planningHash: input.planningHash,
    ownedAgentIds: input.warehouse.roster.agents
      .filter((agent) => agent.owned)
      .map((agent) => agent.agentId),
    // Compatibility field in the planning contract. Scheme-parameter calculations do not
    // fingerprint or validate a Bangboo entity inventory.
    ownedBangbooIds: [],
    capturedAt: input.capturedAt,
    stale: false,
  }
  const compilation = compilePlanningCalculationContext({
    contextId: `target:${input.candidate.candidateId}:${input.planningHash}:${input.modifierProjection.fingerprint}`,
    gameVersion: currentNormalizedPlanningBaseline.gameVersion,
    canonical: {
      packageId: candidateCalculationPackage.packageId,
      packageVersion: candidateCalculationPackage.packageVersion,
      gameVersion: currentNormalizedPlanningBaseline.gameVersion,
      contentHash: currentNormalizedPlanningBaseline.sourcePackHash,
      status: 'candidate',
      rollbackPackageId: candidateCalculationPackage.rollbackPackageId,
    },
    accountSnapshot,
    baseline: currentNormalizedPlanningBaseline,
    memberIds: [...input.fit.memberIds],
    bangboo: sourceSelection.preparedTeamConditions
      ? null
      : {
          id: input.parameters.bangbooId,
          level: 60,
          coreLevel: input.parameters.bangbooStars,
        },
    assets,
    eventUsages,
    effectDispositions: interactions.effectDispositions,
    interactionContracts: interactions.contracts,
    requiredInteractionOperators: interactions.requiredOperators,
    interactionAuthorityRequirement: 'source_backed_only',
    scenarioId: sourceSelection.preparedTeamConditions
      ? sourceSelection.preparedTeamConditions.policyId
      : input.candidate.scenarioTags.length
        ? `scenario:${input.candidate.scenarioTags.join('+')}`
        : 'scenario:normalized',
    constraintsHash: stableContentHash({
      candidateId: input.candidate.candidateId,
      fitFingerprint: input.fit.fingerprint,
      modifierFingerprint: input.modifierProjection.fingerprint,
      discEffectFingerprint: discEffects.fingerprint,
      sourceSelection: sourceSelection.fingerprint,
      calibrationObservations: input.calibrationObservations ?? null,
      ...(input.parameters.koledaFixedEventConditions32
        ? { koledaFixedEventConditions32: input.parameters.koledaFixedEventConditions32 }
        : {}),
    }),
    equipmentBindingMode: 'scheme_parameters',
  })
  if (compilation.status === 'unsupported')
    return {
      status: 'unsupported' as const,
      blockers: compilation.blockers,
      fingerprint: compilation.inputHash,
      ...koledaMetadata,
    }
  const runtime = evaluateSourceBackedPlanningTeamDps({
    memberIds: input.fit.memberIds,
    members: effectRuntimeMembers,
    eventUsages,
    baseline: currentNormalizedPlanningBaseline,
    equipmentModifierBuckets: [...modifierProjection.directRuntime.buckets, ...discEffects.buckets],
    baselineReferencesByAgentId: observedReferences,
  })
  if (runtime.status === 'unsupported')
    return {
      status: 'unsupported' as const,
      blockers: runtime.blockers,
      fingerprint: stableContentHash({ compilation, runtime }),
      ...koledaMetadata,
    }
  const memberOnly = modifierProjection.bangbooScope === 'excluded_from_member_model'
  const bangbooDamage = memberOnly ? null : modifierProjection.bangboo.directDamage
  if (!memberOnly && (typeof bangbooDamage !== 'number' || !Number.isFinite(bangbooDamage)))
    return {
      status: 'unsupported' as const,
      blockers: ['邦布固定事件直接伤害尚不可用。'],
      fingerprint: stableContentHash({ compilation, runtime, bangbooDamage }),
      ...koledaMetadata,
    }
  const memberDamage = runtime.memberDamage.reduce((sum, member) => sum + member.totalDamage, 0)
  const totalDamage = memberOnly ? memberDamage : memberDamage + bangbooDamage!
  const coverage = compileTargetTeamPlanningCoverage({
    runtime,
    interactions,
    discEffects,
    modifierProjection,
    effectRuntimeMembers,
    sourceBoundaries: sourceSelection.sourcePackets.map((row) => row.boundary),
  })
  const mechanismGrants32 = summarizeSourceMechanismResourceGrants32({
    members: effectRuntimeMembers,
    declaration: input.calibrationObservations?.resourceGrantDeclaration32,
  })
  const core = {
    ...koledaMetadata,
    coverage,
    modifierProjection,
    eventSetHash: stableContentHash(eventUsages),
    sourcePackets: sourceSelection.sourcePackets,
    memberModelQualification32:
      input.statProbesByAgentId || input.calibrationObservations
        ? null
        : qualifyReviewedPreparedTeamBenchmark32({
            context: compilation.context,
            members: effectRuntimeMembers,
            eventUsages,
            sourcePackets: sourceSelection.sourcePackets,
            conditions: sourceSelection.preparedTeamConditions,
            references: observedReferences,
            coverage,
            memberDamage: runtime.memberDamage,
          }),
    progressionHash: stableContentHash(
      input.fit.memberIds.map((id) => {
        const row = input.warehouse.roster.agents.find((agent) => agent.agentId === id)!
        return {
          agentId: id,
          level: row.level,
          ascension: row.ascension,
          mindscape: row.mindscape,
          skillLevels: row.skillLevels,
        }
      }),
    ),
    potentialHash: stableContentHash(
      effectRuntimeMembers.map((row) => [row.agentId, row.potential]),
    ),
    status: 'supported' as const,
    context: compilation.context,
    contextFingerprint: compilation.context.fingerprint,
    assetBindingHash: compilation.assetBindingHash,
    runtimeHash: runtime.runtimeHash,
    discEffects,
    // Fixed event counts cannot price losses in stun, energy or anomaly cadence.
    memberUtilityStats: effectRuntimeMembers.map(({ agentId, finalStats }) => ({
      agentId,
      impact: finalStats.impact,
      enerRegen: finalStats.enerRegen,
      anomMas: finalStats.anomMas,
      anomProf: finalStats.anomProf,
    })),
    memberFunctionalCapacities32: effectRuntimeMembers.map((member) =>
      evaluateReviewedFunctionalCapacity32({
        member,
        members: effectRuntimeMembers,
        eventUsages,
        equipmentModifierBuckets: [
          ...modifierProjection.directRuntime.buckets,
          ...discEffects.buckets,
        ],
        equipmentExclusions: [
          ...modifierProjection.directRuntime.exclusions,
          ...discEffects.exclusions,
        ],
        baselineReferencesByAgentId: observedReferences,
      }),
    ),
    memberSourceResourceProduction32: effectRuntimeMembers.map((member) =>
      summarizeSourceResourceProduction32({
        agentId: member.agentId,
        eventUsages,
        mechanismGrants32,
      }),
    ),
    interactionBundleHash: interactions.bundleHash,
    interactionStateHash: compilation.interactionStateHash,
    interactionOperatorCoverage: compilation.interactionOperatorCoverage,
    memberDamage: runtime.memberDamage,
    bangbooDamage,
    includedScope: memberOnly ? ('three_members' as const) : ('members_and_bangboo' as const),
    totalDamage,
    planningDps: totalDamage / currentNormalizedPlanningBaseline.declaredDurationSeconds,
    declaredDurationSeconds: currentNormalizedPlanningBaseline.declaredDurationSeconds,
    baselineId: currentNormalizedPlanningBaseline.baselineId,
    equipmentBindingMode: 'scheme_parameters' as const,
    sideEffect: 'read_only' as const,
    boundary:
      '对当前点击队伍、当前18盘有限候选解和玩家确认的方案装备参数执行同一固定事件 Benchmark；结果不是全账号全局最优，也不是实战轮转 DPS。',
  }
  return { ...core, fingerprint: stableContentHash(core) }
}

export type TargetTeamPlanningContextCompilation = ReturnType<
  typeof compileTargetTeamPlanningContext
>
