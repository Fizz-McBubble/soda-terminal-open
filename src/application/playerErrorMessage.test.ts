import { describe, expect, it } from 'vitest'
import { playerErrorMessage } from './playerErrorMessage'

describe('player errors', () => {
  it.each([
    '代理人 agent-claret 缺少可绑定套装分支的候选约束。',
    '驱动盘 disc-42 不在当前账户中，请刷新后重试。',
    '操作失败：discId=81234，请重试。',
    '候选 candidate-7 已失效，请重新分析。',
    '无法继续：candidateId=abc_7，请重新分析。',
    'Unsupported Calculation/Query contract: source-v1',
    '资料 schema 校验失败',
    '结果结构不符合当前资产快读合同，未写入账户。',
    'TypeError: 无法读取方案，请重试。',
    'Internal Server Error：请稍后重试。',
    '请求失败\n    at loadPlan (plan.ts:10:2)',
    "soda-source-ref:900989a2058dc6e8a331ee45b6ba5921",
    '读取失败 https://example.invalid/candidate/candidate-7',
    '账户 7c9e6679-7425-40de-944b-e07fc1f90ae7 无法读取，请重新登录。',
    '同源校验未通过',
    '内部异常：无法保存',
    '{"message":"没有数据","schema":"internal-v1"}',
    '{"message":"请重试","candidateId":"candidate-7"}',
  ])('does not display internal detail: %s', (message) => {
    expect(playerErrorMessage(new Error(message), '请重新分析后再试。')).toBe('请重新分析后再试。')
  })
  it.each([
    '请先补齐 6 个号位。',
    '保存失败，请重试。',
    '请先选择当前账户。',
    '当前结果已过期，请重新分析。',
    '没有找到可用的驱动盘，请调整主词条后重试。',
    '该方案当前无法保存，请确认名称后重试。',
  ])('preserves actionable information: %s', (message) => {
    expect(playerErrorMessage(new Error(message), '请重试。')).toBe(message)
  })
  it('sanitizes string errors through the same player-facing boundary', () => {
    expect(playerErrorMessage('保存失败 candidate-7，请重试。', '保存失败，请稍后重试。')).toBe(
      '保存失败，请稍后重试。',
    )
  })
  it.each([null, undefined, {}, new Error('Network request failed')])(
    'uses the fallback for non-actionable values: %s',
    (error) => {
      expect(playerErrorMessage(error, '请重新分析后再试。')).toBe('请重新分析后再试。')
    },
  )
  it('rejects messages that exceed the player-facing length limit', () => {
    expect(playerErrorMessage('请重试。'.repeat(61), '请稍后重试。')).toBe('请稍后重试。')
  })
})
