import { currentNormalizedPlanningBaseline } from './currentNormalizedPlanningBaseline'
import type { PlanningBaseline } from './planningDpsContract'
import { stableContentHash } from '../gameDataPacks/types'
import type { CurrentPlanningScenarioSelection32 } from '../application/publicPlanningScenarioContract'
export { currentPlanningScenarioOptions32 } from '../application/publicPlanningScenarioContract'
export type { CurrentPlanningScenarioSelection32 } from '../application/publicPlanningScenarioContract'

export type CurrentPlanningScenarioId32 = 'normalized-comparison' | 'declared-stun-comparison'

export type PlanningScenarioResolution32 = {
  selection: CurrentPlanningScenarioSelection32
  baseline: PlanningBaseline
  identity: string
  enemyStunned: boolean
  boundary: string
}

const normalizedComparisonBoundary =
  '同一30秒固定事件常规比较基线；各被计事件按声明失衡倍率1.0计量，DEF 700 / RES 0.2。这些数值全部是比较假设，非真实Boss或轮转合法证据。'

const declaredStunComparisonBoundary =
  '各被计事件按声明失衡倍率1.5比较，DEF 700 / RES 0.2、时长30秒沿用现行比较坐标；这些数值全部为声明比较假设，非真实Boss、连续30秒失衡或轮转合法证据。'

const declaredStunBaseline: PlanningBaseline = Object.freeze({
  schemaVersion: 'planning-baseline-v1',
  baselineId: `${currentNormalizedPlanningBaseline.baselineId}-declared-stun`,
  gameVersion: currentNormalizedPlanningBaseline.gameVersion,
  phaseId: 'declared-stun-fixed-event-comparison',
  declaredDurationSeconds: currentNormalizedPlanningBaseline.declaredDurationSeconds,
  bangbooFixedEventObservation: currentNormalizedPlanningBaseline.bangbooFixedEventObservation,
  enemy: Object.freeze({
    id: 'declared-level-70-stun-comparison',
    defense: currentNormalizedPlanningBaseline.enemy.defense,
    resistance: currentNormalizedPlanningBaseline.enemy.resistance,
    stunMultiplier: 1.5,
    vulnerability: currentNormalizedPlanningBaseline.enemy.vulnerability,
  }),
  rounding: currentNormalizedPlanningBaseline.rounding,
  sourcePackHash: currentNormalizedPlanningBaseline.sourcePackHash,
  formulaHash: stableContentHash({
    baseFormulaHash: currentNormalizedPlanningBaseline.formulaHash,
    phaseId: 'declared-stun-fixed-event-comparison',
    stunMultiplierAssumption: 1.5,
    authority: 'declared_candidate_fixed_event_comparison',
  }),
})

const normalizedScenarioSelection: CurrentPlanningScenarioSelection32 = Object.freeze({
  schemaVersion: 1,
  id: 'normalized-comparison',
})

const declaredStunScenarioSelection: CurrentPlanningScenarioSelection32 = Object.freeze({
  schemaVersion: 1,
  id: 'declared-stun-comparison',
})

const normalizedScenarioResolution: PlanningScenarioResolution32 = Object.freeze({
  selection: normalizedScenarioSelection,
  baseline: currentNormalizedPlanningBaseline,
  identity: stableContentHash({
    selection: normalizedScenarioSelection,
    baseline: currentNormalizedPlanningBaseline,
    boundary: normalizedComparisonBoundary,
  }),
  enemyStunned: false,
  boundary: normalizedComparisonBoundary,
})

const declaredStunScenarioResolution: PlanningScenarioResolution32 = Object.freeze({
  selection: declaredStunScenarioSelection,
  baseline: declaredStunBaseline,
  identity: stableContentHash({
    selection: declaredStunScenarioSelection,
    baseline: declaredStunBaseline,
    boundary: declaredStunComparisonBoundary,
  }),
  enemyStunned: true,
  boundary: declaredStunComparisonBoundary,
})

/**
 * Validates and resolves the explicit planning comparison scenario selection.
 * Defaults to normalized-comparison strictly when input is undefined.
 * Throws on null, primitive types, unknown keys, unsupported schemaVersion, or unknown id.
 */
export function resolveCurrentPlanningScenario32(input?: unknown): PlanningScenarioResolution32 {
  if (input === undefined) {
    return normalizedScenarioResolution
  }

  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new Error('规划场景选择必须为有效对象或 undefined。')
  }

  const record = input as Record<string, unknown>
  const keys = Object.keys(record)
  const unknownKeys = keys.filter((key) => key !== 'schemaVersion' && key !== 'id')
  if (unknownKeys.length > 0) {
    throw new Error(`规划场景选择包含未知字段：${unknownKeys.join(', ')}。`)
  }

  if (record.schemaVersion !== 1) {
    throw new Error(`不支持的规划场景版本：${String(record.schemaVersion)}。`)
  }

  if (record.id === 'normalized-comparison') {
    return normalizedScenarioResolution
  }

  if (record.id === 'declared-stun-comparison') {
    return declaredStunScenarioResolution
  }

  throw new Error(`不支持的规划场景标识：${String(record.id)}。`)
}
