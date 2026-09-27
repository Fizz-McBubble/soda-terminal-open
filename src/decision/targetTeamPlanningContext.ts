import type { CoreWarehouse } from '../accounts/coreFlow'
import { compileCurrentDriveDiscPlanningEffects } from '../calculation/currentDriveDiscPlanningEffects'
import { resolvePotentialImage } from '../assault/agentCapabilities'
import {
  compileNormalizedAgentEventSchedule,
  currentNormalizedPlanningBaseline,
} from '../calculation/currentNormalizedPlanningBaseline'
import { type PlanningEffectRuntimeMember } from '../calculation/currentPlanningEffectRuntime'
import { compileCurrentPlanningInteractionBundle } from '../calculation/currentPlanningInteractionBundle'
import { evaluateSourceBackedPlanningTeamDps } from '../calculation/currentPlanningTeamDpsRuntime'
import {
  compilePlanningCalculationContext,
  type PlanningContextMemberAsset,
  type PlanningEventUsage,
} from '../calculation/planningCalculationContextCompiler'
import type { TargetTeamEquipmentModifierProjection } from '../calculation/targetTeamEquipmentModifierProjection'
import { currentVersionProjection } from '../gameDataPacks/currentVersionProjection'
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

function unique(values: readonly string[]) {
  return [...new Set(values)]
}

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
}) {
  const blockers: string[] = []
  if (hasUnresolvedAuthorityScenario(input.candidate)) {
    const unresolvedScenarioBlocker =
      '来源精确队伍未提供可计算的场景条件；不得将空条件规范化为 CalculationContext。'
    return {
      status: 'unsupported' as const,
      blockers: [unresolvedScenarioBlocker],
      fingerprint: stableContentHash({
        candidateId: input.candidate.candidateId,
        provenance: input.candidate.provenance,
        scenarioTags: input.candidate.scenarioTags,
        blockers: [unresolvedScenarioBlocker],
      }),
    }
  }
  if (input.fit.status !== 'ready' || input.fit.uniqueDiscCount !== 18)
    blockers.push('目标 CalculationContext 需要三名成员各六张、合计 18 张不同实体盘。')
  if (input.modifierProjection.status !== 'supported')
    blockers.push(...input.modifierProjection.blockers)
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
    const projection = projectNormalizedAccountFinalStatsDetailed({
      agent,
      engineId: parameter.engineId,
      discs,
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
      potential: resolvePotentialImage(agentId, agent.potentialImage) ?? null,
      skillLevels,
      wEngine: {
        copyId: `scheme:${agentId}:${parameter.engineId}`,
        engineId: parameter.engineId,
        level: 60,
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
      mindscape: agent.mindscape,
      potential: resolvePotentialImage(agentId, agent.potentialImage) ?? null,
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

  const discEffects = compileCurrentDriveDiscPlanningEffects({
    members: effectRuntimeMembers,
    loadouts: assets.map((asset) => ({ agentId: asset.agentId, discs: asset.discs })),
  })
  if (discEffects.status !== 'supported')
    return {
      status: 'unsupported' as const,
      blockers: discEffects.blockers,
      fingerprint: discEffects.fingerprint,
    }
  const interactions = compileCurrentPlanningInteractionBundle({
    memberIds: [...input.fit.memberIds],
    members: effectRuntimeMembers,
  })
  if (interactions.status === 'unsupported')
    return {
      status: 'unsupported' as const,
      blockers: unique(interactions.blockers),
      fingerprint: stableContentHash({ input, blockers: unique(interactions.blockers) }),
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
    gameVersion: '3.1',
    canonical: {
      packageId: currentVersionProjection.packageId,
      packageVersion: currentVersionProjection.packageVersion,
      gameVersion: '3.1',
      contentHash: currentNormalizedPlanningBaseline.sourcePackHash,
      status: 'candidate',
      rollbackPackageId: currentVersionProjection.rollbackPackageId,
    },
    accountSnapshot,
    baseline: currentNormalizedPlanningBaseline,
    memberIds: [...input.fit.memberIds],
    bangboo: {
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
    scenarioId: input.candidate.scenarioTags.length
      ? `scenario:${input.candidate.scenarioTags.join('+')}`
      : 'scenario:normalized',
    constraintsHash: stableContentHash({
      candidateId: input.candidate.candidateId,
      fitFingerprint: input.fit.fingerprint,
      modifierFingerprint: input.modifierProjection.fingerprint,
      discEffectFingerprint: discEffects.fingerprint,
    }),
    equipmentBindingMode: 'scheme_parameters',
  })
  if (compilation.status === 'unsupported')
    return {
      status: 'unsupported' as const,
      blockers: compilation.blockers,
      fingerprint: compilation.inputHash,
    }
  const runtime = evaluateSourceBackedPlanningTeamDps({
    memberIds: input.fit.memberIds,
    members: effectRuntimeMembers,
    eventUsages,
    baseline: currentNormalizedPlanningBaseline,
    equipmentModifierBuckets: [
      ...input.modifierProjection.directRuntime.buckets,
      ...discEffects.buckets,
    ],
  })
  if (runtime.status === 'unsupported')
    return {
      status: 'unsupported' as const,
      blockers: runtime.blockers,
      fingerprint: stableContentHash({ compilation, runtime }),
    }
  const bangbooDamage = input.modifierProjection.bangboo.directDamage
  if (typeof bangbooDamage !== 'number' || !Number.isFinite(bangbooDamage))
    return {
      status: 'unsupported' as const,
      blockers: ['邦布固定事件直接伤害尚不可用。'],
      fingerprint: stableContentHash({ compilation, runtime, bangbooDamage }),
    }
  const memberDamage = runtime.memberDamage.reduce((sum, member) => sum + member.totalDamage, 0)
  const totalDamage = memberDamage + bangbooDamage
  const core = {
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
    interactionBundleHash: interactions.bundleHash,
    interactionStateHash: compilation.interactionStateHash,
    interactionOperatorCoverage: compilation.interactionOperatorCoverage,
    memberDamage: runtime.memberDamage,
    bangbooDamage,
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
