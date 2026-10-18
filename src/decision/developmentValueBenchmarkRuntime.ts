import type { DevelopmentValueBenchmarkInput } from './developmentValueBenchmarkProjection'
import {
  unsupportedSide,
  personalRuntimeIdentity,
  projectDevelopmentValueBenchmarkCoverage,
  type ScenarioValueBenchmarkSide,
} from './developmentValueBenchmarkProjection'
import type { ValueBenchmarkSide } from '../calculation/valueBenchmarkComparison'
export {
  unsupportedSide,
  type DevelopmentComparisonParameters,
} from './developmentValueBenchmarkProjection'
import { completePersonalValueBenchmarkCoverage } from '../calculation/personalValueBenchmarkCoverage'
import { getCurrentWEngineStaticData } from '../gameDataPacks/currentWEngineStaticCatalog'
import { summarizeSourceResourceProduction32 } from '../calculation/sourceResourceProduction32'
import { summarizeSourceMechanismResourceGrants32 } from '../calculation/sourceMechanismResourceGrants32'
import { hasCompleteAgentSkillLevels } from '../accounts/agentProgressionRules'
import { compileNormalizedAgentEventSchedule } from '../calculation/currentNormalizedPlanningBaseline'
import { compileCurrentDriveDiscPlanningEffects } from '../calculation/currentDriveDiscPlanningEffects'
import { compileCurrentWEnginePersonalPlanningEffects } from '../calculation/currentWEnginePersonalPlanningEffects'
import { evaluateSourceBackedPersonalPlanningDps } from '../calculation/currentPlanningTeamDpsRuntime'
import { type ValueBenchmarkCoverage } from '../calculation/valueBenchmarkComparison'
import { stableContentHash } from '../gameDataPacks/types'
import {
  accountSkillLevel,
  projectNormalizedAccountFinalStatsDetailed,
} from './normalizedPlanningCandidateEvaluator'
import { supportsPotentialImage } from '../assault/agentCapabilities'
import { resolveWEngine } from './wEngineResolver'
import { developmentSourceAction32 } from './developmentSourceAction32'
import { prepareReviewedPotentialEvents32 } from '../calculation/reviewedPotentialPreparedEvents32'
import { prepareReviewedTemplateEvents32 } from '../calculation/reviewedTemplatePreparedEvents32'
import { qualifyReviewedPreparedBenchmark32 } from '../calculation/reviewedPreparedBenchmark32'
import { reviewedPreparedAnomalyPreparation32 } from '../calculation/reviewedPreparedAnomalyObjective32'
import { evaluateDevelopmentPreparedAnomalyBenchmarkSide32 } from './developmentPreparedAnomalyBenchmark32'
import { evaluateReviewedFunctionalCapacity32 } from '../calculation/reviewedFunctionalCapacity32'
import { resolveCurrentPlanningScenario32 } from '../calculation/currentPlanningScenario32'

