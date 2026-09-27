import type { AccountDecisionSnapshot, DecisionClaim } from './accountDecisionService'

export const accountDecisionCapabilityIds = [
  'account_scope',
  'current_data',
  'build_guidance',
  'agent_cultivation',
  'team_rating',
  'cultivation_priority',
  'warehouse_actions',
  'save_restore',
] as const
export type AccountDecisionCapabilityId = (typeof accountDecisionCapabilityIds)[number]
export type AccountDecisionCapabilityState = 'ready' | 'partial' | 'unavailable' | 'stale' | 'error'

export type AccountDecisionCapabilitySlot = {
  id: AccountDecisionCapabilityId
  label: string
  state: AccountDecisionCapabilityState
  summary: string
  blockers: string[]
  fingerprint: string
}

function claimState(claim: DecisionClaim): AccountDecisionCapabilityState {
  return claim.status === 'formal' || claim.status === 'candidate'
    ? 'ready'
    : claim.status === 'limited'
      ? 'partial'
      : 'unavailable'
}

function slot(
  snapshot: AccountDecisionSnapshot,
  id: AccountDecisionCapabilityId,
  label: string,
  state: AccountDecisionCapabilityState,
  summary: string,
  blockers: readonly string[] = [],
): AccountDecisionCapabilitySlot {
  return {
    id,
    label,
    state,
    summary,
    blockers: [...new Set(blockers)],
    fingerprint: `${snapshot.fingerprint.inputHash}:${id}`,
  }
}

export function projectAccountDecisionCapabilitySlots(
  snapshot: AccountDecisionSnapshot,
  stale = false,
): Record<AccountDecisionCapabilityId, AccountDecisionCapabilitySlot> {
  const owned = snapshot.explanation.ownedAgentCount
  const authority = snapshot.decisionAuthority
  const authorityReady = authority.status === 'ready'
  const ratedCount = authority.coverage.ratedFormationCount
  const recommendationCount = authorityReady ? authority.recommendations.length : 0
  const agentRecommendationCount = authorityReady ? authority.agentRecommendations.length : 0
  const agentCultivationState =
    !authorityReady || agentRecommendationCount === 0
      ? 'unavailable'
      : agentRecommendationCount >= owned
        ? 'ready'
        : 'partial'
  const teamRatingState = !authorityReady || ratedCount === 0 ? 'unavailable' : 'ready'
  const cultivationPriorityState =
    !authorityReady || recommendationCount === 0 ? 'unavailable' : 'ready'
  const authorityBlockers = authority.status === 'blocked' ? authority.blockers : []
  const slots = {
    account_scope: slot(
      snapshot,
      'account_scope',
      '账户范围',
      'ready',
      '当前 Decision Run 已绑定具名本地账户。',
    ),
    current_data: slot(
      snapshot,
      'current_data',
      '3.1 当前资料',
      claimState(snapshot.claims.data),
      snapshot.claims.data.summary,
      snapshot.claims.data.blockers,
    ),
    build_guidance: slot(
      snapshot,
      'build_guidance',
      '构筑与实体分配',
      claimState(snapshot.claims.allocation),
      snapshot.claims.allocation.summary,
      snapshot.claims.allocation.blockers,
    ),
    agent_cultivation: slot(
      snapshot,
      'agent_cultivation',
      '代理人培养顺序',
      agentCultivationState,
      agentRecommendationCount
        ? `${agentRecommendationCount}/${owned} 名已拥有代理人已关联到账户培养优先级。`
        : '当前还没有可关联到代理人的完整三人队伍建议。',
      authorityBlockers,
    ),
    team_rating: slot(
      snapshot,
      'team_rating',
      '队伍强度',
      teamRatingState,
      ratedCount
        ? `${ratedCount} 支合法编队已进入 Team Rating；Benchmark 只作为证据并单独标记置信度。`
        : '当前还没有可评级的完整三人编队。',
      authorityBlockers,
    ),
    cultivation_priority: slot(
      snapshot,
      'cultivation_priority',
      '账户培养优先级',
      cultivationPriorityState,
      recommendationCount
        ? `${recommendationCount} 支队伍已按 Team Rating、完成度、投入成本、资产冲突与覆盖增益形成培养顺序。`
        : '当前还没有可执行的账户培养顺序。',
      authorityBlockers,
    ),
    warehouse_actions: slot(
      snapshot,
      'warehouse_actions',
      '仓库行动',
      snapshot.explanation.warehouseCoverageComplete ? 'ready' : 'partial',
      snapshot.claims.warehouse.summary,
      snapshot.claims.warehouse.blockers,
    ),
    save_restore: slot(
      snapshot,
      'save_restore',
      '保存与恢复',
      'ready',
      '账户、方案与备份继续使用具名本地写入边界。',
    ),
  } satisfies Record<AccountDecisionCapabilityId, AccountDecisionCapabilitySlot>
  if (!stale) return slots
  return Object.fromEntries(
    Object.entries(slots).map(([id, value]) => [
      id,
      {
        ...value,
        state: 'stale',
        blockers: [...value.blockers, 'Decision Run 已 stale，需显式重新分析。'],
      },
    ]),
  ) as Record<AccountDecisionCapabilityId, AccountDecisionCapabilitySlot>
}

export const accountDecisionModuleCapabilities = {
  home: [
    'account_scope',
    'current_data',
    'build_guidance',
    'agent_cultivation',
    'team_rating',
    'cultivation_priority',
    'warehouse_actions',
  ],
  scan_import: ['account_scope', 'current_data'],
  assets: ['account_scope', 'current_data', 'build_guidance'],
  development: ['current_data', 'build_guidance', 'agent_cultivation'],
  box: ['current_data', 'build_guidance', 'team_rating', 'cultivation_priority'],
  warehouse: ['current_data', 'warehouse_actions'],
  save_restore: ['account_scope', 'save_restore'],
} as const satisfies Record<string, readonly AccountDecisionCapabilityId[]>
