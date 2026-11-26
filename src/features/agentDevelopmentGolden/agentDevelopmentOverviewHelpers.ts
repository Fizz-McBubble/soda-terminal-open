import { publicAssetCatalog } from '../../application/publicAssetCatalog'
import type { AgentSummary } from './types'

const directoryAttributes = new Map(
  publicAssetCatalog.agents.map((agent) => [agent.stableId, agent.attribute]),
)

export function developmentDirectoryAttribute(agent: AgentSummary) {
  return directoryAttributes.get(agent.agentId) ?? agent.attribute
}

export const attributeIcons: Record<string, { id: string; label: string }> = {
  electric: { id: 'attribute-electric', label: '电属性' },
  ether: { id: 'attribute-ether', label: '以太属性' },
  fire: { id: 'attribute-fire', label: '火属性' },
  frost: { id: 'attribute-ice', label: '烈霜属性' },
  ice: { id: 'attribute-ice', label: '冰属性' },
  lumiflux: { id: 'attribute-lumiflux', label: '流明属性' },
  physical: { id: 'attribute-physical', label: '物理属性' },
  wind: { id: 'attribute-wind', label: '风属性' },
}

export const specialtyIcons: Record<string, { id: string; label: string }> = {
  armorer: { id: 'specialty-armorer', label: '锋御特性' },
  anomaly: { id: 'specialty-anomaly', label: '异常特性' },
  damage: { id: 'specialty-attack', label: '强攻特性' },
  defense: { id: 'specialty-defense', label: '防护特性' },
  rupture: { id: 'specialty-rupture', label: '命破特性' },
  stun: { id: 'specialty-stun', label: '击破特性' },
  support: { id: 'specialty-support', label: '支援特性' },
}

export function getDirectoryProgress(agent: AgentSummary) {
  let label = ''
  if (agent.status === '已有方案') {
    label = '方案已保存'
  } else if (agent.status === '培养中') {
    label = '已收藏'
  }

  let detail = agent.guideNote?.trim()
  if (!detail) {
    if (agent.status === '已有方案') {
      detail = '配装已保存，可继续调整。'
    } else if (agent.decisionAuthorityState === 'stale') {
      detail = '账户资料已变化，请重新分析养成建议。'
    } else if (agent.decisionAuthorityState === 'unsupported') {
      detail = '当前还没有包含该代理人的完整三人队伍建议。'
    } else {
      detail = '查看技能升级顺序、音擎选择和驱动盘搭配。'
    }
  }

  return {
    label,
    detail,
  }
}
