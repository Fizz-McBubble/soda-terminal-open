import type { AccountRoster } from '../assault/types'
import { publicDevelopmentDirectoryCatalog } from '../application/publicDevelopmentDirectoryCatalog'
import type { AgentSummary } from '../features/agentDevelopmentGolden/types'
import { projectAgentDevelopmentCatalogJoin } from './agentDevelopmentCatalogJoin'

/** Initial cards only; source targets and physical equipment remain pending until facts arrive. */
export function projectDirectoryScaffold(
  agents: AccountRoster['agents'] | undefined,
  priorityOrder: ReadonlyMap<string, number>,
  catalogOrder: ReadonlyMap<string, number>,
): AgentSummary[] {
  if (!agents) return []
  const eligibleOwnedAgentIds = new Set(
    projectAgentDevelopmentCatalogJoin(agents, publicDevelopmentDirectoryCatalog)
      .eligibleOwnedAgentIds,
  )
  const rosterById = new Map(agents.map((agent) => [agent.agentId, agent] as const))
  return publicDevelopmentDirectoryCatalog
    .filter((entry) => entry.releaseState === 'released' && entry.accountOwnable)
    .flatMap<AgentSummary>((entry) => {
      const agentId = entry.stableId
      if (!eligibleOwnedAgentIds.has(agentId)) return []
      const record = rosterById.get(agentId)
      if (!record?.owned) return []
      return [
        {
          agentId,
          name: entry.playerName,
          rarity: entry.rarity === 'A' ? 'A' : 'S',
          attribute: entry.attribute,
          specialty: entry.specialty,
          favorite: priorityOrder.has(agentId),
          visual: { kind: 'avatar', src: '', fallback: 'initials' },
          level: record.level,
          mindscape: record.mindscape,
          status: '待确认',
          guideNote: '角色基础资料已读取；技能、影画与装备正在核对。',
          reliableTarget: false,
          nextTrainingSteps: [],
          cinemaLevels: null,
          equipmentProgress: { engine: '正在核对', discs: '正在核对' },
          skillStatus: 'pending',
        },
      ]
    })
    .sort(
      (left, right) =>
        (priorityOrder.get(left.agentId) ?? Number.MAX_SAFE_INTEGER) -
          (priorityOrder.get(right.agentId) ?? Number.MAX_SAFE_INTEGER) ||
        (catalogOrder.get(left.agentId) ?? Number.MAX_SAFE_INTEGER) -
          (catalogOrder.get(right.agentId) ?? Number.MAX_SAFE_INTEGER),
    )
}
