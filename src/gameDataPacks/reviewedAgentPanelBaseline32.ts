import { stableContentHash } from './types'
import ruptureResourceFacts from './data/reviewed-rupture-resource-panel.3.3.json'

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

// These are character-specific out-of-combat base values, not the named
// combat resources (e.g. determination or blazing heart), or combat effects.
// Gachabase release data and the 3.2 optimizer panel list these separately;
// BWiki entries and Yixuan's archived game screenshot provide additional
// checks. The 3.2 -> 3.3 source delta records no numeric changes to the five
// existing identities. Manato's zero is an observed value, not a missing one.
const ruptureAdrenalineRegen: Readonly<Record<string, number>> = Object.freeze({
  'agent-yixuan': 2,
  'agent-banyue': 2,
  'agent-yidhari': 2,
  'agent-starlight-billy': 2,
  'agent-manato': 0,
})

export function getReviewedRuptureAdrenalineRegen(agentId: string): number | undefined {
  return ruptureAdrenalineRegen[agentId]
}
export function getReviewedRuptureResourceBaseline(agentId: string) {
  return ruptureResourceFacts.records.find((record) => record.stableId === agentId)
}

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
