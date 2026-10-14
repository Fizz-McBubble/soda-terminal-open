import { z } from 'zod'
import type { ObservedAgentField, RosterAgent } from '../assault/types'
import { standardDriveDiscImportSchema } from '../domain/discImport'
import type { StatKey } from '../domain/schemas'
import identities from './catalogIdentityProjection.json'

export type StandardAssetDiscImport = z.infer<typeof standardDriveDiscImportSchema>
export type AssetQuickReadIssue = {
  code: string
  message: string
  kind?: 'discs' | 'engines' | 'agents' | 'snapshot'
  index?: number
  field?: string
}
export type AssetQuickReadAgentCandidate = {
  agentId: string
  name: string
  fields: Partial<RosterAgent>
  observedFields: ObservedAgentField[]
  equippedSourceIds: string[]
}
export type AssetQuickReadCandidate = {
  capturedAt: string
  snapshotSha256: string
  protocolVersion: '3.2'
  discs: StandardAssetDiscImport
  agents: AssetQuickReadAgentCandidate[]
  counts: {
    discs: number
    sDiscs: number
    engines: number
    agents: number
    importableAgents: number
  }
  issues: AssetQuickReadIssue[]
  warnings?: readonly string[]
  importable: boolean
  /** These are observed candidates, never proof of inventory completeness or deletion authority. */
  fullInventoryVerified: false
}

export const statsById: Record<number, [StatKey, boolean]> = {
  11102: ['hp_percent', true],
  11103: ['hp_flat', false],
  12102: ['atk_percent', true],
  12103: ['atk_flat', false],
  12202: ['impact', true],
  13102: ['def_percent', true],
  13103: ['def_flat', false],
  20103: ['crit_rate', true],
  21103: ['crit_dmg', true],
  23103: ['pen_ratio', true],
  23203: ['pen', false],
  30502: ['energy_regen', true],
  31203: ['anomaly_proficiency', false],
  31402: ['anomaly_mastery', true],
  31503: ['physical_dmg', true],
  31603: ['fire_dmg', true],
  31703: ['ice_dmg', true],
  31803: ['electric_dmg', true],
  31903: ['ether_dmg', true],
  32303: ['wind_dmg', true],
}
export const agentIdentities = new Map(
  identities.agents.map((row) => [row.gameId, { id: row.id, name: row.name }]),
)
export const setIdentities = new Map(identities.discs.map((row) => [Number(row.gameId), row.id]))
export const engineIdentities = new Map(identities.engines.map((row) => [Number(row.gameId), row]))
export const sourceId = (uid: number) => `asset-quick-read:${uid}`
