import type { RosterAgent } from '../assault/types'

export const regularAgentSkillFields = ['basic', 'dodge', 'assist', 'special', 'chain'] as const

export type RegularAgentSkillField = (typeof regularAgentSkillFields)[number]

type RegularAgentSkillLevels = Pick<RosterAgent['skillLevels'], RegularAgentSkillField>

export type AgentProgressionRule = {
  id: string
  mindscapeThreshold: number
  skillMax: number
  sourceVersion: string
}

export const agentProgressionRules: AgentProgressionRule[] = [
  { id: 'general-m6-skill-cap', mindscapeThreshold: 6, skillMax: 16, sourceVersion: '3.0' },
  { id: 'general-skill-cap', mindscapeThreshold: 0, skillMax: 12, sourceVersion: '3.0' },
]

export function getAgentSkillMax(mindscape: number) {
  return mindscape >= 6 ? 16 : 12
}

/** M3 and M5 each raise all five regular skills by two levels; M6 expands the editable cap. */
export function getMindscapeSkillLevelBonus(_field: RegularAgentSkillField, mindscape: number) {
  return (mindscape >= 3 ? 2 : 0) + (mindscape >= 5 ? 2 : 0)
}

export function getAgentSkillMaxFor(field: RegularAgentSkillField, mindscape: number) {
  if (mindscape >= 6) return 16
  return 12 + getMindscapeSkillLevelBonus(field, mindscape)
}

/**
 * The accepted account projection keeps the existing A-rank M6 default of 15
 * for every regular skill. Other baselines start at 11 and receive the M3/M5
 * bonuses that apply to all regular skills.
 */
export function getDefaultAgentSkillLevels(rarity: string | null, mindscape: number) {
  if (rarity === 'A' && mindscape >= 6) {
    return { basic: 15, dodge: 15, assist: 15, special: 15, chain: 15 }
  }
  return applyMindscapeSkillLevelChange(
    { basic: 11, dodge: 11, assist: 11, special: 11, chain: 11 },
    0,
    mindscape,
  )
}

/** Stored skill levels are effective levels; apply only the M3/M5 delta. */
export function applyMindscapeSkillLevelChange<T extends RegularAgentSkillLevels>(
  skillLevels: T,
  previousMindscape: number,
  nextMindscape: number,
): T {
  return regularAgentSkillFields.reduce(
    (next, field) => {
      const current = skillLevels[field]
      if (current === null) return next
      const delta =
        getMindscapeSkillLevelBonus(field, nextMindscape) -
        getMindscapeSkillLevelBonus(field, previousMindscape)
      next[field] = Math.max(1, current + delta)
      return next
    },
    { ...skillLevels },
  )
}

/**
 * Correct exact fingerprints written by the former split-skill rule without
 * guessing at legitimate custom values. Hydration stays read-only; a later
 * explicit player save persists the corrected record.
 */
export function repairLegacyMindscapeSkillLevels<T extends RegularAgentSkillLevels>(
  rarity: string | null,
  mindscape: number,
  skillLevels: T,
): T {
  const isOldSplitProjection =
    skillLevels.basic === 13 &&
    skillLevels.dodge === 13 &&
    skillLevels.assist === 13 &&
    skillLevels.special === 11 &&
    skillLevels.chain === 11
  const isOldARankBaselineProjection =
    rarity === 'A' &&
    skillLevels.basic === 15 &&
    skillLevels.dodge === 15 &&
    skillLevels.assist === 15 &&
    skillLevels.special === 14 &&
    skillLevels.chain === 14
  if (!isOldSplitProjection && !isOldARankBaselineProjection) return skillLevels
  const correctedLevel = mindscape >= 5 ? 15 : 13
  return {
    ...skillLevels,
    basic: correctedLevel,
    dodge: correctedLevel,
    assist: correctedLevel,
    special: correctedLevel,
    chain: correctedLevel,
  }
}

export function getSkillOverflow(agent: Pick<RosterAgent, 'mindscape' | 'skillLevels'>) {
  return (
    Object.entries(agent.skillLevels) as Array<[keyof RosterAgent['skillLevels'], number | null]>
  )
    .filter(
      ([field, value]) =>
        field !== 'core' && value !== null && value > getAgentSkillMaxFor(field, agent.mindscape),
    )
    .map(([field]) => field)
}
