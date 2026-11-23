import type { RosterAgent } from '../assault/types'
import { developmentSkillRecommendations } from '../application/developmentSkillRecommendations'

export function inspectSkillInvestments(
  agent:
    | (Pick<RosterAgent, 'agentId' | 'level' | 'skillLevels' | 'lockedFields'> & {
        mindscape?: number | null
      })
    | undefined,
) {
  if (!agent) return { knownGapCount: 7, unknownCount: 0 }
  const skills = developmentSkillRecommendations(agent).skills
  let knownGapCount = agent.level >= 60 ? 0 : 1
  let unknownCount = 0
  for (const skill of skills) {
    const current = agent.skillLevels[skill.key]
    if (current === null || current === undefined || skill.targetLevel === null) {
      unknownCount++
      continue
    }
    if (current < skill.targetLevel) knownGapCount++
  }
  return { knownGapCount, unknownCount }
}
