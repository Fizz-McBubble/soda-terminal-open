import type { RosterAgent } from '../assault/types'
import {
  getCurrentBuildProfile,
  getBuildRecommendation,
  getSelectedBuildBranchId,
} from '../assault/currentBuildProfiles'
import { evaluateSkillInvestmentNextLevel } from '../calculation/skillInvestmentNextLevel'
import {
  projectSkillNextLevelDisplay,
  resolveSkillInvestmentMindscapeBonus,
} from '../decision/skillInvestmentProjection'
import { getCurrentBuildAuthorityProfile } from '../gameDataPacks/currentBuildAuthority'
import { getProjectedBuildKnowledgeProfile } from '../gameDataPacks/agentProfile'
import { getCandidateWarehouseConstraint } from '../gameDataPacks/candidateWarehouseConstraints'
import { reviewedGuideSkillTargets20261014 } from '../gameDataPacks/reviewedGuideSkillTargets20261014'
import { reviewedGuideSkillDirections } from '../gameDataPacks/reviewedGuideSkillDirections'
import {
  getReviewedDevelopmentSkillOrder33,
  getReviewedDevelopmentSkillGroups33,
  getReviewedDevelopmentSkillTargetSupplements33,
} from '../gameDataPacks/reviewedDevelopmentSkillOrders33'
import { currentVersionProjection } from '../gameDataPacks/currentVersionProjection'
import { agentDevelopmentSkillRecommendations } from '../pages/agentDevelopmentSkillRecommendations'
import { skillLabels, skillTargetsFromDirections } from '../pages/agentDevelopmentSkillPriority'

type StructuredSkillPriority = {
  ordered?: unknown
  groups?: unknown
  globalOrderClaimed?: unknown
  remaining?: unknown
}

const explicitPreferredGroupRemaining = new Set([
  'explicit_core_priority_only',
  'explicit_first_tier_only',
  'four_skill_max_group_not_ranked',
])

const isSkillKey = (key: unknown): key is keyof typeof skillLabels =>
  typeof key === 'string' && Object.hasOwn(skillLabels, key)

function validSkillGroup(value: unknown): value is Array<keyof typeof skillLabels> {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(isSkillKey) &&
    new Set(value).size === value.length
  )
}

export function projectStructuredSkillPriorityGroups(
  structured: StructuredSkillPriority | undefined,
) {
  const ordered =
    Array.isArray(structured?.ordered) &&
    structured.ordered.length > 0 &&
    structured.ordered.every(isSkillKey) &&
    new Set(structured.ordered).size === structured.ordered.length
      ? (structured.ordered as Array<keyof typeof skillLabels>)
      : undefined
  const groups =
    Array.isArray(structured?.groups) &&
    structured.groups.length > 0 &&
    structured.groups.every(validSkillGroup) &&
    new Set(structured.groups.flat()).size === structured.groups.flat().length
      ? (structured.groups as Array<Array<keyof typeof skillLabels>>)
      : undefined
  if (groups) return groups
  if (!ordered) return undefined
  if (
    typeof structured?.remaining === 'string' &&
    explicitPreferredGroupRemaining.has(structured.remaining)
  )
    return [ordered]
  if (structured?.globalOrderClaimed === true) return ordered.map((key) => [key])
  return undefined
}

/** The current source is appended last so its explicit targets win without discarding fallback-only skills. */
export function mergeSkillDirectionsForSourcePrecedence(
  currentDirections: readonly string[],
  fallbackDirections: readonly string[],
) {
  return [...fallbackDirections, ...currentDirections]
}

function reviewedCombatTarget(
  agentId: string,
  skill: keyof typeof skillLabels,
  minimumReference: number | null,
) {
  if (skill === 'core') return null
  const supplement = getReviewedDevelopmentSkillTargetSupplements33(
    agentId,
    currentVersionProjection.gameVersion,
  ).find((entry) => entry.skill === skill && entry.kind === 'image_floor')
  if (supplement?.kind === 'image_floor' && supplement.level === minimumReference)
    return { floor: supplement.level, basis: 'unspecified' as const }
  const source = reviewedGuideSkillDirections[agentId]
  const sourceBasis = source?.authorTargets?.combatSourceLevelBasis
  const directions = [
    ...(source?.directions ?? []),
    ...(reviewedGuideSkillTargets20261014.find((entry) => entry.agentId === agentId)?.directions ??
      []),
  ]
  const raw = skillTargetsFromDirections(directions)[skill]
  if (!raw) return null
  const floor = Number(raw.replace(/[^\d]/gu, ''))
  if (!Number.isInteger(floor) || floor < 1 || floor > 12) return null
  if (floor !== minimumReference && !(floor === 12 && raw === '12')) return null
  return {
    floor,
    basis:
      sourceBasis === 'paid_base' || sourceBasis === 'effective'
        ? sourceBasis
        : ('unspecified' as const),
  }
}

/** Project reviewed image floors without turning an omitted basis into a paid
 * base claim. Explicit paid-base evidence is transformed by observed cinema;
 * explicit or unspecified floors remain effective minimum targets. */
