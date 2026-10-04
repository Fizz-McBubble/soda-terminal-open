import { describe, expect, it } from 'vitest'
import { playerErrorMessage } from './playerErrorMessage'

describe('player errors', () => {
  it.each([
    '代理人 agent-claret 缺少可绑定套装分支的候选约束。',
    'Unsupported Calculation/Query contract: source-v1',
    '资料 schema 校验失败',
    "soda-source-ref:900989a2058dc6e8a331ee45b6ba5921",
    '同源校验未通过',
    '{"message":"没有数据","schema":"internal-v1"}',
  ])('does not display internal detail: %s', (message) => {
    expect(playerErrorMessage(new Error(message), '请重新分析后再试。')).toBe('请重新分析后再试。')
  })
  it.each([
    '请先补齐 6 个号位。',
    '保存失败，请重试。',
    '请先选择当前账户。',
    '当前结果已过期，请重新分析。',
  ])('preserves actionable information: %s', (message) => {
    expect(playerErrorMessage(new Error(message), '请重试。')).toBe(message)
  })
})
