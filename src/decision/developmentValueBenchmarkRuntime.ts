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
import {
  equipmentConditionConflict,
  ariaEventDeclarationFailure,
  prepareDevelopmentDeclaredEquipmentRuntime,
} from './developmentDeclaredEquipmentRuntime'
import {
  personalDevelopmentObjectiveRoute32,
  resolvePersonalDevelopmentObjective32,
} from './personalDevelopmentObjective32'
import { personalPreparedSupport32 } from './personalPreparedSupport32'
import { evaluatePersonalPreparedPolarityBenchmarkSide32 } from './personalPreparedAnomalyPolarity32'
import { evaluatePersonalPreparedOrdinaryAnomalyBenchmarkSide32 } from './personalPreparedOrdinaryAnomaly32'
import { evaluatePersonalPreparedPhoenixAbloomBenchmarkSide33 } from './personalPreparedPhoenixAnomaly33'
import { resolvePersonalPhoenixPlanningScenario33 } from '../calculation/personalPhoenixPlanningScenario33'
import { compilePersonalMiyabiShimotsuki32 } from './personalMiyabiShimotsuki32'
import { resolvePersonalFunctionalConditions32 } from './resolvePersonalFunctionalConditions32'
import { compilePersonalComparisonPreparation32 } from './compilePersonalComparisonPreparation32'
import { personalAtomicSourceAction32 } from './personalAtomicSourceAction32'

