import type { AgentSummary } from './types'

export const attributeIcons: Record<string, { id: string; label: string }> = {
  electric: { id: 'attribute-electric', label: '电属性' },
  ether: { id: 'attribute-ether', label: '以太属性' },
  fire: { id: 'attribute-fire', label: '火属性' },
  ice: { id: 'attribute-ice', label: '冰属性' },
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

export function getSkillDisplayInfo(agent: AgentSummary, defaultDetail: string) {
  const steps = agent.nextTrainingSteps ?? []
  const status =
    agent.skillStatus ??
    (agent.decisionAuthorityState === 'stale'
      ? 'stale'
      : steps.length > 0
        ? 'has-gaps'
        : 'no-target')

  switch (status) {
    case 'has-gaps':
      return {
        heading: '接下来可补的技能',
        hasMorePopover: steps.length > 2,
        popoverCount: steps.length > 2 ? steps.length - 2 : 0,
        popoverContent: steps.slice(2).join('；'),
        line1: steps.slice(0, 2).join('；'),
        line2: '当前等级 → 养成目标',
      }
    case 'complete':
      return {
        heading: '技能达标状态',
        hasMorePopover: false,
        popoverCount: 0,
        popoverContent: '',
        line1: '所有关键技能均已达到目标等级',
        line2: '当前阶段无需补充升级',
      }
    case 'pending':
      return {
        heading: '技能目标核对中',
        hasMorePopover: false,
        popoverCount: 0,
        popoverContent: '',
        line1: '正在分析推荐技能升级顺序…',
        line2: agent.guideNote || '分析完成后将自动呈现',
      }
    case 'stale':
      return {
        heading: '技能目标待更新',
        hasMorePopover: false,
        popoverCount: 0,
        popoverContent: '',
        line1: '账户资料已变动，需重新分析',
        line2: agent.guideNote || '重新分析后将更新技能目标',
      }
    case 'unknown':
      if (steps.length) {
        return {
          heading: '已知缺口，仍需补录技能等级',
          hasMorePopover: steps.length > 2,
          popoverCount: steps.length > 2 ? steps.length - 2 : 0,
          popoverContent: steps.slice(2).join('；'),
          line1: steps.slice(0, 2).join('；'),
          line2: '其余技能等级待补录后继续核对',
        }
      }
      return {
        heading: '技能等级待录入',
        hasMorePopover: false,
        popoverCount: 0,
        popoverContent: '',
        line1: '尚未记录当前技能等级',
        line2: '可在我的资产补录后核对目标',
      }
    case 'no-target':
    default:
      return {
        heading: '技能升级目标',
        hasMorePopover: false,
        popoverCount: 0,
        popoverContent: '',
        line1: '当前阶段暂无特定技能推荐',
        line2: agent.guideNote || defaultDetail || '角色资料与配装仍可正常查看',
      }
  }
}
