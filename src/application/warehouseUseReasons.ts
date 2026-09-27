import type { WarehouseUseAssessment } from '../warehouse/warehouseUseAssessment'

/** Player-facing wording shared with the private warehouse producer. */
export const warehouseUseReasons: Record<WarehouseUseAssessment['basis'], string> = {
  active_use: '用于当前养成或已选队伍的配装。',
  quality_reserve: '词条基础较好，作为已拥有角色的优质备件保留。',
  poor_seed: '有效词条基础较弱，不建议继续投入。',
  failed_rolls: '已有至少两次强化未命中有效词条，当前收益不足，建议止损。',
  surplus: '当前需求和优质备件已由其他盘覆盖。',
  low_reserve_value: '暂无养成需求，词条未达到优质备件的保留标准。',
  no_current_use: '当前账号没有适用需求。',
  uncertain_context: '适用条件尚未确认，暂留核对。',
  invalid_record: '词条记录不完整或不一致，暂留核对。',
}
