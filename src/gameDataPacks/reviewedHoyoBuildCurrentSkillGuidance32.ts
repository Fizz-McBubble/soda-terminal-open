import type { AgentProfileField } from './agentProfileFieldProjection'
import hoyoBuildSkillGuidance from './data/hoyobuild-current-skill-guidance.3.2.json'
import { stableContentHash } from './types'

const checkedAt = '2026-10-20'
const pageVersion = '3.2'

const keyToLabel = {
  core: '核心技',
  chain: '连携技',
  basic: '普攻',
  assist: '支援技',
  special: '特殊技',
  dodge: '闪避',
} as const

type SupportedSkillKey = keyof typeof keyToLabel

function sourceFor(entry: (typeof hoyoBuildSkillGuidance.entries)[number]) {
  const contentHash = stableContentHash({
    url: entry.url,
    pageVersion: entry.pageVersion,
    updatedAt: entry.updatedAt,
    talentPriority: entry.talentPriority,
    cinemaLevels: entry.cinemaLevels,
  })
  return {
    id: `hoyobuild-${entry.agentId}-skill-cinema-32-20261020`,
    url: entry.url,
    sourceVersion: pageVersion,
    originalSourceVersion: pageVersion,
    checkedAt,
    contentHash,
    verified: true,
    pageUpdatedAt: entry.updatedAt,
    retrievedAt: checkedAt,
    licenseBoundary:
      'Minimal public-page projection: six talent-priority labels and notable Mindscape level/tags only; no effect prose, tier, DPS, usage or copied article body.',
  }
}

export function getHoyoBuildCurrentSkillDirection32(agentId: string) {
  const entry = hoyoBuildSkillGuidance.entries.find((row) => row.agentId === agentId)
  if (!entry || entry.pageVersion !== pageVersion || entry.talentPriority.length !== 6) return null
  const ordered = entry.talentPriority.map((item) => item.key as SupportedSkillKey)
  const direction = `技能优先顺序：${ordered.map((key) => keyToLabel[key]).join(' > ')}`
  return {
    entry,
    source: sourceFor(entry),
    direction,
    ordered,
  }
}

export function getReviewedHoyoBuildCurrentSkillGuidance32(
  agentId: string,
): AgentProfileField | undefined {
  const guidance = getHoyoBuildCurrentSkillDirection32(agentId)
  if (!guidance) return undefined
  const { entry, source, direction, ordered } = guidance
  return {
    group: 'build_guidance',
    path: 'progression.skill_core_cinema',
    value: {
      kind: 'current_skill_core_cinema',
      sourceDirections: [direction],
      skillPriority: {
        ordered,
        remaining: 'hoyobuild_full_author_order',
        globalOrderClaimed: true,
        scope: 'hoyobuild_agent_page',
      },
      cinema: {
        recommendedLevels: entry.cinemaLevels
          .filter((row) => row.tag === 'Big upgrade')
          .map((row) => row.level),
        notableLevels: entry.cinemaLevels,
        pullOrder: null,
        status: 'key_levels_only',
      },
      numericTargetPolicy: {
        kind: 'soda_derived_from_priority',
        minimumCombatLevel: 7,
        coreCap: 7,
        boundary:
          'HoyoBuild supplies only the displayed talent order and notable Mindscape level/tags; it does not state per-skill numeric target levels.',
      },
    },
    status: 'verified_candidate',
    gameVersion: pageVersion,
    originalSourceVersion: pageVersion,
    lastChangeVersion: pageVersion,
    currentApplicability: 'continuous',
    sourceRefs: [source],
    verifiedAt: checkedAt,
    conflict: null,
    conditions: [
      '页面标记Version 3.2；仅采用Talent priority的六项顺序与Notable dupes的M等级/标签。',
      '页面没有逐技能目标数字；数值等级继续由Soda既有优先顺序策略派生，不冒充作者给出的等级。',
      '“Big upgrade”保留为recommendedLevels，“Solid upgrade/Optional”只留在notableLevels，不扩张为抽取顺序。',
    ],
    reason:
      'HoyoBuild 3.2页面明确给出当前技能优先顺序和可投资影画等级；仅作来源化养成指导，不推断账号状态或强度。',
  }
}

export const reviewedHoyoBuildCurrentSkillGuidance32 = Object.freeze({
  gameVersion: pageVersion,
  checkedAt,
  entries: hoyoBuildSkillGuidance.entries,
})
