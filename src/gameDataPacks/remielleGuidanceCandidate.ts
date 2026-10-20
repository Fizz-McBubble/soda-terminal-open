import type { RosterAgent } from '../assault/types'

type SkillKey = keyof RosterAgent['skillLevels']

/**
 * A narrow consumer projection of existing 3.1 L3 candidate evidence.
 *
 * The community guide establishes which skill families should receive investment, while the
 * structured skill records establish the associated mechanics. The archived author's explicit
 * maximum targets are separate from priority order and effective cinema-boosted levels.
 * The separately sourced
 * low-investment exception below uses the user's level-7 budget convention.
 */
const remielleSkillGuidanceCandidate = {
  agentId: 'agent-remielle',
  gameVersion: '3.1',
  status: 'candidate' as const,
  primaryPriority: ['basic', 'assist', 'chain', 'core'] as readonly SkillKey[],
  supplementalSkills: ['special'] as readonly SkillKey[],
  explicitTargets: {
    combatMaximumSkills: ['basic', 'assist', 'special', 'chain'] as readonly SkillKey[],
    combatTargetBasis: 'paid_base_maximum',
    core: 'F',
    source: {
      id: 'miyoushe-77017654-explicit-skill-maximums',
      url: 'https://www.miyoushe.com/zzz/article/77017654',
      sourceVersion: '3.1',
      checkedAt: '2026-10-19',
      contentHash: '61077E8797FA13E43CF1BB22398D6F945B468A6057A92BD5B541A7004F302003',
      ledgerSha256: 'BB7556959A2E4FB7ED28DBE9AC7F63C3ACCE7C485836138198ACBC53873A21B5',
      locators: ['77017654:text:0013', '77017654:text:0014', '77017654:text:0015'],
      localReviewVersion: '3.2',
      localReviewScope: 'explicit maximum target and skill-family mapping; not investment order',
    },
  },
  // Guides establish low investment value in the usual off-field rotation;
  // level 7 is the user's Soda budget default, not a quoted guide target.
  lowInvestmentSkills: ['dodge'] as readonly SkillKey[],
  lowInvestmentEvidence: {
    gameVersion: '3.1',
    observedAt: '2026-09-12',
    adoption: 'wrap_or_adapt',
    targetOrigin: 'user_budget_default',
    targetLevel: 7,
    scope: '常规后台流转玩法；不将技能缺失、出场时间短或倍率存在单独视作低收益证据。',
    rationale: '闪避不参与该玩法的主要资源获取和输出循环，可暂缓继续投入。',
    sources: [
      {
        url: 'https://www.icy-veins.com/zenless-zone-zero/remielle-dan-guide-best-builds',
        updatedAt: '2026-07-28',
        section: "Remielle Dan's Skill Priority",
      },
      {
        url: 'https://mobalytics.gg/zzz/builds/remielle-build-guide',
        updatedAt: '2026-08-07',
        section: 'Dodges, Chain & Ultimate',
      },
    ],
  },
  sources: [
    {
      recordId: 'fact-miyoushe-3.1-2894001a55fd34b3544e',
      fieldPath: 'investment.skills.upgrade_priority',
      sourceId: 'miyoushe-3.1-post-77017654-author-79695828',
    },
    {
      recordId: 'fact-miyoushe-3.1-ee0f4caf0940bd92d455',
      fieldPath: 'build.progression',
      sourceId: 'miyoushe-3.1-post-77017654-author-79695828',
    },
    {
      recordId: 'fact-remielle-basic4-buildup',
      fieldPath: 'skill.basic.leap.hit4.lumiflux_buildup',
      sourceId: 'gachabase-remielle-3.1.12',
    },
    {
      recordId: 'fact-remielle-chain-buildup',
      fieldPath: 'skill.chain.interwoven_dance.lumiflux_buildup',
      sourceId: 'gachabase-remielle-3.1.12',
    },
    {
      recordId: 'fact-remielle-flower-cost',
      fieldPath: 'skill.assist.flower_feather.floating_radiance_cost',
      sourceId: 'gachabase-remielle-3.1.12',
    },
  ],
  boundary:
    '3.1 社区候选分别记录技能投资方向与原文明示的升满目标；满级按付费基础上限解释，有效等级须用实际影画换算，不据此解决当前来源排序冲突。常规后台玩法的闪避7级仍为用户预算默认。',
} as const

export function getRemielleSkillGuidanceCandidate(agentId: string) {
  return agentId === remielleSkillGuidanceCandidate.agentId ? remielleSkillGuidanceCandidate : null
}
