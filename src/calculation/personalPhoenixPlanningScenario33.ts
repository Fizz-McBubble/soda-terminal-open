import type { PlanningBaseline } from './planningDpsContract'
import {
  resolveCurrentPlanningScenario32,
  type PlanningScenarioResolution32,
} from './currentPlanningScenario32'
import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'
import {
  currentFormulaBaseStats,
  currentFormulaBaseStatsSource,
} from '../gameDataPacks/currentFormulaBaseStats'
import { currentWEngineStaticCatalog } from '../gameDataPacks/currentWEngineStaticCatalog'
import { currentDriveDiscFormulaCatalog } from '../gameDataPacks/currentDriveDiscFormulaCatalog'
import { currentFormulaMechanicContractHash } from './currentFormulaMechanicContracts'
import { reviewedWEngine33Hash } from './reviewedWEngine33'
import { phoenixAnomalyCritHash33 } from './reviewedPhoenixAnomalyCrit33'
import { anomalyDamageCoreHash } from './anomalyDamageCore'
import {
  commonAnomalySettlementHash32,
  commonAnomalySettlementIdentity32,
} from './currentCommonAnomalySettlementIdentity32'
import { stableContentHash } from '../gameDataPacks/types'
import { sha256 } from '../application/contentHash'

const pins = Object.freeze({
  phoenixFormula: 'D938FDB17DAEB39F37F2939142061F3462D824DC2FEFD4A2A8A2F63127AB6120',
  phoenixStats: '237C5B060657DB1FD8ABABE6CD26FB275C325D74A67EDA481BDE6732C7D93DFE',
  anomalyCore: 'fnv1a-69eb18f0',
  phoenixCrit: 'fnv1a-597878c3',
  baseStats: 'A6BA0FE646A28389F63E7EACD48FDBD408B543C13CFE4C62964952196B523426',
  engineBase: '5E574654DC5ED2CBD519AC172A4B693E2BAC6A1CE31915B01AFE7E7334329B1E',
  discs: '86485776DB75203D1BAAAB3EA479610CD93CC37954F2E8722BCF47F6E41BCC80',
  equipment: '8AFF2A481AFFA2152AE89FDA66E59D25BB9C6414A029B532E26C31DB2B3514C2',
})
const boundary =
  '3.3 Phoenix 单人候选对照场景：DEF 700 / RES 0.2 与失衡倍率为声明坐标；沿用已锁定的 3.2 公共异常算式作为候选假设，未独立证明 3.3 游戏内部公式不变。只用于已声明的单次本人火异常与具名绽放，不代表实战循环或 Formal。'

/** Independent candidate baseline: never relabel a 3.2 fixed-event baseline. */
export function resolvePersonalPhoenixPlanningScenario33(
  input?: unknown,
  expected?: { sourcePackHash?: string; formulaHash?: string },
): PlanningScenarioResolution32 {
  const selection = resolveCurrentPlanningScenario32(input).selection
  const actor = getCurrentAgentEventContract('agent-phoenix')
  if (
    !actor ||
    actor.identity.attribute !== 'fire' ||
    actor.source.formulaSha256 !== pins.phoenixFormula ||
    actor.source.statsSha256 !== pins.phoenixStats ||
    sha256(JSON.stringify(actor.eventContract.events)).toUpperCase() !== pins.phoenixFormula ||
    !actor.eventContract.events.some((row) => row.actionId === 'BasicAttackPurifyingFlame') ||
    anomalyDamageCoreHash !== pins.anomalyCore ||
    phoenixAnomalyCritHash33 !== pins.phoenixCrit ||
    commonAnomalySettlementIdentity32.arithmeticCoreHash !== pins.anomalyCore ||
    commonAnomalySettlementIdentity32.commit !== '3456cd0f6f5bea10e168074502460dac2fcd6df4' ||
    currentFormulaBaseStatsSource.sha256 !== pins.baseStats ||
    currentWEngineStaticCatalog.baseCatalogIdentity !== pins.engineBase ||
    currentDriveDiscFormulaCatalog.contentHash !== pins.discs ||
    currentFormulaMechanicContractHash !== pins.equipment
  )
    throw new Error('phoenix_personal_scenario_source_identity_mismatch')
  const sourcePackHash = stableContentHash({
    actor: {
      identity: actor.identity,
      stats: actor.baseStats,
      source: actor.source,
      events: actor.eventContract.events,
    },
    statProjection: {
      defaults: currentFormulaBaseStats,
      source: currentFormulaBaseStatsSource,
      method: 'out-of-combat-panel-initial-and-final',
    },
    equipment: {
      staticCatalog: currentWEngineStaticCatalog.contentHash,
      engine33: reviewedWEngine33Hash,
      driveDiscCatalog: currentDriveDiscFormulaCatalog.contentHash,
      formulaContracts: currentFormulaMechanicContractHash,
    },
  })
  const stunned = selection.id === 'declared-stun-comparison'
  const formulaHash = stableContentHash({
    family: 'personal-phoenix-self-fire-basic-abloom33-v1',
    sourcePackHash,
    phoenixAnomalyCritHash33,
    commonAnomalySettlementHash32,
    anomalyDamageCoreHash,
    continuity: 'candidate-inherits-locked-32-common-math-not-independent-33-verification',
    targetStunMultiplier: stunned ? 1.5 : 1,
  })
  if (
    (expected?.sourcePackHash !== undefined && expected.sourcePackHash !== sourcePackHash) ||
    (expected?.formulaHash !== undefined && expected.formulaHash !== formulaHash)
  )
    throw new Error('phoenix_personal_scenario_expected_identity_mismatch')
  const baseline: PlanningBaseline = {
    schemaVersion: 'planning-baseline-v1',
    baselineId: stunned ? 'phoenix-33-self-abloom-stun-v1' : 'phoenix-33-self-abloom-v1',
    gameVersion: '3.3',
    phaseId: 'personal-phoenix-single-abloom-candidate',
    declaredDurationSeconds: 30,
    enemy: {
      id: stunned ? 'declared-level-70-stun-comparison' : 'normalized-level-70-neutral',
      defense: 700,
      resistance: 0.2,
      stunMultiplier: stunned ? 1.5 : 1,
      vulnerability: 0,
    },
    rounding: 'nearest-0.01',
    sourcePackHash,
    formulaHash,
  }
  return {
    selection,
    baseline,
    identity: stableContentHash({ selection, baseline, boundary }),
    enemyStunned: stunned,
    boundary,
  }
}

export function isPersonalPhoenixPlanningBaseline33(baseline: PlanningBaseline): boolean {
  try {
    const selection =
      baseline.enemy.stunMultiplier === 1.5
        ? { schemaVersion: 1, id: 'declared-stun-comparison' }
        : { schemaVersion: 1, id: 'normalized-comparison' }
    return (
      stableContentHash(resolvePersonalPhoenixPlanningScenario33(selection).baseline) ===
      stableContentHash(baseline)
    )
  } catch {
    return false
  }
}
