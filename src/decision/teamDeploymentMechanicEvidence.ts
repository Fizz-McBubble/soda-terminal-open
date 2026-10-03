import { current31TeamEngineD1Pack } from '../teamEngine/current31D1Pack'
import type { AgentRule, TeamEngineEvidenceRef } from '../teamEngine/contracts'
import { classifyFieldTimeDemand, type FieldTimeMode } from '../teamEngine/fieldTimeDemandOperator'

export type DeploymentMechanicProvenance = TeamEngineEvidenceRef & {
  basis: 'agent_rule' | 'game_rule' | 'current_mechanic' | 'retained_mechanic'
}

export type DeploymentMechanicAgent = {
  agentId: string
  name: string
  specialty: string
  fieldTimeMode: FieldTimeMode
  fieldTimeDemand: number
  quickAssistDirection: 'next' | 'previous' | null
  quickAssistDirections: Array<'next' | 'previous'>
  activeAgentEffectTags: string[]
}

/** `from -> to` always means adjacency in the positive 1 -> 2 -> 3 -> 1 ring. */
export type DeploymentMechanicRingEdge = {
  fromAgentId: string
  toAgentId: string
  triggerAgentId: string
  recipientAgentId: string
  kind: 'quick_assist_handoff'
  direction: 'next' | 'previous'
  strength: 'preferred'
  basis: DeploymentMechanicProvenance['basis']
  condition?: string
  reason: string
  provenance: DeploymentMechanicProvenance[]
}

export type DeploymentMechanicStarterTendency = {
  agentId: string
  kind: 'setup_first' | 'stun_first' | 'main_output_fallback'
  strength: 'preferred'
  reason: string
  provenance: DeploymentMechanicProvenance[]
}

export type TeamDeploymentMechanicEvidence = {
  memberIds: [string, string, string]
  agents: DeploymentMechanicAgent[]
  ringEdges: DeploymentMechanicRingEdge[]
  starterTendencies: DeploymentMechanicStarterTendency[]
  limitations: string[]
}

type DirectionFact = {
  direction: 'next' | 'previous'
  basis: 'game_rule' | 'current_mechanic' | 'retained_mechanic'
  sourceId: string
  gameVersion: string
  locator: string
  condition?: string
}

// These are reusable per-agent switch mechanics, not exact-team rankings. They
// cover exceptions that the current AgentRule resource tags do not yet encode.
const reviewedDirectionFacts = new Map<string, DirectionFact[]>([
  [
    'agent-seth',
    [
      {
        direction: 'previous',
        basis: 'retained_mechanic',
        sourceId: 'miyoushe-57323848-seth-quick-assist',
        gameVersion: '1.1',
        locator: 'article/57323848 op92-96: 蓄力连续斩击结束或招架支援后触发上一位角色快速支援',
        condition: '完成蓄力连续斩击，或招架支援后响应快速支援',
      },
    ],
  ],
  [
    'agent-pan-yinhu',
    [
      {
        direction: 'previous',
        basis: 'retained_mechanic',
        sourceId: 'miyoushe-71526574-pan-yinhu-quick-assist',
        gameVersion: '2.4',
        locator: 'article/71526574 op75: 潘引壶强化特殊技后上切前位输出',
        condition: '潘引壶发动强化特殊技并响应快速支援',
      },
    ],
  ],
  [
    'agent-pulchra',
    [
      {
        direction: 'previous',
        basis: 'retained_mechanic',
        sourceId: 'miyoushe-62601585-pulchra-quick-assist',
        gameVersion: '1.6',
        locator: 'article/62601585 op51,64: 猎步期间重击触发上一位角色快速支援',
        condition: '波可娜处于猎步并以重击命中',
      },
    ],
  ],
  [
    'agent-trigger',
    [
      {
        direction: 'previous',
        basis: 'retained_mechanic',
        sourceId: 'miyoushe-63149552-trigger-quick-assist',
        gameVersion: '1.6',
        locator:
          'article/63149552 op72,109,126: 狙击终结一击、终结技或强化特殊技触发上一位角色快速支援',
        condition: '狙击终结一击、终结技或强化特殊技命中',
      },
    ],
  ],
  [
    'agent-dialyn',
    [
      {
        direction: 'previous',
        basis: 'retained_mechanic',
        sourceId: 'miyoushe-70917235-dialyn-quick-assist',
        gameVersion: '2.4',
        locator: 'article/70917235 op133: 送客触发上一位角色快速支援，琉音放主C后',
        condition: '拥有客诉且好评不足90点时发动强化特殊技：送客',
      },
    ],
  ],
  [
    'agent-lycaon',
    [
      {
        direction: 'previous',
        basis: 'retained_mechanic',
        sourceId: 'miyoushe-73045858-lycaon-potential-quick-assist',
        gameVersion: '2.6',
        locator: 'article/73045858 op75: 潜能新增支援突击触发上一位角色快速支援',
        condition: '已激发对应潜能并发动支援突击：复仇反扑·冰舞',
      },
    ],
  ],
  [
    'agent-nangong',
    [
      {
        direction: 'previous',
        basis: 'retained_mechanic',
        sourceId: 'miyoushe-74132145-nangong-quick-assist',
        gameVersion: '2.7',
        locator: 'article/74132145 op81: 极性紊乱分支触发上一位角色快速支援',
        condition: '拥有舞力全开，并以指定重击命中异常且失衡的敌人',
      },
    ],
  ],
  [
    'agent-velina',
    [
      {
        direction: 'previous',
        basis: 'retained_mechanic',
        sourceId: 'miyoushe-76052835-velina-quick-assist',
        gameVersion: '3.0',
        locator: 'article/76052835 op89,254: 广域气旋或终结技触发上一位角色快速支援',
        condition: '风华达到90点召唤广域气旋，或发动终结技',
      },
    ],
  ],
  [
    'agent-norma',
    [
      {
        direction: 'previous',
        basis: 'retained_mechanic',
        sourceId: 'miyoushe-76558068-norma-quick-assist',
        gameVersion: '3.0',
        locator: 'article/76558068 op35: 随行礼帽蓄力炮击命中触发上一位角色快速支援',
        condition: '持有随行礼帽并以蓄力炮击命中',
      },
    ],
  ],
  [
    'agent-remielle',
    [
      {
        direction: 'next',
        basis: 'current_mechanic',
        sourceId: 'miyoushe-77013702-remielle-quick-assist',
        gameVersion: '3.1',
        locator: 'article/77013702 op301: 转换姿态唤出下一位角色快速支援',
        condition: '流明达到120点后进入转换姿态',
      },
    ],
  ],
])

