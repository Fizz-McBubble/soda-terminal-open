import { getMindscapeSkillLevelBonus } from '../accounts/agentProgressionRules'

type SkillTargetLike = {
  label: string
  targetLevel?: number | null
  baseTargetLevel?: number | null
  targetBasis?: 'paid_base_maximum'
  recommended?: string
  targetType?: 'exact_integer' | 'minimum_reference' | 'soda_derived'
  exactTarget?: number | null
  minimumReference?: number | null
  sodaDerived?: {
    band: string
    targetLevel: number
    baseTargetLevel?: number
    label: string
  } | null
  priority: boolean
  nextLevel?: { status: string; tooltip: string } | null
}

type PotentialSkillReference = {
  skills?: Array<{ label: string; recommended: string }>
  skillDirections?: readonly string[]
  priorityGroups?: readonly (readonly string[])[]
}

const potentialSkillLabelAliases: Record<string, string> = {
  普攻: '普攻',
  普通攻击: '普攻',
  闪避: '闪避',
  支援: '支援',
  支援技: '支援',
  特殊: '特殊',
  特殊技: '特殊',
  连携: '连携',
  连携技: '连携',
  终结技: '连携',
  核心: '核心技',
  核心技: '核心技',
}

function nonExecutableFallback<T extends SkillTargetLike>(skill: T): T {
  return {
    ...skill,
    recommended: '',
    targetLevel: null,
    baseTargetLevel: null,
    targetBasis: undefined,
    targetType: undefined,
    exactTarget: null,
    minimumReference: null,
    sodaDerived: null,
    nextLevel: null,
  } as T
}

function projectPotentialSkillTarget<T extends SkillTargetLike>(
  skill: T,
  recommended: string,
  mindscape: number | null | undefined,
): T {
  const normalized = recommended.trim()
  const isCore = (potentialSkillLabelAliases[skill.label] ?? skill.label) === '核心技'
  if (isCore && /^(?:≥|>=)?(?:F|MAX)\+?$/iu.test(normalized)) {
    const minimum = /^(?:≥|>=)|\+$/u.test(normalized)
    return {
      ...skill,
      recommended: '7',
      targetLevel: 7,
      baseTargetLevel: 7,
      targetBasis: undefined,
      targetType: minimum ? 'minimum_reference' : 'exact_integer',
      exactTarget: minimum ? null : 7,
      minimumReference: minimum ? 7 : null,
      sodaDerived: null,
      nextLevel: null,
    } as T
  }

  const level = normalized.match(/^((?:≥|>=)?)\s*(\d{1,2})(\+?)$/u)
  if (!level) return nonExecutableFallback(skill)
  const targetLevel = Number(level[2])
  if (!Number.isInteger(targetLevel) || targetLevel < 1 || targetLevel > (isCore ? 7 : 16)) {
    return nonExecutableFallback(skill)
  }
  const sourceUsesMinimum = Boolean(level[1]) || level[3] === '+'
  const bonus =
    mindscape != null && Number.isInteger(mindscape) && mindscape >= 0 && mindscape <= 6
      ? getMindscapeSkillLevelBonus('basic', mindscape)
      : null
  return {
    ...skill,
    recommended: String(targetLevel),
    targetLevel,
    targetBasis: undefined,
    baseTargetLevel: isCore
      ? targetLevel
      : bonus !== null && targetLevel > bonus
        ? targetLevel - bonus
        : null,
    targetType: sourceUsesMinimum ? 'minimum_reference' : 'exact_integer',
    exactTarget: sourceUsesMinimum ? null : targetLevel,
    minimumReference: sourceUsesMinimum ? targetLevel : null,
    sodaDerived: null,
    nextLevel: null,
  } as T
}

/** P6 selects the reviewed potential-conditioned target set. Numeric source
 * floors are executable effective minimums; unsupported labels stay unknown. */
export function selectDevelopmentSkillTargets<T extends SkillTargetLike>({
  potential,
  skills,
  potentialReference,
  mindscape,
  priorityGroups = [],
}: {
  potential: number | null | undefined
  skills: T[]
  potentialReference?: PotentialSkillReference | null
  mindscape?: number | null
  priorityGroups?: readonly (readonly string[])[]
}): {
  skills: T[]
  priorityGroups: string[][]
} {
  if (potential !== 6 || !potentialReference)
    return { skills, priorityGroups: priorityGroups.map((group) => [...group]) }

  // A P6 numeric reference does not inherit an ordinary-play investment order.
  const selectedGroups = potentialReference.priorityGroups?.map((group) => [...group]) ?? []

  const sourceSkills =
    potentialReference.skills ??
    potentialReference.skillDirections?.flatMap((direction) => {
      const match =
        /^(普通攻击|普攻|闪避|支援技|支援|特殊技|特殊|终结技|连携技|连携|核心技)\s+(.+)$/u.exec(
          direction.trim(),
        )
      return match ? [{ label: match[1]!, recommended: match[2]! }] : []
    }) ??
    []
  const sourceByLabel = new Map(
    sourceSkills.map((skill) => [
      potentialSkillLabelAliases[skill.label] ?? skill.label,
      skill.recommended.trim(),
    ]),
  )
  return {
    skills: skills.map((skill) => {
      const recommended = sourceByLabel.get(potentialSkillLabelAliases[skill.label] ?? skill.label)
      const priority = (selectedGroups[0] ?? []).some(
        (label) =>
          (potentialSkillLabelAliases[label] ?? label) ===
          (potentialSkillLabelAliases[skill.label] ?? skill.label),
      )
      const selected = { ...skill, priority }
      if (!recommended) return nonExecutableFallback(selected)
      return projectPotentialSkillTarget(selected, recommended, mindscape)
    }),
    priorityGroups: selectedGroups,
  }
}
