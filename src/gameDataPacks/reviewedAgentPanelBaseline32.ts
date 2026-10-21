import { stableContentHash } from './types'

const reviewedAgentPanelBaselineSource = Object.freeze({
  id: 'zzz-data-mechanics-energy-baseline-2025-07-11',
  url: 'https://news.17173.com/content/07112025/114804086.shtml',
  title: '《绝区零》绝区零数据机制导论（2.0版）',
  sourceVersion: '2.0',
  checkedAt: '2025-07-11',
  contentHash: '6D0B2DBD84DAD9F853DF168A59A47939967BB8BBC2CEBC29077F531075DB6FAA',
  locator: 'PART 04 能量系统，4.1「能量」',
})

const normalEnergyBaseline = Object.freeze({
  generationRate: 100,
  maxEnergy: 120,
  applicability:
    '仅适用于使用普通能量且来源基础数据存在正数能量自动回复的代理人；不适用于闪能、锐能或其他具名资源。',
})

export const reviewedAgentPanelBaseline32 = Object.freeze({
  contract: 'soda-reviewed-agent-panel-baseline/1',
  normalEnergy: normalEnergyBaseline,
  source: reviewedAgentPanelBaselineSource,
  boundary:
    '能量获得效率与能量上限是独立面板字段；基础百分百效率不等于能量自动回复倍率，基础上限也不从能量消耗、技能容量或特殊资源常量推导。',
  identity: stableContentHash({
    normalEnergy: normalEnergyBaseline,
    source: reviewedAgentPanelBaselineSource,
  }),
})
