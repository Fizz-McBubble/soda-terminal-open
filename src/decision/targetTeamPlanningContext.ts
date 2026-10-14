import { compileTargetTeamPlanningMembers } from './targetTeamPlanningMembers'
import type { TargetTeamPlanningContextInput } from './targetTeamPlanningContextInput'
import { compileTargetTeamPlanningCoverage } from './targetTeamPlanningCoverage'
import { compileCurrentDriveDiscPlanningEffects } from '../calculation/currentDriveDiscPlanningEffects'
import { summarizeSourceResourceProduction32 } from '../calculation/sourceResourceProduction32'
import { summarizeSourceMechanismResourceGrants32 } from '../calculation/sourceMechanismResourceGrants32'
import { mergePlanningReferenceMaps32 } from '../calculation/currentPlanningEffectDomain'
import { compileCurrentPlanningInteractionBundle } from '../calculation/currentPlanningInteractionBundle'
import { evaluateSourceBackedPlanningTeamDps } from '../calculation/currentPlanningTeamDpsRuntime'
import { compilePlanningCalculationContext } from '../calculation/planningCalculationContextCompiler'
import { projectTargetTeamEquipmentModifiers } from '../calculation/targetTeamEquipmentModifierProjection'
import { candidateCalculationPackage } from '../gameDataPacks/currentCalculationCandidate'
import { usesIncremental32Capabilities } from '../gameDataPacks/incremental32AffectedCapabilities'
import {
  incremental32RecoveryPolicy,
  incremental32RecoveryReason,
} from '../gameDataPacks/incremental32RecoveryPolicy'
import { stableContentHash } from '../gameDataPacks/types'
import { hasUnresolvedAuthorityScenario } from './teamBuildExecutionIdentity'
import { compileTargetTeamKoledaFixedConditions32 } from './targetTeamKoledaFixedConditions32'
import { compileIncremental32PlanningSourceSelection } from './incremental32PlanningSourceSelection'
import { qualifyReviewedPreparedTeamBenchmark32 } from '../calculation/reviewedPreparedTeamBenchmark32'
import { evaluateReviewedFunctionalCapacity32 } from '../calculation/reviewedFunctionalCapacity32'
import { prepareReviewedPotentialEvents32 } from '../calculation/reviewedPotentialPreparedEvents32'
import { prepareReviewedTemplateEvents32 } from '../calculation/reviewedTemplatePreparedEvents32'
import { resolveCurrentPlanningScenario32 } from '../calculation/currentPlanningScenario32'

const unique = (values: readonly string[]) => [...new Set(values)]

