import { agentCatalog, bangbooCatalog } from '../assault/catalogData'
import {
  currentReleasedIdentityMap,
  resolveCurrentReleasedIdentity,
} from '../gameDataPacks/currentReleasedIdentityMap'

export { agentCatalog, bangbooCatalog }

const agentNames = new Map<string, string>([
  ...agentCatalog.map(([id, name]) => [id, name] as const),
  ...currentReleasedIdentityMap.entries
    .filter((entry) => entry.stableId.startsWith('agent-'))
    .map((entry) => [entry.stableId, entry.playerName] as const),
])
const bangbooNames = new Map<string, string>([
  ...bangbooCatalog.map(([id, name]) => [id, name] as const),
  ...currentReleasedIdentityMap.entries
    .filter((entry) => entry.stableId.startsWith('bangboo-'))
    .map((entry) => [entry.stableId, entry.playerName] as const),
])

export function getAgentName(agentId: string) {
  const stableId = resolveCurrentReleasedIdentity(agentId)
  return agentNames.get(stableId) ?? stableId
}

export function getBangbooName(bangbooId: string) {
  return bangbooNames.get(bangbooId) ?? bangbooId
}

const agentSpecialtyLabels: Record<string, string> = {
  damage: '强攻',
  stun: '击破',
  anomaly: '异常',
  support: '支援',
  defense: '防护',
  rupture: '命破',
}

export function getAgentSpecialtyLabel(value: string | null | undefined) {
  return agentSpecialtyLabels[value ?? ''] ?? '资料待补齐'
}
