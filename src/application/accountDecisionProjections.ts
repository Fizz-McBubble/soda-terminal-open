import {
  accountDecisionModuleCapabilities,
  projectAccountDecisionCapabilitySlots,
} from '../decision/accountDecisionCapabilitySlots'
import type { AccountDecisionWorld } from './accountDecisionWorld'
import type { DecisionClaimStatus } from './calculationQueryContract'

type ReadyWorld = Extract<AccountDecisionWorld, { status: 'current' | 'stale' }>

export type AccountDecisionModule = keyof typeof accountDecisionModuleCapabilities
export type AccountDecisionModuleState = 'ready' | 'mixed' | 'unavailable' | 'stale' | 'error'

function moduleState(states: readonly string[]): AccountDecisionModuleState {
  if (states.some((state) => state === 'error')) return 'error'
  if (states.every((state) => state === 'stale')) return 'stale'
  if (states.every((state) => state === 'ready')) return 'ready'
  if (states.every((state) => state === 'unavailable')) return 'unavailable'
  return 'mixed'
}

export function projectAccountDecisionModule(world: ReadyWorld, module: AccountDecisionModule) {
  const snapshot = world.run.snapshot
  const allSlots = projectAccountDecisionCapabilitySlots(snapshot, world.status === 'stale')
  const slots = accountDecisionModuleCapabilities[module].map((capability) => allSlots[capability])
  const state = moduleState(slots.map((item) => item.state))
  const unavailableCount = slots.filter((item) => item.state === 'unavailable').length
  const partialCount = slots.filter((item) => item.state === 'partial').length
  const cultivationSlot = slots.find((item) => item.id === 'cultivation_priority')
  const summary =
    state === 'stale'
      ? '账户资料已有变化；旧培养顺序仍保留，重新分析前不作为当前建议。'
      : state === 'ready'
        ? (cultivationSlot?.summary ?? '当前页面所需的账户决策已经准备好。')
        : `已准备好的建议仍可查看；${partialCount} 项范围有限，${unavailableCount} 项尚缺完整依据。`
  return {
    module,
    runId: world.run.runId,
    fingerprint: snapshot.fingerprint.inputHash,
    state,
    summary,
    slots,
    blockers: slots.flatMap((item) => item.blockers),
    nextAction: world.nextAction,
  }
}

export function projectAgentDecision(world: ReadyWorld, agentId: string) {
  const snapshot = world.run.snapshot
  const allocation = snapshot.allocation.global.find((item) => item.agentId === agentId) ?? null
  const teams = snapshot.teamEngine.recommendations.filter((team) =>
    team.memberIds.includes(agentId),
  )
  const warehouseFitCount = snapshot.warehouse.decisions.filter((decision) =>
    decision.fitAgentIds.includes(agentId),
  ).length
  const authority = snapshot.decisionAuthority
  const authorityRecommendation =
    authority.status === 'ready'
      ? (authority.agentRecommendations.find((item) => item.agentId === agentId) ?? null)
      : null
  const modeled = authorityRecommendation !== null
  const status: DecisionClaimStatus | 'stale' =
    world.status === 'stale'
      ? 'stale'
      : modeled
        ? authorityRecommendation.confidence === 'high'
          ? 'formal'
          : 'candidate'
        : 'unsupported'
  const summary =
    status === 'stale'
      ? '账户资料已变化；保留较早快照中的角色结论，等待显式重新分析。'
      : !modeled
        ? '当前还没有包含该代理人的完整三人队伍建议。'
        : `${cultivationPriorityLabel(authorityRecommendation.cultivationPriority)} · ${authorityRecommendation.teamRating === 'Experimental' ? '队伍强弱尚不确定' : `队伍 ${authorityRecommendation.teamRating} 档`}`
  return {
    agentId,
    runId: world.run.runId,
    fingerprint: snapshot.fingerprint.inputHash,
    status,
    summary,
    allocation,
    teams,
    warehouseFitCount,
    authorityRecommendation,
    nextAction: world.nextAction,
  }
}

function cultivationPriorityLabel(tier: string) {
  if (tier === 'ready_now') return '现在可用'
  if (tier === 'short_upgrade') return '短期补强'
  if (tier === 'strategic_build') return '需要持续培养'
  return '培养建议待补充'
}
