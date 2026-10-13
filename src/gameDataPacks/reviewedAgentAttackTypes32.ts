import source from './data/reviewed-agent-attack-types32.v1.json'
import { currentReleasedIdentityMap } from './currentReleasedIdentityMap'
import { agentCatalog } from '../assault/catalogData'

export type AgentAttackType32 = 'slash' | 'strike' | 'pierce'
const validTypes = new Set<string>(['slash', 'strike', 'pierce'])
const identities = new Map([
  ...agentCatalog.map(([stableId, , , gameId]) => [stableId, gameId] as const),
  ...currentReleasedIdentityMap.entries
    .filter((entry) => entry.stableId.startsWith('agent-'))
    .map((entry) => [entry.stableId, entry.gameEvidenceId] as const),
])
const byAgentId = new Map(
  source.entries.map((entry) => {
    if (
      identities.get(entry.stableId) !== entry.gameId ||
      !entry.attackTypes.length ||
      new Set(entry.attackTypes).size !== entry.attackTypes.length ||
      !entry.attackTypes.every((type) => validTypes.has(type)) ||
      !entry.attackTypes.includes(entry.primaryAttackType)
    )
      throw new Error(`攻击类型来源与当前代理人身份不一致：${entry.stableId}`)
    return [entry.stableId, Object.freeze([...entry.attackTypes] as AgentAttackType32[])] as const
  }),
)
if (byAgentId.size !== source.entries.length || byAgentId.size !== identities.size)
  throw new Error('攻击类型来源未完整覆盖当前代理人目录。')

/** Game hit/hits fields, never inferred from a role or a skill's name. */
export function getReviewedAgentAttackTypes32(agentId: string) {
  return byAgentId.get(agentId) ?? null
}

export const reviewedAgentAttackTypeSource32 = Object.freeze(source.source)
