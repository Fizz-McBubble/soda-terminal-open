import type { CandidateSetPlan } from './candidateSetPlans'
import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'

export type CandidateSetPlanEligibilityContext = {
  /** The actual selected trio; a partial roster is not an absent teammate. */
  memberIds?: readonly string[]
  /** Never substitute account equipment before an optimizer changes the loadouts. */
  selectedLoadouts?: {
    basis: 'final-candidate' | 'confirmed-assumption'
    setCountsByAgentId: Readonly<Record<string, Readonly<Record<string, number>>>>
  }
  /** Source says electric team, not a minimum count of electric characters. */
  electricTeamScenario?: {
    basis: 'selected-team' | 'confirmed-assumption'
    matches: boolean
  }
  /** Separate evidence for the effect; a recommended scene does not activate Shock. */
  shockCoverage?: 'verified' | 'not-covered' | 'unknown'
  operationCoverage?: {
    basis: 'final-candidate' | 'confirmed-assumption' | 'source-confirmed'
    exSpecialByAgentId?: Readonly<Record<string, 'verified' | 'not-covered' | 'unknown'>>
    teamQuickAssist?: 'verified' | 'not-covered' | 'unknown'
    /** Separate actual effect-window/stacks evidence; action use alone never proves uptime. */
    effectWindowsBySetId?: Readonly<Record<string, 'verified' | 'not-covered' | 'unknown'>>
  }
}

export type CandidateSetPlanEligibility = {
  status: 'eligible' | 'condition-not-met' | 'condition-unknown' | 'unrestricted'
  kind: 'source-scenario'
  conditionalPrimarySetId?: string
  sourceId?: string
  sourceUrl?: string
  reason: string
  /** This result never certifies game-equipment legality or exact damage. */
  boundary: string
  effectCoverage?: 'verified' | 'not-covered' | 'unknown'
}

const boundary =
  '仅判断这条来源推荐的适用场景；未匹配或未知不表示盘套非法、无用，也不证明效果已覆盖。'
const conditions = [
  {
    agentId: 'agent-ellen',
    setId: 'set-puffer-electro',
    sourceId: 'prydwen-ellen-dialyn-puffer',
    url: 'https://www.prydwen.gg/zenless/characters/ellen',
    sourceMarker: /Dialyn|琉音/,
  },
  {
    agentId: 'agent-hugo',
    setId: 'set-puffer-electro',
    sourceId: 'prydwen-hugo-dialyn-puffer',
    url: 'https://www.prydwen.gg/zenless/characters/hugo',
    sourceMarker: /Dialyn|琉音/,
  },
  {
    agentId: 'agent-astra',
    setId: 'set-moonlight-lullaby',
    sourceId: 'prydwen-astra-teammate-astral-voice',
    url: 'https://www.prydwen.gg/zenless/characters/astra-yao',
    sourceMarker: /队内已有\s*(?:Astral Voice|静听嘉音)/,
  },
  {
    agentId: 'agent-cissia',
    setId: 'set-thunder-metal',
    sourceId: 'prydwen-cissia-electric-team-thunder-metal',
    url: 'https://www.prydwen.gg/zenless/characters/cissia',
    sourceMarker: /电队/,
  },
] as const

function isCompleteSetCount(counts: Readonly<Record<string, number>> | undefined) {
  if (!counts) return false
  const values = Object.values(counts)
  return (
    values.every((count) => Number.isInteger(count) && count >= 0 && count <= 6) &&
    values.reduce((sum, count) => sum + count, 0) === 6
  )
}

/** Freeze adopted prerequisites with the branch consumed by guides, saves and the solver. */
export function qualifyCandidateSetPlan(agentId: string, plan: CandidateSetPlan): CandidateSetPlan {
  if (plan.condition) return plan
  // A pooled primary is source shorthand, not one conditional branch. The canonical
  // constraint reader splits it first so a condition on P cannot contaminate Q.
  if (plan.pattern !== '4+2' || plan.primarySetIds.length !== 1) return plan
  const source = conditions.find(
    (entry) => entry.agentId === agentId && plan.primarySetIds[0] === entry.setId,
  )
  if (!source) return plan
  return {
    ...plan,
    purpose: 'conditional',
    condition: {
      sourceId: source.sourceId,
      sourceUrl: source.url,
      sourceTextVerified: source.sourceMarker.test(plan.sourceText ?? ''),
      rule:
        agentId === 'agent-astra'
          ? { kind: 'teammate_four_piece', setId: 'set-astral-voice' }
          : agentId === 'agent-cissia'
            ? { kind: 'electric_team' }
            : { kind: 'teammate', agentId: 'agent-dialyn' },
    },
  }
}

/** Pure source-scenario assessment. Callers retain unknown alternatives with a
 * condition label; only an explicitly selected recommendation policy may use
 * this result for priority. This function never filters inventory or set plans. */
