import type { RosterAgent } from '../assault/types'
import { skillMaximumTargetsFromDirections } from './agentDevelopmentSkillPriority'
import { getRemielleSkillGuidanceCandidate } from '../gameDataPacks/remielleGuidanceCandidate'
import { reviewedGuideSkillDirections } from '../gameDataPacks/reviewedGuideSkillDirections'
import type { ReviewedDevelopmentSkillTargetSupplement } from '../gameDataPacks/reviewedDevelopmentSkillOrders33'
import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import {
  fieldTimeIndependentSkillInvestment,
  skillInvestmentPolicy,
} from '../calculation/skillInvestmentPolicy'
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
  primaryPriority?: readonly string[]
  priorityGroups?: readonly (readonly (keyof typeof skillLabels)[])[]
  reviewedTargetSupplements?: readonly ReviewedDevelopmentSkillTargetSupplement[]
  utilityOnlyCombat?: boolean
}

export type AgentSkillRecommendationItem = {
  key: keyof typeof skillLabels
  label: string
  targetLevel: number | null
  baseTargetLevel?: number | null
  targetBasis?: 'paid_base_maximum'
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
  const declaredMaximums = skillMaximumTargetsFromDirections(directions)
  const appliedSupplements = new Map<
    keyof typeof skillLabels,
    ReviewedDevelopmentSkillTargetSupplement
  >()
  for (const supplement of context?.reviewedTargetSupplements ?? []) {
    const existing = targets[supplement.skill]
    // A supplement is a field selection, not a takeHigher rule. A different
    // explicit target must survive until it has its own source decision.
    if (existing && !supplement.replaces?.includes(existing)) continue
    if (declaredMaximums.has(supplement.skill)) continue
    appliedSupplements.set(supplement.skill, supplement)
    if (supplement.kind === 'paid_maximum') {
      targets[supplement.skill] = supplement.skill === 'core' ? 'F' : '12'
      declaredMaximums.add(supplement.skill)
    } else {
      targets[supplement.skill] = `${supplement.level}+`
    }
  }
  const knownMindscapeBonus = resolveSkillInvestmentMindscapeBonus(context?.mindscape ?? null)
  const mindscapeBonus = knownMindscapeBonus ?? 0
  const priority = (
    remielle?.primaryPriority ??
    context?.priorityGroups?.flat() ??
    skillPriorityWithLegacyFallback(directions, legacyPriority)
  ).filter((key): key is keyof typeof skillLabels => key in skillLabels)
  const primaryPriority =
    remielle?.primaryPriority ??
    context?.primaryPriority ??
    skillPrimaryPriorityWithLegacyFallback(directions, legacyPriority)
  const contract = getCurrentAgentEventContract(agentId)
  const scalable = new Set(contract?.eventContract.events.map((event) => event.skill) ?? [])
  // Core has its own 1–7 progression. It must not consume a combat-skill
  // budget slot just because an aggregator prepends it to a five-skill list.
  const combatPriority = priority.filter((key) => key !== 'core')
  const skills: AgentSkillRecommendationItem[] = Object.entries(skillLabels).map(
    ([rawKey, label]) => {
      const key = rawKey as keyof typeof skillLabels
      const index = key === 'core' ? -1 : combatPriority.indexOf(key)
      // Every member of a declared tier uses the tier's first ordinal slot.
      // This retains existing budget thresholds while never splitting a tie.
      const group = context?.priorityGroups?.find((tier) => tier.includes(key))
      const firstCombatInGroup = group?.find((skill) => skill !== 'core')
      const groupIndex = firstCombatInGroup ? combatPriority.indexOf(firstCombatInGroup) : -1
      const primaryIndex = primaryPriority.includes(key)
        ? Math.min(
            ...primaryPriority
              .map((item) => combatPriority.findIndex((skill) => skill === item))
              .filter((i) => i >= 0),
          )
        : -1
      const budgetIndex =
        groupIndex >= 0
          ? groupIndex
          : primaryIndex >= 0 && Number.isFinite(primaryIndex)
            ? primaryIndex
            : index >= 0
              ? index
              : null
      const investment = fieldTimeIndependentSkillInvestment({
        skill: key,
        // The existing reference bands reserve slot zero for core. Apply a
        // consistent combat offset even when the source omits/reorders core.
        priorityIndex:
          key === 'core'
            ? priority.length
              ? 0
              : null
            : budgetIndex === null
              ? null
              : budgetIndex + 1,
        explicitPrimary: remielle?.primaryPriority.includes(key) ?? false,
        explicitSupplemental:
          (remielle?.supplementalSkills.includes(key) ?? false) ||
          // Independent guides identify these ordinary levels as Daze/utility,
          // not growth of the defining buff or anomaly multiplier. Reuse the
          // existing supplemental band instead of inferring a paid maximum.
          (Boolean(context?.utilityOnlyCombat) && key !== 'core' && budgetIndex === 0),
        hasScalableMechanic: key === 'core' ? Boolean(contract) : scalable.has(key),
      })
      const explicit = targets[key]
      const reviewedExplicit = skillTargetsFromDirections(
        reviewedGuideSkillDirections[agentId]?.directions ?? [],
      )[key]
      const lowInvestment = remielle?.lowInvestmentSkills.includes(key) ?? false

      let targetLevel: number | null
      let baseTargetLevel: number | null = null
      let targetBasis: 'paid_base_maximum' | undefined
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
        const isCoreF =
          explicit === 'F' || explicit === '7' || remielle?.explicitTargets.core === 'F'
        const isCoreFMin =
          explicit === 'F+' || explicit === '7+' || explicit === '≥F' || explicit === '≥7'
        if (isCoreF) {
          targetLevel = 7
          targetType = 'exact_integer'
          exactTarget = 7
          baseTargetLevel = 7
          recommended = explicit ?? 'F'
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
        } else if (priority.length) {
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
          // No source order or numeric target is not permission to invent 7.
          targetLevel = null
          targetType = 'soda_derived'
          recommended = ''
        }
      } else {
        // 战斗技能：既有用户最低等级合同 Math.max(7, sourcedTargetLevel ?? 7)
        const isMinimum = Boolean(
          explicit &&
          (explicit.includes('+') || explicit.startsWith('≥') || explicit.startsWith('>=')),
        )
        const sourceLevelBasis = appliedSupplements.has(key)
          ? undefined
          : reviewedGuideSkillDirections[agentId]?.authorTargets?.combatSourceLevelBasis
        const sourceLevelBasisUnknown =
          isMinimum && sourceLevelBasis !== 'paid_base' && sourceLevelBasis !== 'effective'
        if (
          remielle?.explicitTargets.combatMaximumSkills.includes(key) ||
          declaredMaximums.has(key)
        ) {
          // "升满" targets the paid cap, not effective Lv.12 at every cinema.
          baseTargetLevel = skillInvestmentPolicy.combatSkillCap
          targetLevel = knownMindscapeBonus === null ? null : baseTargetLevel + knownMindscapeBonus
          targetBasis = 'paid_base_maximum'
          targetType = 'exact_integer'
          exactTarget = targetLevel
          recommended = targetLevel === null ? '升满' : String(targetLevel)
        } else if (isMinimum && explicit && sourceLevelBasisUnknown) {
          const raw = explicit.replace('+', '').replace('≥', '').replace('>=', '').trim()
          const parsed = Number(raw)
          const reference = Number.isNaN(parsed) ? 7 : parsed
          // The archived image does not say whether 11+/9+ means paid or
          // effective levels. Display the source floor, but do not infer a
          // paid target or claim the current effective level has reached it.
          targetLevel = null
          baseTargetLevel = null
          targetType = 'minimum_reference'
          minimumReference = reference
          recommended = explicit
        } else if (isMinimum && explicit) {
          const raw = explicit.replace('+', '').replace('≥', '').replace('>=', '').trim()
          const parsed = Number(raw)
          const validNum = Number.isNaN(parsed) ? 7 : parsed
          baseTargetLevel = sourceLevelBasis === 'paid_base' ? Math.max(7, validNum) : null
          targetLevel =
            sourceLevelBasis === 'paid_base'
              ? knownMindscapeBonus === null
                ? null
                : baseTargetLevel! + knownMindscapeBonus
              : Math.max(7, validNum)
          if (sourceLevelBasis === 'effective')
            baseTargetLevel =
              knownMindscapeBonus === null ? null : Math.max(1, targetLevel! - mindscapeBonus)
          targetType = 'minimum_reference'
          minimumReference = validNum
          recommended = explicit
        } else if (
          explicit &&
          explicit === reviewedExplicit &&
          sourceLevelBasis !== 'paid_base' &&
          sourceLevelBasis !== 'effective'
        ) {
          // A numeric image label can still omit whether cinema is included.
          targetLevel = null
          targetType = 'exact_integer'
          recommended = explicit
        } else if (explicit) {
          const raw = explicit.trim()
          const parsed = Number(raw)
          const validNum = Number.isNaN(parsed) ? 7 : parsed
          baseTargetLevel = sourceLevelBasis === 'paid_base' ? Math.max(7, validNum) : null
          targetLevel =
            sourceLevelBasis === 'paid_base'
              ? knownMindscapeBonus === null
                ? null
                : baseTargetLevel! + knownMindscapeBonus
              : Math.max(7, validNum)
          if (sourceLevelBasis !== 'paid_base')
            baseTargetLevel =
              knownMindscapeBonus === null || targetLevel === null
                ? null
                : Math.max(1, targetLevel - mindscapeBonus)
          targetType = 'exact_integer'
          exactTarget = targetLevel
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
          targetLevel = null
          targetType = 'soda_derived'
          recommended = ''
        }
      }

      // Derived combat budgets are paid levels. Without cinema the displayed
      // effective target and any comparison against it remain unknown.
      if (key !== 'core' && targetType === 'soda_derived' && knownMindscapeBonus === null) {
        targetLevel = null
      }

      const nextLevelEvidence =
        context?.skillLevels || targetLevel === null
          ? evaluateSkillInvestmentNextLevel({
              agentId,
              skill: key,
              currentLevel: context?.skillLevels?.[key] ?? null,
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
        ...(targetBasis ? { targetBasis } : {}),
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
  // Do not turn a partial prose priority into a complete tier ordering.
  const priorityGroups = remielle
    ? [remielle.primaryPriority]
    : (context?.priorityGroups ?? (primaryPriority.length ? [primaryPriority] : []))
  return { targets, priority, priorityGroups, skills }
}
