import type { TeamPortfolioPreference } from '../accounts/teamPortfolioPreference'

export const portfolioSelectionPolicy = 'authority-exact-reviewed-band-before-equipment-r2' as const

export type SourceBackedTeamCandidate = {
  templateId: string
  label: string
  coreAgentId: string
  members: Array<{
    agentId: string
    role: string
    requiredAgentId: string
    substitution: 'none' | 'whitelist'
    currentPlan: { status: 'available' | 'unavailable'; planId: string | null }
  }>
  bangbooId: string | null
  scenario: string | null
  formulaFamily: string | null
  source: { sourceIds: readonly string[]; evidenceLocator: string; sourceRevision: string }
  strength: {
    status: 'formal' | 'candidate' | 'limited' | 'missing'
    boundary: string
    band?: 'apex' | 'meta' | 'viable' | null
  }
}

export type ActiveMemberPlan = {
  planId: string | null
  discIds: readonly string[]
}

export type TeamPortfolioGap = {
  code: 'team_count' | 'fixed_preference' | 'missing_plan' | 'invalid_disc_count' | 'disc_conflict'
  detail: string
  agentIds?: string[]
  discIds?: string[]
}

export type CoordinatedTeam = {
  template: SourceBackedTeamCandidate
  planIdsByAgent: Record<string, string | null>
  discIds: string[]
  gaps: TeamPortfolioGap[]
  previewEligibleAgentIds: string[]
  buildStabilityCost: number
  usable: boolean
}

export type MultiTeamCoordination = {
  status: 'ready' | 'needs_completion'
  requestedTeamCount: number
  teams: CoordinatedTeam[]
  gaps: TeamPortfolioGap[]
  buildStabilityCost: number
  previewEligibleAgentIds: string[]
}

type CandidatePortfolio = {
  teams: CoordinatedTeam[]
  gaps: TeamPortfolioGap[]
  buildStabilityCost: number
  usableTeamCount: number
  weakestEvidence: number
  modeAdaptation: number
  templateKey: string
  strengthBands: number[]
}

const evidenceRank = { missing: 0, limited: 0, candidate: 1, formal: 2 } as const

function combinations<T>(items: readonly T[], size: number): T[][] {
  if (size === 0) return [[]]
  if (items.length < size) return []
  const result: T[][] = []
  items.forEach((item, index) => {
    for (const tail of combinations(items.slice(index + 1), size - 1)) result.push([item, ...tail])
  })
  return result
}

function unique(values: readonly string[]) {
  return [...new Set(values)]
}

function hasExactTeamShape(match: SourceBackedTeamCandidate) {
  return (
    match.members.length === 3 && new Set(match.members.map((member) => member.agentId)).size === 3
  )
}

function teamFromMatch(
  template: SourceBackedTeamCandidate,
  activePlansByAgent: Readonly<Record<string, ActiveMemberPlan | undefined>>,
): CoordinatedTeam {
  const gaps: TeamPortfolioGap[] = []
  const planIdsByAgent: Record<string, string | null> = {}
  const discIds: string[] = []
  const previewEligibleAgentIds: string[] = []
  for (const member of template.members) {
    const plan = activePlansByAgent[member.agentId]
    planIdsByAgent[member.agentId] = plan?.planId ?? null
    if (!plan) {
      gaps.push({
        code: 'missing_plan',
        agentIds: [member.agentId],
        detail: `${member.agentId} 尚无可继承的六盘方案。`,
      })
      previewEligibleAgentIds.push(member.agentId)
      continue
    }
    if (plan.discIds.length !== 6 || unique(plan.discIds).length !== 6) {
      gaps.push({
        code: 'invalid_disc_count',
        agentIds: [member.agentId],
        discIds: [...plan.discIds],
        detail: `${member.agentId} 的当前方案不是六张不同实体盘。`,
      })
      previewEligibleAgentIds.push(member.agentId)
      continue
    }
    discIds.push(...plan.discIds)
  }
  return {
    template,
    planIdsByAgent,
    discIds,
    gaps,
    previewEligibleAgentIds,
    buildStabilityCost: gaps.length,
    usable: gaps.length === 0,
  }
}

function comparePortfolios(left: CandidatePortfolio, right: CandidatePortfolio) {
  // Preserve the existing coarse strength order before considering owned equipment.
  // Compare bands, not a synthetic damage score or summed team power.
  for (let index = 0; index < left.strengthBands.length; index += 1) {
    const difference = right.strengthBands[index] - left.strengthBands[index]
    if (difference) return difference
  }
  return (
    right.usableTeamCount - left.usableTeamCount ||
    right.weakestEvidence - left.weakestEvidence ||
    right.modeAdaptation - left.modeAdaptation ||
    left.buildStabilityCost - right.buildStabilityCost ||
    left.templateKey.localeCompare(right.templateKey)
  )
}

/**
 * Coordinates only source-backed candidates supplied by the decision boundary. It never creates a
 * free three-agent team, produces a recommendation, or rewrites plans.
 */