function agentRuleProvenance(rule: AgentRule): DeploymentMechanicProvenance[] {
  return rule.evidence.map((ref) => ({ ...ref, basis: 'agent_rule' }))
}

function directionsFor(rule: AgentRule): DirectionFact[] {
  const reviewed = reviewedDirectionFacts.get(rule.agentId)
  if (reviewed) return reviewed
  if (rule.specialty !== 'support') return []
  return [
    {
      direction: 'next',
      basis: 'game_rule',
      sourceId: 'zzz-support-quick-assist-direction',
      gameVersion: current31TeamEngineD1Pack.gameVersion,
      locator: '支援代理人的普通快速支援选择正向下一位；具名技能写明“上一位”时由角色事实覆盖',
      condition: '该支援代理人的招式实际打开快速支援窗口',
    },
  ]
}

function outputTargets(providerId: string, rules: readonly AgentRule[]) {
  const peers = rules.filter((rule) => rule.agentId !== providerId)
  const outputs = peers.filter((rule) =>
    ['damage', 'anomaly', 'rupture', 'armorer'].includes(rule.specialty),
  )
  const pool = outputs.length ? outputs : peers
  const highest = Math.max(...pool.map((rule) => rule.fieldTimeDemand))
  return pool.filter((rule) => rule.fieldTimeDemand === highest)
}

function setupStarter(rule: AgentRule) {
  return (
    rule.fieldTimeDemand <= 0.45 &&
    rule.effects.some(
      (effect) => effect.recipient === 'team' || effect.recipient === 'active_agent',
    )
  )
}

export function currentProducedQuickAssistDirectionCoverage(
  agentRules: readonly AgentRule[] = current31TeamEngineD1Pack.agentRules,
) {
  return agentRules
    .filter((rule) => rule.produces.includes('quick_assist'))
    .map((rule) => ({
      agentId: rule.agentId,
      name: rule.name,
      directions: directionsFor(rule).map((fact) => ({
        direction: fact.direction,
        basis: fact.basis,
        sourceId: fact.sourceId,
        gameVersion: fact.gameVersion,
        locator: fact.locator,
        condition: fact.condition,
      })),
    }))
}

/**
 * Projects reusable placement facts only. The caller remains responsible for
 * comparing all six orders and for combining stronger exact-team evidence.
 */