export function evaluateCandidateSetPlanEligibility(
  agentId: string,
  plan: CandidateSetPlan,
  context: CandidateSetPlanEligibilityContext = {},
): CandidateSetPlanEligibility {
  const condition = qualifyCandidateSetPlan(agentId, plan).condition
  if (
    !condition &&
    plan.pattern === '4+2' &&
    plan.primarySetIds.length !== 1 &&
    conditions.some(
      (entry) => entry.agentId === agentId && plan.primarySetIds.includes(entry.setId),
    )
  )
    return {
      status: 'condition-unknown',
      kind: 'source-scenario',
      reason: '四件套候选池含其他主套，需按主套分别判断这条推荐条件。',
      boundary,
    }
  if (!condition)
    return {
      status: 'unrestricted',
      kind: 'source-scenario',
      reason: '该分支没有本模块已采用的推荐场景条件。',
      boundary,
    }
  const result = (
    status: CandidateSetPlanEligibility['status'],
    reason: string,
  ): CandidateSetPlanEligibility => ({
    status,
    kind: 'source-scenario',
    conditionalPrimarySetId: plan.primarySetIds[0],
    sourceId: condition.sourceId,
    sourceUrl: condition.sourceUrl,
    reason,
    boundary,
    ...(condition.rule.kind === 'electric_team'
      ? { effectCoverage: context.shockCoverage ?? 'unknown' }
      : condition.rule.kind === 'teammate_specialty_and_action'
        ? {
            effectCoverage:
              context.operationCoverage?.effectWindowsBySetId?.[plan.primarySetIds[0]!] ??
              'unknown',
          }
        : {}),
  })
  // Explicit typed pooled input remains fail-closed. Canonical constraint reads
  // split ordinary pooled source shorthand before it reaches this evaluator.
  if (plan.primarySetIds.length !== 1)
    return result('condition-unknown', '四件套候选池含其他主套，需按主套分别判断这条推荐条件。')
  if (!condition.sourceTextVerified)
    return result(
      'condition-unknown',
      '当前分支没有保留该推荐场景的来源原文，不能确认条件已被采用。',
    )
  const members = context.memberIds
  if (!members || members.length !== 3 || new Set(members).size !== 3 || !members.includes(agentId))
    return result('condition-unknown', '尚无包含当前代理人的完整、唯一三人队伍。')
  if (condition.rule.kind === 'teammate') {
    return members.filter((id) => id !== agentId).includes(condition.rule.agentId)
      ? result('eligible', '当前三人队包含这条推荐所需的队友；推荐场景成立不表示触发效果常驻。')
      : result('condition-not-met', '当前三人队缺少这条推荐所需的队友；盘套本身仍可装备。')
  }
  if (condition.rule.kind === 'teammate_specialty_and_action') {
    const peers = members
      .filter((id) => id !== agentId)
      .map((id) => getCurrentAgentEventContract(id)?.identity.specialty)
    if (peers.some((specialty) => !specialty))
      return result('condition-unknown', '队友特性事实不完整，不能确认来源限定的输出角色。')
    if (
      !peers.some(
        (specialty) =>
          condition.rule.kind === 'teammate_specialty_and_action' &&
          condition.rule.specialties.some((required) => required === specialty),
      )
    )
      return result('condition-not-met', '当前队友没有来源限定的输出特性；该套装仍是合法库存分支。')
    const operations = context.operationCoverage
    if (
      !operations ||
      !['final-candidate', 'confirmed-assumption', 'source-confirmed'].includes(operations.basis)
    )
      return result(
        'condition-unknown',
        '尚无实际或来源确认的触发动作覆盖；不能凭队友特性自动激活套装。',
      )
    const coverage =
      condition.rule.action === 'wearer_ex_special'
        ? operations.exSpecialByAgentId?.[agentId]
        : operations.teamQuickAssist
    if (!coverage || coverage === 'unknown')
      return result('condition-unknown', '所需强化特殊技或团队快速支援动作覆盖未知；保留条件候选。')
    return coverage === 'verified'
      ? result(
          'eligible',
          '来源限定的输出特性与触发动作场景已确认；效果窗口与快速支援层数仍须单独核验，不代表常驻。',
        )
      : result('condition-not-met', '当前明确没有所需触发动作覆盖；不视为套装装备禁令。')
  }
  if (
    condition.rule.kind === 'teammate_four_piece' ||
    condition.rule.kind === 'teammate_not_four_piece'
  ) {
    const requiredSetId = condition.rule.setId
    const selected = context.selectedLoadouts
    if (!selected || !['final-candidate', 'confirmed-assumption'].includes(selected.basis))
      return result(
        'condition-unknown',
        '尚无本次候选最终套装或已确认的配装假设，不能用账户原装备证明队友仍持有所需四件套。',
      )
    const teammateCounts = members
      .filter((id) => id !== agentId)
      .map((id) => selected.setCountsByAgentId[id])
    if (!teammateCounts.every(isCompleteSetCount))
      return result(
        'condition-unknown',
        condition.rule.kind === 'teammate_four_piece'
          ? '队友本次六盘套装记录不完整，尚不能确认所需四件套是否由其他成员承担。'
          : '队友本次六盘套装记录不完整，尚不能确认同名四件套是否重复配置。',
      )
    const teammateHasSet = teammateCounts.some((counts) => counts![requiredSetId] >= 4)
    if (condition.rule.kind === 'teammate_not_four_piece')
      return teammateHasSet
        ? result(
            'condition-not-met',
            '本次配装的另一名队友已持有同名四件套；来源明确其团队增益不叠加，不采用重复配置。',
          )
        : result('eligible', '本次配装两名队友均未持有同名四件套，符合这条来源推荐场景。')
    if (teammateHasSet)
      return result('eligible', '本次配装的另一名队友持有所需四件套，符合这条来源推荐场景。')
    return result(
      'condition-not-met',
      '本次配装两名队友均未持有所需四件套，未匹配这条来源推荐场景。',
    )
  }
  const scenario = context.electricTeamScenario
  if (!scenario || !['selected-team', 'confirmed-assumption'].includes(scenario.basis))
    return result(
      'condition-unknown',
      '来源限定电队使用方向；当前未明确队伍输出场景，不按电属性人数推定，保留条件候选。',
    )
  return scenario.matches
    ? result(
        'eligible',
        '已明确采用电队场景，符合雷暴四件来源推荐方向；感电覆盖须单独核验，不能默认常驻。',
      )
    : result(
        'condition-not-met',
        '当前明确采用其他输出场景，未匹配这条电队来源推荐；这不是盘套装备禁令。',
      )
}
