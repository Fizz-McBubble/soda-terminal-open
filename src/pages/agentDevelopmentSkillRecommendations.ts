import { getRemielleSkillGuidanceCandidate } from '../gameDataPacks/remielleGuidanceCandidate'
import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import { fieldTimeIndependentSkillInvestment } from '../calculation/skillInvestmentPolicy'
import {
  skillLabels,
  skillPriorityWithLegacyFallback,
  skillTargetsFromDirections,
} from './agentDevelopmentWorkbenchModel'

/** One target policy for the directory's next step and the workbench's skill table. */
export function agentDevelopmentSkillRecommendations(
  agentId: string,
  directions: readonly string[],
  legacyPriority: readonly string[],
) {
  const remielle = getRemielleSkillGuidanceCandidate(agentId)
  const targets = skillTargetsFromDirections(directions)
  const priority = (
    remielle?.primaryPriority ?? skillPriorityWithLegacyFallback(directions, legacyPriority)
  ).filter((key): key is keyof typeof skillLabels => key in skillLabels)
  const contract = getCurrentAgentEventContract(agentId)
  const scalable = new Set(contract?.eventContract.events.map((event) => event.skill) ?? [])
  const skills = Object.entries(skillLabels).map(([rawKey, label]) => {
    const key = rawKey as keyof typeof skillLabels
    const index = priority.indexOf(key)
    const investment = fieldTimeIndependentSkillInvestment({
      skill: key,
      priorityIndex: index >= 0 ? index : null,
      explicitPrimary: remielle?.primaryPriority.includes(key) ?? false,
      explicitSupplemental: remielle?.supplementalSkills.includes(key) ?? false,
      hasScalableMechanic: key === 'core' ? Boolean(contract) : scalable.has(key),
    })
    const explicit = targets[key]
    const lowInvestment = remielle?.lowInvestmentSkills.includes(key) ?? false
    const sourcedTargetLevel =
      explicit === 'F'
        ? 7
        : explicit
          ? Number(explicit.replace('+', ''))
          : lowInvestment
            ? remielle!.lowInvestmentEvidence.targetLevel
            : priority.length
              ? investment.targetLevel
              : null
    const targetLevel = Math.max(7, sourcedTargetLevel ?? 7)
    return {
      key,
      label,
      targetLevel,
      recommended:
        sourcedTargetLevel === null || sourcedTargetLevel < 7
          ? '7'
          : (explicit ?? (lowInvestment ? '可保持 7' : investment.label)),
      priority: investment.band === 'max_priority',
    }
  })
  return { targets, priority, skills }
}
