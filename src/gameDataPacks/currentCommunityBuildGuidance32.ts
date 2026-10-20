import type { AgentProfileField } from './agentProfileFieldProjection'

/**
 * Minimal 3.2 facts transcribed from HoyoBuild's Remielle build page.
 * The content hash binds the retrieved page response bytes, not a copied page
 * or a claim that HoyoBuild's recommendation is a global optimum.
 */
export const remielleHoyoBuild32Source = Object.freeze({
  id: 'hoyobuild-remielle-build-3.2-2026-09-24',
  url: 'https://hoyobuild.com/en/zzz/characters/remielle',
  sourceVersion: '3.2',
  checkedAt: '2026-10-19',
  contentHash: 'CF52554D18DAA9F11D8C02E311A529A7DAD76ACF68A42B9C06A82EB6B154E437',
  licenseBoundary:
    '事实字段最小投影；仅采用队伍/邦布身份与页面明确的候选优先级，不复制正文或媒体。社区推荐保持候选，不代表全局最优或账户默认。',
})

const sourceRefs = [remielleHoyoBuild32Source]

export const remielleCurrentTeamBangbooGuidance32: AgentProfileField = {
  group: 'build_guidance',
  path: 'build.team_bangboo_scenario',
  value: {
    sourceScenario: 'premium_anomaly_team',
    memberIds: ['agent-remielle', 'agent-promeia', 'agent-velina'],
    recommendedBangbooIds: ['bangboo-ariel', 'bangboo-birkblick', 'bangboo-ultra-jake'],
    scenarioBoundary: '仅为该页面列出的Premium Anomaly组合与邦布候选；不自动选用或外推到不同队伍。',
  },
  status: 'candidate',
  gameVersion: '3.2',
  originalSourceVersion: '3.2',
  lastChangeVersion: '3.2',
  currentApplicability: 'continuous',
  sourceRefs: sourceRefs.map((source) => ({ ...source })),
  verifiedAt: '2026-10-19',
  conflict: null,
  reason:
    '当前3.2社区攻略明确列出蕾米埃尔·普罗米娅·维丽娜队伍，并将Ariel、Birkblick、Ultra Jake列为邦布候选。',
  conditions: [
    'HoyoBuild页面标记为Version 3.2，页面更新日期为2026-09-24；该字段是攻略候选而非全局强度排序。',
  ],
}

export const remielleCurrentProgressionEvidence32 = Object.freeze({
  skillPriorityCandidate: [
    'core_skill',
    'chain_attack',
    'basic_attack',
    'assist',
    'special_attack',
    'dodge',
  ],
  mindscapePriorityCandidate: [
    { level: 1, label: 'big_upgrade' },
    { level: 2, label: 'big_upgrade' },
    { level: 6, label: 'solid_upgrade' },
  ],
  sourceRefs: sourceRefs.map((source) => ({ ...source })),
  boundary:
    'HoyoBuild 3.2候选顺序；Prydwen当前蕾米埃尔页的技能优先区未列Core Skill且链击顺序不同，故保留为冲突候选，不作为已闭合技能/核心/影画指导。',
})
