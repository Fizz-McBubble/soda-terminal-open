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
    .filter((entry) => entry.releaseState === 'released' && entry.stableId.startsWith('agent-'))
    .map((entry) => [entry.stableId, entry.playerName] as const),
])
const bangbooNames = new Map<string, string>([
  ...bangbooCatalog.map(([id, name]) => [id, name] as const),
  ...currentReleasedIdentityMap.entries
    .filter((entry) => entry.releaseState === 'released' && entry.stableId.startsWith('bangboo-'))
    .map((entry) => [entry.stableId, entry.playerName] as const),
])

export function getAgentName(agentId: string) {
  const stableId = resolveCurrentReleasedIdentity(agentId)
  return agentNames.get(stableId) ?? '未知代理人'
}

export function getBangbooName(bangbooId: string) {
  const stableId = resolveCurrentReleasedIdentity(bangbooId)
  return bangbooNames.get(stableId) ?? '未知邦布'
}

const releasedNames = new Map(
  currentReleasedIdentityMap.entries
    .filter((entry) => entry.releaseState === 'released')
    .map((entry) => [entry.stableId, entry.playerName] as const),
)

/** One released-identity resolver for player prose; unknown identity remains unknown. */
export function getPlayerEntityName(id: string): string | undefined {
  const stableId = resolveCurrentReleasedIdentity(id)
  if (stableId.startsWith('agent-')) return agentNames.get(stableId)
  if (stableId.startsWith('bangboo-')) return bangbooNames.get(stableId)
  if (stableId.startsWith('set-'))
    return publicLabels.driveDiscSets[stableId as keyof typeof publicLabels.driveDiscSets]
  return (
    releasedNames.get(stableId) ??
    publicLabels.wEngines[stableId as keyof typeof publicLabels.wEngines]
  )
}

/** Convert source annotations without dropping a missing condition or inventing an identity. */
export function formatDevelopmentEntityText(text: string) {
  const idPattern = '(?:wengine|agent|bangboo|set)-[a-zA-Z0-9-]+'
  const missingName = (id: string) =>
    `未知${id.startsWith('agent-') ? '代理人' : id.startsWith('bangboo-') ? '邦布' : id.startsWith('set-') ? '套装' : '音擎'}`
  const withoutAnnotations = text.replace(
    new RegExp(`[（(](${idPattern})[）)]`, 'g'),
    (_annotation, id: string, offset: number) => {
      const name = getPlayerEntityName(id)
      if (!name) return `（${missingName(id)}）`
      if (text.slice(0, offset).trimEnd().endsWith(name)) return ''
      return `（${name}）`
    },
  )
  return withoutAnnotations.replace(
    new RegExp(idPattern, 'g'),
    (id) => getPlayerEntityName(id) ?? missingName(id),
  )
}

const agentSpecialtyLabels: Record<string, string> = {
  damage: '强攻',
  attack: '强攻',
  stun: '击破',
  anomaly: '异常',
  support: '支援',
  defense: '防护',
  rupture: '命破',
  armorer: '锋御',
}

export function getAgentSpecialtyLabel(value: string | null | undefined) {
  return agentSpecialtyLabels[value ?? ''] ?? '未知特性'
}
