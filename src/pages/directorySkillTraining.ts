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
  const targeted = (input.decision?.skills ?? []).filter((skill) => skill.targetLevel !== null)
  if (!targeted.length) return { status: 'no-target', nextTrainingSteps: [] }
  const knownGaps = targeted
    .filter((skill) => {
      const current = input.agent.skillLevels[skill.key]
      return current !== null && current !== undefined && current < skill.targetLevel!
    })
    .sort((left, right) => Number(right.priority) - Number(left.priority))
  const hasUnknown = targeted.some((skill) => {
    const current = input.agent.skillLevels[skill.key]
    return current === null || current === undefined
  })
  return {
    status: hasUnknown ? 'unknown' : knownGaps.length ? 'has-gaps' : 'complete',
    nextTrainingSteps: knownGaps.map(
      (skill) =>
        `${skill.label} ${input.agent.skillLevels[skill.key]} → ${
          skill.recommended ? presentationTargetLevel(skill.recommended) : String(skill.targetLevel)
        }级`,
    ),
  }
}
