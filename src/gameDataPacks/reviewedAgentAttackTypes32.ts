import source from './data/reviewed-agent-attack-types32.v1.json'
import { currentReleasedIdentityMap } from './currentReleasedIdentityMap'
import { agentCatalog } from '../assault/catalogData'
import mechanicCatalog from './generated/current-agent-mechanic-catalog.v1.json'
import phoenix from './data/reviewed-phoenix-numeric.3.3.json'
import { currentGameDataSelection } from './currentGameDataSelection'

export type AgentAttackType32 = 'slash' | 'strike' | 'pierce'
if (
  phoenix.source.rawSha256 !== '237c5b060657db1fd8ababe6cd26fb275c325d74a67eda481bde6732c7d93dfe' ||
  phoenix.source.providerManifestSha256 !==
    '4d30f529d6e0568a130ebe4d79557b30d9c65d2219e77461763df1c4b42cb029' ||
  phoenix.attackType.gameEnum !== 101 ||
  phoenix.attackType.key !== 'slash'
)
  throw new Error('Phoenix attack semantic source binding mismatch.')
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
if (
  byAgentId.size !== source.entries.length ||
  byAgentId.size !== mechanicCatalog.items.length ||
  mechanicCatalog.items.some(
    (item) => !source.entries.some((entry) => entry.gameId === item.externalId),
  )
)
  throw new Error('攻击类型来源未完整覆盖当前代理人目录。')

/** Game hit/hits fields, never inferred from a role or a skill's name. */
export function getReviewedAgentAttackTypes32(agentId: string) {
  if (agentId === 'agent-phoenix' && currentGameDataSelection.gameVersion === '3.3')
    return [phoenix.attackType.key] as AgentAttackType32[]
  return byAgentId.get(agentId) ?? null
}

export const reviewedAgentAttackTypeSource32 = Object.freeze(source.source)

/** Source identity semantic only; not action segmentation or a GO formula claim. */
export const reviewedPhoenixAttackTypeSource33 = Object.freeze({
  stableId: phoenix.stableId,
  attackTypes: [phoenix.attackType.key] as readonly AgentAttackType32[],
  source: phoenix.source,
  locator: phoenix.attackType.locator,
  gameEnum: phoenix.attackType.gameEnum,
  boundary:
    'Agent attack semantic only; does not bind source parameter aggregates to executable hits.',
})