export function coordinateMatchedTeams(input: {
  matches: readonly SourceBackedTeamCandidate[]
  preference: TeamPortfolioPreference
  activePlansByAgent: Readonly<Record<string, ActiveMemberPlan | undefined>>
  /**
   * A team the player has already chosen for this portfolio journey. Locked teams remain first;
   * all following slots are coordinated from the remaining mutually exclusive BOX.
   */
  lockedTemplateIds?: readonly string[]
}): MultiTeamCoordination {
  const { preference } = input
  const validMatches = input.matches.filter(hasExactTeamShape)
  const lockedTemplateIds = [...new Set(input.lockedTemplateIds ?? [])]
  const lockedMatches = lockedTemplateIds
    .map((templateId) => validMatches.find((match) => match.templateId === templateId))
    .filter((match): match is SourceBackedTeamCandidate => Boolean(match))
  if (
    lockedMatches.length !== lockedTemplateIds.length ||
    lockedMatches.length > preference.teamCount
  ) {
    return {
      status: 'needs_completion',
      requestedTeamCount: preference.teamCount,
      teams: [],
      gaps: [
        {
          code: 'fixed_preference',
          detail: '已锁定的队伍不再满足当前 BOX 条件；请返回队伍列表重新选择。',
        },
      ],
      buildStabilityCost: 0,
      previewEligibleAgentIds: [],
    }
  }
  const lockedIds = new Set(lockedTemplateIds)
  const candidates = combinations(
    validMatches.filter((match) => !lockedIds.has(match.templateId)),
    preference.teamCount - lockedMatches.length,
  )
    .map((matches) => [...lockedMatches, ...matches])
    .filter((matches) => {
      const members = matches.flatMap((match) => match.members.map((member) => member.agentId))
      const bangboos = matches.flatMap((match) => (match.bangbooId ? [match.bangbooId] : []))
      const templateIds = matches.map((match) => match.templateId)
      return (
        new Set(members).size === members.length &&
        preference.templateIds.every((id) => templateIds.includes(id)) &&
        preference.fixedAgentIds.every((id) => members.includes(id)) &&
        preference.fixedBangbooIds.every((id) => bangboos.includes(id))
      )
    })

  if (!candidates.length) {
    const detail =
      validMatches.length < preference.teamCount
        ? `当前仅有 ${validMatches.length} 支机制闭环方案，无法组成 ${preference.teamCount} 支互斥完整队。`
        : '固定成员、邦布或模板偏好无法同时满足互斥完整队。'
    return {
      status: 'needs_completion',
      requestedTeamCount: preference.teamCount,
      teams: [],
      gaps: [
        {
          code: validMatches.length < preference.teamCount ? 'team_count' : 'fixed_preference',
          detail,
        },
      ],
      buildStabilityCost: 0,
      previewEligibleAgentIds: [],
    }
  }

  const portfolios = candidates.map((matches): CandidatePortfolio => {
    const teams = matches.map((match) => teamFromMatch(match, input.activePlansByAgent))
    const allDiscIds = teams.flatMap((team) => team.discIds)
    const duplicatedDiscIds = unique(
      allDiscIds.filter((id, index) => allDiscIds.indexOf(id) !== index),
    )
    const conflictGap = duplicatedDiscIds.length
      ? [
          {
            code: 'disc_conflict' as const,
            discIds: duplicatedDiscIds,
            detail: `当前激活方案复用了实体盘：${duplicatedDiscIds.join('、')}。`,
          },
        ]
      : []
    const withConflict = teams.map((team) => ({
      ...team,
      gaps: [...team.gaps, ...conflictGap],
      buildStabilityCost: team.buildStabilityCost + conflictGap.length,
      usable: team.usable && conflictGap.length === 0,
    }))
    return {
      teams: withConflict,
      strengthBands: matches
        .map((match) =>
          match.strength.band ? { apex: 3, meta: 2, viable: 1 }[match.strength.band] : 0,
        )
        .sort((left, right) => right - left),
      gaps: conflictGap,
      buildStabilityCost: withConflict.reduce((total, team) => total + team.buildStabilityCost, 0),
      usableTeamCount: withConflict.filter((team) => team.usable).length,
      weakestEvidence: Math.min(...matches.map((match) => evidenceRank[match.strength.status])),
      modeAdaptation: matches.filter(
        (match) =>
          match.strength.status === 'candidate' && Boolean(match.scenario && match.formulaFamily),
      ).length,
      templateKey: matches
        .map((match) => match.templateId)
        .sort()
        .join(':'),
    }
  })
  const selected = portfolios.sort(comparePortfolios)[0]!
  return {
    status: selected.usableTeamCount === preference.teamCount ? 'ready' : 'needs_completion',
    requestedTeamCount: preference.teamCount,
    teams: selected.teams,
    gaps: [...selected.gaps, ...selected.teams.flatMap((team) => team.gaps)],
    buildStabilityCost: selected.buildStabilityCost,
    previewEligibleAgentIds: unique(selected.teams.flatMap((team) => team.previewEligibleAgentIds)),
  }
}