function materializeReviewedCombatFloorTargets(
  agentId: string,
  recommendation: ReturnType<typeof agentDevelopmentSkillRecommendations>,
  context?: {
    skillLevels?: RosterAgent['skillLevels']
    mindscape?: number | null
  },
) {
  const bonus = resolveSkillInvestmentMindscapeBonus(context?.mindscape ?? null)
  return {
    ...recommendation,
    skills: recommendation.skills.map((skill) => {
      // A selected image floor explicitly marked as unspecified has no
      // established paid/effective basis. Equal numbers from an older source
      // cannot supply that missing identity or turn the reference into a target.
      const selectedReceiptFloor = getReviewedDevelopmentSkillTargetSupplements33(
        agentId,
        currentVersionProjection.gameVersion,
      ).find(
        (entry) =>
          entry.skill === skill.key &&
          entry.kind === 'image_floor' &&
          entry.levelBasis === 'unspecified' &&
          entry.level === skill.minimumReference,
      )
      if (selectedReceiptFloor && skill.targetLevel === null) return skill
      const reviewed = reviewedCombatTarget(agentId, skill.key, skill.minimumReference)
      if (
        reviewed === null ||
        skill.targetBasis === 'paid_base_maximum' ||
        (skill.targetType !== 'minimum_reference' && skill.targetType !== 'exact_integer') ||
        (skill.targetType === 'exact_integer' &&
          skill.targetLevel === null &&
          reviewed.basis === 'unspecified') ||
        (skill.targetLevel !== null &&
          skill.targetLevel !== reviewed.floor &&
          !(
            reviewed.basis === 'paid_base' &&
            bonus !== null &&
            skill.targetLevel === reviewed.floor + bonus
          ))
      )
        return skill
      const targetLevel =
        reviewed.basis === 'paid_base'
          ? bonus === null
            ? null
            : reviewed.floor + bonus
          : reviewed.floor
      const baseTargetLevel =
        bonus === null
          ? null
          : reviewed.basis === 'paid_base'
            ? reviewed.floor
            : targetLevel !== null && targetLevel - bonus >= 1
              ? targetLevel - bonus
              : null
      const nextLevelEvidence =
        context?.skillLevels || targetLevel === null
          ? evaluateSkillInvestmentNextLevel({
              agentId,
              skill: skill.key,
              currentLevel: context?.skillLevels?.[skill.key] ?? null,
              targetLevel,
              effectiveLevelBonus: bonus,
            })
          : null
      return {
        ...skill,
        baseTargetLevel,
        targetLevel,
        recommended: targetLevel === null ? skill.recommended : String(targetLevel),
        exactTarget: skill.targetType === 'exact_integer' ? targetLevel : skill.exactTarget,
        nextLevel: nextLevelEvidence
          ? projectSkillNextLevelDisplay(nextLevelEvidence)
          : skill.nextLevel,
      }
    }),
  }
}

/** Directory, workbench and next action consume the same current source
 * directions, explicit skill targets and observed mindscape. */
export function developmentSkillRecommendations(
  agent: Pick<RosterAgent, 'agentId' | 'skillLevels' | 'lockedFields'> & {
    mindscape?: number | null
  },
) {
  const profile = getProjectedBuildKnowledgeProfile(agent.agentId)
  const legacy = getCurrentBuildProfile(agent.agentId)
  const branch = legacy
    ? getBuildRecommendation(legacy, getSelectedBuildBranchId(agent) ?? legacy.defaultBranchId)
    : null
  const current = getCurrentBuildAuthorityProfile(agent.agentId)?.guidance.fields.find(
    (field) => field.fieldId === 'progression.skill_core_cinema',
  )
  const value =
    current?.state === 'ready' && current.value && typeof current.value === 'object'
      ? (current.value as {
          sourceDirections?: unknown
          skillPriority?: StructuredSkillPriority
        })
      : null
  const directions = Array.isArray(value?.sourceDirections)
    ? value.sourceDirections.filter((item): item is string => typeof item === 'string')
    : []
  const profileDirections =
    profile.recommendation?.skillPriority ??
    getCandidateWarehouseConstraint(agent.agentId)?.progressionDirection ??
    []
  const validGroups =
    getReviewedDevelopmentSkillGroups33(agent.agentId, currentVersionProjection.gameVersion) ??
    projectStructuredSkillPriorityGroups(value?.skillPriority)
  const selectedPrimary = validGroups?.[0]
  const review = getReviewedDevelopmentSkillOrder33(
    agent.agentId,
    currentVersionProjection.gameVersion,
  )
  const recommendation = agentDevelopmentSkillRecommendations(
    agent.agentId,
    mergeSkillDirectionsForSourcePrecedence(directions, profileDirections),
    branch?.skillPriority ?? [],
    {
      skillLevels: agent.skillLevels,
      mindscape: agent.mindscape,
      primaryPriority: selectedPrimary,
      priorityGroups: validGroups,
      reviewedTargetSupplements: getReviewedDevelopmentSkillTargetSupplements33(
        agent.agentId,
        currentVersionProjection.gameVersion,
      ),
      utilityOnlyCombat: review?.utilityOnlyCombat,
    },
  )
  return materializeReviewedCombatFloorTargets(agent.agentId, recommendation, {
    skillLevels: agent.skillLevels,
    mindscape: agent.mindscape,
  })
}
