import type { DriveDisc } from '../domain/schemas'
import type { ExtendedPanelKey } from '../domain/characterPanelStats'
import { currentPanelData } from '../gameDataPacks/panel/currentPanelData'

export const outOfCombatKeys = [
  'hp',
  'atk',
  'def',
  'impact',
  'critRate',
  'critDamage',
  'lacerationDamage',
  'anomalyMastery',
  'anomalyProficiency',
  'pen',
  'penRatio',
  'energyRegen',
] as const

export type OutOfCombatKey = (typeof outOfCombatKeys)[number]
export type PanelInput = {
  agentId: string
  level: number
  ascension: number
  /** Learned-growth row0..5 (A..F) maps to account core2..7.
   * Explicit -1 alone maps to account core1's source-proven zero enhancement;
   * missing/NaN never select this zero row. */
  core: number
  mindscape?: number
  potentialImage?: number | null
  wEngine: { id: string; level: number; ascension: number; refinement: number }
  discs: DriveDisc[]
}
export type PanelTrace = {
  key: OutOfCombatKey | ExtendedPanelKey
  source: string
  operation: 'base' | 'percent' | 'post_flat' | 'final' | 'inactive'
  value: number | string
}
export type PanelResult = {
  status: 'ok' | 'unsupported'
  values: Record<OutOfCombatKey, number> & Partial<Record<ExtendedPanelKey, number>>
  trace: PanelTrace[]
  menuRounding: 'menu_rule_missing'
  reason?: string
}
export type PanelEngineSupport = {
  agentId: string
  wEngineId: string
  released: boolean
  status: 'computable' | 'unsupported'
  blockers: string[]
}

/** Engine coverage only. Formal readiness is derived by the L3 validator and CalculationContext evidence. */
export function projectPanelEngineSupport(
  entries: Array<{ agentId: string; wEngineId: string; released: boolean }>,
): PanelEngineSupport[] {
  return entries.map((entry) => {
    const blockers = [
      ...(entry.released ? [] : ['not-released']),
      ...(currentPanelData.agents[entry.agentId] ? [] : ['agent-not-registered']),
      ...(currentPanelData.wEngines[entry.wEngineId] ? [] : ['wengine-not-registered']),
    ]
    return { ...entry, status: blockers.length === 0 ? 'computable' : 'unsupported', blockers }
  })
}
