import type { RosterAgent } from '../assault/types'

type SkillKey = keyof RosterAgent['skillLevels']

/**
 * A narrow consumer projection of existing 3.1 L3 candidate evidence.
 *
 * The community guide establishes which skill families should receive investment, while the
 * structured skill records establish the associated mechanics. Neither source states individual
 * target levels, so this carries no inferred Lv.12 targets. The separately sourced
 * low-investment exception below uses the user's level-7 budget convention.
 */
const remielleSkillGuidanceCandidate = {
  agentId: 'agent-remielle',
  gameVersion: '3.1',
  status: 'candidate' as const,
  primaryPriority: ['basic', 'assist', 'chain', 'core'] as readonly SkillKey[],
  supplementalSkills: ['special'] as readonly SkillKey[],
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
    '3.1 社区候选映射技能投资方向；常规后台玩法的闪避低投入结论另经两篇攻略核对，7级为用户指定预算默认。其余省略技能不自动生成等级。',
} as const

export function getRemielleSkillGuidanceCandidate(agentId: string) {
  return agentId === remielleSkillGuidanceCandidate.agentId ? remielleSkillGuidanceCandidate : null
}
