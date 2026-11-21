import { developmentSkillRecommendations } from './developmentSkillRecommendations'
import { selectDevelopmentSkillTargets } from './developmentSkillTargetSelection'
import type { RosterAgent } from '../assault/types'
import {
  getCurrentBuildAuthorityProfile,
  getCurrentPotentialSkillReference,
} from '../gameDataPacks/currentBuildAuthority'

/** Source-backed per-agent targets; no account decision authority is implied. */
export function projectDevelopmentDirectorySourceTargets(record: RosterAgent) {
  const agentId = record.agentId
  const guidance = developmentSkillRecommendations(record)
  const skillTargets = selectDevelopmentSkillTargets({
    potential: record.potentialImage,
    mindscape: record.mindscape,
    skills: guidance.skills,
    potentialReference: getCurrentPotentialSkillReference(agentId),
    priorityGroups: guidance.priorityGroups,
  })
  const field = getCurrentBuildAuthorityProfile(agentId)?.guidance.fields.find(
    (item) => item.fieldId === 'progression.skill_core_cinema',
  )
  const value =
    field?.state === 'ready' && field.value && typeof field.value === 'object'
      ? (field.value as { cinema?: { recommendedLevels?: unknown } })
      : null
  const levels = value?.cinema?.recommendedLevels
  return {
    agentId,
    cinemaLevels: Array.isArray(levels)
      ? levels.filter(
          (level): level is number => Number.isInteger(level) && level >= 1 && level <= 6,
        )
      : null,
    skillPriorityGroups: skillTargets.priorityGroups,
    skills: skillTargets.skills.map(
      ({
        key,
        label,
        targetLevel,
        baseTargetLevel,
        recommended,
        targetType,
        exactTarget,
        minimumReference,
        sodaDerived,
        priority,
        nextLevel,
      }) => ({
        key,
        label,
        targetLevel,
        baseTargetLevel,
        recommended,
        targetType,
        exactTarget,
        minimumReference,
        sodaDerived,
        priority,
        nextLevel: nextLevel ?? null,
      }),
    ),
  }
}
