import { playerErrorMessage } from './playerErrorMessage'

export type WarehouseMatchFeedback = { summary: string; details: string[] }

/** Keep solver diagnostics intact while grouping repeated inventory gaps for players. */
export function warehouseMatchFeedback(
  gaps: readonly string[],
  fallback = '当前仓库暂不能组成完整配装，请补充驱动盘后重试。',
): WarehouseMatchFeedback {
  const messages = [...new Set(gaps.map((gap) => gap.trim()).filter(Boolean))]
  const slots: number[] = []
  const details: string[] = []
  for (const message of messages.slice(1)) {
    const missingSlot = /^([1-6])号位没有(?:推荐套装的驱动盘|该场景允许的套装盘)[。.]?$/.exec(
      message,
    )
    if (missingSlot) slots.push(Number(missingSlot[1]))
    else if (!/^(?:补充对应套装\/号位库存|该角色自身尚无完整合法套装)/.test(message))
      details.push(playerErrorMessage(message, '该条件尚未满足，请调整后重试。'))
  }
  if (slots.length)
    details.unshift(
      `缺少推荐套装的号位：${slots.length === 6 ? '1–6' : [...new Set(slots)].sort().join('、')}号。`,
    )
  const summary = /^当前仓库暂不满足推荐套装与六个号位的组合/.test(messages[0] ?? '')
    ? '当前仓库还不能组成完整配装，请补充推荐套装的驱动盘。'
    : playerErrorMessage(messages[0], fallback)
  return { summary, details: [...new Set(details)] }
}

export class WarehouseMatchError extends Error {
  readonly feedback: WarehouseMatchFeedback
  constructor(gaps: readonly string[]) {
    const feedback = warehouseMatchFeedback(gaps)
    super(feedback.summary)
    this.name = 'WarehouseMatchError'
    this.feedback = feedback
  }
}

export function warehouseActionFeedback(error: unknown): WarehouseMatchFeedback {
  return error instanceof WarehouseMatchError
    ? error.feedback
    : { summary: playerErrorMessage(error, '搭配未完成，请重新分析后重试。'), details: [] }
}
