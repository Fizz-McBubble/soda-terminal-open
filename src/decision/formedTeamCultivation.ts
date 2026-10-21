import { currentAgentDirectory } from '../assault/catalog'
import { supportsPotentialImage } from '../assault/agentCapabilities'
import { getHoyoBuildCurrentSkillDirection32 } from '../gameDataPacks/reviewedHoyoBuildCurrentSkillGuidance32'
import { stableContentHash } from '../gameDataPacks/types'
import type { FormedTeamReference } from '../application/publicFormedTeamReference'
import { currentVersionProjection } from '../gameDataPacks/currentVersionProjection'
import { getPhoenixFormedReference33 } from '../gameDataPacks/gameData33BuildGuidance'

/** Local formed-team policy. Guide investment tags select a reference state;
 * they never supply a damage multiplier, a team tier, or an account observation. */
export const formedTeamCultivationPolicy = Object.freeze({
  id: 'formed-team-reviewed-key-mindscapes/v1',
  gameVersion: '3.2',
  aRankMindscape: 6,
  sRankSelection: 'highest-reviewed-big-upgrade-within-m1-m2',
  level: 60,
  baseSkillLevel: 11,
  coreLevel: 7,
  supportedPotential: 6,
})

export function formedAgentCultivation(agentId: string, memberIds: readonly string[] = []) {
  const agent = currentAgentDirectory.find((row) => row.id === agentId)
  if (!agent || !['S', 'A'].includes(agent.rarity ?? ''))
    throw new Error(`成型参考缺少S/A身份：${agentId}`)
  if (agentId === 'agent-phoenix' && currentVersionProjection.gameVersion === '3.3') {
    const reference = getPhoenixFormedReference33()
    if (!reference || agent.rarity !== 'S')
      throw new Error(`成型参考缺少已复核关键影画：${agentId}`)
    return {
      agentId,
      level: reference.level,
      mindscape: reference.mindscape,
      potential: reference.potential,
      baseSkillLevel: reference.baseSkillLevel,
      coreLevel: reference.coreLevel,
      reason: '已复核1影成型参考；灼蚀目标异常暴伤与燃烧攻击燔焰效率按条件生效。',
      evidenceRefs: [reference.source.url],
      sourceHash: reference.source.contentHash,
      conditions: [...reference.conditions],
    }
  }
  const guide = getHoyoBuildCurrentSkillDirection32(agentId)
  const levels =
    guide?.entry.cinemaLevels
      .filter((row) => row.tag === 'Big upgrade' && row.level >= 1 && row.level <= 2)
      .map((row) => row.level) ?? []
  // The reviewed physical pair changes Alice's role and the value of her M2.
  // Keep the exact partner requirement; do not promote every Alice team.
  const physicalPair = agentId === 'agent-alice' && memberIds.includes('agent-jane')
  const mindscape =
    agent.rarity === 'A' ? 6 : physicalPair ? 2 : levels.length ? Math.max(...levels) : null
  if (mindscape === null) throw new Error(`成型参考缺少已复核关键影画：${agentId}`)
  const evidenceRefs = guide ? [guide.source.url] : []
  if (physicalPair) evidenceRefs.push('https://www.prydwen.gg/zenless/characters/jane-doe/')
  return {
    agentId,
    level: 60,
    mindscape,
    potential: supportsPotentialImage(agentId) ? 6 : null,
    baseSkillLevel: 11,
    coreLevel: 7,
    reason:
      agent.rarity === 'A'
        ? 'A级满影成型参考'
        : physicalPair
          ? '与简组队采用二影协同参考'
          : `按已复核关键影画采用${mindscape}影成型参考`,
    evidenceRefs,
    sourceHash: guide?.source.contentHash ?? null,
  }
}

export function formedTeamCultivation(memberIds: readonly string[]): FormedTeamReference {
  if (memberIds.length !== 3 || new Set(memberIds).size !== 3)
    throw new Error('成型参考需要三个不同成员。')
  const members = [...memberIds].sort().map((id) => formedAgentCultivation(id, memberIds))
  const phoenixCurrent33 =
    memberIds.includes('agent-phoenix') && currentVersionProjection.gameVersion === '3.3'
  const gameVersion = phoenixCurrent33 ? '3.3' : formedTeamCultivationPolicy.gameVersion
  return {
    policy: formedTeamCultivationPolicy.id,
    gameVersion,
    identity: stableContentHash({
      policy: formedTeamCultivationPolicy,
      members,
      ...(phoenixCurrent33 ? { gameVersion } : {}),
    }),
    members: members.map((row) => ({
      agentId: row.agentId,
      mindscape: row.mindscape,
      potential: row.potential,
      reason: row.reason,
      level: 60,
      baseSkillLevel: 11,
      coreLevel: 7,
    })),
  }
}