export function evaluateDevelopmentValueBenchmarkSide(
  input: DevelopmentValueBenchmarkInput,
): ScenarioValueBenchmarkSide {
  const scenario = resolveCurrentPlanningScenario32(input.scenarioSelection)
  const unavailable = (facts: Parameters<typeof unsupportedSide>[0]) =>
    unsupportedSide({ ...facts, scenarioSelection: scenario.selection })
  const agent = input.warehouse.roster.agents.find(
    (item) => item.agentId === input.agentId && item.owned,
  )
  const resolution = resolveWEngine({
    agent,
    legacyWEngines: input.warehouse.roster.wEngines,
  })
  const engine = input.parameters?.wEngine
    ? { ...input.parameters.wEngine, source: 'agent_current_fact' as const }
    : resolution.current
  const engineAscension =
    input.parameters?.wEngine?.ascension ??
    (agent && agent.wEngineDetails.id === engine?.engineId
      ? (agent.wEngineDetails.ascension ?? undefined)
      : undefined)
  const potential = input.parameters?.potential ?? agent?.potentialImage
  const engineKey = engine
    ? `${engine.engineId}:p${engine.refinement}:lv${engine.level}:asc${engineAscension ?? 'derived'}`
    : 'missing'
  if (input.stale)
    return unavailable({
      agentId: input.agentId,
      discs: input.discs,
      engineKey,
      state: 'stale',
      reasons: ['账户或仓库快照已 stale，请重新分析。'],
    })
  if (!agent || !engine)
    return unavailable({
      agentId: input.agentId,
      discs: input.discs,
      engineKey,
      reasons: [
        !agent
          ? '缺少目标代理人。'
          : '未记录当前音擎；六盘方案仍可查看和保存，固定事件数值比较需明确音擎参数。',
      ],
    })
  if (
    !Number.isInteger(engine.level) ||
    engine.level < 1 ||
    engine.level > 60 ||
    !Number.isInteger(engine.refinement) ||
    engine.refinement < 1 ||
    engine.refinement > 5 ||
    (engineAscension !== undefined &&
      (!Number.isInteger(engineAscension) || engineAscension < 0 || engineAscension > 5)) ||
    (input.parameters?.potential !== undefined &&
      (!supportsPotentialImage(input.agentId) ||
        !Number.isInteger(input.parameters.potential) ||
        input.parameters.potential < 0 ||
        input.parameters.potential > 6))
  )
    return unavailable({
      agentId: input.agentId,
      discs: input.discs,
      engineKey,
      reasons: ['显式音擎等级需在 1–60、突破在 0–5、精炼在 P1–P5；潜能需属于该代理人开放范围。'],
    })
  if (input.discs.length !== 6 || new Set(input.discs.map((disc) => disc.slot)).size !== 6)
    return unavailable({
      agentId: input.agentId,
      discs: input.discs,
      engineKey,
      reasons: [`需要六个不同盘位的实体驱动盘，当前为 ${input.discs.length}/6。`],
    })
  const projection = projectNormalizedAccountFinalStatsDetailed({
    agent: {
      ...agent,
      potentialImage: potential,
      wEngineDetails: {
        id: engine.engineId,
        name: engine.engineId,
        level: engine.level,
        ascension: engineAscension,
        refinement: engine.refinement,
      },
    },
    engineId: engine.engineId,
    discs: [...input.discs],
    ...(input.statProbe ? { statProbe: input.statProbe } : {}),
  })
  const stats = projection.status === 'supported' ? projection.stats : null
  const skillLevels = Object.fromEntries(
    ['basic', 'dodge', 'assist', 'special', 'chain', 'core'].map((skill) => [
      skill,
      accountSkillLevel(agent, skill),
    ]),
  )
  if (!hasCompleteAgentSkillLevels(skillLevels))
    return unavailable({
      agentId: input.agentId,
      discs: input.discs,
      engineKey,
      reasons: ['技能等级未完整观测，不能用默认值补算。'],
    })
  if (!stats)
    return unavailable({
      agentId: input.agentId,
      discs: input.discs,
      engineKey,
      reasons: [...(projection.status === 'unsupported' ? projection.reasons : [])],
    })
  const member = {
    agentId: input.agentId,
    level: agent.level,
    mindscape: agent.mindscape,
    potential,
    coreLevel: skillLevels.core,
    skillLevels,
    initialStats: stats.initialStats,
    finalStats: stats.finalStats,
  }
  if (reviewedPreparedAnomalyPreparation32(input.agentId)) {
    if (input.agentId === 'agent-aria') {
      const allowedScenario =
        (scenario.selection.id === 'normalized-comparison' &&
          scenario.baseline.enemy.stunMultiplier === 1) ||
        (scenario.selection.id === 'declared-stun-comparison' &&
          scenario.baseline.enemy.stunMultiplier === 1.5)
      if (
        !allowedScenario ||
        scenario.baseline.enemy.defense !== 700 ||
        scenario.baseline.enemy.resistance !== 0.2
      )
        return unavailable({
          agentId: input.agentId,
          discs: input.discs,
          engineKey,
          reasons: [
            '爱芮异常准备轴仅支持 normalized 与 declared-stun 两个固定比较场景（DEF 700 / RES 0.2）。',
          ],
        })
      if (input.eventConditionDeclaration) {
        if (
          input.eventConditionDeclaration.windswept != null ||
          input.eventConditionDeclaration.sunnaDelusionApplied != null ||
          input.eventConditionDeclaration.nangongMisstepApplied != null ||
          input.eventConditionDeclaration.remiellePhaseFlow != null ||
          input.eventConditionDeclaration.whiteWaterBalladCritWindow != null ||
          input.eventConditionDeclaration.whiteWaterBalladAttackWindow != null ||
          (input.eventConditionDeclaration.enemyStunned != null &&
            input.eventConditionDeclaration.enemyStunned !== scenario.enemyStunned)
        )
          return unavailable({
            agentId: input.agentId,
            discs: input.discs,
            engineKey,
            reasons: ['爱芮异常准备轴不接受外来或冲突的额外事件声明。'],
          })
      }
    } else {
      if (scenario.baseline.enemy.stunMultiplier !== 1 || input.eventConditionDeclaration)
        return unavailable({
          agentId: input.agentId,
          discs: input.discs,
          engineKey,
          reasons: ['已核异常准备轴仅验证失衡倍率1且不接受额外事件条件。'],
        })
    }
    return {
      ...evaluateDevelopmentPreparedAnomalyBenchmarkSide32({
        member,
        baseline: scenario.baseline,
        discs: input.discs,
        wEngine: { engineId: engine.engineId, refinement: engine.refinement },
        engineKey,
        discLoadoutKey: stableContentHash(
          input.statProbe
            ? { discs: input.discs, hypotheticalStatProbe: input.statProbe }
            : input.discs,
        ),
        potential,
        preparation:
          input.agentId === 'agent-aria'
            ? {
                kind: 'aria_single_self_ether_abloom',
                acceptedSingleOwnerSettlement: true,
                perfectPitchHit3Heavy: true,
                ownEtherAnomalyPresent: true,
                fandomPowerPrepared: true,
                enemyStunned: scenario.enemyStunned,
                momentOfDelusion: false,
              }
            : undefined,
        subjectKey: stableContentHash({
          agentId: input.agentId,
          level: agent.level,
          ascension: agent.ascension,
          mindscape: agent.mindscape,
          skillLevels,
        }),
      }),
      scenarioSelection: scenario.selection,
      scenarioIdentity: scenario.identity,
      functionalStats32: {
        impact: stats.finalStats.impact,
        enerRegen: stats.finalStats.enerRegen,
        anomMas: stats.finalStats.anomMas,
        anomProf: stats.finalStats.anomProf,
      },
    }
  }
  const sourceAction = developmentSourceAction32(member)
  if (
    sourceAction &&
    (scenario.baseline.enemy.stunMultiplier !== 1 || input.eventConditionDeclaration)
  )
    return unavailable({
      agentId: input.agentId,
      discs: input.discs,
      engineKey,
      reasons: ['已核准备轴仅验证失衡倍率1且不接受额外事件条件；请切回常规比较或验证新的模型域。'],
    })
  if (sourceAction?.status === 'unsupported')
    return unavailable({
      agentId: input.agentId,
      discs: input.discs,
      engineKey,
      reasons: sourceAction.blockers,
    })
  const schedule =
    sourceAction ??
    compileNormalizedAgentEventSchedule({
      agentId: input.agentId,
      skillLevels,
      ...(input.agentId === 'agent-lycaon' ? { declaredSkills: ['basic'] } : {}),
    })
  if (schedule.status === 'unsupported')
    return unavailable({
      agentId: input.agentId,
      discs: input.discs,
      engineKey,
      reasons: schedule.blockers,
    })
  const eventUsages = schedule.eventUsages
  const potentialPreparation = sourceAction
    ? null
    : prepareReviewedPotentialEvents32({ member, eventUsages })
  const templatePreparation = sourceAction
    ? null
    : prepareReviewedTemplateEvents32({
        member,
        eventUsages,
        references: potentialPreparation?.baselineReferences,
        // Event trigger declarations are separate from the numeric scene coordinate.
        // Only an absent state inherits the scene default; false/null remain explicit.
        conditionDeclaration: input.eventConditionDeclaration
          ? {
              ...input.eventConditionDeclaration,
              enemyStunned:
                input.eventConditionDeclaration.enemyStunned === undefined
                  ? scenario.enemyStunned
                  : input.eventConditionDeclaration.enemyStunned,
            }
          : undefined,
      })
  if (templatePreparation?.conditionPreparation?.status === 'unsupported')
    return unavailable({
      agentId: input.agentId,
      discs: input.discs,
      engineKey,
      reasons: templatePreparation.conditionPreparation.blockers,
    })
  const discEffects = compileCurrentDriveDiscPlanningEffects({
    members: [member],
    loadouts: [{ agentId: input.agentId, discs: input.discs }],
    preparedWhiteWaterByAgentId: templatePreparation?.conditionPreparation
      ? { [member.agentId]: templatePreparation.conditionPreparation.whiteWaterBalladPreparation }
      : undefined,
  })
  if (discEffects.status !== 'supported')
    return unavailable({
      agentId: input.agentId,
      discs: input.discs,
      engineKey,
      reasons: discEffects.blockers,
    })
  const engineEffects = compileCurrentWEnginePersonalPlanningEffects({
    agentId: input.agentId,
    engineId: engine.engineId,
    refinement: engine.refinement,
    member,
    runtime: sourceAction?.equipmentRuntime,
  })
  if (engineEffects.status !== 'supported')
    return unavailable({
      agentId: input.agentId,
      discs: input.discs,
      engineKey,
      reasons: engineEffects.blockers,
    })
  const discCoverage: ValueBenchmarkCoverage = {
    domain: 'fixed_event_direct_damage',
    includedEffectKeys: discEffects.buckets.map((bucket) => bucket.effectKey),
    excludedEffects: discEffects.exclusions.map((exclusion) => ({
      effectKey: `disc:${exclusion.agentId}:${exclusion.setId}:four-piece`,
      reason: exclusion.reason,
      fields: [...exclusion.fields],
      sourceRefs: [...exclusion.sourceRefs],
    })),
    exclusionContextFingerprint: stableContentHash({
      exclusions: discEffects.exclusions,
      initialStats: member.initialStats,
      finalStats: member.finalStats,
    }),
    boundary: discEffects.boundary,
  }
  const runtime = evaluateSourceBackedPersonalPlanningDps({
    member,
    ...(sourceAction?.runtimeInput ?? { eventUsages }),
    ...(potentialPreparation
      ? {
          potentialEvents: potentialPreparation.potentialEvents,
          baselineReferences: potentialPreparation.baselineReferences,
        }
      : {}),
    ...(templatePreparation ? { baselineReferences: templatePreparation.baselineReferences } : {}),
    ...(templatePreparation?.commonAnomalyEvents
      ? { commonAnomalyEvents: templatePreparation.commonAnomalyEvents }
      : {}),
    baseline: scenario.baseline,
    equipmentModifierBuckets: [...discEffects.buckets, ...engineEffects.buckets],
  })
  if (runtime.status === 'unsupported')
    return unavailable({
      agentId: input.agentId,
      discs: input.discs,
      engineKey,
      reasons: runtime.blockers,
    })
  const sourceResourceProduction32 = summarizeSourceResourceProduction32({
    agentId: member.agentId,
    eventUsages,
    mechanismGrants32: summarizeSourceMechanismResourceGrants32({
      members: [member],
      declaration: input.resourceGrantDeclaration32,
    }),
  })
  const baseCoverage = completePersonalValueBenchmarkCoverage({
    discCoverage,
    engine,
    engineSource: getCurrentWEngineStaticData(engine.engineId)?.source ?? null,
    member,
    potentialApplications: runtime.potentialApplications,
    engineEffects,
    sourceEffectKeys: [
      ...runtime.effectBuckets
        .filter((row) => row.application !== 'outside_direct_event_formula')
        .map((row) => row.effectKey),
      ...runtime.sourceResolvedInactiveEffectKeys,
    ],
    // Resource-cycle incompleteness is reported separately and must not
    // invalidate a comparison whose objective does not consume that cycle.
    sourceEffectExclusions: runtime.sourceEffectExclusions,
  })
  const coverage = projectDevelopmentValueBenchmarkCoverage({
    agentId: input.agentId,
    member,
    baseCoverage,
    sourceAction,
    potentialPreparation,
    templatePreparation,
  })
  const dimensions: ValueBenchmarkSide['dimensions'] = {
    game_version: scenario.baseline.gameVersion,
    subject: stableContentHash({
      agentId: input.agentId,
      level: agent.level,
      ascension: agent.ascension,
      mindscape: agent.mindscape,
      skillLevels,
    }),
    potential: String(potential ?? 'unavailable'),
    scenario: `${scenario.identity}${sourceAction ? `:${sourceAction.policyId}` : ''}${potentialPreparation ? `:${potentialPreparation.policyId}` : ''}${templatePreparation ? `:${templatePreparation.policyId}:${templatePreparation.conditionPreparation?.identity ?? 'neutral'}` : ''}`,
    event_set: stableContentHash(eventUsages),
    duration: String(runtime.declaredDurationSeconds),
    formula: scenario.baseline.formulaHash,
    runtime: `${personalRuntimeIdentity}${sourceAction ? `:${sourceAction.identity}` : ''}${potentialPreparation ? `:${potentialPreparation.identity}` : ''}${templatePreparation ? `:${templatePreparation.identity}` : ''}`,
    disc_loadout: stableContentHash(
      input.statProbe
        ? { discs: input.discs, hypotheticalStatProbe: input.statProbe }
        : input.discs,
    ),
    w_engine: engineKey,
    bangboo: 'none',
  }
  const modelQualification32 =
    sourceAction && !input.statProbe
      ? qualifyReviewedPreparedBenchmark32({
          member,
          policyId: sourceAction.policyId,
          actionIdentity: sourceAction.identity,
          resourceLegality: sourceAction.resourceLegality,
          eventUsages,
          baseline: scenario.baseline,
          engine,
          discs: input.discs,
          accountId: input.warehouse.accountId ?? 'legacy-local',
          accountHash: stableContentHash({ agent, engine, potential }),
          effects: {
            included: coverage.includedEffectKeys,
            excluded: coverage.excludedEffects,
            context: coverage.exclusionContextFingerprint,
          },
          totalDamage: runtime.totalDamage,
          planningDps: runtime.planningDps,
          stale: input.stale,
        })
      : null
  const functionalCapacities32 = evaluateReviewedFunctionalCapacity32({
    member,
    eventUsages,
    potentialEvents: potentialPreparation?.potentialEvents,
    equipmentModifierBuckets: [...discEffects.buckets, ...engineEffects.buckets],
    equipmentExclusions: [...discEffects.exclusions, ...engineEffects.exclusions],
    baselineReferencesByAgentId: sourceAction
      ? { [member.agentId]: sourceAction.runtimeInput.baselineReferences }
      : templatePreparation
        ? { [member.agentId]: templatePreparation.baselineReferences }
        : potentialPreparation
          ? { [member.agentId]: potentialPreparation.baselineReferences }
          : undefined,
  })
  const functionalStats32 = {
    impact: stats.finalStats.impact,
    enerRegen: stats.finalStats.enerRegen,
    anomMas: stats.finalStats.anomMas,
    anomProf: stats.finalStats.anomProf,
  }
  return {
    scenarioSelection: scenario.selection,
    scenarioIdentity: scenario.identity,
    state: 'supported',
    dimensions,
    totalDamage: runtime.totalDamage,
    planningDps: runtime.planningDps,
    calculationFingerprint: stableContentHash({
      dimensions,
      runtime,
      coverage,
      modelQualification32,
      functionalCapacities32,
      functionalStats32,
      sourceResourceProduction32,
    }),
    ...(modelQualification32 ? { modelQualification32 } : {}),
    reasons: coverage.excludedEffects.map(
      (effect) =>
        `固定事件未计入 ${effect.effectKey}：${effect.reason}（${effect.fields.join('、') || '无可用条件字段'}）。`,
    ),
    coverage,
    functionalCapacities32,
    functionalStats32,
    sourceResourceProduction32,
  }
}
