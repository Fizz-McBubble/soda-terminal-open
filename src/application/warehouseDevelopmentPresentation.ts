export type WarehouseDevelopmentAdvice = {
  kind:
    | 'review_after_enhance'
    | 'prefer_alternative'
    | 'review_finished'
    | 'verify_record'
    | 'hold_for_need'
    | 'stop_investment'
    | 'verify_use'
  currentEffectiveRolls: number | null
  optimisticEffectiveRolls: number | null
  effectiveAgentId: string | null
  remainingNodes: number | null
  nextReviewLevel: number | null
  improvingDemandAgentIds: string[]
  priority: number
}

export function compareWarehouseDevelopmentAdvice(
  left?: WarehouseDevelopmentAdvice,
  right?: WarehouseDevelopmentAdvice,
) {
  if (!left || !right) return 0
  // Effective hits from different agents are explanations, not a shared score.
  return left.priority - right.priority
}

export function warehouseDevelopmentAction(advice: WarehouseDevelopmentAdvice) {
  switch (advice.kind) {
    case 'review_after_enhance':
      return `可先强化至 +${advice.nextReviewLevel}，再复评`
    case 'prefer_alternative':
      return '优先培养同类替代盘'
    case 'review_finished':
      return '已满级，复核现有用途'
    case 'verify_record':
      return '先核对副词条记录'
    case 'hold_for_need':
      return '等待明确用途，暂缓投入'
    case 'stop_investment':
      return '不建议继续强化'
    case 'verify_use':
      return '适用条件待确认，暂缓投入'
  }
}