export function currentTeamDeploymentMechanicEvidence(
  memberIds: readonly string[],
  agentRules: readonly AgentRule[] = current31TeamEngineD1Pack.agentRules,
): TeamDeploymentMechanicEvidence {
  if (memberIds.length !== 3 || new Set(memberIds).size !== 3)
    throw new Error('站位机制证据需要三名不同代理人。')
  const rulesById = new Map(agentRules.map((rule) => [rule.agentId, rule]))
  const rules = memberIds.flatMap((agentId) => {
    const rule = rulesById.get(agentId)
    return rule ? [rule] : []
  })
  const limitations = memberIds
    .filter((agentId) => !rulesById.has(agentId))
    .map((agentId) => `缺少 ${agentId} 的当前 AgentRule；其余成员的机制信号仍保留。`)
  const agents = rules.map((rule): DeploymentMechanicAgent => {
    const directions = [...new Set(directionsFor(rule).map((fact) => fact.direction))]
    return {
      agentId: rule.agentId,
      name: rule.name,
      specialty: rule.specialty,
      fieldTimeMode: classifyFieldTimeDemand(rule.fieldTimeDemand),
      fieldTimeDemand: rule.fieldTimeDemand,
      quickAssistDirection: directions.length === 1 ? directions[0]! : null,
      quickAssistDirections: directions,
      activeAgentEffectTags: rule.effects
        .filter((effect) => effect.recipient === 'active_agent')
        .map((effect) => effect.tag),
    }
  })
  const ringEdges = rules.flatMap((provider): DeploymentMechanicRingEdge[] => {
    return directionsFor(provider).flatMap((direction) => {
      const provenance: DeploymentMechanicProvenance[] = [
        {
          sourceId: direction.sourceId,
          gameVersion: direction.gameVersion,
          status:
            direction.basis === 'current_mechanic' || direction.basis === 'game_rule'
              ? 'candidate'
              : 'limited',
          locator: direction.locator,
          basis: direction.basis,
        },
      ]
      return outputTargets(provider.agentId, rules).map((target) => ({
        fromAgentId: direction.direction === 'next' ? provider.agentId : target.agentId,
        toAgentId: direction.direction === 'next' ? target.agentId : provider.agentId,
        triggerAgentId: provider.agentId,
        recipientAgentId: target.agentId,
        kind: 'quick_assist_handoff',
        direction: direction.direction,
        strength: 'preferred',
        basis: direction.basis,
        condition: direction.condition,
        reason:
          direction.direction === 'next'
            ? `把${target.name}放在${provider.name}后面，方便接快速支援。${direction.condition ? `触发条件：${direction.condition}。` : ''}`
            : `把${target.name}放在${provider.name}前面，方便接反向快速支援。${direction.condition ? `触发条件：${direction.condition}。` : ''}`,
        provenance,
      }))
    })
  })
  const starterTendencies = rules.flatMap((rule): DeploymentMechanicStarterTendency[] => {
    if (rule.specialty === 'stun' && rule.fieldTimeDemand >= 0.3)
      return [
        {
          agentId: rule.agentId,
          kind: 'stun_first',
          strength: 'preferred',
          reason: `${rule.name}承担前台击破，可先手建立失衡进度。`,
          provenance: agentRuleProvenance(rule),
        },
      ]
    if (setupStarter(rule))
      return [
        {
          agentId: rule.agentId,
          kind: 'setup_first',
          strength: 'preferred',
          reason: `需要先给队友加成时，可以让${rule.name}首发，启动效果后切人。`,
          provenance: agentRuleProvenance(rule),
        },
      ]
    return []
  })
  if (!starterTendencies.length && rules.length) {
    const highest = Math.max(...rules.map((rule) => rule.fieldTimeDemand))
    for (const rule of rules.filter((candidate) => candidate.fieldTimeDemand === highest))
      starterTendencies.push({
        agentId: rule.agentId,
        kind: 'main_output_fallback',
        strength: 'preferred',
        reason: `${rule.name}是本队主要站场角色，可以从该角色开始输出。`,
        provenance: agentRuleProvenance(rule),
      })
  }
  if (!ringEdges.length)
    limitations.push('当前机制合同没有可安全确定的快速支援相邻方向；仍可使用首发与站场倾向。')
  limitations.push('首发倾向描述开局；快速支援相邻边描述循环交接，两者不能互相替代。')
  return {
    memberIds: [...memberIds] as [string, string, string],
    agents,
    ringEdges,
    starterTendencies,
    limitations,
  }
}