export function compileTargetTeamPlanningContext(input: TargetTeamPlanningContextInput) {
  const scenario = resolveCurrentPlanningScenario32(input.scenarioSelection)
  const blockers: string[] = []
  const unknownConditionProviders = Object.keys(
    input.eventConditionDeclarationsByAgentId ?? {},
  ).filter((id) => !input.candidate.memberIds.includes(id))
  if (unknownConditionProviders.length)
    return {
      status: 'unsupported' as const,
      blockers: [`事件状态声明不属于目标队：${unknownConditionProviders.join('、')}`],
      fingerprint: stableContentHash({
        scenario: scenario.identity,
        declarations: input.eventConditionDeclarationsByAgentId,
      }),
    }
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
  const memberCompilation = compileTargetTeamPlanningMembers(input)
  const { eventUsages, assets, effectRuntimeMembers } = memberCompilation
  blockers.push(...memberCompilation.blockers)
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
  if (
    sourceSelection.preparedTeamConditions &&
    (scenario.baseline.enemy.stunMultiplier !== 1 ||
      Object.keys(input.eventConditionDeclarationsByAgentId ?? {}).length)
  )
    return {
      status: 'unsupported' as const,
      blockers: ['已核准备轴不接受额外事件状态声明；需独立验证该模型域。'],
      fingerprint: stableContentHash({
        scenario: scenario.identity,
        declarations: input.eventConditionDeclarationsByAgentId,
      }),
    }

  const sourceReferences = mergePlanningReferenceMaps32(
    sourceSelection.referencesByAgentId,
    input.calibrationObservations?.referencesByAgentId,
  )

  const koledaConditions = compileTargetTeamKoledaFixedConditions32({
    members: effectRuntimeMembers,
    eventUsages,
    baseline: scenario.baseline,
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

  const potentialPreparations = sourceSelection.preparedTeamConditions
    ? []
    : effectRuntimeMembers.flatMap((member) => {
        const prepared = prepareReviewedPotentialEvents32({
          member,
          eventUsages,
          memberIds: effectRuntimeMembers.map((row) => row.agentId),
        })
        return prepared ? [{ agentId: member.agentId, ...prepared }] : []
      })
  const potentialEvents = Object.assign(
    {},
    ...potentialPreparations.map((row) => row.potentialEvents),
  )
  const existingReferences = mergePlanningReferenceMaps32(
    Object.fromEntries(potentialPreparations.map((row) => [row.agentId, row.baselineReferences])),
    mergePlanningReferenceMaps32(sourceReferences, koledaConditions.references),
  )
  const templatePreparations = sourceSelection.preparedTeamConditions
    ? []
    : effectRuntimeMembers.flatMap((member) => {
        const prepared = prepareReviewedTemplateEvents32({
          member,
          eventUsages,
          references: existingReferences[member.agentId],
          // Event trigger declarations are separate from the numeric scene coordinate.
          // Only an absent state inherits the scene default; false/null remain explicit.
          conditionDeclaration: input.eventConditionDeclarationsByAgentId?.[member.agentId]
            ? {
                ...input.eventConditionDeclarationsByAgentId[member.agentId]!,
                enemyStunned:
                  input.eventConditionDeclarationsByAgentId[member.agentId]!.enemyStunned ===
                  undefined
                    ? scenario.enemyStunned
                    : input.eventConditionDeclarationsByAgentId[member.agentId]!.enemyStunned,
              }
            : undefined,
        })
        return prepared ? [{ agentId: member.agentId, ...prepared }] : []
      })
  const observedReferences = mergePlanningReferenceMaps32(
    existingReferences,
    Object.fromEntries(templatePreparations.map((row) => [row.agentId, row.baselineReferences])),
  )
  const conditionBlockers = templatePreparations.flatMap(
    (row) => row.conditionPreparation?.blockers ?? [],
  )
  if (conditionBlockers.length)
    return {
      status: 'unsupported' as const,
      blockers: unique(conditionBlockers),
      fingerprint: stableContentHash({
        scenario: scenario.identity,
        conditionBlockers,
        declarations: input.eventConditionDeclarationsByAgentId,
      }),
    }
  const commonAnomalyEvents = Object.fromEntries(
    [
      ...new Set(templatePreparations.flatMap((row) => Object.keys(row.commonAnomalyEvents ?? {}))),
    ].map((key) => [
      key,
      templatePreparations.flatMap((row) => row.commonAnomalyEvents?.[key] ?? []),
    ]),
  )
  const modifierProjection = projectTargetTeamEquipmentModifiers({
    baseline: scenario.baseline,
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
    preparedWhiteWaterByAgentId: Object.fromEntries(
      templatePreparations.flatMap((row) =>
        row.conditionPreparation
          ? [[row.agentId, row.conditionPreparation.whiteWaterBalladPreparation]]
          : [],
      ),
    ),
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
    gameVersion: scenario.baseline.gameVersion,
    canonical: {
      packageId: candidateCalculationPackage.packageId,
      packageVersion: candidateCalculationPackage.packageVersion,
      gameVersion: scenario.baseline.gameVersion,
      contentHash: scenario.baseline.sourcePackHash,
      status: 'candidate',
      rollbackPackageId: candidateCalculationPackage.rollbackPackageId,
    },
    accountSnapshot,
    baseline: scenario.baseline,
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
      ? `${sourceSelection.preparedTeamConditions.policyId}:${scenario.identity}`
      : scenario.identity,
    constraintsHash: stableContentHash({
      scenario: scenario.identity,
      eventConditionDeclarations: input.eventConditionDeclarationsByAgentId ?? null,
      candidateId: input.candidate.candidateId,
      fitFingerprint: input.fit.fingerprint,
      modifierFingerprint: input.modifierProjection.fingerprint,
      discEffectFingerprint: discEffects.fingerprint,
      sourceSelection: sourceSelection.fingerprint,
      calibrationObservations: input.calibrationObservations ?? null,
      potentialPreparationPolicies: potentialPreparations.map((row) => row.identity),
      templatePreparationPolicies: templatePreparations,
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
    potentialEvents,
    baseline: scenario.baseline,
    equipmentModifierBuckets: [...modifierProjection.directRuntime.buckets, ...discEffects.buckets],
    equipmentEffectExclusions: [
      ...modifierProjection.directRuntime.exclusions,
      ...discEffects.exclusions,
    ],
    baselineReferencesByAgentId: observedReferences,
    commonAnomalyEvents,
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
    sourceBoundaries: [
      ...sourceSelection.sourcePackets.map((row) => row.boundary),
      ...templatePreparations.map((row) => row.boundary),
    ],
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
        potentialEvents,
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
    planningDps: totalDamage / scenario.baseline.declaredDurationSeconds,
    declaredDurationSeconds: scenario.baseline.declaredDurationSeconds,
    baselineId: scenario.baseline.baselineId,
    scenarioSelection: scenario.selection,
    scenarioIdentity: scenario.identity,
    scenarioBoundary: scenario.boundary,
    eventConditionDeclarationsByAgentId: input.eventConditionDeclarationsByAgentId ?? null,
    equipmentBindingMode: 'scheme_parameters' as const,
    sideEffect: 'read_only' as const,
    boundary:
      '对当前点击队伍、当前18盘有限候选解和玩家确认的方案装备参数执行同一固定事件 Benchmark；结果不是全账号全局最优，也不是实战轮转 DPS。' +
      (potentialPreparations.length ? ` ${potentialPreparations[0]!.boundary}` : '') +
      (templatePreparations.length ? ` ${templatePreparations[0]!.boundary}` : ''),
  }
  return { ...core, fingerprint: stableContentHash(core) }
}

export type TargetTeamPlanningContextCompilation = ReturnType<
  typeof compileTargetTeamPlanningContext
>
