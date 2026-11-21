import type { AgentSkillTrainingStatus } from '../features/agentDevelopmentGolden/types'
import { presentationTargetLevel } from '../features/agentDevelopmentGolden/agentDevelopmentWorkbenchPresentation'
import type { DevelopmentDirectoryDecision } from '../application/publicDevelopmentDirectoryContract'
import type { RosterAgent } from '../assault/types'

export function projectDirectorySkillTraining(input: {
  agent: Pick<RosterAgent, 'skillLevels'>
  decision?: DevelopmentDirectoryDecision
}): {
  status: AgentSkillTrainingStatus
  nextTrainingSteps: string[]
} {
  const skills = input.decision?.skills ?? []
  const targeted = skills.filter((skill) => skill.targetLevel !== null)
  if (!targeted.length) return { status: 'no-target', nextTrainingSteps: [] }
  const knownGaps = targeted
    .filter((skill) => {
      const current = input.agent.skillLevels[skill.key]
      return current !== null && current !== undefined && current < skill.targetLevel!
    })
    .sort((left, right) => {
      const groups = input.decision?.skillPriorityGroups
      if (!groups?.length) return Number(right.priority) - Number(left.priority)
      const rank = (key: typeof left.key) => {
        const index = groups.findIndex((group) => group.includes(key))
        return index < 0 ? groups.length : index
      }
      return rank(left.key) - rank(right.key)
    })
  const hasUnknown = targeted.some((skill) => {
    const current = input.agent.skillLevels[skill.key]
    return current === null || current === undefined
  })
  return {
    status: hasUnknown
      ? 'unknown'
      : skills.some((skill) => skill.targetLevel === null)
        ? 'target-unknown'
        : knownGaps.length
          ? 'has-gaps'
          : 'complete',
    nextTrainingSteps: knownGaps.map(
      (skill) =>
        `${skill.label} ${input.agent.skillLevels[skill.key]} → ${
          skill.targetType === 'minimum_reference'
            ? `≥${skill.minimumReference ?? skill.targetLevel}`
            : skill.recommended
              ? presentationTargetLevel(skill.recommended)
              : String(skill.targetLevel)
        }级`,
    ),
  }
}
