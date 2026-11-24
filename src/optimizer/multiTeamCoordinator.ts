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

function* disjointPortfolios(
  matches: readonly SourceBackedTeamCandidate[],
  locked: readonly SourceBackedTeamCandidate[],
  teamCount: number,
) {
  const selected = [...locked]
  if (!Number.isSafeInteger(teamCount) || teamCount < locked.length) return
  const lockedMembers = locked.flatMap((match) => match.members.map((member) => member.agentId))
  const occupied = new Set(lockedMembers)
  if (occupied.size !== lockedMembers.length) return

  function* visit(start: number): Generator<SourceBackedTeamCandidate[]> {
    const remaining = teamCount - selected.length
    if (remaining === 0) {
      yield [...selected]
      return
    }
    for (let index = start; index <= matches.length - remaining; index += 1) {
      const match = matches[index]
      if (match.members.some((member) => occupied.has(member.agentId))) continue
      for (const member of match.members) occupied.add(member.agentId)
      selected.push(match)
      yield* visit(index + 1)
      selected.pop()
      for (const member of match.members) occupied.delete(member.agentId)
    }
  }

  yield* visit(0)
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

function compareStrengthBands(left: readonly number[], right: readonly number[]) {
  // Preserve the existing coarse strength order before considering owned equipment.
  // Compare bands, not a synthetic damage score or summed team power.
  for (let index = 0; index < left.length; index += 1) {
    const difference = right[index] - left[index]
    if (difference) return difference
  }
  return 0
}

function comparePortfolioTies(left: CandidatePortfolio, right: CandidatePortfolio) {
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
  const candidates = disjointPortfolios(
    validMatches.filter((match) => !lockedIds.has(match.templateId)),
    lockedMatches,
    preference.teamCount,
  )
  const teamCache = new Map<SourceBackedTeamCandidate, CoordinatedTeam>()
  let selected: CandidatePortfolio | undefined
  for (const matches of candidates) {
    if (
      !preference.templateIds.every((id) => matches.some((match) => match.templateId === id)) ||
      !preference.fixedAgentIds.every((id) =>
        matches.some((match) => match.members.some((member) => member.agentId === id)),
      ) ||
      !preference.fixedBangbooIds.every((id) =>
        matches.some((match) => match.bangbooId && match.bangbooId === id),
      )
    )
      continue

    const strengthBands = matches
      .map((match) =>
        match.strength.band ? { apex: 3, meta: 2, viable: 1 }[match.strength.band] : 0,
      )
      .sort((left, right) => right - left)
    const bandOrder = selected ? compareStrengthBands(strengthBands, selected.strengthBands) : -1
    if (bandOrder > 0) continue
    const teams = matches.map((match) => {
      let team = teamCache.get(match)
      if (!team) {
        team = teamFromMatch(match, input.activePlansByAgent)
        teamCache.set(match, team)
      }
      return team
    })
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
    const portfolio: CandidatePortfolio = {
      teams: withConflict,
      strengthBands,
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
    if (!selected || bandOrder < 0 || comparePortfolioTies(portfolio, selected) < 0)
      selected = portfolio
  }

  if (!selected) {
    const insufficient = validMatches.length < preference.teamCount
    return {
      status: 'needs_completion',
      requestedTeamCount: preference.teamCount,
      teams: [],
      gaps: [
        {
          code: insufficient ? 'team_count' : 'fixed_preference',
          detail: insufficient
            ? `当前仅有 ${validMatches.length} 支机制闭环方案，无法组成 ${preference.teamCount} 支互斥完整队。`
            : '固定成员、邦布或模板偏好无法同时满足互斥完整队。',
        },
      ],
      buildStabilityCost: 0,
      previewEligibleAgentIds: [],
    }
  }
  return {
    status: selected.usableTeamCount === preference.teamCount ? 'ready' : 'needs_completion',
    requestedTeamCount: preference.teamCount,
    teams: selected.teams,
    gaps: [...selected.gaps, ...selected.teams.flatMap((team) => team.gaps)],
    buildStabilityCost: selected.buildStabilityCost,
    previewEligibleAgentIds: unique(selected.teams.flatMap((team) => team.previewEligibleAgentIds)),
  }
}