export function evaluateDevelopmentValueBenchmarkSide(
  input: DevelopmentValueBenchmarkInput,
): ScenarioValueBenchmarkSide {
  const scenario = resolveCurrentPlanningScenario32(input.scenarioSelection)
  const unavailable = (facts: Parameters<typeof unsupportedSide>[0]) =>
    unsupportedSide({ ...facts, scenarioSelection: scenario.selection })
  if (!personalDevelopmentObjectiveRoute32(input.agentId))
    return unavailable({
      agentId: input.agentId,
      discs: input.discs,
      engineKey: 'unknown',
      reasons: ['角色身份没有已声明个人收益目标。'],
    })
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
  input = {
    ...input,
    eventConditionDeclaration: compilePersonalComparisonPreparation32({
      agentId: input.agentId,
      engineId: engine.engineId,
      declaration: input.eventConditionDeclaration,
    }),
  }
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
    statBasis32: stats.statBasis32,
    initialStats: stats.initialStats,
    finalStats: stats.finalStats,
  }
  const functionalConditions = resolvePersonalFunctionalConditions32({
    agentId: input.agentId,
    engineId: engine.engineId,
    discs: input.discs,
    declaration: input.eventConditionDeclaration?.personalFunctionalConditions32,
  })
  if (functionalConditions.status !== 'supported')
    return unavailable({
      agentId: input.agentId,
      discs: input.discs,
      engineKey,
      reasons: functionalConditions.blockers,
    })
  const hasApplicableFunctionalConditions =
    Object.keys(functionalConditions.engineFlags).length > 0 ||
    Object.keys(functionalConditions.stacks).length > 0 ||
    Object.keys(functionalConditions.discFlags).length > 0 ||
    Object.keys(functionalConditions.references).length > 0
  const supportDeclaration = input.eventConditionDeclaration?.personalSupportPreparation32
  if (supportDeclaration) {
    const allowed =
      input.agentId === 'agent-zhao'
        ? ['zhaoAdditionalAbilityActive', 'zhaoInsideEtherVeil']
        : input.agentId === 'agent-sunna'
          ? ['sunnaAngelicChordActive']
          : input.agentId === 'agent-lucia'
            ? ['luciaDarkbreaker']
            : []
    if (
      Object.entries(supportDeclaration).some(
        ([key, value]) => value != null && !allowed.includes(key),
      )
    )
      return unavailable({
        agentId: input.agentId,
        discs: input.discs,
        engineKey,
        reasons: ['支持准备态声明与当前角色不匹配。'],
      })
  }
  if (input.agentId === 'agent-phoenix' && input.eventConditionDeclaration?.phoenixOwnFireAbloom) {
    const declaration = input.eventConditionDeclaration
    let phoenixScenario: ReturnType<typeof resolvePersonalPhoenixPlanningScenario33>
    try {
      phoenixScenario = resolvePersonalPhoenixPlanningScenario33(input.scenarioSelection)
    } catch {
      return unavailable({
        agentId: input.agentId,
        discs: input.discs,
        engineKey,
        reasons: ['菲欧妮单次绽放的来源与场景身份未通过核对。'],
      })
    }
    if (
      hasApplicableFunctionalConditions ||
      Object.keys(declaration).some(
        (key) =>
          ![
            'sourceRefs',
            'enemyStunned',
            'phoenixOwnFireAbloom',
            'firstPlumageAnomalyCritWindowActive',
            'personalFunctionalConditions32',
          ].includes(key),
      ) ||
      (declaration.enemyStunned !== undefined && declaration.enemyStunned !== scenario.enemyStunned)
    )
      return unavailable({
        agentId: input.agentId,
        discs: input.discs,
        engineKey,
        reasons: ['菲欧妮单次绽放声明包含尚未绑定的额外事件条件。'],
      })
    const equipment = prepareDevelopmentDeclaredEquipmentRuntime(declaration, undefined)
    if (equipment.conflict)
      return unavailable(equipmentConditionConflict(input.agentId, input.discs, engineKey))
    const side = evaluatePersonalPreparedPhoenixAbloomBenchmarkSide33({
      member,
      baseline: phoenixScenario.baseline,
      discs: input.discs,
      wEngine: {
        engineId: engine.engineId,
        refinement: engine.refinement,
        runtime: equipment.runtime,
      },
      engineKey,
      discLoadoutKey: stableContentHash(
        input.statProbe
          ? { discs: input.discs, hypotheticalStatProbe: input.statProbe }
          : input.discs,
      ),
      subjectKey: stableContentHash({
        agentId: input.agentId,
        level: agent.level,
        ascension: agent.ascension,
        mindscape: agent.mindscape,
        skillLevels,
      }),
      potential,
      declaration: declaration.phoenixOwnFireAbloom!,
    })
    return {
      ...side,
      personalObjective32: resolvePersonalDevelopmentObjective32(input.agentId, side),
      scenarioSelection: phoenixScenario.selection,
      scenarioIdentity: phoenixScenario.identity,
      functionalStats32: {
        impact: stats.finalStats.impact,
        enerRegen: stats.finalStats.enerRegen,
        anomMas: stats.finalStats.anomMas,
        anomProf: stats.finalStats.anomProf,
      },
    }
  }
  if (input.agentId === 'agent-yanagi') {
    const declaration = input.eventConditionDeclaration
    const preparation = declaration?.yanagiPolarity
    if (!preparation)
      return unavailable({
        agentId: input.agentId,
        discs: input.discs,
        engineKey,
        reasons: ['柳的单次极性紊乱需要明确声明本人原异常的归属及有效时序。'],
      })
    if (
      hasApplicableFunctionalConditions ||
      Object.keys(declaration).some(
        (key) =>
          ![
            'sourceRefs',
            'enemyStunned',
            'yanagiPolarity',
            'personalFunctionalConditions32',
          ].includes(key),
      ) ||
      (declaration.enemyStunned !== undefined && declaration.enemyStunned !== scenario.enemyStunned)
    )
      return unavailable({
        agentId: input.agentId,
        discs: input.discs,
        engineKey,
        reasons: ['柳的极性紊乱声明包含该单次模型尚未绑定的事件条件。'],
      })
    const side = evaluatePersonalPreparedPolarityBenchmarkSide32({
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
      subjectKey: stableContentHash({
        agentId: input.agentId,
        level: agent.level,
        ascension: agent.ascension,
        mindscape: agent.mindscape,
        skillLevels,
      }),
      potential,
      preparation,
    })
    return {
      ...side,
      personalObjective32: resolvePersonalDevelopmentObjective32(input.agentId, side),
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
  if (input.eventConditionDeclaration?.personalOrdinaryAnomaly) {
    const declaration = input.eventConditionDeclaration
    if (
      !['agent-burnice', 'agent-grace', 'agent-vivian', 'agent-velina'].includes(input.agentId) ||
      hasApplicableFunctionalConditions ||
      Object.keys(declaration).some(
        (key) =>
          ![
            'sourceRefs',
            'enemyStunned',
            'personalOrdinaryAnomaly',
            'personalFunctionalConditions32',
          ].includes(key),
      ) ||
      (declaration.enemyStunned !== undefined && declaration.enemyStunned !== scenario.enemyStunned)
    )
      return unavailable({
        agentId: input.agentId,
        discs: input.discs,
        engineKey,
        reasons: ['该单次异常声明的角色或额外事件条件不在已核模型范围。'],
      })
    const side = evaluatePersonalPreparedOrdinaryAnomalyBenchmarkSide32({
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
      subjectKey: stableContentHash({
        agentId: input.agentId,
        level: agent.level,
        ascension: agent.ascension,
        mindscape: agent.mindscape,
        skillLevels,
      }),
      potential,
      declaration: declaration.personalOrdinaryAnomaly!,
    })
    return {
      ...side,
      personalObjective32: resolvePersonalDevelopmentObjective32(input.agentId, side),
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
  if (reviewedPreparedAnomalyPreparation32(input.agentId)) {
    if (hasApplicableFunctionalConditions)
      return unavailable({
        agentId: input.agentId,
        discs: input.discs,
        engineKey,
        reasons: ['单次异常结算尚未绑定这些装备或角色功能准备态。'],
      })
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
      const ariaFailure = ariaEventDeclarationFailure(input, scenario.enemyStunned, engineKey)
      if (ariaFailure) return unavailable(ariaFailure)
    } else {
      if (
        scenario.baseline.enemy.stunMultiplier !== 1 ||
        (input.eventConditionDeclaration &&
          Object.keys(input.eventConditionDeclaration).some(
            (key) => !['sourceRefs', 'personalFunctionalConditions32'].includes(key),
          ))
      )
        return unavailable({
          agentId: input.agentId,
          discs: input.discs,
          engineKey,
          reasons: ['已核异常准备轴仅验证失衡倍率1且不接受额外事件条件。'],
        })
    }
    const side = evaluateDevelopmentPreparedAnomalyBenchmarkSide32({
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
    })
    return {
      ...side,
      personalObjective32: resolvePersonalDevelopmentObjective32(input.agentId, side),
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
  const miyabiDeclaration = input.eventConditionDeclaration?.miyabiShimotsuki
  if (
    miyabiDeclaration &&
    (input.agentId !== 'agent-miyabi' ||
      Object.keys(input.eventConditionDeclaration!).some(
        (key) =>
          ![
            'sourceRefs',
            'enemyStunned',
            'miyabiShimotsuki',
            'personalFunctionalConditions32',
          ].includes(key),
      ) ||
      (input.eventConditionDeclaration?.enemyStunned !== undefined &&
        input.eventConditionDeclaration.enemyStunned !== scenario.enemyStunned))
  )
    return unavailable({
      agentId: input.agentId,
      discs: input.discs,
      engineKey,
      reasons: ['霜月声明的角色或额外事件条件不在已核模型范围。'],
    })
  const miyabiAction = miyabiDeclaration
    ? compilePersonalMiyabiShimotsuki32({ member, declaration: miyabiDeclaration })
    : null
  if (miyabiAction?.status === 'unsupported')
    return unavailable({
      agentId: input.agentId,
      discs: input.discs,
      engineKey,
      reasons: miyabiAction.blockers,
    })
  const sourceAction = developmentSourceAction32(member)
  if (
    sourceAction &&
    (scenario.baseline.enemy.stunMultiplier !== 1 ||
      (input.eventConditionDeclaration &&
        (Object.keys(input.eventConditionDeclaration).some(
          (key) => !['sourceRefs', 'enemyStunned', 'personalFunctionalConditions32'].includes(key),
        ) ||
          (input.eventConditionDeclaration.enemyStunned !== undefined &&
            input.eventConditionDeclaration.enemyStunned !== scenario.enemyStunned))))
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
  const atomicAction =
    sourceAction || miyabiAction
      ? null
      : personalAtomicSourceAction32({
          agentId: input.agentId,
          skillLevels,
        })
  const schedule =
    sourceAction ??
    miyabiAction ??
    atomicAction ??
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
        references: {
          ...potentialPreparation?.baselineReferences,
          ...miyabiAction?.baselineReferences,
          ...functionalConditions.references,
          ...(input.agentId === 'agent-lucia' &&
          input.eventConditionDeclaration?.personalSupportPreparation32?.luciaDarkbreaker ===
            true &&
          input.eventConditionDeclaration.sourceRefs?.includes(
            'personal-comparison-preparation32:lucia-prepared-darkbreaker-ex-and-dreamers-nursery-rhyme-self-share-no-window-uptime',
          )
            ? { dreamersNurseryRhyme: true }
            : {}),
          enemyStunned:
            input.eventConditionDeclaration?.enemyStunned === undefined
              ? scenario.enemyStunned
              : input.eventConditionDeclaration.enemyStunned,
        },
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
    ...(Object.keys(functionalConditions.discFlags).length
      ? {
          preparedFunctionalByAgentId: {
            [input.agentId]: {
              flags: functionalConditions.discFlags,
              sourceRefs: functionalConditions.sourceRefs,
            },
          },
        }
      : {}),
    preparedWhiteWaterByAgentId: templatePreparation?.conditionPreparation
      ? {
          [member.agentId]: templatePreparation.conditionPreparation.whiteWaterBalladPreparation,
        }
      : undefined,
  })
  if (discEffects.status !== 'supported')
    return unavailable({
      agentId: input.agentId,
      discs: input.discs,
      engineKey,
      reasons: discEffects.blockers,
    })
  const preparedEngine = sourceAction?.equipmentRuntime
  const engineConflict =
    Object.entries(functionalConditions.engineFlags).some(
      ([key, value]) =>
        preparedEngine?.flags?.[key] !== undefined && preparedEngine.flags[key] !== value,
    ) ||
    Object.entries(functionalConditions.stacks).some(
      ([key, value]) =>
        preparedEngine?.accumulators?.[key] !== undefined &&
        preparedEngine.accumulators[key] !== value,
    )
  if (engineConflict)
    return unavailable(equipmentConditionConflict(input.agentId, input.discs, engineKey))
  const hasFunctionalEngine =
    Object.keys(functionalConditions.engineFlags).length > 0 ||
    Object.keys(functionalConditions.stacks).length > 0
  const equipmentContext = prepareDevelopmentDeclaredEquipmentRuntime(
    input.eventConditionDeclaration,
    hasFunctionalEngine
      ? {
          ...preparedEngine,
          flags: { ...preparedEngine?.flags, ...functionalConditions.engineFlags },
          accumulators: { ...preparedEngine?.accumulators, ...functionalConditions.stacks },
        }
      : preparedEngine,
  )
  if (equipmentContext.conflict)
    return unavailable(equipmentConditionConflict(input.agentId, input.discs, engineKey))
  const engineEffects = compileCurrentWEnginePersonalPlanningEffects({
    agentId: input.agentId,
    engineId: engine.engineId,
    refinement: engine.refinement,
    member,
    runtime: equipmentContext.runtime,
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
    ...(sourceAction?.runtimeInput ?? {
      eventUsages,
      ...(miyabiAction ? { baselineReferences: miyabiAction.baselineReferences } : {}),
    }),
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
  const projectedCoverage = projectDevelopmentValueBenchmarkCoverage({
    agentId: input.agentId,
    member,
    baseCoverage,
    sourceAction,
    potentialPreparation,
    templatePreparation,
  })
  const coverage = miyabiAction
    ? { ...projectedCoverage, boundary: `${projectedCoverage.boundary} ${miyabiAction.boundary}` }
    : projectedCoverage
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
    scenario: `${scenario.identity}${sourceAction ? `:${sourceAction.policyId}` : ''}${potentialPreparation ? `:${potentialPreparation.policyId}` : ''}${templatePreparation ? `:${templatePreparation.policyId}:${templatePreparation.conditionPreparation?.identity ?? 'neutral'}` : ''}${equipmentContext.identity}${hasFunctionalEngine ? `:functional-engine:${stableContentHash({ flags: functionalConditions.engineFlags, stacks: functionalConditions.stacks })}` : ''}`,
    event_set: stableContentHash(eventUsages),
    duration: atomicAction ? 'not_applicable' : String(runtime.declaredDurationSeconds),
    formula: scenario.baseline.formulaHash,
    runtime: `${personalRuntimeIdentity}${sourceAction ? `:${sourceAction.identity}` : ''}${miyabiAction ? `:miyabiShimotsuki:${miyabiAction.identity}` : ''}${atomicAction ? ':atomic-lycaon-charged-hit9-r1' : ''}${potentialPreparation ? `:${potentialPreparation.identity}` : ''}${templatePreparation ? `:${templatePreparation.identity}` : ''}`,
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
  const evaluatedFunctionalCapacities32 = evaluateReviewedFunctionalCapacity32({
    member,
    eventUsages,
    potentialEvents: potentialPreparation?.potentialEvents,
    equipmentModifierBuckets: [...discEffects.buckets, ...engineEffects.buckets],
    equipmentExclusions: [...discEffects.exclusions, ...engineEffects.exclusions],
    baselineReferencesByAgentId: sourceAction
      ? { [member.agentId]: sourceAction.runtimeInput.baselineReferences }
      : templatePreparation
        ? {
            [member.agentId]: {
              ...templatePreparation.baselineReferences,
              ...(input.eventConditionDeclaration?.personalSupportPreparation32
                ?.luciaDarkbreaker === undefined
                ? {}
                : {
                    darkbreaker:
                      input.eventConditionDeclaration.personalSupportPreparation32.luciaDarkbreaker,
                  }),
            },
          }
        : potentialPreparation
          ? { [member.agentId]: potentialPreparation.baselineReferences }
          : undefined,
  })
  const preparedSupport = personalPreparedSupport32({
    member,
    equipmentExclusions: [...discEffects.exclusions, ...engineEffects.exclusions],
    equipmentModifierBuckets: [...discEffects.buckets, ...engineEffects.buckets],
    declaration: input.eventConditionDeclaration?.personalSupportPreparation32,
  })
  const functionalCapacities32 = {
    ...evaluatedFunctionalCapacities32,
    blockers: evaluatedFunctionalCapacities32.blockers.filter(
      (blocker) =>
        !(
          member.agentId === 'agent-zhao' &&
          preparedSupport.length > 0 &&
          blocker === '功能目标缺少已核来源、等级、激活或初始属性/装备上下文：agent-zhao'
        ),
    ),
    capacities: [
      ...evaluatedFunctionalCapacities32.capacities.filter(
        (capacity) =>
          !(
            member.agentId === 'agent-zhao' &&
            preparedSupport.length > 0 &&
            capacity.key === 'agent-zhao:initial_hp_additional_target' &&
            capacity.value === null
          ),
      ),
      ...preparedSupport,
    ],
  }
  const functionalStats32 = {
    impact: stats.finalStats.impact,
    enerRegen: stats.finalStats.enerRegen,
    anomMas: stats.finalStats.anomMas,
    anomProf: stats.finalStats.anomProf,
  }
  const apEquipmentUnknowns = [...discEffects.exclusions, ...engineEffects.exclusions]
    .filter(
      (effect) =>
        !effect.resolvedInactive &&
        (!effect.writeFields?.length ||
          effect.writeFields.some((field) =>
            ['initial.anomProf', 'final.anomProf', 'combat.anomProf'].includes(field),
          )),
    )
    .map((effect) => ({
      reason: effect.reason,
      fields: effect.fields,
      effectPath: effect.effectPath ?? null,
      writeFields: effect.writeFields ?? null,
      sourceRefs: effect.sourceRefs,
    }))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  const apEquipmentBuckets = [...discEffects.buckets, ...engineEffects.buckets]
    .filter((bucket) => bucket.application === 'anomaly_proficiency_flat')
    .map((bucket) => ({
      key: bucket.effectKey,
      value: bucket.value,
      sourceRefs: bucket.sourceRefs,
    }))
    .sort((a, b) => a.key.localeCompare(b.key))
  const side: ScenarioValueBenchmarkSide = {
    scenarioSelection: scenario.selection,
    scenarioIdentity: scenario.identity,
    state: 'supported',
    dimensions,
    totalDamage: runtime.totalDamage,
    planningDps: atomicAction ? null : runtime.planningDps,
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
    personalFunctionalInputs32: {
      initialAttack: stats.initialStats.atk,
      initialHp: stats.initialStats.hp,
    },
    personalFunctionalEquipmentIdentity32: stableContentHash({
      apEquipmentUnknowns,
      apEquipmentBuckets,
    }),
    sourceResourceProduction32,
  }
  return {
    ...side,
    personalObjective32: resolvePersonalDevelopmentObjective32(input.agentId, side),
  }
}
