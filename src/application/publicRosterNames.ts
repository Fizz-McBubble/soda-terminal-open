import { agentCatalog, bangbooCatalog } from '../assault/catalogData'
import publicLabels from './publicCandidateLabels.data.json'
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
  const stableId = resolveCurrentReleasedIdentity(bangbooId)
  return bangbooNames.get(stableId) ?? stableId
}

const releasedNames = new Map(
  currentReleasedIdentityMap.entries.map((entry) => [entry.stableId, entry.playerName] as const),
)

/** Convert source identity annotations only at the player-facing presentation boundary. */
export function formatDevelopmentEntityText(text: string) {
  const idPattern = '(?:wengine-[a-zA-Z0-9-]+|agent-[a-zA-Z0-9-]+)'
  const nameFor = (id: string) => {
    const stableId = resolveCurrentReleasedIdentity(id)
    if (stableId.startsWith('agent-')) return agentNames.get(stableId)
    return (
      releasedNames.get(stableId) ??
      publicLabels.wEngines[stableId as keyof typeof publicLabels.wEngines]
    )
  }
  const withoutAnnotations = text.replace(
    new RegExp(`[（(](${idPattern})[）)]`, 'g'),
    (_annotation, id: string, offset: number) => {
      const name = nameFor(id)
      if (!name || text.slice(0, offset).trimEnd().endsWith(name)) return ''
      return `（${name}）`
    },
  )
  return withoutAnnotations.replace(
    new RegExp(idPattern, 'g'),
    (id) => nameFor(id) ?? (id.startsWith('agent-') ? '代理人资料待补齐' : '音擎资料待补齐'),
  )
}

const agentSpecialtyLabels: Record<string, string> = {
  damage: '强攻',
  stun: '击破',
  anomaly: '异常',
  support: '支援',
  defense: '防护',
  rupture: '命破',
  armorer: '锋御',
}

export function getAgentSpecialtyLabel(value: string | null | undefined) {
  return agentSpecialtyLabels[value ?? ''] ?? '资料待补齐'
}
