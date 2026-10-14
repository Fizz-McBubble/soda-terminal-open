import type { RosterAgent } from '../assault/types'
import { getRemielleSkillGuidanceCandidate } from '../gameDataPacks/remielleGuidanceCandidate'
import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import { fieldTimeIndependentSkillInvestment } from '../calculation/skillInvestmentPolicy'
import { evaluateSkillInvestmentNextLevel } from '../calculation/skillInvestmentNextLevel'
import {
  projectSkillNextLevelDisplay,
  resolveSkillInvestmentMindscapeBonus,
  type SkillNextLevelDisplay,
} from '../decision/skillInvestmentProjection'
import {
  skillLabels,
  skillPrimaryPriorityWithLegacyFallback,
  skillPriorityWithLegacyFallback,
  skillTargetsFromDirections,
} from './agentDevelopmentWorkbenchModel'

export type SkillTargetType = 'exact_integer' | 'minimum_reference' | 'soda_derived'

export type AgentSkillRecommendationContext = {
  skillLevels?: RosterAgent['skillLevels']
  mindscape?: number | null
}

export type AgentSkillRecommendationItem = {
  key: keyof typeof skillLabels
  label: string
  targetLevel: number
  baseTargetLevel?: number | null
  recommended: string
  priority: boolean
  targetType: SkillTargetType
  exactTarget: number | null
  minimumReference: number | null
  sodaDerived: {
    band: string
    targetLevel: number
    baseTargetLevel?: number
    label: string
  } | null
  nextLevel?: SkillNextLevelDisplay | null
}

