import type { CoreWarehouse } from '../accounts/coreFlow'
import type { StandardSubstatProbe } from '../calculation/standardSubstatProbe'
import type { SourceResourceGrantDeclaration32 } from '../calculation/sourceMechanismResourceGrants32'
import type { ReviewedTemplateEventConditionDeclaration32 } from '../calculation/reviewedTemplateEventConditions32'
import { currentAgentPlanningEffectBlueprints } from '../calculation/currentAgentPlanningEffectBlueprint'
import { currentNormalizedPlanningBaseline } from '../calculation/currentNormalizedPlanningBaseline'
import { currentWEnginePersonalPlanningEffectVersion } from '../calculation/currentWEnginePersonalPlanningEffects'
import type {
  ValueBenchmarkSide,
  ValueBenchmarkCoverage,
} from '../calculation/valueBenchmarkComparison'
import type { DriveDisc } from '../domain/schemas'
import { stableContentHash } from '../gameDataPacks/types'
import {
  resolveCurrentPlanningScenario32,
  type CurrentPlanningScenarioSelection32,
} from '../calculation/currentPlanningScenario32'
import { getCurrentAgentDecisionMechanicContract } from '../calculation/currentAgentDecisionMechanicContracts'
import type { PlanningEffectRuntimeMember } from '../calculation/currentPlanningEffectDomain'
import type { developmentSourceAction32 } from './developmentSourceAction32'
import type { prepareReviewedPotentialEvents32 } from '../calculation/reviewedPotentialPreparedEvents32'
import type { prepareReviewedTemplateEvents32 } from '../calculation/reviewedTemplatePreparedEvents32'

export const personalRuntimeIdentity = `source-backed-personal-fixed-event/v7-${currentWEnginePersonalPlanningEffectVersion}`
export const personalEventSetIdentity = stableContentHash({
  baselineId: currentNormalizedPlanningBaseline.baselineId,
  selection: 'normalized-agent-fixed-event-schedule',
})

export type ScenarioValueBenchmarkSide = ValueBenchmarkSide & {
  scenarioSelection: CurrentPlanningScenarioSelection32
  scenarioIdentity: string
}

export function unsupportedSide(input: {
  agentId: string
  discs: readonly DriveDisc[]
  engineKey: string
  state?: 'unsupported' | 'stale'
  reasons: string[]
  scenarioSelection?: CurrentPlanningScenarioSelection32
}): ScenarioValueBenchmarkSide {
  const scenario = resolveCurrentPlanningScenario32(input.scenarioSelection)
  return {
    scenarioSelection: scenario.selection,
    scenarioIdentity: scenario.identity,
    state: input.state ?? 'unsupported',
    dimensions: {
      game_version: scenario.baseline.gameVersion,
      subject: `agent:${input.agentId}`,
      scenario: scenario.identity,
      event_set: personalEventSetIdentity,
      duration: String(scenario.baseline.declaredDurationSeconds),
      formula: scenario.baseline.formulaHash,
      runtime: personalRuntimeIdentity,
      disc_loadout: stableContentHash(input.discs),
      w_engine: input.engineKey,
      bangboo: 'none',
    },
    totalDamage: null,
    planningDps: null,
    calculationFingerprint: null,
    reasons: input.reasons,
  }
}

export type DevelopmentComparisonParameters = {
  wEngine?: { engineId: string; level: number; ascension?: number; refinement: number }
  potential?: number
}

/** Project personal effect omissions and source completeness without changing numeric runtime. */
export function projectDevelopmentValueBenchmarkCoverage(input: {
  agentId: string
  member: PlanningEffectRuntimeMember
  baseCoverage: ValueBenchmarkCoverage
  sourceAction: Extract<
    ReturnType<typeof developmentSourceAction32>,
    { status: 'supported' }
  > | null
  potentialPreparation: ReturnType<typeof prepareReviewedPotentialEvents32> | null
  templatePreparation: ReturnType<typeof prepareReviewedTemplateEvents32> | null
}) {
  const { agentId, member, baseCoverage, sourceAction, potentialPreparation, templatePreparation } =
    input
  const agentExclusions = currentAgentPlanningEffectBlueprints
    .filter(
      (row) =>
        row.providerAgentId === agentId &&
        !baseCoverage.includedEffectKeys.includes(row.effectKey) &&
        row.effectId !== 'core_initial_crit_',
    )
    .map((row) => ({
      effectKey: row.effectKey,
      reason: '此个人固定事件切片未消费该来源角色效果；条件、队伍与动作适用范围不能从盘面推断。',
      fields: ['agent_effect', 'combat_conditions', 'event_context', ...row.targetKinds],
      sourceRefs: [...row.sourceRefs],
    }))
  const sourceContract = getCurrentAgentDecisionMechanicContract(agentId)
  const effectSource = sourceContract?.readiness.effectSource ?? 'unknown'
  const sourceCompletenessExclusions =
    effectSource === 'specific_expression'
      ? []
      : [
          {
            effectKey: `${agentId}:source_mechanism_completeness`,
            reason:
              effectSource === 'generic_template'
                ? '锁定角色效果为通用占位模板，未声明的角色机制不能视为已完整计入。'
                : '角色特有效果来源完整性尚未确认。',
            fields: ['source_mechanism_completeness', effectSource],
            sourceRefs: sourceContract
              ? [
                  `${sourceContract.effectContract.source.formulaPath}#${sourceContract.effectContract.source.formulaSha256}`,
                ]
              : [],
          },
        ]
  const coverage: ValueBenchmarkCoverage = {
    ...baseCoverage,
    boundary: `${baseCoverage.boundary}${sourceAction ? ` ${sourceAction.boundary}` : ''}${potentialPreparation ? ` ${potentialPreparation.boundary}` : ''}${templatePreparation ? ` ${templatePreparation.boundary}` : ''}`,
    excludedEffects: [
      ...baseCoverage.excludedEffects,
      ...agentExclusions,
      ...sourceCompletenessExclusions,
    ],
    exclusionContextFingerprint: stableContentHash({
      context: baseCoverage.exclusionContextFingerprint,
      agentExclusions,
      sourceCompletenessExclusions,
      member,
      ...(sourceAction ? { actionPolicy: sourceAction.identity } : {}),
      ...(potentialPreparation ? { potentialPolicy: potentialPreparation.identity } : {}),
      ...(templatePreparation ? { templatePolicy: templatePreparation } : {}),
    }),
  }
  return coverage
}

export type DevelopmentValueBenchmarkInput = {
  warehouse: CoreWarehouse
  agentId: string
  discs: readonly DriveDisc[]
  stale: boolean
  parameters?: DevelopmentComparisonParameters
  /** Internal read-only sensitivity analysis; cannot be stored as a real loadout. */
  statProbe?: StandardSubstatProbe
  /** Optional internal trigger observation; never derived from damage-hit counts. */
  resourceGrantDeclaration32?: SourceResourceGrantDeclaration32
  scenarioSelection?: CurrentPlanningScenarioSelection32
  eventConditionDeclaration?: ReviewedTemplateEventConditionDeclaration32
}
