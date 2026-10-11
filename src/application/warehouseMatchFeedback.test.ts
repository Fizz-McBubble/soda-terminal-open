import { describe, expect, it } from 'vitest'
import {
  warehouseActionFeedback,
  warehouseMatchFeedback,
  WarehouseMatchError,
} from './warehouseMatchFeedback'

describe('warehouse matching feedback', () => {
  it('groups six repeated slot gaps and keeps an independent condition available', () => {
    const gaps = [
      '当前仓库暂不满足推荐套装与六个号位的组合；请补充以下库存后重新搭配。',
      ...[1, 2, 3, 4, 5, 6].map((slot) => `${slot}号位没有推荐套装的驱动盘。`),
      '补充对应套装/号位库存',
      '该角色自身尚无完整合法套装，因此不是被其他角色抢盘导致。',
      '需要另一名支援代理人满足额外能力。',
    ]
    const feedback = warehouseActionFeedback(new WarehouseMatchError(gaps))
    expect(feedback.summary).toBe('当前仓库还不能组成完整配装，请补充推荐套装的驱动盘。')
    expect(feedback.details).toEqual([
      '缺少推荐套装的号位：1–6号。',
      '需要另一名支援代理人满足额外能力。',
    ])
    expect(gaps).toHaveLength(10)
  })

  it('retains empty inventory, conflict and request failures as actionable messages', () => {
    for (const summary of [
      '当前账户还没有驱动盘，请先扫描或导入仓库。',
      '当前固定或排除条件下没有完整配装；可取消冲突条件后重新搭配。',
    ])
      expect(warehouseMatchFeedback([summary])).toEqual({ summary, details: [] })
    expect(warehouseActionFeedback(new Error('网络暂不可用，请重试。')).summary).toBe(
      '网络暂不可用，请重试。',
    )
    expect(warehouseActionFeedback(new Error('TypeError stack')).summary).toBe(
      '搭配未完成，请重新分析后重试。',
    )
  })
})