/** One target policy for the directory's next step and the workbench's skill table. */
export function agentDevelopmentSkillRecommendations(
  agentId: string,
  directions: readonly string[],
  legacyPriority: readonly string[],
  context?: AgentSkillRecommendationContext,
) {
  const remielle = getRemielleSkillGuidanceCandidate(agentId)
  const targets = skillTargetsFromDirections(directions)
  const knownMindscapeBonus = resolveSkillInvestmentMindscapeBonus(context?.mindscape ?? null)
  const mindscapeBonus = knownMindscapeBonus ?? 0
  const priority = (
    remielle?.primaryPriority ?? skillPriorityWithLegacyFallback(directions, legacyPriority)
  ).filter((key): key is keyof typeof skillLabels => key in skillLabels)
  const primaryPriority =
    remielle?.primaryPriority ?? skillPrimaryPriorityWithLegacyFallback(directions, legacyPriority)
  const contract = getCurrentAgentEventContract(agentId)
  const scalable = new Set(contract?.eventContract.events.map((event) => event.skill) ?? [])
  const skills: AgentSkillRecommendationItem[] = Object.entries(skillLabels).map(
    ([rawKey, label]) => {
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

      let targetLevel: number
      let baseTargetLevel: number | null = null
      let targetType: SkillTargetType
      let exactTarget: number | null = null
      let minimumReference: number | null = null
      let sodaDerived: {
        band: string
        targetLevel: number
        baseTargetLevel?: number
        label: string
      } | null = null
      let recommended: string

      if (key === 'core') {
        // 核心技独立上限 7，不得误套战斗技最低 7
        const isCoreF = explicit === 'F' || explicit === '7'
        const isCoreFMin =
          explicit === 'F+' || explicit === '7+' || explicit === '≥F' || explicit === '≥7'
        if (isCoreF) {
          targetLevel = 7
          targetType = 'exact_integer'
          exactTarget = 7
          recommended = explicit
        } else if (isCoreFMin) {
          targetLevel = 7
          targetType = 'minimum_reference'
          minimumReference = 7
          recommended = explicit
        } else if (
          explicit &&
          (explicit.includes('+') || explicit.startsWith('≥') || explicit.startsWith('>='))
        ) {
          const raw = explicit.replace('+', '').replace('≥', '').replace('>=', '').trim()
          const parsed = raw.toUpperCase() === 'F' ? 7 : Number(raw)
          const val = Number.isNaN(parsed) ? 7 : Math.min(7, Math.max(1, parsed))
          targetLevel = val
          targetType = 'minimum_reference'
          minimumReference = val
          recommended = explicit
        } else if (explicit) {
          const raw = explicit.trim()
          const parsed = raw.toUpperCase() === 'F' ? 7 : Number(raw)
          const val = Number.isNaN(parsed) ? 7 : Math.min(7, Math.max(1, parsed))
          targetLevel = val
          targetType = 'exact_integer'
          exactTarget = val
          recommended = explicit
        } else if (priority.includes('core')) {
          baseTargetLevel = Math.min(7, investment.targetLevel ?? 7)
          targetLevel = baseTargetLevel
          targetType = 'soda_derived'
          sodaDerived = {
            band: investment.band,
            targetLevel,
            baseTargetLevel,
            label: investment.label,
          }
          recommended = investment.label
        } else {
          // Retain the existing baseline policy; this is not a sourced target.
          baseTargetLevel = 7
          targetLevel = 7
          targetType = 'soda_derived'
          sodaDerived = { band: 'baseline', targetLevel: 7, baseTargetLevel: 7, label: '7' }
          recommended = '7'
        }
      } else {
        // 战斗技能：既有用户最低等级合同 Math.max(7, sourcedTargetLevel ?? 7)
        const isMinimum = Boolean(
          explicit &&
          (explicit.includes('+') || explicit.startsWith('≥') || explicit.startsWith('>=')),
        )
        if (isMinimum && explicit) {
          const raw = explicit.replace('+', '').replace('≥', '').replace('>=', '').trim()
          const parsed = Number(raw)
          const validNum = Number.isNaN(parsed) ? 7 : parsed
          targetLevel = Math.max(7, validNum)
          baseTargetLevel =
            knownMindscapeBonus === null ? null : Math.max(1, targetLevel - mindscapeBonus)
          targetType = 'minimum_reference'
          minimumReference = validNum
          recommended = explicit
        } else if (explicit) {
          const raw = explicit.trim()
          const parsed = Number(raw)
          const validNum = Number.isNaN(parsed) ? 7 : parsed
          targetLevel = Math.max(7, validNum)
          baseTargetLevel =
            knownMindscapeBonus === null ? null : Math.max(1, targetLevel - mindscapeBonus)
          targetType = 'exact_integer'
          exactTarget = validNum
          // 低于既有用户最低合同 7 时，等级升至 7
          recommended = validNum < 7 ? '7' : explicit
        } else if (lowInvestment) {
          baseTargetLevel = 7
          targetLevel = 7 + mindscapeBonus
          targetType = 'soda_derived'
          sodaDerived = {
            band: 'low_investment',
            targetLevel,
            baseTargetLevel,
            label: `可保持 ${targetLevel}`,
          }
          recommended = `可保持 ${targetLevel}`
        } else if (priority.length && investment.targetLevel !== null) {
          baseTargetLevel = Math.max(7, investment.targetLevel)
          targetLevel = baseTargetLevel + mindscapeBonus
          targetType = 'soda_derived'
          recommended =
            investment.targetLevel < 7
              ? `可保持 ${targetLevel}`
              : investment.label.replace(/\d+/u, String(targetLevel))
          sodaDerived = {
            band: investment.band,
            targetLevel,
            baseTargetLevel,
            label: recommended,
          }
        } else {
          baseTargetLevel = 7
          targetLevel = 7 + mindscapeBonus
          targetType = 'soda_derived'
          sodaDerived = {
            band: 'baseline',
            targetLevel,
            baseTargetLevel,
            label: String(targetLevel),
          }
          recommended = String(targetLevel)
        }
      }

      const nextLevelEvidence = context?.skillLevels
        ? evaluateSkillInvestmentNextLevel({
            agentId,
            skill: key,
            currentLevel: context.skillLevels[key],
            targetLevel,
            effectiveLevelBonus: key === 'core' ? 0 : knownMindscapeBonus,
          })
        : null
      const nextLevel = nextLevelEvidence ? projectSkillNextLevelDisplay(nextLevelEvidence) : null

      return {
        key,
        label,
        targetLevel,
        baseTargetLevel,
        recommended,
        priority: primaryPriority.includes(key),
        targetType,
        exactTarget,
        minimumReference,
        sodaDerived,
        nextLevel,
      }
    },
  )
  return { targets, priority, skills }
}
