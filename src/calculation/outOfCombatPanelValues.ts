import type { StatKey } from '../domain/schemas'
import { currentFormulaBaseStats } from '../gameDataPacks/currentFormulaBaseStats'
import {
  outOfCombatKeys,
  type OutOfCombatKey,
  type PanelTrace,
  type PanelResult,
} from './outOfCombatPanelSupport'

export type PanelValues = Record<OutOfCombatKey, number>

const defaultCritRate = currentFormulaBaseStats.critRate * 100
const defaultCritDamage = currentFormulaBaseStats.critDamage * 100
export const flatStatMap: Partial<Record<StatKey, OutOfCombatKey>> = {
  hp_flat: 'hp',
  atk_flat: 'atk',
  def_flat: 'def',
  crit_rate: 'critRate',
  crit_dmg: 'critDamage',
  anomaly_proficiency: 'anomalyProficiency',
  pen: 'pen',
  pen_ratio: 'penRatio',
}
export const percentStatMap: Partial<Record<StatKey, OutOfCombatKey>> = {
  hp_percent: 'hp',
  atk_percent: 'atk',
  def_percent: 'def',
  anomaly_mastery: 'anomalyMastery',
  impact: 'impact',
  energy_regen: 'energyRegen',
}
export const knownNonPanelTwoPieceStats = new Set([
  'physical_dmg_',
  'fire_dmg_',
  'ice_dmg_',
  'electric_dmg_',
  'wind_dmg_',
  'ether_dmg_',
  'action_dmg_',
  'shield_',
  'dazeInc_',
])
export const twoPiecePercentPanelKey: Partial<Record<string, OutOfCombatKey>> = {
  hp_: 'hp',
  atk_: 'atk',
  def_: 'def',
  impact_: 'impact',
  anomMas_: 'anomalyMastery',
  enerRegen_: 'energyRegen',
}
export const twoPiecePostFlatPanelKey: Partial<Record<string, OutOfCombatKey>> = {
  crit_: 'critRate',
  crit_dmg_: 'critDamage',
  anomProf: 'anomalyProficiency',
  pen_: 'penRatio',
}

export function emptyValues(): PanelValues {
  return Object.fromEntries(outOfCombatKeys.map((key) => [key, 0])) as PanelValues
}

export function initialValues(): PanelValues {
  return {
    ...emptyValues(),
    critRate: defaultCritRate,
    critDamage: defaultCritDamage,
    lacerationDamage: currentFormulaBaseStats.lacerationDamage * 100,
  }
}

export function unsupported(reason: string): PanelResult {
  return {
    status: 'unsupported',
    values: emptyValues(),
    trace: [],
    menuRounding: 'menu_rule_missing',
    reason,
  }
}

export function add(
  target: PanelValues,
  trace: PanelTrace[],
  key: OutOfCombatKey,
  value: number,
  source: string,
  operation: PanelTrace['operation'],
) {
  target[key] += value
  trace.push({ key, source, operation, value })
}
